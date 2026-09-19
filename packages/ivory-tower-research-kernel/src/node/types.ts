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

export type FragmentRepresentationKind = 'source' | 'artifact';

export interface FragmentProfile {
    readonly converter: string;
    readonly converterRevision: string;
    readonly selectorProfileRevision: string;
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
    readonly proposal?: { readonly digest: string; readonly provider: string; readonly model: string };
}

/** Trusted Core input; never exposed as an agent tool. */
export interface AcceptAgentProposalInput {
    readonly proposalDigest: string;
    readonly idempotencyKey: string;
    readonly researcher: string;
    readonly provider: string;
    readonly model: string;
    readonly expectedClaim: ExactRef;
    readonly text: string;
    readonly fragmentRef: ExactRef;
    readonly role: 'supports' | 'challenges';
    readonly rationale: string;
}

export interface AgentProposalReceipt {
    readonly requestDigest: string;
    readonly claimRef: ExactRef;
    readonly linkRef: ExactRef;
    readonly activityId: string;
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
export type FragmentSelectorInput = Omit<TextSelector, 'passageId'> | TableSelector;

export type FragmentContextKind =
    | 'heading'
    | 'table-header'
    | 'units'
    | 'denominator'
    | 'legend'
    | 'footnote'
    | 'methods'
    | 'limitation'
    | 'other';

export interface FragmentAnchorIdentity extends FragmentProfile {
    readonly brand: 'ivory.fragment-anchor/1';
    readonly representation: FragmentRepresentationKind;
    readonly representationRef: ExactRef;
    readonly representationDigest: string;
    readonly selectorKind: FragmentSelector['kind'];
    readonly orderedSpanIdentity: string;
}

export interface FragmentContextReference {
    readonly kind: FragmentContextKind;
    readonly representation: FragmentRepresentationKind;
    readonly representationRef: ExactRef;
    readonly representationDigest: string;
    readonly selector: FragmentSelector;
    readonly orderedSpanIdentity: string;
}

export type FragmentContext =
    | {
          readonly state: 'applicable';
          readonly references: readonly FragmentContextReference[];
      }
    | {
          readonly state: 'not-applicable';
          readonly basis: 'no-material-structure';
          readonly reason: string;
      }
    | {
          readonly state: 'unavailable';
          readonly reason: string;
      };

export type FragmentContextInput =
    | {
          readonly state: 'applicable';
          readonly references: readonly {
              readonly kind: FragmentContextKind;
              readonly representation?: FragmentRepresentationKind;
              readonly selector: FragmentSelectorInput;
          }[];
      }
    | {
          readonly state: 'not-applicable';
          readonly basis: 'no-material-structure';
          readonly reason: string;
      }
    | {
          readonly state: 'unavailable';
          readonly reason: string;
      };

export interface FragmentPayload {
    readonly sourceRef: ExactRef;
    readonly artifactRef: ExactRef;
    readonly selector: FragmentSelector;
    readonly anchor: FragmentAnchorIdentity;
    readonly context: FragmentContext;
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
export type EvidenceFragmentRole = 'cited' | 'context';

export interface EvidenceFragmentTarget {
    readonly ref: ExactRef;
    readonly role: EvidenceFragmentRole;
}

export interface EvidenceLinkPayload {
    readonly claimRef: ExactRef;
    readonly targets: readonly ExactRef[];
    readonly fragmentTargets: readonly EvidenceFragmentTarget[];
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
    readonly selector: FragmentSelectorInput;
    readonly representation?: FragmentRepresentationKind;
    readonly profile?: FragmentProfile;
    readonly context?: FragmentContextInput;
    readonly actor: string;
    readonly fragmentKey?: string;
}

export interface VerifyCitationInput {
    readonly fragmentRef: ExactRef;
}

export interface MechanicalCitationReceipt {
    readonly kind: 'mechanical-citation';
    readonly fragmentRef: ExactRef;
    readonly fragmentRevisionDigest: string;
    readonly representationDigest: string;
    readonly selectorKind: FragmentSelector['kind'];
    readonly status: 'EXACT' | 'MISMATCH';
    readonly checks: {
        readonly representationDigest: boolean;
        readonly selectorBytes: boolean;
        readonly context: boolean;
    };
    readonly semanticSupport: 'not-assessed';
    readonly receiptDigest: string;
}

export type FragmentRemapStatus = 'EXACT' | 'AMBIGUOUS' | 'UNRESOLVED';

export interface RemapFragmentInput {
    readonly fragmentRef: ExactRef;
    readonly expectedHead: string;
    readonly artifactRef: ExactRef;
    readonly profile: FragmentProfile;
    readonly representation?: FragmentRepresentationKind;
    readonly actor: string;
}

export interface FragmentRemapReceipt {
    readonly status: FragmentRemapStatus;
    readonly from: ExactRef;
    readonly to?: ExactRef;
    readonly candidateSelectors: readonly FragmentSelectorInput[];
    readonly reason?: string;
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
    readonly fragmentTargets?: readonly EvidenceFragmentTarget[];
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
    readonly anchor: FragmentAnchorIdentity;
    readonly context: FragmentContext;
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
