// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { canonicalJson, Sha256Digest } from '@ivory/contracts';
import { fork, ForkOptions } from 'child_process';
import { promises as fs } from 'fs';
import { request as httpRequest } from 'http';
import * as path from 'path';
import { ProjectManifest } from '../common/project-manifest';
import { ChainProblem, CommitOutcome, CommitReceipt, CommitRequest, GcResult, IvoryStoreError, RecoveryReport, StoreProtocol, VerifyChainResult } from '../common/store-protocol';
import {
    CoreCommand, CoreDescriptor, CoreIdentity, decodeBlob, isRecord, MAX_BLOB_BYTES, MAX_MESSAGE_BYTES,
    parseCoreDescriptor, parseCoreError, parseCoreIdentity
} from './core-protocol';
import { ProjectLayout, readManifest } from './project-layout';
import { ProjectStore, StoreDisposable } from './store-host';
import { processId } from './store/process-lease';

export interface CoreClient extends ProjectStore {
    readonly identity: CoreIdentity;
    /** Explicitly stops the shared service. close() only detaches this client. */
    stop(): Promise<void>;
}

export interface ConnectCoreOptions {
    readonly timeoutMs?: number;
}

function invalidResponse(): never {
    throw new IvoryStoreError('invalid-core-response', 'invalid Core result');
}

function parseRecovery(value: unknown): RecoveryReport {
    if (!isRecord(value)) {
        return invalidResponse();
    }
    const strings = (input: unknown): string[] => {
        if (!Array.isArray(input) || !input.every(item => typeof item === 'string')) {
            return invalidResponse();
        }
        return input;
    };
    return {
        swept: strings(value.swept), skippedAlive: strings(value.skippedAlive), malformed: strings(value.malformed), deferred: strings(value.deferred)
    };
}

function parseReceipt(value: unknown): CommitReceipt | undefined {
    // eslint-disable-next-line no-null/no-null -- JSON represents an absent receipt with null.
    if (value === null) {
        return undefined;
    }
    if (!isRecord(value) || typeof value.seq !== 'number' || !Number.isSafeInteger(value.seq) || value.seq < 1 || !Sha256Digest.is(value.digest)) {
        return invalidResponse();
    }
    return { seq: value.seq, digest: value.digest };
}

export async function requestCore(descriptor: CoreDescriptor, command: CoreCommand, timeoutMs = 15_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(command);
        const request = httpRequest({
            hostname: '127.0.0.1', port: descriptor.port, path: '/core', method: 'POST', agent: false,
            headers: {
                Authorization: 'Bearer ' + descriptor.token, 'X-Ivory-Epoch': descriptor.epoch,
                'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Connection: 'close'
            }
        }, response => {
            const chunks: Buffer[] = [];
            let length = 0;
            response.on('data', (chunk: Buffer) => {
                length += chunk.length;
                if (length > MAX_MESSAGE_BYTES) {
                    request.destroy(new IvoryStoreError('invalid-core-response', 'Core response exceeds the message bound'));
                } else {
                    chunks.push(chunk);
                }
            });
            response.on('error', () => {
                clearTimeout(timer);
                reject(new IvoryStoreError('core-unavailable', 'the Core response was interrupted'));
            });
            response.on('end', () => {
                clearTimeout(timer);
                try {
                    if (response.statusCode !== 200) {
                        throw new IvoryStoreError('core-unavailable', 'the Core rejected the connection');
                    }
                    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    if (!isRecord(value) || value.epoch !== descriptor.epoch) {
                        return invalidResponse();
                    }
                    if (value.ok === false) {
                        throw parseCoreError(value.error);
                    }
                    if (value.ok !== true || !('result' in value)) {
                        return invalidResponse();
                    }
                    resolve(value.result);
                } catch (error) {
                    reject(error instanceof SyntaxError ? new IvoryStoreError('invalid-core-response', 'invalid Core JSON') : error);
                }
            });
        });
        const timer = setTimeout(() => request.destroy(new IvoryStoreError('core-unavailable', 'the Core request timed out')), timeoutMs);
        request.once('error', error => {
            clearTimeout(timer);
            reject(error instanceof IvoryStoreError ? error : new IvoryStoreError('core-unavailable', 'the local Core is unavailable'));
        });
        request.end(body);
    });
}

/** Attaches only after an authenticated, epoch-bound round trip proves project and store identity. */
export async function connectCore(projectDir: string, options: ConnectCoreOptions = {}): Promise<CoreClient> {
    const manifest = await readManifest(projectDir);
    const layout = ProjectLayout.of(await fs.realpath(projectDir));
    const sameDirectory = (candidate: string): boolean => process.platform === 'win32'
        ? candidate.toLowerCase() === layout.projectDir.toLowerCase() : candidate === layout.projectDir;
    let descriptor: CoreDescriptor;
    try {
        const value: unknown = JSON.parse(await fs.readFile(layout.coreDiscovery, 'utf8'));
        descriptor = parseCoreDescriptor(value);
    } catch {
        throw new IvoryStoreError('core-unavailable', 'no usable Core discovery record exists');
    }
    if (descriptor.projectId !== manifest.projectId || descriptor.storeInstanceId !== manifest.storeInstanceId || !sameDirectory(descriptor.projectDir)) {
        throw new IvoryStoreError('store-mismatch', 'the Core discovery record belongs to another project or store instance');
    }
    const status = await requestCore(descriptor, { op: 'status' }, options.timeoutMs);
    if (!isRecord(status) || typeof status.headSeq !== 'number' || !Number.isSafeInteger(status.headSeq) || status.headSeq < 0) {
        return invalidResponse();
    }
    const identity = parseCoreIdentity(status.identity);
    if (identity.projectId !== manifest.projectId || identity.storeInstanceId !== manifest.storeInstanceId || identity.epoch !== descriptor.epoch
        || identity.processId !== descriptor.processId || !sameDirectory(identity.projectDir)) {
        throw new IvoryStoreError('store-mismatch', 'the responding Core belongs to another project, store instance or ownership epoch');
    }
    return new ConnectedCore(manifest, descriptor, identity, parseRecovery(status.recovery), status.headSeq);
}

/** Racing starters may spawn contenders, but only the OS lock winner can publish and serve. Never steals by PID. */
export async function startOrAttachCore(projectDir: string, options: ConnectCoreOptions = {}): Promise<CoreClient> {
    const manifest = await readManifest(projectDir);
    if (manifest.role !== 'live') {
        throw new IvoryStoreError('read-only-project', 'a headless Core requires a live project');
    }
    try {
        return await connectCore(projectDir, options);
    } catch {
        // Stale or absent discovery is not evidence that the writer lock is free.
    }
    const timeoutMs = options.timeoutMs ?? 15_000;
    const deadline = Date.now() + timeoutMs;
    const launchOptions: ForkOptions & { windowsHide: boolean } = {
        detached: true, windowsHide: true, execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc']
    };
    const child = fork(path.join(__dirname, 'core-service-main.js'), [path.resolve(projectDir)], launchOptions);
    const startup = await new Promise<IvoryStoreError | undefined>((resolve, reject) => {
        const timer = setTimeout(() => {
            child.kill();
            reject(new IvoryStoreError('core-unavailable', 'the Core startup timed out'));
        }, timeoutMs);
        child.once('error', () => {
            clearTimeout(timer);
            reject(new IvoryStoreError('core-unavailable', 'the Core process could not be started'));
        });
        child.once('message', (message: unknown) => {
            clearTimeout(timer);
            if (isRecord(message) && message.type === 'ready') {
                resolve(undefined);
            } else if (isRecord(message) && message.type === 'failed') {
                resolve(parseCoreError(message.error));
            } else {
                reject(new IvoryStoreError('invalid-core-response', 'invalid Core startup response'));
            }
        });
        child.once('exit', () => {
            clearTimeout(timer);
            reject(new IvoryStoreError('core-unavailable', 'the Core exited before startup completed'));
        });
    });
    child.unref();
    if (startup !== undefined && startup.code !== 'writer-owned' && startup.code !== 'already-open') {
        throw startup;
    }
    do {
        try {
            return await connectCore(projectDir, { timeoutMs: Math.max(1, Math.min(1000, deadline - Date.now())) });
        } catch {
            await new Promise<void>(resolve => setTimeout(resolve, 25));
        }
    } while (Date.now() < deadline);
    throw startup ?? new IvoryStoreError('core-unavailable', 'the Core could not be attached within the startup bound');
}

class ConnectedCore implements CoreClient {
    readonly writerEpoch: string;
    readonly processId: string;
    protected closed = false;
    protected pollTimer: NodeJS.Timeout | undefined;
    protected readonly listeners = new Set<(seq: number) => void>();
    protected polling = false;

    constructor(
        readonly manifest: ProjectManifest, protected readonly descriptor: CoreDescriptor, readonly identity: CoreIdentity,
        readonly openRecovery: RecoveryReport, protected lastSeq: number
    ) {
        this.writerEpoch = identity.epoch;
        this.processId = processId;
    }

    async commit<O = unknown>(request: CommitRequest): Promise<CommitOutcome<O>> {
        try {
            canonicalJson(request.input);
        } catch (error) {
            return { refusal: { code: 'invalid-input', message: error instanceof Error ? error.message : 'invalid canonical input' } };
        }
        const result = await this.request({ op: 'commit', request });
        if (!isRecord(result)) {
            return invalidResponse();
        }
        if (isRecord(result.refusal) && typeof result.refusal.code === 'string' && typeof result.refusal.message === 'string') {
            return { refusal: { ...result.refusal, code: result.refusal.code, message: result.refusal.message } };
        }
        const receipt = parseReceipt(result.receipt);
        if (!receipt || typeof result.replayed !== 'boolean') {
            return invalidResponse();
        }
        // Handler output is caller-defined, as on ProjectStore.commit<O>; the receipt and transport envelope are parsed above.
        return { value: result.value as O, receipt, replayed: result.replayed };
    }

    async admitBlob(bytes: Uint8Array, expectedDigest?: Sha256Digest): Promise<Sha256Digest> {
        if (!(bytes instanceof Uint8Array) || bytes.length > MAX_BLOB_BYTES) {
            throw new IvoryStoreError('invalid-argument', 'the Core admits at most 8 MiB per request');
        }
        const result = await this.request({ op: 'admitBlob', bytes: Buffer.from(bytes).toString('base64'), expectedDigest });
        return Sha256Digest.is(result) ? result : invalidResponse();
    }

    async readBlob(digest: Sha256Digest): Promise<Uint8Array> {
        return decodeBlob(await this.request({ op: 'readBlob', digest }));
    }

    async gc(options: { readonly graceMs?: number } = {}): Promise<GcResult> {
        const result = await this.request({ op: 'gc', graceMs: options.graceMs ?? StoreProtocol.DEFAULT_GC_GRACE_MS });
        if (!isRecord(result) || typeof result.deleted !== 'number' || typeof result.skipped !== 'number'
            || !Number.isSafeInteger(result.deleted) || result.deleted < 0 || !Number.isSafeInteger(result.skipped) || result.skipped < 0) {
            return invalidResponse();
        }
        return { deleted: result.deleted, skipped: result.skipped };
    }

    async headSeq(): Promise<number> {
        const result = await this.request({ op: 'status' });
        return isRecord(result) && typeof result.headSeq === 'number' && Number.isSafeInteger(result.headSeq) && result.headSeq >= 0
            ? result.headSeq : invalidResponse();
    }

    async head(): Promise<CommitReceipt | undefined> {
        return parseReceipt(await this.request({ op: 'head' }));
    }

    async receiptFor(principal: string, idempotencyKey: string): Promise<CommitReceipt | undefined> {
        return parseReceipt(await this.request({ op: 'receiptFor', principal, idempotencyKey }));
    }

    async verifyChain(): Promise<VerifyChainResult> {
        const result = await this.request({ op: 'verifyChain' });
        if (!isRecord(result) || typeof result.ok !== 'boolean' || typeof result.headSeq !== 'number' || !Number.isSafeInteger(result.headSeq)
            || result.headSeq < 0 || !Sha256Digest.is(result.headDigest) || !Array.isArray(result.problems)) {
            return invalidResponse();
        }
        const problems = result.problems.map((problem: unknown): ChainProblem => {
            if (!isRecord(problem) || typeof problem.seq !== 'number' || !Number.isSafeInteger(problem.seq)
                || (problem.reason !== 'seq-gap' && problem.reason !== 'prev-digest-mismatch'
                    && problem.reason !== 'digest-mismatch' && problem.reason !== 'receipt-digest-mismatch')) {
                return invalidResponse();
            }
            return { seq: problem.seq, reason: problem.reason };
        });
        return { ok: result.ok, headSeq: result.headSeq, headDigest: result.headDigest, problems };
    }

    async recover(): Promise<RecoveryReport> {
        return parseRecovery(await this.request({ op: 'recover' }));
    }

    onDidAdvance(listener: (seq: number) => void): StoreDisposable {
        this.listeners.add(listener);
        if (!this.pollTimer && !this.closed) {
            this.pollTimer = setInterval(() => {
                if (!this.polling) {
                    this.polling = true;
                    this.headSeq().then(seq => {
                        if (seq > this.lastSeq) {
                            this.lastSeq = seq;
                            for (const current of [...this.listeners]) {
                                current(seq);
                            }
                        }
                    }).catch(() => undefined).finally(() => { this.polling = false; });
                }
            }, StoreProtocol.DEFAULT_POLL_INTERVAL_MS);
        }
        return { dispose: () => {
            this.listeners.delete(listener);
            if (!this.listeners.size && this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = undefined;
            }
        } };
    }

    close(): Promise<void> {
        this.closed = true;
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }
        this.listeners.clear();
        return Promise.resolve();
    }

    async stop(): Promise<void> {
        await this.request({ op: 'stop' });
        await this.close();
    }

    protected request(command: CoreCommand): Promise<unknown> {
        return this.closed ? Promise.reject(new IvoryStoreError('store-closed', 'the Core client is closed')) : requestCore(this.descriptor, command);
    }
}
