// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { canonicalJson, IvoryContractError, IvoryContractErrorCode, Sha256Digest } from '@ivory/contracts';
import { readFileSync } from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { ProjectManifest } from '../common/project-manifest';
import {
    CommitOutcome, CommitReceipt, CommitRequest, GcResult, IvoryStoreError, IvoryStoreErrorCode, RecoveryReport, StoreErrorPayload, StoreProtocol,
    StoreOp, StoreQualificationOptions, StoreRefusalInfo, StoreRequest, StoreResponse, StoreWorkerData, StoreWorkerEvent, VerifyChainResult
} from '../common/store-protocol';
import { acquireLease, processId, ProcessLease } from './store/process-lease';
import { ProjectLayout, readManifest } from './project-layout';

export interface StoreDisposable {
    dispose(): void;
}

export interface OpenProjectStoreOptions {
    /** Recorded in the lease, so another host can see what holds a project. */
    readonly hostKind?: string;
    /** Absolute paths of compiled modules that export `commitHandlers`. The built-in handlers always load first. */
    readonly handlerModules?: readonly string[];
    /** How long a commit or GC batch waits for another writer before it is refused with `writer-busy`. Default 10 000. */
    readonly writerBusyBoundMs?: number;
    /** SQLite's own wait per attempt. Default 50. */
    readonly busyTimeoutMs?: number;
    /** How often the worker looks for commits of other processes. Default 250. */
    readonly pollIntervalMs?: number;
    /** The largest canonical input a commit accepts, in UTF-8 bytes. Default 256 KiB. */
    readonly maxInputBytes?: number;
    /** Recorded in every commit. Defaults to `@ivory/core@<version>`. */
    readonly libraryBuild?: string;
    /**
     * A failpoint that kills the host and the durability of the write connection, for the IV5-6 qualification harness.
     * Product hosts never set it.
     * @internal
     */
    readonly qualification?: StoreQualificationOptions;
}

/** An open project store. Every operation is a message to the store's worker thread. */
export interface ProjectStore {
    readonly manifest: ProjectManifest;
    /** The process id that names this host in leases and staging files. */
    readonly processId: string;
    /** What the sweep of dead leases found when the store opened. */
    readonly openRecovery: RecoveryReport;
    commit<O = unknown>(request: CommitRequest): Promise<CommitOutcome<O>>;
    /** Stores the bytes in the content-addressed store. Rejects with `cas-corrupt` when the name is taken by other bytes. */
    admitBlob(bytes: Uint8Array): Promise<Sha256Digest>;
    gc(options?: { readonly graceMs?: number }): Promise<GcResult>;
    /** The highest committed sequence number, read on the read connection. */
    headSeq(): Promise<number>;
    /** The last committed sequence number and its chain digest, read on the read connection, or `undefined` for an empty log. */
    head(): Promise<CommitReceipt | undefined>;
    /** The commit that this idempotency key produced, read on the read connection, or `undefined` when it committed nothing. */
    receiptFor(principal: string, idempotencyKey: string): Promise<CommitReceipt | undefined>;
    verifyChain(): Promise<VerifyChainResult>;
    recover(): Promise<RecoveryReport>;
    /** Called with the new head when commits land, from this store or another process. Only committed sequence numbers are reported. */
    onDidAdvance(listener: (seq: number) => void): StoreDisposable;
    close(): Promise<void>;
}

const openProjects = new Set<string>();
let cachedLibraryBuild: string | undefined;

/**
 * Opens the project's store: takes the process lease, starts the store worker and waits for it to recover and
 * serve. A live project is opened for writing, any other role read-only.
 */
export async function openProjectStore(projectDir: string, options: OpenProjectStoreOptions = {}): Promise<ProjectStore> {
    const layout = ProjectLayout.of(projectDir);
    const key = process.platform === 'win32' ? layout.projectDir.toLowerCase() : layout.projectDir;
    if (openProjects.has(key)) {
        throw new IvoryStoreError('already-open', `${layout.projectDir} is already open in this process`);
    }
    openProjects.add(key);
    let lease: ProcessLease | undefined;
    let worker: Worker | undefined;
    try {
        const manifest = await readManifest(layout.projectDir);
        const hostKind = options.hostKind ?? 'ivory-core';
        if (manifest.role === 'live') {
            lease = acquireLease(layout.projectDir, hostKind);
        }
        const data: StoreWorkerData = {
            projectDir: layout.projectDir,
            processId,
            hostKind,
            handlerModules: [...options.handlerModules ?? []],
            writerBusyBoundMs: options.writerBusyBoundMs ?? StoreProtocol.DEFAULT_WRITER_BUSY_BOUND_MS,
            busyTimeoutMs: options.busyTimeoutMs ?? StoreProtocol.DEFAULT_BUSY_TIMEOUT_MS,
            pollIntervalMs: options.pollIntervalMs ?? StoreProtocol.DEFAULT_POLL_INTERVAL_MS,
            maxInputBytes: options.maxInputBytes ?? StoreProtocol.DEFAULT_MAX_INPUT_BYTES,
            libraryBuild: options.libraryBuild ?? readLibraryBuild(),
            qualification: options.qualification
        };
        worker = new Worker(path.join(__dirname, 'store', 'store-worker-main.js'), { workerData: data });
        const store = new WorkerProjectStore(manifest, worker, lease, () => openProjects.delete(key));
        await store.ready;
        return store;
    } catch (error) {
        await worker?.terminate().catch(() => undefined);
        lease?.release();
        openProjects.delete(key);
        throw error;
    }
}

function readLibraryBuild(): string {
    if (cachedLibraryBuild === undefined) {
        const manifest = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as { version: string };
        cachedLibraryBuild = `@ivory/core@${manifest.version}`;
    }
    return cachedLibraryBuild;
}

interface PendingRequest {
    resolve(result: unknown): void;
    reject(error: Error): void;
}

class WorkerProjectStore implements ProjectStore {
    readonly ready: Promise<void>;
    readonly processId = processId;
    openRecovery: RecoveryReport = { swept: [], skippedAlive: [], malformed: [], deferred: [] };

    protected nextId = 1;
    protected readonly pending = new Map<number, PendingRequest>();
    protected readonly listeners = new Set<(seq: number) => void>();
    protected closing: Promise<void> | undefined;
    protected failure: Error | undefined;
    protected resolveReady!: () => void;
    protected rejectReady!: (error: Error) => void;

    constructor(
        readonly manifest: ProjectManifest,
        protected readonly worker: Worker,
        protected readonly lease: ProcessLease | undefined,
        protected readonly onClosed: () => void
    ) {
        this.ready = new Promise<void>((resolve, reject) => {
            this.resolveReady = resolve;
            this.rejectReady = reject;
        });
        worker.on('message', (message: StoreResponse | StoreWorkerEvent) => this.onMessage(message));
        worker.on('error', error => this.fail(new IvoryStoreError('worker-failed', `the store worker failed: ${error.message}`)));
        worker.on('exit', code => this.fail(new IvoryStoreError('worker-failed', `the store worker exited with code ${code}`)));
    }

    async commit<O = unknown>(request: CommitRequest): Promise<CommitOutcome<O>> {
        try {
            // Structured cloning would quietly turn a class instance into a plain object, so the input is checked here.
            canonicalJson(request.input);
        } catch (error) {
            if (error instanceof IvoryContractError) {
                return { refusal: { code: 'invalid-input', message: error.message, contractCode: error.code } };
            }
            throw error;
        }
        const { kind, input, principal, idempotencyKey } = request;
        return await this.request('commit', { request: { kind, input, principal, idempotencyKey } }) as CommitOutcome<O>;
    }

    async admitBlob(bytes: Uint8Array): Promise<Sha256Digest> {
        return this.unwrap(await this.request('admitBlob', { bytes }) as { digest: Sha256Digest } | { refusal: StoreRefusalInfo }).digest;
    }

    async gc(options: { readonly graceMs?: number } = {}): Promise<GcResult> {
        return this.unwrap(await this.request('gc', { graceMs: options.graceMs }) as GcResult | { refusal: StoreRefusalInfo });
    }

    async headSeq(): Promise<number> {
        return await this.request('headSeq', undefined) as number;
    }

    async head(): Promise<CommitReceipt | undefined> {
        return await this.request('head', undefined) as CommitReceipt | undefined;
    }

    async receiptFor(principal: string, idempotencyKey: string): Promise<CommitReceipt | undefined> {
        return await this.request('receiptFor', { principal, idempotencyKey }) as CommitReceipt | undefined;
    }

    async verifyChain(): Promise<VerifyChainResult> {
        return await this.request('verifyChain', undefined) as VerifyChainResult;
    }

    async recover(): Promise<RecoveryReport> {
        return this.unwrap(await this.request('recover', undefined) as RecoveryReport | { refusal: StoreRefusalInfo });
    }

    onDidAdvance(listener: (seq: number) => void): StoreDisposable {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
    }

    close(): Promise<void> {
        this.closing ??= this.shutDown();
        return this.closing;
    }

    protected async shutDown(): Promise<void> {
        try {
            if (!this.failure) {
                await this.send('close', undefined);
            }
        } catch {
            // The worker is going away either way.
        }
        this.failure ??= new IvoryStoreError('store-closed', 'the store is closed');
        await this.worker.terminate().catch(() => undefined);
        this.lease?.release();
        this.onClosed();
    }

    protected request(op: StoreOp, args: unknown): Promise<unknown> {
        if (this.closing || this.failure) {
            return Promise.reject(this.failure ?? new IvoryStoreError('store-closed', 'the store is closed'));
        }
        return this.send(op, args);
    }

    protected send(op: StoreOp, args: unknown): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const id = this.nextId++;
            this.pending.set(id, { resolve, reject });
            const request: StoreRequest = { id, op, args };
            try {
                this.worker.postMessage(request);
            } catch (error) {
                this.pending.delete(id);
                reject(error);
            }
        });
    }

    /** Refusals of the operations that are not commits reject with the refusal's code. */
    protected unwrap<T extends object>(result: T | { refusal: StoreRefusalInfo }): T {
        if ('refusal' in result) {
            throw new IvoryStoreError(result.refusal.code as IvoryStoreErrorCode, result.refusal.message);
        }
        return result;
    }

    protected onMessage(message: StoreResponse | StoreWorkerEvent): void {
        if ('type' in message) {
            switch (message.type) {
                case 'ready':
                    this.openRecovery = message.recovery;
                    this.resolveReady();
                    break;
                case 'startup-failed':
                    this.rejectReady(WorkerProjectStore.revive(message.error));
                    break;
                case 'advanced':
                    for (const listener of [...this.listeners]) {
                        listener(message.seq);
                    }
                    break;
            }
            return;
        }
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.ok) {
            pending?.resolve(message.result);
        } else {
            pending?.reject(WorkerProjectStore.revive(message.error));
        }
    }

    protected fail(error: Error): void {
        if (!this.closing) {
            this.failure ??= error;
        }
        this.rejectReady(error);
        for (const pending of this.pending.values()) {
            pending.reject(error);
        }
        this.pending.clear();
    }

    protected static revive(payload: StoreErrorPayload): Error {
        if (payload.name === 'IvoryStoreError') {
            return new IvoryStoreError(payload.code as IvoryStoreErrorCode, payload.message);
        }
        if (payload.name === 'IvoryContractError') {
            return new IvoryContractError(payload.code as IvoryContractErrorCode, payload.message);
        }
        const error = new Error(payload.message);
        error.name = payload.name;
        return error;
    }
}
