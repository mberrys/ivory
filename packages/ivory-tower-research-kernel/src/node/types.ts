// *****************************************************************************
// Copyright (C) 2026 Berry Studio and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

export type ResearchObjectType = 'project' | 'source' | 'artifact' | 'fragment' | 'codebook' | 'annotation' | 'claim' | 'evidenceLink';

export type N1Prefix = 'clm' | 'evl' | 'ann' | 'cdb' | 'snp' | 'act' | 'rev' | 'frg';

export interface ExactRef {
    readonly projectId: string;
    readonly objectId: string;
    readonly revisionId: string;
}

export interface RevisionRecord<T = unknown> {
    readonly revisionId: string;
    readonly objectId: string;
    readonly objectType: ResearchObjectType;
    readonly revisionNumber: number;
    readonly predecessor?: ExactRef;
    readonly payload: T;
    readonly exactRefs: readonly ExactRef[];
    readonly activityId: string;
    readonly projectSequence: number;
    readonly schemaVersion: string;
    readonly digest: string;
}

export interface ActivityEdge {
    readonly kind: string;
    readonly target: ExactRef;
}

export interface ActivityRecord {
    readonly activityId: string;
    readonly command: string;
    readonly actor: string;
    readonly projectSequence: number;
    readonly edges: ActivityEdge[];
}

export interface SourcePayload {
    readonly name: string;
    readonly contentBase64: string;
    readonly contentDigest: string;
    readonly sourceVersionId: string;
}

export interface TextSelector {
    readonly kind: 'text';
    readonly start: number;
    readonly end: number;
    readonly quote: string;
    readonly prefix?: string;
    readonly suffix?: string;
    readonly passageId: string;
}

export interface TableSelector {
    readonly kind: 'table';
    readonly sheet: string;
    readonly row: number;
    readonly column: string;
    readonly value: string;
}

export type FragmentSelector = TextSelector | TableSelector;

export interface FragmentPayload {
    readonly sourceRef: ExactRef;
    readonly artifactRef: ExactRef;
    readonly selector: FragmentSelector;
}

export interface CodeDefinition {
    readonly id: string;
    readonly label: string;
    readonly definition: string;
}

export interface CodebookPayload {
    readonly name: string;
    readonly edition: number;
    readonly codes: readonly CodeDefinition[];
}

export interface AnnotationPayload {
    readonly fragmentRef: ExactRef;
    readonly codebookRef: ExactRef;
    readonly codeId: string;
    readonly actor: string;
    readonly actorType: 'human' | 'model';
    readonly rationale?: string;
}

export interface ClaimPayload {
    readonly text: string;
    readonly author: string;
    readonly authorType: 'human' | 'model';
    readonly status: 'proposed' | 'accepted' | 'retracted';
}

export type EvidenceRole = 'supports' | 'challenges' | 'qualifies' | 'contextualizes';

export interface EvidenceLinkPayload {
    readonly claimRef: ExactRef;
    readonly targets: readonly ExactRef[];
    readonly role: EvidenceRole;
    readonly rationale: string;
    readonly linkAuthor: string;
    readonly linkAuthorType: 'human' | 'model';
}

export interface ArtifactPayload {
    readonly artifactId: string;
    readonly executionId: string;
    readonly fingerprintId: string;
    readonly sourceRefs: readonly ExactRef[];
    readonly output: string;
    readonly outputDigest: string;
}

export interface SnapshotMember {
    readonly ref: ExactRef;
    readonly role: 'selected' | 'context' | 'dependency';
    readonly revisionDigest: string;
}

export interface SnapshotManifest {
    readonly projectId: string;
    readonly projectSequence: number;
    readonly selected: readonly ExactRef[];
    readonly context: readonly ExactRef[];
    readonly dependencies: readonly ExactRef[];
    readonly members: readonly SnapshotMember[];
}

export interface SnapshotRecord {
    readonly snapshotId: string;
    readonly digest: string;
    readonly manifest: SnapshotManifest;
    readonly label: string;
    readonly researcher: string;
    readonly createdAt: string;
}

export interface AdmitSourceInput {
    readonly name: string;
    readonly bytes: Uint8Array | string;
    readonly actor: string;
    readonly sourceId?: string;
    readonly expectedHead?: string;
}

export interface CreateFragmentInput {
    readonly sourceRef: ExactRef;
    readonly artifactRef: ExactRef;
    readonly selector: Omit<TextSelector, 'passageId'> | TableSelector;
    readonly actor: string;
    readonly fragmentKey?: string;
}

export interface CreateCodebookInput {
    readonly key: string;
    readonly name: string;
    readonly codes: readonly CodeDefinition[];
    readonly actor: string;
}

export interface ReviseCodebookInput {
    readonly codebookRef: ExactRef;
    readonly expectedHead: string;
    readonly codes: readonly CodeDefinition[];
    readonly actor: string;
}

export interface AnnotateInput {
    readonly key?: string;
    readonly fragmentRef: ExactRef;
    readonly codebookRef: ExactRef;
    readonly codeId: string;
    readonly actor: string;
    readonly actorType?: 'human' | 'model';
    readonly rationale?: string;
}

export interface CreateClaimInput {
    readonly key: string;
    readonly text: string;
    readonly author: string;
    readonly authorType?: 'human' | 'model';
    readonly status?: ClaimPayload['status'];
    readonly actor?: string;
}

export interface ReviseClaimInput {
    readonly claimRef: ExactRef;
    readonly expectedHead: string;
    readonly text: string;
    readonly actor: string;
    readonly status?: ClaimPayload['status'];
}

export interface CreateEvidenceLinkInput {
    readonly key?: string;
    readonly claimRef: ExactRef;
    readonly targets: readonly ExactRef[];
    readonly role: EvidenceRole;
    readonly rationale: string;
    readonly linkAuthor: string;
    readonly linkAuthorType?: 'human' | 'model';
    readonly actor?: string;
    readonly [key: string]: unknown;
}

export interface AdmitArtifactInput {
    readonly key: string;
    readonly sourceRefs: readonly ExactRef[];
    readonly output: string;
    readonly actor: string;
    readonly transformation?: string;
}

export interface FreezeSnapshotInput {
    readonly label: string;
    readonly researcher: string;
    readonly selected: readonly (ExactRef | string)[];
    readonly context?: readonly ExactRef[];
    readonly createdAt?: string;
}

export interface CarryForwardPreview {
    readonly from: ExactRef;
    readonly to: ExactRef;
    readonly links: readonly ExactRef[];
}

export interface CitationResolution {
    readonly ref: ExactRef;
    readonly quote: string;
    readonly sourceVersionId: string;
    readonly selector: FragmentSelector;
    readonly sourceName: string;
}

export interface ClaimExplanation {
    readonly claimRef: ExactRef;
    readonly claim: ClaimPayload;
    readonly links: readonly {
        readonly ref: ExactRef;
        readonly role: EvidenceRole;
        readonly linkAuthor: string;
        readonly authoredByDifferentPerson: boolean;
        readonly codebookEdition?: number;
        readonly citation?: CitationResolution;
    }[];
    readonly text: string;
}
