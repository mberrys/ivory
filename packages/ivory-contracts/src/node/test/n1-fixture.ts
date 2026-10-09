// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
// N1 fixture text: Copyright (C) 2026 Berry Studio and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { readFileSync } from 'fs';
import * as path from 'path';
import { ResearchGraph, revisionRef } from '../../common/research-graph';
import {
    AcceptedRevision, AdjudicationBody, AgentPrincipal, CorePrincipal, Ref, ResearcherPrincipal,
    ResearchKind, ResearchRevision, RevisionPreimage
} from '../../common/research-record';
import { canonicalDigest } from '../canonical-digest';
import { carryForwardEvidenceLink, createRevision, freezeSnapshotBody, parseRevision, readResearchGraph } from '../research-revision';
import { blobDigest } from '../verify-fragment';

interface N1Input {
    readonly contract: string;
    readonly projectId: string;
    readonly transcript1: string;
    readonly transcript2: string;
    readonly table: string;
    readonly artifact: string;
    readonly correction: string;
    readonly claim1: string;
    readonly claim2: string;
    readonly competingClaim: string;
    readonly code1: string;
    readonly code2: string;
    readonly expected: { readonly snapshot1Members: number; readonly snapshot2Members: number };
}

export const n1Input: N1Input = JSON.parse(readFileSync(path.resolve(__dirname, '../../../test-resources/n1-research-fixture.json'), 'utf8'));
export const maya: ResearcherPrincipal = { kind: 'researcher', id: 'Maya' };
export const jordan: ResearcherPrincipal = { kind: 'researcher', id: 'Jordan' };
export const core: CorePrincipal = { kind: 'core', id: 'Core' };
export const drafter: AgentPrincipal = { kind: 'agent', id: 'DraftAgent' };

/** A test-only trace builder. It has no persistence, sessions or authority commands. */
export class N1Trace {
    readonly entries: AcceptedRevision[] = [];
    readonly blobs = new Map<string, Uint8Array>();

    append<K extends ResearchKind>(preimage: RevisionPreimage<K>): ResearchRevision<K> {
        return this.retain(createRevision(preimage));
    }

    retain<K extends ResearchKind>(revision: ResearchRevision<K>): ResearchRevision<K> {
        this.entries.push({ seq: this.entries.length + 1, revision: parseRevision(revision) });
        return revision;
    }

    graph(): ResearchGraph {
        return readResearchGraph(n1Input.projectId, this.entries);
    }

    blob(text: string): ReturnType<typeof blobDigest> {
        const bytes = Buffer.from(text, 'utf8');
        const digest = blobDigest(bytes);
        this.blobs.set(digest, bytes);
        return digest;
    }

    snapshot(objectId: string, selected: readonly Ref<'statement'>[]): ResearchRevision<'snapshot'> {
        const body = freezeSnapshotBody({ graph: this.graph(), selected, asOfSeq: this.entries.length, label: objectId });
        return this.append({ ...base(objectId), kind: 'snapshot', schema: 'snapshot@1', body });
    }
}

export function base(objectId: string): {
    projectId: string; objectId: string; parent: 'none'; author: ResearcherPrincipal; initiatedBy: ResearcherPrincipal; origin: { kind: 'direct' }
} {
    return { projectId: n1Input.projectId, objectId, parent: 'none', author: maya, initiatedBy: maya, origin: { kind: 'direct' } };
}

export function decisionBody(decision: AdjudicationBody['decision']): AdjudicationBody {
    return { decision, attestation: { level: 'cli-tty', surface: 'cli', session: 'n1-fixture' },
        presented: { basisSchema: 'decision-basis@1', basisDigest: canonicalDigest([decision.subject]) }, libraryBuild: 'n1-fixture@1' };
}

export function buildN1Trace(): {
    trace: N1Trace;
    source1: ResearchRevision<'source'>; source2: ResearchRevision<'source'>; replacement: ResearchRevision<'source'>;
    representation1: ResearchRevision<'representation'>; fragment1: ResearchRevision<'fragment'>;
    codebook1: ResearchRevision<'codebook'>; codebook2: ResearchRevision<'codebook'>;
    annotationMaya: ResearchRevision<'annotation'>; annotationJordan: ResearchRevision<'annotation'>;
    claim1: ResearchRevision<'statement'>; claim2: ResearchRevision<'statement'>; unrelated: ResearchRevision<'statement'>;
    challenge1: ResearchRevision<'evidence-link'>; carried: ResearchRevision<'evidence-link'>;
    mechanical1: ResearchRevision<'mechanical'>; support: ResearchRevision<'evidence-link'>;
    snapshot1: ResearchRevision<'snapshot'>; snapshot2: ResearchRevision<'snapshot'>;
} {
    const trace = new N1Trace();
    const source = (id: string, text: string): ResearchRevision<'source'> => trace.append({ ...base(id), kind: 'source', schema: 'source@1',
        body: { name: id, blob: trace.blob(text), mediaType: 'text/plain', rights: 'local-only', status: 'active' } });
    const source1 = source('T1', n1Input.transcript1);
    const source2 = source('T2', n1Input.transcript2);
    const table = source('table', n1Input.table);
    const representation = (id: string, sourceRevision: ResearchRevision<'source'>): ResearchRevision<'representation'> =>
        trace.append({ ...base(id), author: core, kind: 'representation', schema: 'representation@1', body: { source: revisionRef(sourceRevision),
            blob: sourceRevision.body.blob, profile: 'utf8-text@1', converter: { id: 'retained-text', version: '1' }, rights: 'local-only' } });
    const representation1 = representation('T1-text', source1);
    const representation2 = representation('T2-text', source2);
    const artifact = trace.append({ ...base('excerpt-matrix'), author: core, kind: 'artifact', schema: 'artifact@1',
        body: { inputs: [revisionRef(source1), revisionRef(source2), revisionRef(table)], blob: trace.blob(n1Input.artifact),
            profile: 'utf8-text@1', transformation: 'n1-excerpt-matrix@1', rights: 'local-only' } });
    const fragment = (id: string, representationRevision: ResearchRevision<'representation' | 'artifact'>, quote: string): ResearchRevision<'fragment'> =>
        trace.append({ ...base(id), kind: 'fragment', schema: 'fragment@1', body: { representation: revisionRef(representationRevision),
            representationDigest: representationRevision.body.blob,
            selector: { profile: 'utf8-bytes@1', start: 0, end: Buffer.byteLength(quote), quote } } });
    const fragment1 = fragment('T1-span', representation1, n1Input.transcript1);
    const fragment2 = fragment('T2-span', representation2, n1Input.transcript2);
    const tableFragment = fragment('matrix-span', artifact, n1Input.artifact);
    const codebook1 = trace.append({ ...base('codebook'), kind: 'codebook', schema: 'codebook@1',
        body: { name: 'Advising agency', edition: 1, codes: [{ id: 'agency', label: 'Agency', definition: n1Input.code1 }] } });
    const annotationMaya = trace.append({ ...base('maya-annotation'), kind: 'annotation', schema: 'annotation@1', body: {
        fragment: revisionRef(fragment1), codebook: revisionRef(codebook1), codeId: 'agency', rationale: 'The participant names a visible next step.' } });
    const claim1 = trace.append({ ...base('claim-a'), kind: 'statement', schema: 'statement@1', body: { wording: n1Input.claim1, scope: [] } });
    const claimB = trace.append({ ...base('claim-b'), author: jordan, initiatedBy: jordan, kind: 'statement', schema: 'statement@1',
        body: { wording: n1Input.competingClaim, scope: [] } });
    const challenge1 = trace.append({ ...base('jordan-challenge'), author: jordan, initiatedBy: jordan, kind: 'evidence-link', schema: 'evidence-link@1',
        body: { statement: revisionRef(claim1), cited: [revisionRef(fragment1), revisionRef(annotationMaya)], context: [revisionRef(fragment2)],
            role: 'challenges', rationale: 'The same material admits a negotiated reading.' } });
    trace.append({ ...base('support-b'), author: jordan, initiatedBy: jordan, kind: 'evidence-link', schema: 'evidence-link@1', body: {
        statement: revisionRef(claimB), role: 'supports', cited: [revisionRef(fragment1), revisionRef(tableFragment)], context: [], rationale: 'Relational language.' } });
    const exactFinding = { status: 'exact', anchor: { profile: 'utf8-bytes@1', start: 0, end: Buffer.byteLength(n1Input.transcript1),
        quoteDigest: blobDigest(Buffer.from(n1Input.transcript1)) }, context: 'not-applicable-verified' } as const;
    const mechanical1 = trace.append({ ...base('challenge-finding'), author: core, kind: 'mechanical', schema: 'mechanical@1',
        body: { subject: revisionRef(challenge1), finding: exactFinding } });
    const challengeDecision1 = trace.append({ ...base('challenge-decision'), kind: 'decision', schema: 'decision@1', body: decisionBody({
        question: 'challenge-adoption', subject: revisionRef(claim1), challenge: revisionRef(challenge1), outcome: 'defer', rationale: 'Keep the competing reading.' }) });
    const unrelated = trace.append({ ...base('unrelated-note'), kind: 'statement', schema: 'statement@1',
        body: { wording: 'An unrelated activity must not enter a snapshot.', scope: [] } });
    const snapshot1 = trace.snapshot('S1', [revisionRef(claim1)]);

    const codebook2 = trace.append({ ...base('codebook'), parent: revisionRef(codebook1), author: jordan, initiatedBy: jordan,
        kind: 'codebook', schema: 'codebook@1', body: { name: 'Advising agency', edition: 2,
            codes: [{ id: 'agency', label: 'Agency', definition: n1Input.code2 }, { id: 'negotiation', label: 'Negotiation', definition: 'Jointly negotiated agency.' }] } });
    const annotationJordan = trace.append({ ...base('jordan-annotation'), author: jordan, initiatedBy: jordan, kind: 'annotation', schema: 'annotation@1',
        body: { fragment: revisionRef(fragment1), codebook: revisionRef(codebook2), codeId: 'negotiation', rationale: 'A competing interpretation of the same span.' } });
    const replacement = trace.append({ ...base('T1'), parent: revisionRef(source1), kind: 'source', schema: 'source@1',
        body: { ...source1.body, blob: trace.blob(n1Input.correction) } });
    const claim2 = trace.append({ ...base('claim-a'), parent: revisionRef(claim1), kind: 'statement', schema: 'statement@1',
        body: { wording: n1Input.claim2, scope: [] } });
    const carried = trace.retain(carryForwardEvidenceLink({ graph: trace.graph(), from: revisionRef(challenge1), to: revisionRef(claim2), initiatedBy: maya }));
    trace.append({ ...base('challenge-finding'), parent: revisionRef(mechanical1), author: core, kind: 'mechanical', schema: 'mechanical@1',
        body: { subject: revisionRef(carried), finding: exactFinding } });
    trace.append({ ...base('challenge-decision'), parent: revisionRef(challengeDecision1), kind: 'decision', schema: 'decision@1', body: decisionBody({
        question: 'challenge-adoption', subject: revisionRef(claim2), challenge: revisionRef(carried), outcome: 'defer', rationale: 'The challenge remains open.' }) });
    const support = trace.append({ ...base('support-a2'), kind: 'evidence-link', schema: 'evidence-link@1', body: { statement: revisionRef(claim2),
        cited: [revisionRef(fragment1), revisionRef(annotationJordan)], context: [], role: 'supports', rationale: 'The revised codebook qualifies the reading.' } });
    const supportFinding = trace.append({ ...base('support-finding'), author: core, kind: 'mechanical', schema: 'mechanical@1',
        body: { subject: revisionRef(support), finding: exactFinding } });
    trace.append({ ...base('support-decision'), kind: 'decision', schema: 'decision@1', body: decisionBody({ question: 'evidence-support',
        subject: revisionRef(support), mechanical: revisionRef(supportFinding), outcome: 'supported', scope: {}, contrary: [], rationale: 'Researcher judgment.' }) });
    const snapshot2 = trace.snapshot('S2', [revisionRef(claim2)]);
    return { trace, source1, source2, replacement, representation1, fragment1, codebook1, codebook2, annotationMaya, annotationJordan,
        claim1, claim2, unrelated, challenge1, carried, mechanical1, support, snapshot1, snapshot2 };
}
