// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

/** Durable, content-free record of a converter representation used by N4. */
export interface N4RepresentationRecord {
    readonly id: string;
    readonly sourceVersionId: string;
    readonly artifactId: string;
    readonly contentHash: string;
    readonly objectKey: string;
    readonly contentType: string;
    readonly converterRef: string;
    readonly text: string;
    readonly createdAt: string;
}

/** A page-local coordinate retained with an anchor for post-conversion inspection. */
export interface N4PageCoordinate {
    readonly page: number;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly unit: 'pt' | 'px' | 'normalized';
}

/** An anchor is stored as selector digests so the persistence layer never duplicates source text. */
export interface N4AnchorRecord {
    readonly id: string;
    readonly projectId: string;
    readonly representationId: string;
    readonly sourceVersionId: string;
    readonly artifactId: string;
    readonly spans: readonly { readonly start: number; readonly end: number }[];
    readonly quote: {
        readonly prefixDigest: string;
        readonly exactDigest: string;
        readonly suffixDigest: string;
        readonly normalizationVersion: string;
    };
    /** Optional for backwards-compatible records created before V2 layout retention. */
    readonly coordinates?: readonly N4PageCoordinate[];
    readonly confidence: 'exact' | 'approximate';
    readonly createdAt: string;
}

export interface N4RemapLedgerEntry {
    readonly anchorId: string;
    readonly fromRepresentationId: string;
    readonly toRepresentationId: string;
    readonly outcome: 'exact' | 'ambiguous' | 'unresolved';
    readonly falseExact: boolean;
}
