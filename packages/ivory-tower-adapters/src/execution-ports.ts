// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ExecutionEvent, ExecutionFailure, ExecutionKind, ExecutionRecord } from '@ivory-tower/domain';
import { AcquisitionRoute, ContentClass, DeploymentTopology, RightsBasisKind, SourceMetadata } from '@ivory-tower/contracts';

export interface ExecutionJob {
    readonly executionId: string;
    readonly kind: ExecutionKind;
    readonly contractVersion: number;
    readonly attempt: number;
    readonly jobKey: string;
    readonly input: unknown;
}

export interface ExecutionTransactionPort {
    createAndEnqueue(record: ExecutionRecord, job: ExecutionJob): Promise<ExecutionRecord>;
}

export interface ExecutionStorePort {
    findByIdempotencyKey(idempotencyKey: string): Promise<ExecutionRecord | undefined>;
    get(executionId: string): Promise<ExecutionRecord | undefined>;
    listEvents(executionId: string, afterSequence?: number): Promise<readonly ExecutionEvent[]>;
    appendEvent(executionId: string, type: ExecutionEvent['type'], payload: unknown): Promise<ExecutionEvent>;
    markRunning(executionId: string, leaseToken: string, leaseUntil: string): Promise<boolean>;
    updateProgress(executionId: string, leaseToken: string, progress: number, payload?: unknown): Promise<boolean>;
    complete(executionId: string, leaseToken: string, result: unknown): Promise<boolean>;
    fail(executionId: string, leaseToken: string, failure: ExecutionFailure): Promise<boolean>;
    retry(executionId: string, leaseToken: string, failure: ExecutionFailure): Promise<boolean>;
    cancelRunning(executionId: string, leaseToken: string): Promise<boolean>;
    cancel(executionId: string): Promise<ExecutionRecord | undefined>;
}

export interface ExecutionQueuePort {
    enqueue(job: ExecutionJob): Promise<{ readonly id: string }>;
}

export interface ExecutionIdPort {
    next(): string;
}

export interface ObjectStorePort {
    putImmutable(key: string, content: Uint8Array, contentType: string): Promise<{ readonly key: string; readonly etag: string }>;
    get(key: string): Promise<Uint8Array>;
}

export interface SourceRecord {
    readonly id: string;
    readonly contentHash: string;
    readonly objectKey: string;
    readonly contentType: string;
    readonly license: string;
    readonly authorizationEvidence: string;
    readonly admissionPolicyVersion: string;
    readonly admittedAt: string;
    readonly contentClass: ContentClass;
    readonly rightsBasisKind: RightsBasisKind;
    readonly acquisitionRoute: AcquisitionRoute;
    readonly deploymentTopology: DeploymentTopology;
    readonly ingestPermitted: boolean;
    readonly transferPermitted: boolean;
    readonly ingestReason: string;
    readonly transferReason: string;
}

export interface SourceRecordPort {
    /**
     * Persists a source and returns the canonical record. Implementations must
     * return the existing record when the content hash was already admitted.
     */
    persistSource(record: SourceRecord): Promise<SourceRecord>;
    getByContentHash(contentHash: string): Promise<SourceRecord | undefined>;
}

export interface SourceAdmissionResult {
    readonly allowed: boolean;
    readonly reason: string;
    readonly contentClass: ContentClass;
    readonly rightsBasisKind: RightsBasisKind;
    readonly acquisitionRoute: AcquisitionRoute;
    readonly deploymentTopology: DeploymentTopology;
    readonly ingestPermitted: boolean;
    readonly transferPermitted: boolean;
    readonly ingestReason: string;
    readonly transferReason: string;
}

export interface SourceAdmissionPort {
    admit(metadata: SourceMetadata, contentHash: string): Promise<SourceAdmissionResult>;
}

export interface ConversionPort {
    convert(request: {
        readonly content: Uint8Array;
        readonly filename: string;
        readonly contentType: string;
        readonly contentHash: string;
        readonly parserVersion: string;
        readonly signal?: AbortSignal;
    }): Promise<{
        readonly artifactKey: string;
        readonly parserVersion: string;
        readonly artifact: Uint8Array;
        readonly artifactContentType: string;
        readonly normalizedPassages: readonly unknown[];
    }>;
}

export interface EgressPolicyPort {
    authorize(request: { readonly purpose: string; readonly target: string; readonly contentHash?: string }): Promise<{
        readonly allowed: boolean;
        readonly reason: string;
    }>;
}

export interface ProviderPort {
    execute(request: unknown, egressPolicy: EgressPolicyPort): Promise<unknown>;
}

export const ExecutionTransactionPort = Symbol('ExecutionTransactionPort');
export const ExecutionStorePort = Symbol('ExecutionStorePort');
export const ExecutionQueuePort = Symbol('ExecutionQueuePort');
export const ExecutionIdPort = Symbol('ExecutionIdPort');
export const ObjectStorePort = Symbol('ObjectStorePort');
export const SourceRecordPort = Symbol('SourceRecordPort');
export const SourceAdmissionPort = Symbol('SourceAdmissionPort');
export const ConversionPort = Symbol('ConversionPort');
export const EgressPolicyPort = Symbol('EgressPolicyPort');
export const ProviderPort = Symbol('ProviderPort');
