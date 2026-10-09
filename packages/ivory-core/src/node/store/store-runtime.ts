// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { canonicalJson, IvoryContractError, Sha256Digest } from '@ivory/contracts';
import { canonicalDigest } from '@ivory/contracts/lib/node';
import type { DatabaseSync } from 'node:sqlite';
import { ProjectManifest } from '../../common/project-manifest';
import {
    CommitOutcome, CommitReceipt, GcResult, RecoveryReport, StoreProtocol, StoreRefusal, StoreRefusalInfo, StoreWorkerData, VerifyChainResult
} from '../../common/store-protocol';
import { ProjectLayout, readManifest } from '../project-layout';
import { admitBlob, collectGarbage, readReferencedBlob } from './cas';
import { applyCommit, CommitContext, ParsedCommit, readHead, readHeadSeq, readReceipt } from './commit-log';
import { CommitHandler, loadCommitHandlers } from './commit-handler';
import { configureFailpoint, failpoint } from './qualification/failpoint';
import { recoverStore } from './recovery';
import { assertStoreMatches, ensureSchema, openReadConnection, openWriteConnection } from './store-schema';
import { verifyChain } from './verify-chain';
import { runImmediateTransaction, WriteQueue } from './write-queue';

/** A refusal in place of a result, for the operations that are not a commit. */
export interface RefusedOperation {
    readonly refusal: StoreRefusalInfo;
}

/**
 * Everything the store worker owns: the write connection, the read connection, the write queue and the handlers.
 * Reads use the read connection only, so they never see the uncommitted work of the write connection or of another process.
 */
export class StoreRuntime {

    static async open(data: StoreWorkerData, onAdvanced: (seq: number) => void): Promise<{ runtime: StoreRuntime; recovery: RecoveryReport }> {
        configureFailpoint(data.qualification?.failpoint);
        const handlers = loadCommitHandlers(data.handlerModules);
        const manifest = await readManifest(data.projectDir);
        const layout = ProjectLayout.of(data.projectDir);
        let write: DatabaseSync | undefined;
        let read: DatabaseSync | undefined;
        try {
            let recovery: RecoveryReport = { swept: [], skippedAlive: [], malformed: [], deferred: [] };
            if (manifest.role === 'live' && !data.readOnly) {
                write = await openWriteConnection(layout.store, data.busyTimeoutMs, data.writerBusyBoundMs, data.qualification?.synchronous);
                await ensureSchema(write, manifest.projectId, data.writerBusyBoundMs);
                read = openReadConnection(layout.store, data.busyTimeoutMs);
                recovery = recoverStore(data.projectDir, data.processId);
            } else {
                read = openReadConnection(layout.store, data.busyTimeoutMs);
                assertStoreMatches(read, manifest.projectId);
            }
            const runtime = new StoreRuntime(data, manifest, layout, handlers, write, read, onAdvanced);
            runtime.startPolling();
            return { runtime, recovery };
        } catch (error) {
            read?.close();
            write?.close();
            throw error;
        }
    }

    protected readonly queue = new WriteQueue();
    protected lastSeq: number;
    protected pollTimer: NodeJS.Timeout | undefined;

    protected constructor(
        protected readonly data: StoreWorkerData,
        protected readonly manifest: ProjectManifest,
        protected readonly layout: ProjectLayout,
        protected readonly handlers: ReadonlyMap<string, CommitHandler>,
        protected readonly write: DatabaseSync | undefined,
        protected readonly read: DatabaseSync,
        protected readonly onAdvanced: (seq: number) => void
    ) {
        this.lastSeq = readHeadSeq(read);
    }

    protected get readOnly(): boolean {
        return this.write === undefined;
    }

    headSeq(): number {
        return readHeadSeq(this.read);
    }

    head(): CommitReceipt | undefined {
        return readHead(this.read);
    }

    receiptFor(principal: unknown, idempotencyKey: unknown): CommitReceipt | undefined {
        return typeof principal === 'string' && typeof idempotencyKey === 'string' ? readReceipt(this.read, principal, idempotencyKey) : undefined;
    }

    verifyChain(): VerifyChainResult {
        return verifyChain(this.read, this.manifest.projectId);
    }

    recover(): RecoveryReport | RefusedOperation {
        return this.write === undefined ? StoreRuntime.readOnlyRefusal() : recoverStore(this.data.projectDir, this.data.processId);
    }

    async commit(request: unknown): Promise<CommitOutcome> {
        const write = this.write;
        if (write === undefined) {
            return StoreRuntime.readOnlyRefusal();
        }
        const parsed = this.parseRequest(request);
        if ('refusal' in parsed) {
            return parsed;
        }
        const context: CommitContext = { db: write, layout: this.layout, projectId: this.manifest.projectId, libraryBuild: this.data.libraryBuild };
        return this.queue.enqueue(async () => {
            const result = await runImmediateTransaction(write, () => applyCommit(context, parsed.handler, parsed.commit, parsed.input), this.data.writerBusyBoundMs);
            if (result.busy) {
                return { refusal: { code: 'writer-busy', message: `another writer held the store for ${this.data.writerBusyBoundMs} ms` } };
            }
            const outcome = result.value;
            if (!CommitOutcome.isRefusal(outcome) && !outcome.replayed) {
                // After the acknowledgement, which the worker posts as soon as this job resolves.
                const seq = outcome.receipt.seq;
                setImmediate(() => this.advanced(seq));
                // The commit is durable here, and the acknowledgement is not sent yet.
                failpoint('afterDbCommit');
            }
            return outcome;
        });
    }

    admitBlob(bytes: Uint8Array, expectedDigest?: Sha256Digest): Promise<{ digest: Sha256Digest } | RefusedOperation> {
        if (this.readOnly) {
            return Promise.resolve(StoreRuntime.readOnlyRefusal());
        }
        return this.queue.enqueue(async () => ({ digest: await admitBlob({ layout: this.layout, processId: this.data.processId }, bytes, undefined, expectedDigest) }));
    }

    readBlob(digest: Sha256Digest): Promise<Uint8Array> {
        return readReferencedBlob(this.read, this.layout, digest);
    }

    gc(graceMs: number): Promise<GcResult | RefusedOperation> {
        const write = this.write;
        if (write === undefined) {
            return Promise.resolve(StoreRuntime.readOnlyRefusal());
        }
        return this.queue.enqueue(() => collectGarbage({
            layout: this.layout, processId: this.data.processId, db: write, writerBusyBoundMs: this.data.writerBusyBoundMs, graceMs
        }));
    }

    /** Runs after every queued job, then closes both connections. */
    close(): Promise<void> {
        return this.queue.enqueue(async () => {
            if (this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = undefined;
            }
            this.read.close();
            this.write?.close();
        });
    }

    protected static readOnlyRefusal(): RefusedOperation {
        return { refusal: { code: 'read-only-project', message: 'the project is not a live project, so the store is read-only' } };
    }

    /** The boundary parse. Nothing here touches the database. */
    protected parseRequest(request: unknown): { commit: ParsedCommit; handler: CommitHandler; input: unknown } | RefusedOperation {
        const { kind, input, principal, idempotencyKey } = (typeof request === 'object' && request ? request : {}) as Record<string, unknown>;
        const invalid = (message: string): RefusedOperation => ({ refusal: { code: 'invalid-input', message } });
        const handler = typeof kind === 'string' ? this.handlers.get(kind) : undefined;
        if (typeof kind !== 'string' || !handler) {
            return { refusal: { code: 'unknown-kind', message: `no commit handler is registered for ${JSON.stringify(kind)}` } };
        }
        if (!StoreProtocol.isIdentifier(principal)) {
            return invalid(`the principal must be a non-blank string of at most ${StoreProtocol.MAX_ID_LENGTH} characters`);
        }
        if (!StoreProtocol.isIdentifier(idempotencyKey)) {
            return invalid(`the idempotency key must be a non-blank string of at most ${StoreProtocol.MAX_ID_LENGTH} characters`);
        }
        let canonicalInput: string;
        try {
            canonicalInput = canonicalJson(input);
        } catch (error) {
            if (error instanceof IvoryContractError) {
                return { refusal: { code: 'invalid-input', message: error.message, contractCode: error.code } };
            }
            throw error;
        }
        if (Buffer.byteLength(canonicalInput, 'utf8') > this.data.maxInputBytes) {
            return { refusal: { code: 'input-too-large', message: `the input is larger than ${this.data.maxInputBytes} bytes`, maxInputBytes: this.data.maxInputBytes } };
        }
        let parsedInput: unknown;
        try {
            parsedInput = handler.parse(input);
        } catch (error) {
            return StoreRefusal.is(error) ? { refusal: error.toInfo() } : invalid(error instanceof Error ? error.message : String(error));
        }
        return {
            commit: { kind, principal, idempotencyKey, input, requestDigest: canonicalDigest({ kind, input }) },
            handler,
            input: parsedInput
        };
    }

    protected advanced(seq: number): void {
        if (seq > this.lastSeq) {
            this.lastSeq = seq;
            this.onAdvanced(seq);
        }
    }

    protected startPolling(): void {
        this.pollTimer = setInterval(() => {
            try {
                this.advanced(readHeadSeq(this.read));
            } catch {
                // A read that failed is tried again on the next tick.
            }
        }, this.data.pollIntervalMs);
    }
}
