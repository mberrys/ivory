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
import { IvoryContractError } from './ivory-contract-error';
import { freeze } from './parse-research-record';
import { decisionKey, ResearchGraph, revisionRef } from './research-graph';
import { AcceptedRevision, NonEmpty, Ref } from './research-record';
import { semanticClosure } from './semantic-closure';

export interface SnapshotMembership {
    readonly basisRule: 'claim-basis@1';
    readonly selected: NonEmpty<Ref<'statement'>>;
    readonly asOfSeq: number;
    readonly basis: readonly ExactRef[];
    readonly members: readonly ExactRef[];
}

/**
 * Materialize incoming link heads, their finding heads, and DecisionKey heads at the
 * fence, then traverse forward from all explicit members. Snapshot attestations stay out.
 */
export function claimBasis(input: { readonly graph: ResearchGraph; readonly selected: readonly ExactRef[]; readonly asOfSeq: number }): SnapshotMembership {
    const { graph, asOfSeq } = input;
    if (input.selected.length === 0) {
        throw new IvoryContractError('invalid-record', 'a claim snapshot selects at least one statement');
    }
    const heads = graph.heads(asOfSeq);
    const available = new Set(graph.entries.filter(entry => entry.seq <= asOfSeq).map(entry => ExactRef.key(revisionRef(entry.revision))));
    const selected = [...new Map(input.selected.map(ref => {
        const parsed = graph.ref(ref, 'statement');
        if (!available.has(ExactRef.key(parsed))) {
            throw new IvoryContractError('invalid-history', 'selected revision is later than asOfSeq');
        }
        return [ExactRef.key(parsed), parsed] as const;
    })).values()].sort(ExactRef.compare);
    const statements = new Set(selected.map(ExactRef.key));
    const links = heads.filter(entry => entry.revision.kind === 'evidence-link' && statements.has(ExactRef.key(entry.revision.body.statement)));
    const linkRefs = new Set(links.map(entry => ExactRef.key(revisionRef(entry.revision))));
    const findingHeads = new Map<string, AcceptedRevision>();
    const decisionHeads = new Map<string, AcceptedRevision>();
    const latest = (index: Map<string, AcceptedRevision>, key: string, entry: AcceptedRevision): void => {
        const previous = index.get(key);
        if (previous && previous.seq === entry.seq) {
            throw new IvoryContractError('invalid-history', 'a finding or DecisionKey has two heads in the same commit');
        }
        if (!previous || previous.seq < entry.seq) {
            index.set(key, entry);
        }
    };
    for (const entry of heads) {
        const { revision } = entry;
        if (revision.kind === 'mechanical' && linkRefs.has(ExactRef.key(revision.body.subject))) {
            latest(findingHeads, ExactRef.key(revision.body.subject), entry);
        }
        if (revision.kind === 'decision' && revision.body.decision.question !== 'claim-acceptance') {
            const decision = revision.body.decision;
            // Include stale subject revisions too: the release predicate must be able to report them.
            if (selected.some(ref => ref.objectId === decision.subject.objectId) || links.some(link => link.revision.objectId === decision.subject.objectId)) {
                latest(decisionHeads, decisionKey(decision), entry);
            }
        }
    }
    const basis = [...new Map([...selected, ...links.map(entry => revisionRef(entry.revision)),
        ...[...findingHeads.values(), ...decisionHeads.values()].map(entry => revisionRef(entry.revision))].map(ref => [ExactRef.key(ref), ref])).values()]
        .sort(ExactRef.compare);
    const members = semanticClosure(graph.projectId, basis, graph.edges(), graph.refs());
    if (members.some(ref => !available.has(ExactRef.key(ref)))) {
        throw new IvoryContractError('invalid-history', 'snapshot closure contains a revision later than its fence');
    }
    // Deduplication cannot empty a non-empty selection.
    const normalizedSelected: NonEmpty<Ref<'statement'>> = [selected[0], ...selected.slice(1)];
    return freeze({ basisRule: 'claim-basis@1', selected: normalizedSelected, asOfSeq, basis, members });
}
