// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ExactRef } from './exact-ref';
import { Sha256Digest } from './sha256-digest';

/** Authoritative wire contract. Changing an identity preimage requires a new schema. */
export const RESEARCH_CONTRACT = 'ivory-research@1';

export interface ResearcherPrincipal { readonly kind: 'researcher'; readonly id: string }
export interface AgentPrincipal { readonly kind: 'agent'; readonly id: string }
export interface CorePrincipal { readonly kind: 'core'; readonly id: string }
export type Principal = ResearcherPrincipal | AgentPrincipal | CorePrincipal;

/** Authorship is distinct from the principal initiating a command or endorsing its content. */
export const AuthorOf = Object.freeze({
    source: 'researcher', representation: 'core', artifact: 'core', fragment: 'researcher',
    codebook: 'researcher', annotation: 'researcher', statement: 'researcher', 'evidence-link': 'researcher',
    protocol: 'researcher', proposal: 'agent', mechanical: 'core', decision: 'researcher',
    snapshot: 'researcher', receipt: 'core'
} as const);

export type ResearchKind = keyof typeof AuthorOf;
declare const refKind: unique symbol;
/** The brand never appears on the wire; resolution against retained records checks the kind. */
export type Ref<K extends ResearchKind> = ExactRef & { readonly [refKind]: K };
export type NonEmpty<T> = readonly [T, ...T[]];
export type Rights = 'local-only' | 'local-model-ok' | 'remote-ok';

export type Origin =
    | { readonly kind: 'direct' }
    | { readonly kind: 'adopted'; readonly proposal: Ref<'proposal'>; readonly adoption: Ref<'decision'>;
        readonly drafter: AgentPrincipal; readonly edited: boolean }
    | { readonly kind: 'carried-forward'; readonly from: Ref<'evidence-link'>; readonly originalAuthor: ResearcherPrincipal };

type OriginOf<K extends ResearchKind> = K extends 'evidence-link' ? Origin
    : K extends 'statement' ? Exclude<Origin, { kind: 'carried-forward' }> : Extract<Origin, { kind: 'direct' }>;

export interface SourceBody {
    readonly name: string;
    readonly blob: Sha256Digest;
    readonly mediaType: string;
    readonly rights: Rights;
    readonly status: 'active' | 'retracted';
}

export interface RepresentationBody {
    readonly source: Ref<'source'>;
    readonly blob: Sha256Digest;
    readonly profile: 'utf8-text@1';
    readonly converter: { readonly id: string; readonly version: string };
    readonly rights: Rights;
}

export interface ArtifactBody {
    readonly inputs: NonEmpty<ExactRef>;
    readonly blob: Sha256Digest;
    readonly profile: 'utf8-text@1';
    readonly transformation: string;
    readonly rights: Rights;
}

export interface TextSelector {
    readonly profile: 'utf8-bytes@1';
    readonly start: number;
    readonly end: number;
    readonly quote: string;
}

export interface FragmentBody {
    readonly representation: Ref<'representation' | 'artifact'>;
    readonly representationDigest: Sha256Digest;
    readonly selector: TextSelector;
}

export interface CodeDefinition { readonly id: string; readonly label: string; readonly definition: string }
export interface CodebookBody { readonly name: string; readonly edition: number; readonly codes: NonEmpty<CodeDefinition> }
export interface AnnotationBody {
    readonly fragment: Ref<'fragment'>;
    readonly codebook: Ref<'codebook'>;
    readonly codeId: string;
    readonly rationale: string;
}
/** Recording wording is not a claim-acceptance decision. */
export interface StatementBody { readonly wording: string; readonly scope: readonly string[] }
export type EvidenceRole = 'supports' | 'challenges' | 'qualifies' | 'contextualizes';
export interface EvidenceLinkBody {
    readonly statement: Ref<'statement'>;
    readonly role: EvidenceRole;
    readonly cited: NonEmpty<Ref<'fragment' | 'annotation' | 'artifact'>>;
    readonly context: readonly ExactRef[];
    readonly rationale: string;
}
export interface ProtocolBody { readonly name: string; readonly text: string; readonly inputs: readonly ExactRef[] }

export type ProposedChange =
    | { readonly kind: 'statement'; readonly objectId: string; readonly expectedHead: Ref<'statement'> | 'none'; readonly body: StatementBody }
    | { readonly kind: 'evidence-link'; readonly objectId: string; readonly expectedHead: Ref<'evidence-link'> | 'none'; readonly body: EvidenceLinkBody };
export interface ProposalBody { readonly basis: NonEmpty<ExactRef>; readonly change: ProposedChange }

export type MechanicalFinding =
    | { readonly status: 'exact'; readonly anchor: { readonly profile: 'utf8-bytes@1'; readonly start: number; readonly end: number;
        readonly quoteDigest: Sha256Digest }; readonly context: 'verified' | 'not-applicable-verified' | 'waived' }
    | { readonly status: 'blocked'; readonly reason: 'context-unavailable' | 'blob-missing' | 'blob-redacted' | 'representation-missing' };
/** The V5 assessment is mechanical; ADR-010 excludes model advice records. */
export interface AssessmentBody { readonly subject: Ref<'evidence-link'>; readonly finding: MechanicalFinding }
export type Attestation =
    | { readonly level: 'workbench-gesture' | 'cli-tty' | 'unattested'; readonly surface: 'theia' | 'cli' | 'mcp'; readonly session: string }
    | { readonly level: 'webauthn-uv'; readonly assertionDigest: Sha256Digest };
export type FacetScope = Readonly<Record<string, 'preserved' | 'narrowed' | 'not-applicable'>>;
export type Decision =
    | { readonly question: 'evidence-support'; readonly subject: Ref<'evidence-link'>; readonly mechanical: Ref<'mechanical'>;
        readonly outcome: 'supported' | 'partial' | 'unsupported' | 'contradicted' | 'undetermined'; readonly scope: FacetScope;
        readonly contrary: readonly Ref<'evidence-link'>[]; readonly rationale: string }
    | { readonly question: 'claim-acceptance'; readonly subject: Ref<'statement'>; readonly snapshot: Ref<'snapshot'>;
        readonly outcome: 'accept' | 'reject' | 'defer' }
    | { readonly question: 'challenge-adoption'; readonly subject: Ref<'statement'>; readonly challenge: Ref<'evidence-link'>;
        readonly outcome: 'rebut' | 'defer' | { readonly adopt: StatementBody }; readonly rationale: string }
    | { readonly question: 'proposal-adoption'; readonly subject: Ref<'proposal'>; readonly outcome: 'adopt' | 'decline' | 'defer' }
    | { readonly question: 'context-waiver'; readonly subject: Ref<'evidence-link'>; readonly reason: string }
    | { readonly question: 'rights-release'; readonly subject: ExactRef; readonly to: Rights; readonly reason: string };
export interface AdjudicationBody {
    readonly decision: Decision;
    readonly attestation: Attestation;
    readonly presented: { readonly basisSchema: 'decision-basis@1'; readonly basisDigest: Sha256Digest };
    readonly libraryBuild: string;
}
export interface SnapshotBody {
    readonly basisRule: 'claim-basis@1';
    readonly selected: NonEmpty<Ref<'statement'>>;
    readonly asOfSeq: number;
    readonly members: { readonly basis: readonly ExactRef[]; readonly closureCount: number };
    readonly manifestDigest: Sha256Digest;
    readonly label: string;
}
/** A contract-level receipt body; transaction/chain persistence belongs to Core. */
export interface ReceiptBody {
    readonly command: string;
    readonly requestDigest: Sha256Digest;
    readonly seq: number;
    readonly written: readonly ExactRef[];
}

export interface ResearchBodies {
    readonly source: SourceBody;
    readonly representation: RepresentationBody;
    readonly artifact: ArtifactBody;
    readonly fragment: FragmentBody;
    readonly codebook: CodebookBody;
    readonly annotation: AnnotationBody;
    readonly statement: StatementBody;
    readonly 'evidence-link': EvidenceLinkBody;
    readonly protocol: ProtocolBody;
    readonly proposal: ProposalBody;
    readonly mechanical: AssessmentBody;
    readonly decision: AdjudicationBody;
    readonly snapshot: SnapshotBody;
    readonly receipt: ReceiptBody;
}

/** Exactly these nine fields are hashed by RFC 8785 / SHA-256; no envelope sequence or timestamps. */
export type RevisionPreimage<K extends ResearchKind = ResearchKind> = {
    [P in K]: {
        readonly projectId: string;
        readonly kind: P;
        readonly schema: `${P}@1`;
        readonly objectId: string;
        readonly parent: Ref<P> | 'none';
        readonly author: Extract<Principal, { kind: typeof AuthorOf[P] }>;
        readonly initiatedBy: typeof AuthorOf[P] extends 'researcher' ? ResearcherPrincipal : P extends 'proposal' ? AgentPrincipal : Principal;
        readonly origin: OriginOf<P>;
        readonly body: ResearchBodies[P];
    }
}[K];
export type ResearchRevision<K extends ResearchKind = ResearchKind> = {
    [P in K]: RevisionPreimage<P> & { readonly revisionId: Sha256Digest }
}[K];
export interface AcceptedRevision { readonly seq: number; readonly revision: ResearchRevision }
export type AssessmentRevision = ResearchRevision<'mechanical'>;
export type AdjudicationRevision = ResearchRevision<'decision'>;
