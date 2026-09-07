// *****************************************************************************
// Copyright (C) 2026 Berry Studio and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ResearchClient } from './clients';
import { ResearchKernel } from './kernel';
import { ClaimPayload, ExactRef, SnapshotRecord } from './types';

export interface AdvisingAgencyFixture {
    readonly kernel: ResearchKernel;
    readonly t1: ExactRef;
    readonly t2: ExactRef;
    readonly table: ExactRef;
    readonly artifact: ExactRef;
    readonly fragment: ExactRef;
    readonly tableFragment: ExactRef;
    readonly codebook1: ExactRef;
    readonly annotationMaya: ExactRef;
    readonly claimA1: ExactRef;
    readonly claimB: ExactRef;
    readonly challengeA1: ExactRef;
    readonly snapshot1: SnapshotRecord;
    readonly codebook2: ExactRef;
    readonly annotationJordan: ExactRef;
    readonly t1Replacement: ExactRef;
    readonly claimA2: ExactRef;
    readonly carriedLinks: readonly ExactRef[];
    readonly snapshot2: SnapshotRecord;
    readonly unrelatedNote: ExactRef;
}

/**
 * The N1 golden trace. It intentionally freezes S1 before source/codebook/claim revisions and
 * then performs every mutation that could otherwise silently re-anchor a citation.
 */
export function buildAdvisingAgencyFixture(clientOrKernel: ResearchClient | ResearchKernel = new ResearchKernel()): AdvisingAgencyFixture {
    const client = clientOrKernel instanceof ResearchKernel ? new ResearchClient(clientOrKernel, 'cli') : clientOrKernel;
    const kernel = client.kernel;
    const t1 = client.admitSource({ name: 'T1 Maya interview', bytes: 'Maya said advising made the next step visible.', actor: 'Maya' });
    const t2 = client.admitSource({
        name: 'T2 Jordan interview',
        bytes: 'Jordan described advising as negotiated agency.',
        actor: 'Jordan',
    });
    const table = client.admitSource({
        name: 'Imported coding table',
        bytes: 'sheet,row,column,value\nExcerpt,2,agency,negotiated',
        actor: 'Maya',
    });
    const artifact = client.admitArtifact({
        key: 'advising-excerpt-matrix',
        sourceRefs: [t1, t2, table],
        output: 'T1 | visible next step | agency\nT2 | negotiated agency | agency',
        actor: 'Maya',
    });
    const fragment = client.createFragment({
        sourceRef: t1,
        artifactRef: artifact,
        selector: { kind: 'text', start: 0, end: 48, quote: 'Maya said advising made the next step visible.' },
        actor: 'Maya',
        fragmentKey: 't1-agency-span',
    });
    const tableFragment = client.createFragment({
        sourceRef: table,
        artifactRef: artifact,
        selector: { kind: 'table', sheet: 'Excerpt', row: 2, column: 'agency', value: 'negotiated' },
        actor: 'Maya',
        fragmentKey: 'table-agency-cell',
    });
    const codebook1 = client.createCodebook({
        key: 'advising-agency',
        name: 'Advising agency',
        codes: [
            { id: 'agency', label: 'Agency', definition: 'A participant describes capacity to act.' },
            { id: 'support', label: 'Support', definition: 'A participant describes relational support.' },
        ],
        actor: 'Maya',
    });
    const annotationMaya = client.annotate({
        key: 'maya-agency-t1',
        fragmentRef: fragment,
        codebookRef: codebook1,
        codeId: 'agency',
        actor: 'Maya',
        rationale: 'The participant names a visible next step.',
    });
    const claimA1 = client.createClaim({
        key: 'claim-a',
        text: 'Advising makes agency visible by turning uncertainty into a next step.',
        author: 'Maya',
        status: 'accepted',
    });
    const claimB = client.createClaim({
        key: 'claim-b',
        text: 'Agency is negotiated with the advisor rather than simply revealed by advising.',
        author: 'Jordan',
        status: 'accepted',
    });
    const challengeA1 = client.createEvidenceLink({
        key: 'jordan-challenges-a1',
        claimRef: claimA1,
        targets: [fragment, annotationMaya],
        role: 'challenges',
        rationale: 'The same material admits a negotiated reading.',
        linkAuthor: 'Jordan',
    });
    const supportB = client.createEvidenceLink({
        key: 'jordan-supports-b',
        claimRef: claimB,
        targets: [fragment, tableFragment],
        role: 'supports',
        rationale: 'The transcript and table use relational language.',
        linkAuthor: 'Jordan',
    });
    const unrelatedNote = client.createClaim({
        key: 'unrelated-note',
        text: 'Unrelated live note must not enter S1 through provenance.',
        author: 'Jordan',
        status: 'proposed',
    });
    kernel.addActivityEdge(kernel.getRevision(challengeA1).activityId, { kind: 'used-by', target: unrelatedNote });
    const snapshot1 = client.freezeSnapshot({
        label: 'S1 before revision sequence',
        researcher: 'Maya',
        selected: [t1, t2, table, artifact],
        context: [fragment, tableFragment, codebook1, annotationMaya, claimA1, claimB, challengeA1, supportB],
        createdAt: '2026-09-07T12:00:00.000Z',
    });

    const codebook2 = client.reviseCodebook({
        codebookRef: codebook1,
        expectedHead: codebook1.revisionId,
        codes: [
            { id: 'agency', label: 'Agency', definition: 'A participant describes capacity to act with or against constraints.' },
            { id: 'support', label: 'Support', definition: 'A participant describes relational support.' },
            { id: 'negotiation', label: 'Negotiation', definition: 'A participant describes agency as jointly negotiated.' },
        ],
        actor: 'Jordan',
    });
    const annotationJordan = client.annotate({
        key: 'jordan-negotiation-t1',
        fragmentRef: fragment,
        codebookRef: codebook2,
        codeId: 'negotiation',
        actor: 'Jordan',
        rationale: 'The span can support a competing negotiated interpretation.',
    });
    const t1Replacement = client.replaceSource({
        name: 'T1 Maya interview',
        bytes: 'Maya said advising made the next move visible.',
        actor: 'Maya',
        sourceId: t1.objectId,
        expectedHead: t1.revisionId,
    });
    const claimA2 = client.reviseClaim({
        claimRef: claimA1,
        expectedHead: claimA1.revisionId,
        text: 'Advising makes agency visible by helping a participant name a next step.',
        actor: 'Maya',
    });
    const carriedLinks = client.carryForwardLinks(claimA1, claimA2, 'Maya');
    const snapshot2 = client.freezeSnapshot({
        label: 'S2 after revision sequence',
        researcher: 'Maya',
        selected: [t1Replacement, t2, table, artifact],
        context: [
            fragment,
            tableFragment,
            codebook2,
            annotationMaya,
            annotationJordan,
            claimA2,
            claimB,
            challengeA1,
            supportB,
            ...carriedLinks,
        ],
        createdAt: '2026-09-07T12:30:00.000Z',
    });
    return {
        kernel,
        t1,
        t2,
        table,
        artifact,
        fragment,
        tableFragment,
        codebook1,
        annotationMaya,
        claimA1,
        claimB,
        challengeA1,
        snapshot1,
        codebook2,
        annotationJordan,
        t1Replacement,
        claimA2,
        carriedLinks,
        snapshot2,
        unrelatedNote,
    };
}

export function claimPayload(kernel: ResearchKernel, ref: ExactRef): ClaimPayload {
    return kernel.getRevision(ref).payload as ClaimPayload;
}
