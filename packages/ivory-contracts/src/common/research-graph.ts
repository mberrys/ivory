// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { canonicalJson } from './canonical-json';
import { ExactRef } from './exact-ref';
import { IvoryContractError } from './ivory-contract-error';
import { freeze, identifier, integer } from './parse-research-record';
import { AcceptedRevision, Decision, EvidenceLinkBody, Ref, ResearchKind, ResearchRevision } from './research-record';
import { DependencyEdge } from './semantic-closure';

interface TypedDependency { readonly ref: ExactRef; readonly kinds: readonly ResearchKind[] }
const ANY_KIND: readonly ResearchKind[] = [];

export function revisionRef<K extends ResearchKind>(revision: ResearchRevision<K>): Ref<K> {
    return ExactRef.parse({ projectId: revision.projectId, objectId: revision.objectId, revisionId: revision.revisionId }) as Ref<K>;
}

/** Semantic dependencies come from schema fields, never a caller-supplied edge list. */
export function semanticDependencies(revision: ResearchRevision): readonly TypedDependency[] {
    const dependency = (ref: ExactRef, ...kinds: ResearchKind[]): TypedDependency => ({ ref, kinds });
    const arbitrary = (refs: readonly ExactRef[]): TypedDependency[] => refs.map(ref => dependency(ref));
    const link = (body: EvidenceLinkBody): TypedDependency[] => [dependency(body.statement, 'statement'),
        ...body.cited.map(ref => dependency(ref, 'fragment', 'annotation', 'artifact')), ...arbitrary(body.context)];
    switch (revision.kind) {
        case 'source': case 'codebook': case 'statement': case 'receipt': return [];
        case 'representation': return [dependency(revision.body.source, 'source')];
        case 'artifact': return arbitrary(revision.body.inputs);
        case 'fragment': return [dependency(revision.body.representation, 'representation', 'artifact')];
        case 'annotation': return [dependency(revision.body.fragment, 'fragment'), dependency(revision.body.codebook, 'codebook')];
        case 'evidence-link': return link(revision.body);
        case 'protocol': return arbitrary(revision.body.inputs);
        case 'proposal': {
            const change = revision.body.change;
            return [...arbitrary(revision.body.basis), ...(change.expectedHead === 'none' ? [] : [dependency(change.expectedHead, change.kind)]),
                ...(change.kind === 'evidence-link' ? link(change.body) : [])];
        }
        case 'mechanical': return [dependency(revision.body.subject, 'evidence-link')];
        case 'decision': {
            const decision = revision.body.decision;
            switch (decision.question) {
                case 'evidence-support': return [dependency(decision.subject, 'evidence-link'), dependency(decision.mechanical, 'mechanical'),
                    ...decision.contrary.map(ref => dependency(ref, 'evidence-link'))];
                case 'claim-acceptance': return [dependency(decision.subject, 'statement'), dependency(decision.snapshot, 'snapshot')];
                case 'challenge-adoption': return [dependency(decision.subject, 'statement'), dependency(decision.challenge, 'evidence-link')];
                case 'proposal-adoption': return [dependency(decision.subject, 'proposal')];
                case 'context-waiver': return [dependency(decision.subject, 'evidence-link')];
                case 'rights-release': return [dependency(decision.subject)];
                default: {
                    const exhaustive: never = decision;
                    return exhaustive;
                }
            }
        }
        case 'snapshot': return [...revision.body.selected.map(ref => dependency(ref, 'statement')), ...arbitrary(revision.body.members.basis)];
        default: {
            const exhaustive: never = revision;
            return exhaustive;
        }
    }
}

/** Object id, not revision id, identifies the key; currency still uses the exact subject. */
export function decisionKey(decision: Decision): string {
    return canonicalJson([decision.question, decision.subject.objectId,
        decision.question === 'challenge-adoption' ? decision.challenge.objectId : 'none']);
}

/** The precondition for one accepted-head update. It performs no mutation. */
export function validateRevisionTransition(input: {
    readonly revision: ResearchRevision; readonly expectedHead: ExactRef | 'none'; readonly currentHead: ResearchRevision | 'none'
}): void {
    const { revision, expectedHead, currentHead } = input;
    if (expectedHead !== 'none') {
        ExactRef.parse(expectedHead, revision.projectId);
    }
    if (currentHead === 'none') {
        if (expectedHead !== 'none' || revision.parent !== 'none') {
            throw new IvoryContractError('expected-head-conflict', 'a new object requires an absent head and no parent');
        }
        return;
    }
    if (currentHead.projectId !== revision.projectId) {
        throw new IvoryContractError('cross-project-ref', 'the current head belongs to another project');
    }
    if (currentHead.kind !== revision.kind || currentHead.objectId !== revision.objectId) {
        throw new IvoryContractError('wrong-type', 'an object cannot change kind or identity');
    }
    const head = revisionRef(currentHead);
    if (expectedHead === 'none' || !ExactRef.equals(expectedHead, head) || revision.parent === 'none' || !ExactRef.equals(revision.parent, head)) {
        throw new IvoryContractError('expected-head-conflict', 'the expected head and parent must both name the current head');
    }
    if (revision.kind === 'decision' && currentHead.kind === 'decision' && decisionKey(revision.body.decision) !== decisionKey(currentHead.body.decision)) {
        throw new IvoryContractError('invalid-history', 'a decision object cannot change DecisionKey');
    }
}

/**
 * A read-only graph over parsed, digest-verified revisions, not a second acceptance store.
 * Use readResearchGraph in node to parse untrusted records. Core supplies their commit sequences.
 */
export class ResearchGraph {
    readonly entries: readonly AcceptedRevision[];
    private readonly byRef = new Map<string, AcceptedRevision>();

    constructor(readonly projectId: string, entries: readonly AcceptedRevision[]) {
        identifier(projectId);
        this.entries = freeze([...entries].sort((a, b) => a.seq - b.seq));
        const heads = new Map<string, ResearchRevision>();
        const decisionCommits = new Set<string>();
        for (const entry of this.entries) {
            integer(entry.seq, 1);
            const ref = ExactRef.parse(revisionRef(entry.revision), projectId);
            const key = ExactRef.key(ref);
            if (this.byRef.has(key)) {
                throw new IvoryContractError('invalid-history', 'an immutable revision can be accepted only once');
            }
            const head = heads.get(ref.objectId) ?? 'none';
            if (head !== 'none' && this.byRef.get(ExactRef.key(revisionRef(head)))?.seq === entry.seq) {
                throw new IvoryContractError('invalid-history', 'one object has at most one revision in a commit');
            }
            validateRevisionTransition({ revision: entry.revision, expectedHead: entry.revision.parent, currentHead: head });
            if (entry.revision.kind === 'decision') {
                const decisionCommit = canonicalJson([entry.seq, decisionKey(entry.revision.body.decision)]);
                if (decisionCommits.has(decisionCommit)) {
                    throw new IvoryContractError('invalid-history', 'one DecisionKey has at most one head in a commit');
                }
                decisionCommits.add(decisionCommit);
            }
            this.byRef.set(key, entry);
            heads.set(ref.objectId, entry.revision);
        }
        for (const entry of this.entries) {
            for (const dependency of semanticDependencies(entry.revision)) {
                const target = this.require(dependency.ref, dependency.kinds);
                if (target.seq > entry.seq) {
                    throw new IvoryContractError('invalid-history', 'a semantic input cannot come from a later commit');
                }
            }
            this.checkBody(entry);
        }
    }

    get<K extends ResearchKind>(ref: ExactRef, kind: K): ResearchRevision<K>;
    get(ref: ExactRef): ResearchRevision;
    get(ref: ExactRef, kind?: ResearchKind): ResearchRevision {
        return this.require(ref, kind ? [kind] : ANY_KIND).revision;
    }

    ref<K extends ResearchKind>(value: unknown, kind: K): Ref<K> {
        const parsed = ExactRef.parse(value, this.projectId);
        this.require(parsed, [kind]);
        return parsed as Ref<K>;
    }

    refs(): readonly ExactRef[] {
        return freeze(this.entries.map(entry => revisionRef(entry.revision)).sort(ExactRef.compare));
    }

    heads(asOfSeq: number): readonly AcceptedRevision[] {
        integer(asOfSeq);
        if (asOfSeq > (this.entries.at(-1)?.seq ?? 0)) {
            throw new IvoryContractError('invalid-history', 'asOfSeq must not be in the future');
        }
        const heads = new Map<string, AcceptedRevision>();
        for (const entry of this.entries) {
            if (entry.seq <= asOfSeq) {
                heads.set(entry.revision.objectId, entry);
            }
        }
        return freeze([...heads.values()]);
    }

    edges(): readonly DependencyEdge[] {
        return freeze(this.entries.flatMap(({ revision }) => {
            const from = revisionRef(revision);
            const edges: DependencyEdge[] = semanticDependencies(revision).map(({ ref }) => ({ kind: 'semantic', from, to: ref }));
            if (revision.origin.kind === 'carried-forward') {
                edges.push({ kind: 'activity', from, to: revision.origin.from });
            } else if (revision.origin.kind === 'adopted') {
                edges.push({ kind: 'activity', from, to: revision.origin.proposal }, { kind: 'activity', from, to: revision.origin.adoption });
            }
            if (revision.kind === 'receipt') {
                edges.push(...revision.body.written.map(to => ({ kind: 'activity' as const, from, to })));
            }
            return edges;
        }));
    }

    private require(ref: ExactRef, kinds: readonly ResearchKind[]): AcceptedRevision {
        const parsed = ExactRef.parse(ref, this.projectId);
        const entry = this.byRef.get(ExactRef.key(parsed));
        if (!entry) {
            throw new IvoryContractError('dangling-ref', `revision ${ExactRef.key(parsed)} is not retained`);
        }
        if (kinds.length > 0 && !kinds.includes(entry.revision.kind)) {
            throw new IvoryContractError('wrong-type', `expected ${kinds.join(' or ')}, found ${entry.revision.kind}`);
        }
        return entry;
    }

    private checkBody(entry: AcceptedRevision): void {
        const { revision } = entry;
        if (revision.kind === 'annotation' && !this.get(revision.body.codebook, 'codebook').body.codes.some(code => code.id === revision.body.codeId)) {
            throw new IvoryContractError('invalid-record', 'annotation code is absent from its exact codebook edition');
        }
        if (revision.kind === 'fragment') {
            const representation = this.require(revision.body.representation, ['representation', 'artifact']).revision;
            if ((representation.kind === 'representation' || representation.kind === 'artifact') && representation.body.blob !== revision.body.representationDigest) {
                throw new IvoryContractError('digest-mismatch', 'fragment representation digest does not match its retained revision');
            }
        }
        if (revision.kind === 'decision' && revision.body.decision.question === 'evidence-support') {
            const decision = revision.body.decision;
            const mechanical = this.get(decision.mechanical, 'mechanical');
            if (mechanical.body.finding.status !== 'exact' || !ExactRef.equals(mechanical.body.subject, decision.subject)) {
                throw new IvoryContractError('invalid-record', 'support decisions require an exact finding on the same link revision');
            }
        }
        if (revision.kind === 'decision' && revision.body.decision.question === 'challenge-adoption') {
            const decision = revision.body.decision;
            const link = this.get(decision.challenge, 'evidence-link');
            if (link.body.role !== 'challenges' || !ExactRef.equals(link.body.statement, decision.subject)) {
                throw new IvoryContractError('invalid-record', 'challenge adoption must name a challenge to its exact statement');
            }
        }
        if (revision.origin.kind === 'carried-forward') {
            if (revision.kind !== 'evidence-link') {
                throw new IvoryContractError('invalid-carry-forward', 'only EvidenceLinks can be carried forward');
            }
            const original = this.get(revision.origin.from, 'evidence-link');
            const statement = this.get(revision.body.statement, 'statement');
            if (this.require(revision.origin.from, ['evidence-link']).seq >= entry.seq
                || canonicalJson(original.author) !== canonicalJson(revision.author)
                || canonicalJson(original.author) !== canonicalJson(revision.origin.originalAuthor)
                || original.body.statement.objectId !== statement.objectId
                || this.require(revision.body.statement, ['statement']).seq <= this.require(original.body.statement, ['statement']).seq
                || canonicalJson({ ...original.body, statement: revision.body.statement }) !== canonicalJson(revision.body)) {
                throw new IvoryContractError('invalid-carry-forward', 'carry-forward preserves the link and author and explicitly targets a later statement revision');
            }
        }
        if (revision.origin.kind === 'adopted') {
            const proposal = this.get(revision.origin.proposal, 'proposal');
            const adoptionRevision = this.get(revision.origin.adoption, 'decision');
            const adoption = adoptionRevision.body.decision;
            if (canonicalJson(proposal.author) !== canonicalJson(revision.origin.drafter) || adoption.question !== 'proposal-adoption'
                || canonicalJson(adoptionRevision.author) !== canonicalJson(revision.author)
                || adoption.outcome !== 'adopt' || !ExactRef.equals(adoption.subject, revision.origin.proposal)
                || proposal.body.change.kind !== revision.kind || proposal.body.change.objectId !== revision.objectId
                || canonicalJson(proposal.body.change.expectedHead) !== canonicalJson(revision.parent)
                || (!revision.origin.edited && canonicalJson(proposal.body.change.body) !== canonicalJson(revision.body))) {
                throw new IvoryContractError('invalid-record', 'adopted content must retain the proposal, adopting decision and agent drafter');
            }
        }
        const activity = revision.origin.kind === 'direct' ? [] : revision.origin.kind === 'carried-forward'
            ? [revision.origin.from] : [revision.origin.proposal, revision.origin.adoption];
        const activityRefs = revision.kind === 'receipt' ? [...activity, ...revision.body.written] : activity;
        if (activityRefs.some(ref => this.require(ref, ANY_KIND).seq > entry.seq)) {
            throw new IvoryContractError('invalid-history', 'provenance cannot reference a later commit');
        }
        if (revision.kind === 'receipt' && (revision.body.seq !== entry.seq
            || revision.body.written.some(ref => this.require(ref, ANY_KIND).seq !== entry.seq))) {
            throw new IvoryContractError('invalid-record', 'a receipt names the revisions written in its own commit');
        }
    }
}
