// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { Sha256Digest } from '@ivory/contracts';

/** The refusals the store itself produces. A commit handler may refuse with any other code. */
export type StoreRefusalCode =
    | 'unknown-kind'
    | 'invalid-input'
    | 'input-too-large'
    | 'idempotency-conflict'
    | 'blob-missing'
    | 'writer-busy'
    | 'read-only-project';

/** What a refused commit reports. Refusals are results, not errors. */
export interface StoreRefusalInfo {
    readonly code: string;
    readonly message: string;
    readonly [detail: string]: unknown;
}

/**
 * Thrown by a commit handler to refuse the commit. The transaction rolls back
 * and the caller receives the refusal as a result.
 */
export class StoreRefusal extends Error {
    constructor(readonly code: string, message: string, readonly detail: Record<string, unknown> = {}) {
        super(message);
        this.name = 'StoreRefusal';
    }

    /** True for a refusal even when it was created by another copy of this module. */
    static is(error: unknown): error is StoreRefusal {
        return error instanceof StoreRefusal || (error instanceof Error && error.name === 'StoreRefusal' && typeof (error as { code?: unknown }).code === 'string');
    }

    toInfo(): StoreRefusalInfo {
        return { ...this.detail, code: this.code, message: this.message };
    }
}

export type IvoryStoreErrorCode =
    | 'invalid-manifest'
    | 'project-exists'
    | 'store-mismatch'
    | 'unsupported-schema'
    | 'already-open'
    | 'store-closed'
    | 'worker-failed'
    | 'duplicate-handler'
    | 'invalid-handler-module'
    | 'handler-not-synchronous'
    | 'handler-transaction-control'
    | 'cas-corrupt'
    | 'read-only-project'
    | 'writer-busy'
    | 'invalid-argument';

/**
 * A failure of the store host itself, as opposed to a refusal of one request.
 * Also the error a non-commit operation rejects with when the store refuses it.
 */
export class IvoryStoreError extends Error {
    constructor(readonly code: IvoryStoreErrorCode, message: string) {
        super(message);
        this.name = 'IvoryStoreError';
    }
}

/** The receipt a commit hands back: where it sits in the chain and the digest that binds it there. */
export interface CommitReceipt {
    readonly seq: number;
    readonly digest: Sha256Digest;
}

export interface CommitRequest {
    readonly kind: string;
    readonly input: unknown;
    readonly principal: string;
    readonly idempotencyKey: string;
}

export interface CommitSuccess<O = unknown> {
    readonly value: O;
    readonly receipt: CommitReceipt;
    /** True when the idempotency key had already committed the same request and this is the stored receipt. */
    readonly replayed: boolean;
}

export interface CommitRefusal {
    readonly refusal: StoreRefusalInfo;
}

export type CommitOutcome<O = unknown> = CommitSuccess<O> | CommitRefusal;

export namespace CommitOutcome {
    export function isRefusal(outcome: CommitOutcome): outcome is CommitRefusal {
        return 'refusal' in outcome;
    }
}

export interface GcResult {
    readonly deleted: number;
    readonly skipped: number;
}

export type ChainProblemReason =
    | 'seq-gap'
    | 'prev-digest-mismatch'
    | 'digest-mismatch'
    | 'receipt-digest-mismatch';

export interface ChainProblem {
    readonly seq: number;
    readonly reason: ChainProblemReason;
}

export interface VerifyChainResult {
    readonly ok: boolean;
    readonly headSeq: number;
    /** The stored digest of the last commit, or the genesis digest when the log is empty. */
    readonly headDigest: Sha256Digest;
    readonly problems: readonly ChainProblem[];
}

export interface RecoveryReport {
    /** Process ids of dead leases whose staging files and lease file were removed. */
    readonly swept: readonly string[];
    readonly skippedAlive: readonly string[];
    /** Lease files without a readable lease row. They are never treated as dead. */
    readonly malformed: readonly string[];
    /** Dead leases that could not be deleted yet, for example because Windows still held a handle. */
    readonly deferred: readonly string[];
}

export type StoreOp = 'commit' | 'admitBlob' | 'gc' | 'headSeq' | 'head' | 'receiptFor' | 'verifyChain' | 'recover' | 'close';

/**
 * The places where the qualification harness kills the host. Each is one call to `failpoint(name)`:
 * `duringBlobStage` (C1) after half of a blob's bytes are staged, `beforeBlobInstall` (C1) after the staging file
 * is durable and before it is renamed, `afterBlobInstall` (C2) after the blob is installed and before `admitBlob`
 * returns, `beforeDbCommit` (C3) inside the transaction after the inserts and before COMMIT, and `afterDbCommit` (C4)
 * after COMMIT and before the worker posts the response.
 */
export type StoreFailpoint = 'duringBlobStage' | 'beforeBlobInstall' | 'afterBlobInstall' | 'beforeDbCommit' | 'afterDbCommit';

export namespace StoreFailpoint {
    export const ALL: readonly StoreFailpoint[] = ['duringBlobStage', 'beforeBlobInstall', 'afterBlobInstall', 'beforeDbCommit', 'afterDbCommit'];
}

/** Kills the host with SIGKILL at the `afterHits`-th hit of `name`, after writing `markerFile`. */
export interface StoreFailpointConfig {
    readonly name: StoreFailpoint;
    readonly afterHits: number;
    readonly markerFile: string;
}

/**
 * What only the qualification harness sets: the failpoint and the durability of the write connection.
 * Product hosts never set it.
 * @internal
 */
export interface StoreQualificationOptions {
    readonly failpoint?: StoreFailpointConfig;
    /** The write connection's `PRAGMA synchronous`. Default `'FULL'`. */
    readonly synchronous?: 'FULL' | 'OFF';
}

export interface StoreRequest {
    readonly id: number;
    readonly op: StoreOp;
    readonly args: unknown;
}

export interface StoreErrorPayload {
    readonly name: string;
    readonly code?: string;
    readonly message: string;
}

export type StoreResponse =
    | { readonly id: number; readonly ok: true; readonly result: unknown }
    | { readonly id: number; readonly ok: false; readonly error: StoreErrorPayload };

/** Worker to main messages that are not responses. */
export type StoreWorkerEvent =
    | { readonly type: 'ready'; readonly recovery: RecoveryReport }
    | { readonly type: 'startup-failed'; readonly error: StoreErrorPayload }
    | { readonly type: 'advanced'; readonly seq: number };

export interface StoreWorkerData {
    readonly projectDir: string;
    readonly processId: string;
    readonly hostKind: string;
    readonly handlerModules: readonly string[];
    readonly writerBusyBoundMs: number;
    readonly busyTimeoutMs: number;
    readonly pollIntervalMs: number;
    readonly maxInputBytes: number;
    readonly libraryBuild: string;
    /** @internal */
    readonly qualification?: StoreQualificationOptions;
}

export namespace StoreProtocol {
    export const MAX_ID_LENGTH = 256;
    export const DEFAULT_MAX_INPUT_BYTES = 256 * 1024;
    export const DEFAULT_WRITER_BUSY_BOUND_MS = 10_000;
    export const DEFAULT_BUSY_TIMEOUT_MS = 50;
    export const DEFAULT_POLL_INTERVAL_MS = 250;
    export const DEFAULT_GC_GRACE_MS = 24 * 60 * 60 * 1000;

    /** True for a non-blank string of at most {@link MAX_ID_LENGTH} characters. */
    export function isIdentifier(value: unknown): value is string {
        return typeof value === 'string' && !!value.trim() && value.length <= MAX_ID_LENGTH;
    }

    export function errorPayload(error: unknown): StoreErrorPayload {
        if (error instanceof Error) {
            const code = (error as { code?: unknown }).code;
            return { name: error.name, message: error.message, ...(typeof code === 'string' ? { code } : {}) };
        }
        return { name: 'Error', message: String(error) };
    }
}
