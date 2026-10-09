// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { canonicalJson, isPlainObject } from './canonical-json';
import { ExactRef } from './exact-ref';
import { IvoryContractError } from './ivory-contract-error';
import {
    AdjudicationBody, AgentPrincipal, Attestation, AuthorOf, Decision, EvidenceLinkBody, FacetScope,
    MechanicalFinding, NonEmpty, Origin, Principal, ProposedChange, Ref, ResearchBodies, ResearchKind,
    ResearcherPrincipal, RevisionPreimage, Rights, StatementBody, TextSelector
} from './research-record';
import { Sha256Digest } from './sha256-digest';

export const PREIMAGE_FIELDS = ['projectId', 'kind', 'schema', 'objectId', 'parent', 'author', 'initiatedBy', 'origin', 'body'] as const;

/** Parse before hashing. No coercion, defaults, unknown fields or unversioned bodies. */
export function parseRevisionPreimage(input: unknown): RevisionPreimage {
    canonicalJson(input);
    const value = record(input, PREIMAGE_FIELDS);
    const kind = researchKind(value.kind);
    if (value.schema !== `${kind}@1`) {
        throw new IvoryContractError('unsupported-schema', `unsupported ${kind} schema ${String(value.schema)}`);
    }
    const projectId = identifier(value.projectId);
    const objectId = identifier(value.objectId);
    const author = principal(value.author);
    const initiatedBy = principal(value.initiatedBy);
    if (author.kind !== AuthorOf[kind] || (author.kind === 'researcher' && initiatedBy.kind !== 'researcher')) {
        throw new IvoryContractError('invalid-author', `${kind} is authored by ${AuthorOf[kind]}; researcher commands require a researcher initiator`);
    }
    if (kind === 'proposal' && (initiatedBy.kind !== 'agent' || author.id !== initiatedBy.id)) {
        throw new IvoryContractError('invalid-author', 'an agent proposal retains its agent as author and initiator');
    }
    const parent = value.parent === 'none' ? 'none' : ExactRef.parse(value.parent, projectId);
    if (parent !== 'none' && parent.objectId !== objectId) {
        throw new IvoryContractError('invalid-history', 'a parent must be a revision of the same object');
    }
    const parsedOrigin = origin(value.origin, projectId);
    if (parsedOrigin.kind === 'carried-forward' && kind !== 'evidence-link') {
        throw new IvoryContractError('invalid-carry-forward', 'only EvidenceLinks can be carried forward');
    }
    if (parsedOrigin.kind === 'adopted' && author.kind !== 'researcher') {
        throw new IvoryContractError('invalid-author', 'adopted content is authored by a researcher and keeps its agent drafter in origin');
    }
    if (parsedOrigin.kind === 'adopted' && kind !== 'statement' && kind !== 'evidence-link') {
        throw new IvoryContractError('invalid-record', 'this schema supports adoption of statement and EvidenceLink proposals');
    }
    // Kind/body/schema and the kind-specific author have all been checked above and below.
    return freeze({ projectId, kind, schema: value.schema, objectId, parent, author, initiatedBy,
        origin: parsedOrigin, body: body(kind, value.body, projectId) }) as RevisionPreimage;
}

export function record(value: unknown, fields: readonly string[]): Record<string, unknown> {
    if (!isPlainObject(value) || Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) {
        throw new IvoryContractError('invalid-record', `expected exactly ${fields.join(', ')}`);
    }
    return value;
}

export function identifier(value: unknown): string {
    return ExactRef.parse({ projectId: value, objectId: 'identifier', revisionId: 'identifier' }).projectId;
}

function text(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new IvoryContractError('invalid-record', 'expected non-blank text');
    }
    return value;
}

export function integer(value: unknown, minimum = 0): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
        throw new IvoryContractError('invalid-record', `expected a safe integer >= ${minimum}`);
    }
    return value;
}

export function digest(value: unknown): Sha256Digest {
    if (!Sha256Digest.is(value)) {
        throw new IvoryContractError('digest-mismatch', 'expected sha256: followed by 64 lowercase hex digits');
    }
    return value;
}

function choice<T extends string>(value: unknown, values: readonly T[]): T {
    const found = values.find(candidate => candidate === value);
    if (found === undefined) {
        throw new IvoryContractError('invalid-record', `expected one of ${values.join(', ')}`);
    }
    return found;
}

export function researchKind(value: unknown): ResearchKind {
    return choice(value, Object.keys(AuthorOf) as ResearchKind[]);
}

function array<T>(value: unknown, parse: (item: unknown) => T): readonly T[] {
    if (!Array.isArray(value)) {
        throw new IvoryContractError('invalid-record', 'expected an array');
    }
    return value.map(parse);
}

function nonEmpty<T>(values: readonly T[]): NonEmpty<T> {
    if (values.length === 0) {
        throw new IvoryContractError('invalid-record', 'expected a non-empty array');
    }
    return [values[0], ...values.slice(1)];
}

function refs<K extends ResearchKind>(value: unknown, projectId: string): readonly Ref<K>[] {
    const parsed = array(value, item => ref<K>(item, projectId));
    if (new Set(parsed.map(ExactRef.key)).size !== parsed.length) {
        throw new IvoryContractError('invalid-record', 'duplicate exact references');
    }
    return parsed;
}

/** Wire shape only; ResearchGraph checks the brand against the retained target's kind. */
function ref<K extends ResearchKind>(value: unknown, projectId: string): Ref<K> {
    return ExactRef.parse(value, projectId) as Ref<K>;
}

function principal(value: unknown): Principal {
    const parsed = record(value, ['kind', 'id']);
    const id = identifier(parsed.id);
    switch (parsed.kind) {
        case 'researcher': return { kind: 'researcher', id };
        case 'agent': return { kind: 'agent', id };
        case 'core': return { kind: 'core', id };
        default: throw new IvoryContractError('invalid-author', 'unknown principal kind');
    }
}

function researcher(value: unknown): ResearcherPrincipal {
    const parsed = principal(value);
    if (parsed.kind !== 'researcher') {
        throw new IvoryContractError('invalid-author', 'expected a researcher principal');
    }
    return parsed;
}

function agent(value: unknown): AgentPrincipal {
    const parsed = principal(value);
    if (parsed.kind !== 'agent') {
        throw new IvoryContractError('invalid-author', 'expected an agent drafter');
    }
    return parsed;
}

function origin(value: unknown, projectId: string): Origin {
    if (!isPlainObject(value)) {
        throw new IvoryContractError('invalid-record', 'expected an origin');
    }
    switch (value.kind) {
        case 'direct':
            record(value, ['kind']);
            return { kind: 'direct' };
        case 'adopted':
            record(value, ['kind', 'proposal', 'adoption', 'drafter', 'edited']);
            if (typeof value.edited !== 'boolean') {
                throw new IvoryContractError('invalid-record', 'edited must be a boolean');
            }
            return { kind: 'adopted', proposal: ref(value.proposal, projectId), adoption: ref(value.adoption, projectId),
                drafter: agent(value.drafter), edited: value.edited };
        case 'carried-forward':
            record(value, ['kind', 'from', 'originalAuthor']);
            return { kind: 'carried-forward', from: ref(value.from, projectId), originalAuthor: researcher(value.originalAuthor) };
        default: throw new IvoryContractError('invalid-record', 'unknown origin kind');
    }
}

function rights(value: unknown): Rights {
    return choice(value, ['local-only', 'local-model-ok', 'remote-ok']);
}

function statement(value: unknown): StatementBody {
    const parsed = record(value, ['wording', 'scope']);
    return { wording: text(parsed.wording), scope: array(parsed.scope, text) };
}

function evidenceLink(value: unknown, projectId: string): EvidenceLinkBody {
    const parsed = record(value, ['statement', 'role', 'cited', 'context', 'rationale']);
    return { statement: ref(parsed.statement, projectId), role: choice(parsed.role, ['supports', 'challenges', 'qualifies', 'contextualizes']),
        cited: nonEmpty(refs(parsed.cited, projectId)), context: refs(parsed.context, projectId), rationale: text(parsed.rationale) };
}

function proposedChange(value: unknown, projectId: string): ProposedChange {
    const parsed = record(value, ['kind', 'objectId', 'expectedHead', 'body']);
    const objectId = identifier(parsed.objectId);
    const expectedHead = parsed.expectedHead === 'none' ? 'none' : ExactRef.parse(parsed.expectedHead, projectId);
    if (expectedHead !== 'none' && expectedHead.objectId !== objectId) {
        throw new IvoryContractError('invalid-history', 'proposal expected head must name its target object');
    }
    switch (parsed.kind) {
        case 'statement': return { kind: 'statement', objectId, expectedHead: expectedHead as Ref<'statement'> | 'none', body: statement(parsed.body) };
        case 'evidence-link': return { kind: 'evidence-link', objectId, expectedHead: expectedHead as Ref<'evidence-link'> | 'none',
            body: evidenceLink(parsed.body, projectId) };
        default: throw new IvoryContractError('invalid-record', 'unsupported proposed change');
    }
}

function selector(value: unknown): TextSelector {
    const parsed = record(value, ['profile', 'start', 'end', 'quote']);
    const start = integer(parsed.start);
    const end = integer(parsed.end, start + 1);
    return { profile: choice(parsed.profile, ['utf8-bytes@1']), start, end, quote: text(parsed.quote) };
}

function finding(value: unknown): MechanicalFinding {
    if (!isPlainObject(value)) {
        throw new IvoryContractError('invalid-record', 'expected a mechanical finding');
    }
    switch (value.status) {
        case 'exact': {
            record(value, ['status', 'anchor', 'context']);
            const anchor = record(value.anchor, ['profile', 'start', 'end', 'quoteDigest']);
            const start = integer(anchor.start);
            return { status: 'exact', anchor: { profile: choice(anchor.profile, ['utf8-bytes@1']), start,
                end: integer(anchor.end, start + 1), quoteDigest: digest(anchor.quoteDigest) },
            context: choice(value.context, ['verified', 'not-applicable-verified', 'waived']) };
        }
        case 'blocked':
            record(value, ['status', 'reason']);
            return { status: 'blocked', reason: choice(value.reason, ['context-unavailable', 'blob-missing', 'blob-redacted', 'representation-missing']) };
        default: throw new IvoryContractError('invalid-record', 'unknown mechanical finding status');
    }
}

function facetScope(value: unknown): FacetScope {
    if (!isPlainObject(value)) {
        throw new IvoryContractError('invalid-record', 'expected facet scope');
    }
    const entries = Object.entries(value).map(([facet, disposition]) => [text(facet), choice(disposition, ['preserved', 'narrowed', 'not-applicable'])]);
    return Object.fromEntries(entries);
}

function decision(value: unknown, projectId: string): Decision {
    if (!isPlainObject(value)) {
        throw new IvoryContractError('invalid-record', 'expected a decision');
    }
    switch (value.question) {
        case 'evidence-support':
            record(value, ['question', 'subject', 'mechanical', 'outcome', 'scope', 'contrary', 'rationale']);
            return { question: 'evidence-support', subject: ref(value.subject, projectId), mechanical: ref(value.mechanical, projectId),
                outcome: choice(value.outcome, ['supported', 'partial', 'unsupported', 'contradicted', 'undetermined']), scope: facetScope(value.scope),
                contrary: refs(value.contrary, projectId), rationale: text(value.rationale) };
        case 'claim-acceptance':
            record(value, ['question', 'subject', 'snapshot', 'outcome']);
            return { question: 'claim-acceptance', subject: ref(value.subject, projectId), snapshot: ref(value.snapshot, projectId),
                outcome: choice(value.outcome, ['accept', 'reject', 'defer']) };
        case 'challenge-adoption': {
            record(value, ['question', 'subject', 'challenge', 'outcome', 'rationale']);
            const outcome = isPlainObject(value.outcome)
                ? { adopt: statement(record(value.outcome, ['adopt']).adopt) } : choice(value.outcome, ['rebut', 'defer']);
            return { question: 'challenge-adoption', subject: ref(value.subject, projectId), challenge: ref(value.challenge, projectId),
                outcome, rationale: text(value.rationale) };
        }
        case 'proposal-adoption':
            record(value, ['question', 'subject', 'outcome']);
            return { question: 'proposal-adoption', subject: ref(value.subject, projectId), outcome: choice(value.outcome, ['adopt', 'decline', 'defer']) };
        case 'context-waiver':
            record(value, ['question', 'subject', 'reason']);
            return { question: 'context-waiver', subject: ref(value.subject, projectId), reason: text(value.reason) };
        case 'rights-release':
            record(value, ['question', 'subject', 'to', 'reason']);
            return { question: 'rights-release', subject: ExactRef.parse(value.subject, projectId), to: rights(value.to), reason: text(value.reason) };
        default: throw new IvoryContractError('invalid-record', 'unknown decision question');
    }
}

function attestation(value: unknown): Attestation {
    if (isPlainObject(value) && value.level === 'webauthn-uv') {
        record(value, ['level', 'assertionDigest']);
        return { level: 'webauthn-uv', assertionDigest: digest(value.assertionDigest) };
    }
    const parsed = record(value, ['level', 'surface', 'session']);
    return { level: choice(parsed.level, ['workbench-gesture', 'cli-tty', 'unattested']),
        surface: choice(parsed.surface, ['theia', 'cli', 'mcp']), session: identifier(parsed.session) };
}

function adjudication(value: unknown, projectId: string): AdjudicationBody {
    const parsed = record(value, ['decision', 'attestation', 'presented', 'libraryBuild']);
    const presented = record(parsed.presented, ['basisSchema', 'basisDigest']);
    return { decision: decision(parsed.decision, projectId), attestation: attestation(parsed.attestation),
        presented: { basisSchema: choice(presented.basisSchema, ['decision-basis@1']), basisDigest: digest(presented.basisDigest) },
        libraryBuild: text(parsed.libraryBuild) };
}

function body(kind: ResearchKind, value: unknown, projectId: string): ResearchBodies[ResearchKind] {
    switch (kind) {
        case 'source': {
            const parsed = record(value, ['name', 'blob', 'mediaType', 'rights', 'status']);
            return { name: text(parsed.name), blob: digest(parsed.blob), mediaType: text(parsed.mediaType), rights: rights(parsed.rights),
                status: choice(parsed.status, ['active', 'retracted']) };
        }
        case 'representation': {
            const parsed = record(value, ['source', 'blob', 'profile', 'converter', 'rights']);
            const converter = record(parsed.converter, ['id', 'version']);
            return { source: ref(parsed.source, projectId), blob: digest(parsed.blob), profile: choice(parsed.profile, ['utf8-text@1']),
                converter: { id: text(converter.id), version: text(converter.version) }, rights: rights(parsed.rights) };
        }
        case 'artifact': {
            const parsed = record(value, ['inputs', 'blob', 'profile', 'transformation', 'rights']);
            return { inputs: nonEmpty(refs(parsed.inputs, projectId)), blob: digest(parsed.blob), profile: choice(parsed.profile, ['utf8-text@1']),
                transformation: text(parsed.transformation), rights: rights(parsed.rights) };
        }
        case 'fragment': {
            const parsed = record(value, ['representation', 'representationDigest', 'selector']);
            return { representation: ref(parsed.representation, projectId), representationDigest: digest(parsed.representationDigest), selector: selector(parsed.selector) };
        }
        case 'codebook': {
            const parsed = record(value, ['name', 'edition', 'codes']);
            const codes = nonEmpty(array(parsed.codes, item => {
                const code = record(item, ['id', 'label', 'definition']);
                return { id: identifier(code.id), label: text(code.label), definition: text(code.definition) };
            }));
            if (new Set(codes.map(code => code.id)).size !== codes.length) {
                throw new IvoryContractError('invalid-record', 'duplicate code ids');
            }
            return { name: text(parsed.name), edition: integer(parsed.edition, 1), codes };
        }
        case 'annotation': {
            const parsed = record(value, ['fragment', 'codebook', 'codeId', 'rationale']);
            return { fragment: ref(parsed.fragment, projectId), codebook: ref(parsed.codebook, projectId), codeId: identifier(parsed.codeId), rationale: text(parsed.rationale) };
        }
        case 'statement': return statement(value);
        case 'evidence-link': return evidenceLink(value, projectId);
        case 'protocol': {
            const parsed = record(value, ['name', 'text', 'inputs']);
            return { name: text(parsed.name), text: text(parsed.text), inputs: refs(parsed.inputs, projectId) };
        }
        case 'proposal': {
            const parsed = record(value, ['basis', 'change']);
            return { basis: nonEmpty(refs(parsed.basis, projectId)), change: proposedChange(parsed.change, projectId) };
        }
        case 'mechanical': {
            const parsed = record(value, ['subject', 'finding']);
            return { subject: ref(parsed.subject, projectId), finding: finding(parsed.finding) };
        }
        case 'decision': return adjudication(value, projectId);
        case 'snapshot': {
            const parsed = record(value, ['basisRule', 'selected', 'asOfSeq', 'members', 'manifestDigest', 'label']);
            const members = record(parsed.members, ['basis', 'closureCount']);
            return { basisRule: choice(parsed.basisRule, ['claim-basis@1']), selected: nonEmpty(refs(parsed.selected, projectId)),
                asOfSeq: integer(parsed.asOfSeq), members: { basis: refs(members.basis, projectId), closureCount: integer(members.closureCount) },
                manifestDigest: digest(parsed.manifestDigest), label: text(parsed.label) };
        }
        case 'receipt': {
            const parsed = record(value, ['command', 'requestDigest', 'seq', 'written']);
            return { command: text(parsed.command), requestDigest: digest(parsed.requestDigest), seq: integer(parsed.seq, 1), written: refs(parsed.written, projectId) };
        }
        default: {
            const exhaustive: never = kind;
            return exhaustive;
        }
    }
}

/** Parsed values have no shared mutable containers with their caller. */
export function freeze<T>(value: T): T {
    if (typeof value === 'object' && value) {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}
