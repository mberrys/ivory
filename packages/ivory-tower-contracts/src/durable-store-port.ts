// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
/**
 * Durable-store port accepted by ADR-005. The local implementation is the N2 spike until the
 * production kernel lands; nothing outside the infrastructure layer may import a concrete engine.
 */

/** Blob identity is its SHA-256 digest of raw bytes. */
export type BlobDigest = string;

export interface AdmittedBlob {
    readonly digest: BlobDigest;
    readonly byteLength: number;
    readonly objectKey: string;
}

export interface AdmissionReceipt extends AdmittedBlob {
    readonly admittedAt: string;
}

export interface CommitReceipt {
    readonly revisionIds: readonly string[];
    readonly projectSequence: number;
    /** Read-back handle for an identical retry of the same idempotency key. */
    readonly idempotencyKey: string;
    readonly acknowledgedAt: string;
}

export interface StoredRevision {
    readonly objectId: string;
    readonly revisionId: string;
    readonly type: string;
    readonly payload: unknown;
    readonly blobDigests: readonly BlobDigest[];
}

/**
 * Ordering is part of the contract: `admitBlob` must have durably installed and fsynced the bytes
 * before `commit` may reference them, and `commit` acknowledges only after its transaction returns.
 */
export interface DurableStorePort {
    admitBlob(bytes: Uint8Array): Promise<AdmissionReceipt>;
    commit(request: CommitRequest): Promise<CommitReceipt>;
    getVisible(objectId: string): Promise<StoredRevision | undefined>;
    freezeUnchanged(projectId: string, sequence: number): Promise<SnapshotManifest>;
    exportSemantic(projectId: string): Promise<SemanticExport>;
    importSemantic(project: SemanticExport): Promise<void>;
}

export interface CommitRequest {
    readonly projectId: string;
    readonly idempotencyKey: string;
    readonly expectedHeads: Readonly<Record<string, string>>;
    readonly revisions: readonly Omit<StoredRevision, 'revisionId'>[];
    readonly blobDigests: readonly BlobDigest[];
}

export interface SnapshotManifest {
    readonly projectId: string;
    readonly sequence: number;
    readonly members: readonly { readonly objectId: string; readonly revisionId: string }[];
    readonly manifestDigest: string;
}

export interface SemanticExport {
    readonly format: 'ivory-semantic-export/1';
    readonly projectSequence: number;
    readonly revisions: readonly StoredRevision[];
    readonly blobs: readonly AdmittedBlob[];
}
