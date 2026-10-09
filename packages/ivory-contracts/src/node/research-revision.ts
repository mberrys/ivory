// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { canonicalJson } from '../common/canonical-json';
import { claimBasis } from '../common/claim-basis';
import { ExactRef } from '../common/exact-ref';
import { IvoryContractError } from '../common/ivory-contract-error';
import { digest, freeze, integer, parseRevisionPreimage, PREIMAGE_FIELDS, record } from '../common/parse-research-record';
import { ResearchGraph, revisionRef } from '../common/research-graph';
import { AcceptedRevision, ResearcherPrincipal, ResearchKind, ResearchRevision, RevisionPreimage, SnapshotBody } from '../common/research-record';
import { canonicalDigest } from './canonical-digest';

export function createRevision<K extends ResearchKind>(preimage: RevisionPreimage<K>): ResearchRevision<K> {
    const parsed = parseRevisionPreimage(preimage);
    // The parser checked the input discriminant and its matching body/author/schema.
    return freeze({ ...parsed, revisionId: canonicalDigest(parsed) }) as ResearchRevision<K>;
}

/** A revision id covers the nine-field preimage, never itself or store sequence metadata. */
export function parseRevision(value: unknown): ResearchRevision {
    canonicalJson(value);
    const parsed = record(value, [...PREIMAGE_FIELDS, 'revisionId']);
    const { revisionId: supplied, ...preimage } = parsed;
    const revision = createRevision(parseRevisionPreimage(preimage));
    if (digest(supplied) !== revision.revisionId) {
        throw new IvoryContractError('digest-mismatch', 'revisionId does not match the canonical preimage');
    }
    return revision;
}

export function readResearchGraph(projectId: string, input: unknown): ResearchGraph {
    canonicalJson(input);
    if (!Array.isArray(input)) {
        throw new IvoryContractError('invalid-record', 'accepted records must be an array');
    }
    const entries: AcceptedRevision[] = input.map(item => {
        const parsed = record(item, ['seq', 'revision']);
        return { seq: integer(parsed.seq, 1), revision: parseRevision(parsed.revision) };
    });
    const graph = new ResearchGraph(projectId, entries);
    for (const { seq, revision } of graph.entries) {
        if (revision.kind === 'snapshot') {
            if (revision.body.asOfSeq >= seq) {
                throw new IvoryContractError('snapshot-mismatch', 'a snapshot fence must precede its acceptance commit');
            }
            const expected = freezeSnapshotBody({ graph, selected: revision.body.selected, asOfSeq: revision.body.asOfSeq, label: revision.body.label });
            if (canonicalJson(expected) !== canonicalJson(revision.body)) {
                throw new IvoryContractError('snapshot-mismatch', 'snapshot basis, member count or manifest digest differs from its frozen closure');
            }
        }
    }
    return graph;
}

export function freezeSnapshotBody(input: {
    readonly graph: ResearchGraph; readonly selected: readonly ExactRef[]; readonly asOfSeq: number; readonly label: string
}): SnapshotBody {
    const membership = claimBasis(input);
    return freeze({ basisRule: membership.basisRule, selected: membership.selected, asOfSeq: membership.asOfSeq,
        members: { basis: membership.basis, closureCount: membership.members.length }, manifestDigest: canonicalDigest(membership), label: input.label });
}

/** An explicit copy to a later statement; it preserves authorship and keeps the initiator separate. */
export function carryForwardEvidenceLink(input: {
    readonly graph: ResearchGraph; readonly from: ExactRef; readonly to: ExactRef; readonly initiatedBy: ResearcherPrincipal
}): ResearchRevision<'evidence-link'> {
    const from = input.graph.get(input.from, 'evidence-link');
    const to = input.graph.ref(input.to, 'statement');
    return createRevision({ projectId: from.projectId, objectId: from.objectId, kind: 'evidence-link', schema: 'evidence-link@1',
        parent: revisionRef(from), author: from.author, initiatedBy: input.initiatedBy,
        origin: { kind: 'carried-forward', from: revisionRef(from), originalAuthor: from.author }, body: { ...from.body, statement: to } });
}
