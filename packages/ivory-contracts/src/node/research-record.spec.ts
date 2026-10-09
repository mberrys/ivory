// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { readFileSync } from 'fs';
import * as path from 'path';
import { canonicalJson } from '../common/canonical-json';
import { claimBasis } from '../common/claim-basis';
import { ExactRef } from '../common/exact-ref';
import { PREIMAGE_FIELDS, record } from '../common/parse-research-record';
import { ResearchGraph, revisionRef, validateRevisionTransition } from '../common/research-graph';
import { AuthorOf, ResearchRevision, RevisionPreimage } from '../common/research-record';
import { semanticClosure } from '../common/semantic-closure';
import { refusalCode } from '../common/test/refusal-code';
import { canonicalDigest } from './canonical-digest';
import { carryForwardEvidenceLink, createRevision, freezeSnapshotBody, parseRevision, readResearchGraph } from './research-revision';
import { base, buildN1Trace, core, decisionBody, drafter, jordan, maya, n1Input } from './test/n1-fixture';
import { blobDigest, verifyFragment } from './verify-fragment';

function preimage(revision: ResearchRevision): Record<string, unknown> {
    const { revisionId, ...value } = revision;
    return record(value, PREIMAGE_FIELDS);
}

function sealed(value: Record<string, unknown>): unknown {
    return { ...value, revisionId: canonicalDigest(value) };
}

function withRecord(fixture: ReturnType<typeof buildN1Trace>, value: Record<string, unknown>): ResearchGraph {
    return readResearchGraph(n1Input.projectId, [...fixture.trace.entries, { seq: fixture.trace.entries.length + 1, revision: sealed(value) }]);
}

function members(graph: ResearchGraph, snapshot: ResearchRevision<'snapshot'>): readonly ExactRef[] {
    return claimBasis({ graph, selected: snapshot.body.selected, asOfSeq: snapshot.body.asOfSeq }).members;
}

describe('ivory-research@1 immutable revisions', () => {
    const fixture = buildN1Trace();

    it('hashes the specified nine-field preimage and parses the same immutable identity', () => {
        for (const { revision } of fixture.trace.entries) {
            expect(revision.revisionId).to.equal(canonicalDigest(preimage(revision)));
            expect(parseRevision(JSON.parse(JSON.stringify(revision)))).to.deep.equal(revision);
            expect(Object.isFrozen(revision)).to.be.true;
            expect(Object.isFrozen(revision.body)).to.be.true;
        }
    });

    it('binds author, initiator, origin, schema and body to the identity', () => {
        const original = fixture.claim1;
        for (const value of [
            { ...preimage(original), author: jordan }, { ...preimage(original), initiatedBy: jordan },
            { ...preimage(original), body: { ...original.body, wording: 'A different interpretation.' } }
        ]) {
            expect(canonicalDigest(value)).to.not.equal(original.revisionId);
        }
    });

    it('copies input containers and freezes nested data', () => {
        const scope = ['pilot'];
        const input: RevisionPreimage<'statement'> = { ...base('immutable'), kind: 'statement', schema: 'statement@1',
            body: { wording: 'A bounded statement.', scope } };
        const revision = createRevision(input);
        scope.push('silently broadened');
        expect(revision.body.scope).to.deep.equal(['pilot']);
        expect(() => Object.assign(revision.body, { wording: 'changed' })).to.throw(TypeError);
        expect(() => Object.assign(revision.author, { id: 'other' })).to.throw(TypeError);
    });

    it('refuses a changed body under an old revision digest', () => {
        expect(refusalCode(() => parseRevision({ ...fixture.claim1, body: { ...fixture.claim1.body, wording: 'tampered' } }))).to.equal('digest-mismatch');
    });

    it('refuses non-canonical digest spelling', () => {
        expect(refusalCode(() => parseRevision({ ...fixture.claim1, revisionId: fixture.claim1.revisionId.toUpperCase() }))).to.equal('digest-mismatch');
    });

    it('refuses unknown schemas and unversioned revisions', () => {
        for (const schema of ['statement@2', 'statement', 'source@1']) {
            expect(refusalCode(() => parseRevision(sealed({ ...preimage(fixture.claim1), schema })))).to.equal('unsupported-schema');
        }
    });

    it('refuses fields outside the schema, including confidence', () => {
        expect(refusalCode(() => parseRevision({ ...fixture.claim1, confidence: 0.99 }))).to.equal('invalid-record');
        expect(refusalCode(() => parseRevision(sealed({ ...preimage(fixture.claim1), body: { ...fixture.claim1.body, confidence: 0.99 } })))).to.equal('invalid-record');
    });

    it('refuses sparse, cyclic and non-JSON input at the boundary', () => {
        expect(refusalCode(() => readResearchGraph(n1Input.projectId, new Array(1)))).to.equal('unsupported-value');
        const cycle: unknown[] = [];
        cycle.push(cycle);
        expect(refusalCode(() => readResearchGraph(n1Input.projectId, cycle))).to.equal('cyclic-value');
    });

    it('enforces the fixed author table for every kind in the trace', () => {
        for (const { revision } of fixture.trace.entries) {
            expect(revision.author.kind).to.equal(AuthorOf[revision.kind]);
            const wrong = revision.author.kind === 'researcher' ? drafter : maya;
            expect(refusalCode(() => parseRevision(sealed({ ...preimage(revision), author: wrong })))).to.equal('invalid-author');
        }
    });

    it('refuses agent-initiated researcher authority', () => {
        expect(refusalCode(() => parseRevision(sealed({ ...preimage(fixture.claim1), initiatedBy: drafter })))).to.equal('invalid-author');
    });

    it('keeps author roles and ref kinds distinct at compile time and at the wire boundary', () => {
        const invalid: RevisionPreimage<'statement'> = {
            ...base('invalid-typed-statement'), kind: 'statement', schema: 'statement@1', body: fixture.claim1.body,
            // @ts-expect-error An agent cannot initiate researcher-owned content.
            initiatedBy: drafter
        };
        expect(refusalCode(() => createRevision(invalid))).to.equal('invalid-author');
        const graph = fixture.trace.graph();
        // @ts-expect-error A retained fragment ref cannot be passed as a source ref.
        const wrongSource: import('../common/research-record').Ref<'source'> = revisionRef(fixture.fragment1);
        expect(refusalCode(() => graph.get(wrongSource, 'source'))).to.equal('wrong-type');
    });
});

describe('retained exact refs and accepted-head history', () => {
    const fixture = buildN1Trace();
    const graph = fixture.trace.graph();

    it('checks types during ref resolution while preserving the three-field wire shape', () => {
        expect(Object.keys(graph.ref(revisionRef(fixture.fragment1), 'fragment')).sort()).to.deep.equal(['objectId', 'projectId', 'revisionId']);
        expect(refusalCode(() => graph.ref(revisionRef(fixture.fragment1), 'source'))).to.equal('wrong-type');
    });

    it('refuses wrong-project, dangling and latest refs', () => {
        const ref = revisionRef(fixture.fragment1);
        expect(refusalCode(() => graph.ref({ ...ref, projectId: 'other' }, 'fragment'))).to.equal('cross-project-ref');
        expect(refusalCode(() => graph.ref({ ...ref, revisionId: blobDigest(Buffer.from('missing')) }, 'fragment'))).to.equal('dangling-ref');
        expect(refusalCode(() => graph.ref({ ...ref, revisionId: 'latest' }, 'fragment'))).to.equal('invalid-exact-ref');
    });

    it('checks every typed semantic dependency, even an unselected record', () => {
        const annotation = preimage(fixture.annotationMaya);
        expect(refusalCode(() => withRecord(fixture, { ...annotation, objectId: 'wrong-type-annotation', body: {
            ...fixture.annotationMaya.body, fragment: revisionRef(fixture.source1) } }))).to.equal('wrong-type');
        expect(refusalCode(() => withRecord(fixture, { ...annotation, objectId: 'dangling-annotation', body: {
            ...fixture.annotationMaya.body, fragment: { ...revisionRef(fixture.fragment1), objectId: 'missing' } } }))).to.equal('dangling-ref');
        expect(refusalCode(() => withRecord(fixture, { ...annotation, objectId: 'foreign-annotation', body: {
            ...fixture.annotationMaya.body, fragment: { ...revisionRef(fixture.fragment1), projectId: 'foreign' } } }))).to.equal('cross-project-ref');
    });

    it('refuses a code absent from the exact codebook edition', () => {
        expect(refusalCode(() => withRecord(fixture, { ...preimage(fixture.annotationMaya), objectId: 'bad-code',
            body: { ...fixture.annotationMaya.body, codeId: 'negotiation' } }))).to.equal('invalid-record');
    });

    it('requires an expected head for a new and an existing object', () => {
        expect(refusalCode(() => validateRevisionTransition({ revision: fixture.claim1, expectedHead: 'none', currentHead: 'none' }))).to.be.undefined;
        expect(refusalCode(() => validateRevisionTransition({ revision: fixture.claim2, expectedHead: revisionRef(fixture.claim1),
            currentHead: fixture.claim1 }))).to.be.undefined;
        expect(refusalCode(() => validateRevisionTransition({ revision: fixture.claim2, expectedHead: 'none', currentHead: fixture.claim1 })))
            .to.equal('expected-head-conflict');
        expect(refusalCode(() => validateRevisionTransition({ revision: fixture.claim2, expectedHead: revisionRef(fixture.claim1), currentHead: fixture.claim2 })))
            .to.equal('expected-head-conflict');
    });

    it('refuses forks, duplicate acceptance and object kind changes', () => {
        expect(refusalCode(() => withRecord(fixture, { ...preimage(fixture.claim2), body: { ...fixture.claim2.body, wording: 'fork' } })))
            .to.equal('expected-head-conflict');
        expect(refusalCode(() => readResearchGraph(n1Input.projectId, [...fixture.trace.entries,
            { seq: 31, revision: fixture.claim1 }]))).to.equal('invalid-history');
        expect(refusalCode(() => withRecord(fixture, { ...preimage(fixture.source1), objectId: fixture.claim1.objectId,
            parent: revisionRef(fixture.claim2) }))).to.equal('wrong-type');
    });

    it('reads accepted heads at an earlier fence', () => {
        const heads = graph.heads(fixture.snapshot1.body.asOfSeq).map(entry => revisionRef(entry.revision));
        expect(heads).to.deep.include(revisionRef(fixture.claim1));
        expect(heads).to.not.deep.include(revisionRef(fixture.claim2));
        expect(refusalCode(() => graph.heads(1000))).to.equal('invalid-history');
    });
});

describe('N1 source correction, interpretation and explicit carry-forward', () => {
    const fixture = buildN1Trace();
    const graph = fixture.trace.graph();

    it('keeps the earlier citation on the original retained source bytes', () => {
        const bytes = fixture.trace.blobs.get(fixture.source1.body.blob);
        expect(bytes).to.not.be.undefined;
        const old = verifyFragment({ graph, fragment: revisionRef(fixture.fragment1), bytes: bytes ?? new Uint8Array() });
        expect(old.quote).to.equal(n1Input.transcript1);
        expect(fixture.replacement.revisionId).to.not.equal(fixture.source1.revisionId);
        expect(graph.get(fixture.fragment1.body.representation, 'representation').body.source).to.deep.equal(revisionRef(fixture.source1));
        expect(refusalCode(() => verifyFragment({ graph, fragment: revisionRef(fixture.fragment1), bytes: Buffer.from(n1Input.correction) })))
            .to.equal('digest-mismatch');
    });

    it('keeps overlapping annotations and exact codebook editions independent', () => {
        expect(fixture.annotationMaya.body.fragment).to.deep.equal(fixture.annotationJordan.body.fragment);
        expect(fixture.annotationMaya.body.codebook).to.deep.equal(revisionRef(fixture.codebook1));
        expect(fixture.annotationJordan.body.codebook).to.deep.equal(revisionRef(fixture.codebook2));
        expect(fixture.annotationMaya.author).to.deep.equal(maya);
        expect(fixture.annotationJordan.author).to.deep.equal(jordan);
    });

    it('leaves links on their old statement unless explicitly carried forward', () => {
        const before = readResearchGraph(n1Input.projectId, fixture.trace.entries.filter(entry => entry.seq <=
            fixture.trace.entries.find(candidate => candidate.revision.revisionId === fixture.claim2.revisionId)!.seq));
        const basis = claimBasis({ graph: before, selected: [revisionRef(fixture.claim2)], asOfSeq: before.entries.at(-1)!.seq });
        expect(basis.basis).to.not.deep.include(revisionRef(fixture.challenge1));
        // The old decision is explicitly retained to expose its staleness; its forward
        // dependencies can include the old link without carrying it to the new statement.
        expect(before.get(revisionRef(fixture.challenge1), 'evidence-link').body.statement).to.deep.equal(revisionRef(fixture.claim1));
        expect(fixture.challenge1.body.statement).to.deep.equal(revisionRef(fixture.claim1));
        expect(fixture.carried.body.statement).to.deep.equal(revisionRef(fixture.claim2));
    });

    it('preserves the different link author and records the carrying actor separately', () => {
        expect(fixture.claim2.author).to.deep.equal(maya);
        expect(fixture.carried.author).to.deep.equal(jordan);
        expect(fixture.carried.initiatedBy).to.deep.equal(maya);
        expect(fixture.carried.origin).to.deep.equal({ kind: 'carried-forward', from: revisionRef(fixture.challenge1), originalAuthor: jordan });
        expect(fixture.carried.body.cited).to.deep.equal(fixture.challenge1.body.cited);
    });

    it('refuses changed authorship, rationale and source statement during carry-forward', () => {
        const carrySeq = fixture.trace.entries.find(candidate => candidate.revision.revisionId === fixture.carried.revisionId)!.seq;
        const entries = fixture.trace.entries.filter(entry => entry.seq < carrySeq);
        for (const invalid of [
            { ...preimage(fixture.carried), author: maya },
            { ...preimage(fixture.carried), body: { ...fixture.carried.body, rationale: 'rewritten' } },
            { ...preimage(fixture.carried), body: { ...fixture.carried.body, statement: revisionRef(fixture.claim1) } }
        ]) {
            expect(refusalCode(() => readResearchGraph(n1Input.projectId, [...entries, { seq: entries.length + 1, revision: sealed(invalid) }])))
                .to.equal('invalid-carry-forward');
        }
    });

    it('refuses carrying a link to another statement object', () => {
        const copied = carryForwardEvidenceLink({ graph, from: revisionRef(fixture.carried), to: revisionRef(fixture.unrelated), initiatedBy: maya });
        expect(refusalCode(() => readResearchGraph(n1Input.projectId, [...fixture.trace.entries, { seq: 31, revision: copied }])))
            .to.equal('invalid-carry-forward');
    });
});

describe('claim-basis@1 snapshot closure', () => {
    const fixture = buildN1Trace();
    const graph = fixture.trace.graph();

    it('passes the statement-only golden trace with 12 and 17 members', () => {
        expect(fixture.snapshot1.body.selected).to.deep.equal([revisionRef(fixture.claim1)]);
        expect(members(graph, fixture.snapshot1)).to.have.length(n1Input.expected.snapshot1Members);
        expect(members(graph, fixture.snapshot2)).to.have.length(n1Input.expected.snapshot2Members);
    });

    it('materializes incoming links, mechanical findings and current DecisionKey heads', () => {
        const basis = claimBasis({ graph, selected: [revisionRef(fixture.claim1)], asOfSeq: fixture.snapshot1.body.asOfSeq });
        expect(basis.basis).to.have.length(4);
        expect(basis.basis).to.deep.include(revisionRef(fixture.challenge1));
        expect(basis.basis).to.deep.include(revisionRef(fixture.mechanical1));
        expect(graph.entries.filter(entry => entry.revision.kind === 'decision').some(entry =>
            basis.basis.some(ref => ExactRef.equals(ref, revisionRef(entry.revision))))).to.be.true;
    });

    it('excludes activity backlinks, predecessor chains, corrected source heads and unrelated notes', () => {
        const second = members(graph, fixture.snapshot2);
        expect(second).to.not.deep.include(revisionRef(fixture.claim1));
        expect(second).to.not.deep.include(revisionRef(fixture.challenge1));
        expect(second).to.not.deep.include(revisionRef(fixture.replacement));
        expect(second).to.not.deep.include(revisionRef(fixture.unrelated));
        const edge = { kind: 'activity', from: revisionRef(fixture.carried), to: revisionRef(fixture.unrelated) } as const;
        expect(semanticClosure(graph.projectId, fixture.snapshot2.body.members.basis, [...graph.edges(), edge], graph.refs())).to.deep.equal(second);
    });

    it('preserves the first manifest and citation after the correction sequence', () => {
        const firstGraph = readResearchGraph(n1Input.projectId, fixture.trace.entries.filter(entry => entry.seq <= fixture.snapshot1.body.asOfSeq));
        const before = freezeSnapshotBody({ graph: firstGraph, selected: fixture.snapshot1.body.selected, asOfSeq: fixture.snapshot1.body.asOfSeq, label: 'S1' });
        const after = freezeSnapshotBody({ graph, selected: fixture.snapshot1.body.selected, asOfSeq: fixture.snapshot1.body.asOfSeq, label: 'S1' });
        expect(after).to.deep.equal(before);
        expect(after).to.deep.equal(fixture.snapshot1.body);
    });

    it('does not admit post-freeze links or acceptance attestations into earlier snapshots', () => {
        const changed = buildN1Trace();
        const acceptance = changed.trace.append({ ...base('acceptance'), kind: 'decision', schema: 'decision@1', body: decisionBody({
            question: 'claim-acceptance', subject: revisionRef(changed.claim2), snapshot: revisionRef(changed.snapshot2), outcome: 'defer' }) });
        const later = changed.trace.append({ ...base('late-link'), kind: 'evidence-link', schema: 'evidence-link@1', body: {
            ...changed.support.body, role: 'qualifies', rationale: 'Added after freezing.' } });
        const changedGraph = changed.trace.graph();
        expect(members(changedGraph, changed.snapshot2)).to.not.deep.include(revisionRef(later));
        expect(members(changedGraph, changed.snapshot2)).to.not.deep.include(revisionRef(acceptance));
        const fresh = claimBasis({ graph: changedGraph, selected: [revisionRef(changed.claim2)], asOfSeq: changed.trace.entries.length });
        expect(fresh.members).to.deep.include(revisionRef(later));
        expect(fresh.members).to.not.deep.include(revisionRef(acceptance));
    });

    it('refuses a forged manifest, basis, count and future fence', () => {
        const snapshotEntry = fixture.trace.entries.find(entry => entry.revision.revisionId === fixture.snapshot1.revisionId)!;
        const entries = fixture.trace.entries.filter(entry => entry.seq < snapshotEntry.seq);
        for (const body of [
            { ...fixture.snapshot1.body, manifestDigest: canonicalDigest('forged') },
            { ...fixture.snapshot1.body, members: { ...fixture.snapshot1.body.members, closureCount: 999 } },
            { ...fixture.snapshot1.body, members: { ...fixture.snapshot1.body.members, basis: [revisionRef(fixture.claim1)] } },
            { ...fixture.snapshot1.body, asOfSeq: snapshotEntry.seq }
        ]) {
            expect(refusalCode(() => readResearchGraph(n1Input.projectId, [...entries,
                { seq: snapshotEntry.seq, revision: sealed({ ...preimage(fixture.snapshot1), body }) }]))).to.equal('snapshot-mismatch');
        }
    });

    it('refuses empty, wrong-type, future and latest selections', () => {
        expect(refusalCode(() => claimBasis({ graph, selected: [], asOfSeq: 0 }))).to.equal('invalid-record');
        expect(refusalCode(() => claimBasis({ graph, selected: [revisionRef(fixture.fragment1)], asOfSeq: 30 }))).to.equal('wrong-type');
        expect(refusalCode(() => claimBasis({ graph, selected: [revisionRef(fixture.claim2)], asOfSeq: fixture.snapshot1.body.asOfSeq })))
            .to.equal('invalid-history');
        expect(refusalCode(() => claimBasis({ graph, selected: [{ ...revisionRef(fixture.claim1), revisionId: 'latest' }], asOfSeq: 30 })))
            .to.equal('invalid-exact-ref');
    });

    it('sorts and deduplicates selections deterministically and freezes the membership', () => {
        const first = claimBasis({ graph, selected: [revisionRef(fixture.claim2)], asOfSeq: 30 });
        const second = claimBasis({ graph, selected: [revisionRef(fixture.claim2), revisionRef(fixture.claim2)], asOfSeq: 30 });
        expect(second).to.deep.equal(first);
        expect(Object.isFrozen(second.members)).to.be.true;
        expect(Object.isFrozen(second.members[0])).to.be.true;
    });
});

describe('UTF-8 selector and representation checks', () => {
    const fixture = buildN1Trace();

    it('refuses a representation digest mismatch at graph admission', () => {
        expect(refusalCode(() => withRecord(fixture, { ...preimage(fixture.fragment1), objectId: 'bad-digest-fragment',
            body: { ...fixture.fragment1.body, representationDigest: canonicalDigest('wrong') } }))).to.equal('digest-mismatch');
    });

    for (const [name, selector] of [
        ['wrong quote', { ...fixture.fragment1.body.selector, quote: 'different quote' }],
        ['outside bytes', { ...fixture.fragment1.body.selector, end: 999 }]
    ] as const) {
        it(`refuses ${name}`, () => {
            const graph = withRecord(fixture, { ...preimage(fixture.fragment1), objectId: 'bad-selector', body: { ...fixture.fragment1.body, selector } });
            const ref = graph.heads(31).find(entry => entry.revision.objectId === 'bad-selector')!.revision;
            expect(refusalCode(() => verifyFragment({ graph, fragment: revisionRef(ref), bytes: Buffer.from(n1Input.transcript1) }))).to.equal('selector-mismatch');
        });
    }

    it('uses UTF-8 byte offsets, preserving BOMs and mixed line endings', () => {
        const text = '\uFEFFé\r\n文\n';
        const bytes = Buffer.from(text);
        const blob = blobDigest(bytes);
        const source = createRevision({ ...base('unicode-source'), kind: 'source', schema: 'source@1',
            body: { ...fixture.source1.body, blob } });
        const representation = createRevision({ ...base('unicode-representation'), author: core, kind: 'representation', schema: 'representation@1',
            body: { ...fixture.representation1.body, source: revisionRef(source), blob } });
        const fragment = createRevision({ ...base('unicode-fragment'), kind: 'fragment', schema: 'fragment@1', body: {
            representation: revisionRef(representation), representationDigest: blob,
            selector: { profile: 'utf8-bytes@1', start: 3, end: 5, quote: 'é' } } });
        const graph = readResearchGraph(n1Input.projectId, [source, representation, fragment].map((revision, index) => ({ seq: index + 1, revision })));
        expect(verifyFragment({ graph, fragment: revisionRef(fragment), bytes }).quote).to.equal('é');
        const { revisionId, ...fragmentPreimage } = fragment;
        const broken = createRevision({ ...fragmentPreimage, objectId: 'split-character', body: {
            ...fragment.body, selector: { ...fragment.body.selector, start: 4 } } });
        const brokenGraph = readResearchGraph(n1Input.projectId, [...graph.entries, { seq: 4, revision: broken }]);
        expect(refusalCode(() => verifyFragment({ graph: brokenGraph, fragment: revisionRef(broken), bytes }))).to.equal('selector-mismatch');
    });
});

describe('agent proposals, assessments, adjudications, protocols and receipts', () => {
    it('keeps a proposal and its researcher adoption as different records and identities', () => {
        const fixture = buildN1Trace();
        const proposal = fixture.trace.append({ ...base('agent-proposal'), author: drafter, initiatedBy: drafter, kind: 'proposal', schema: 'proposal@1',
            body: { basis: [revisionRef(fixture.claim2)], change: { kind: 'statement', objectId: fixture.claim2.objectId, expectedHead: revisionRef(fixture.claim2),
                body: { wording: 'A proposed narrower interpretation.', scope: ['pilot'] } } } });
        const adoption = fixture.trace.append({ ...base('adoption'), kind: 'decision', schema: 'decision@1',
            body: decisionBody({ question: 'proposal-adoption', subject: revisionRef(proposal), outcome: 'adopt' }) });
        if (proposal.body.change.kind !== 'statement') {
            throw new Error('fixture proposal must be a statement');
        }
        const accepted = fixture.trace.append({ ...base(fixture.claim2.objectId), parent: revisionRef(fixture.claim2), kind: 'statement', schema: 'statement@1',
            origin: { kind: 'adopted', proposal: revisionRef(proposal), adoption: revisionRef(adoption), drafter, edited: false }, body: proposal.body.change.body });
        const graph = fixture.trace.graph();
        expect(accepted.author).to.deep.equal(maya);
        expect(proposal.author).to.deep.equal(drafter);
        expect(graph.edges().filter(edge => ExactRef.equals(edge.from, revisionRef(accepted))).every(edge => edge.kind === 'activity')).to.be.true;
        expect(refusalCode(() => parseRevision(sealed({ ...preimage(proposal), initiatedBy: maya })))).to.equal('invalid-author');
    });

    it('refuses researcher-authored proposals and agent-authored adjudications and assessments', () => {
        const fixture = buildN1Trace();
        expect(refusalCode(() => withRecord(fixture, { ...base('human-proposal'), kind: 'proposal', schema: 'proposal@1', body: {
            basis: [revisionRef(fixture.claim2)], change: { kind: 'statement', objectId: 'draft', expectedHead: 'none', body: fixture.claim2.body } } })))
            .to.equal('invalid-author');
        const decision = fixture.trace.entries.find(entry => entry.revision.kind === 'decision')!.revision;
        for (const revision of [decision, fixture.mechanical1]) {
            expect(refusalCode(() => parseRevision(sealed({ ...preimage(revision), author: drafter, initiatedBy: drafter })))).to.equal('invalid-author');
        }
    });

    it('records protocol inputs as semantic dependencies and receipt writes as provenance', () => {
        const fixture = buildN1Trace();
        const protocol = fixture.trace.append({ ...base('protocol'), kind: 'protocol', schema: 'protocol@1',
            body: { name: 'Advising agency', text: 'Compare the two interpretations.', inputs: [revisionRef(fixture.claim2)] } });
        const receipt = createRevision({ ...base('receipt'), author: core, kind: 'receipt', schema: 'receipt@1',
            body: { command: 'record-protocol', requestDigest: canonicalDigest('request'), seq: 31, written: [revisionRef(protocol)] } });
        fixture.trace.entries.push({ seq: 31, revision: receipt });
        const graph = fixture.trace.graph();
        expect(graph.edges().some(edge => edge.kind === 'semantic' && ExactRef.equals(edge.from, revisionRef(protocol)))).to.be.true;
        expect(semanticClosure(graph.projectId, [revisionRef(receipt)], graph.edges(), graph.refs())).to.deep.equal([revisionRef(receipt)]);
    });

    it('refuses a receipt that claims writes from another commit', () => {
        const fixture = buildN1Trace();
        expect(refusalCode(() => withRecord(fixture, { ...base('false-receipt'), author: core, kind: 'receipt', schema: 'receipt@1',
            body: { command: 'write', requestDigest: canonicalDigest('request'), seq: 31, written: [revisionRef(fixture.claim1)] } }))).to.equal('invalid-record');
    });

    it('refuses two heads for the same DecisionKey in a commit', () => {
        const fixture = buildN1Trace();
        const original = fixture.trace.entries.find(entry => entry.revision.kind === 'decision')!;
        const { revisionId, ...decisionPreimage } = original.revision;
        const duplicate = createRevision({ ...decisionPreimage, objectId: 'duplicate-key' });
        expect(refusalCode(() => readResearchGraph(n1Input.projectId, [...fixture.trace.entries, { seq: original.seq, revision: duplicate }])))
            .to.equal('invalid-history');
    });

    it('refuses support judgments on blocked mechanical findings', () => {
        const fixture = buildN1Trace();
        const blocked = fixture.trace.append({ ...base('blocked'), author: core, kind: 'mechanical', schema: 'mechanical@1',
            body: { subject: revisionRef(fixture.support), finding: { status: 'blocked', reason: 'context-unavailable' } } });
        const decision = fixture.trace.append({ ...base('bad-support'), kind: 'decision', schema: 'decision@1', body: decisionBody({
            question: 'evidence-support', subject: revisionRef(fixture.support), mechanical: revisionRef(blocked), outcome: 'supported',
            scope: {}, contrary: [], rationale: 'Cannot judge support on a blocked citation.' }) });
        expect(decision.kind).to.equal('decision');
        expect(refusalCode(() => fixture.trace.graph())).to.equal('invalid-record');
    });
});

describe('frozen revision identities shared with Python', () => {
    interface Vector { readonly name: string; readonly preimage: unknown; readonly canonical: string; readonly revisionId: string }
    const file = path.resolve(__dirname, '../../test-resources/research-revision-vectors.json');
    // The file is retained independently of test execution, not generated from the implementation here.
    const vectors: readonly Vector[] = JSON.parse(readFileSync(file, 'utf8'));
    it('matches the retained identities when the complete N1 trace is replayed', () => {
        const fixture = buildN1Trace();
        expect(fixture.trace.entries.map(({ revision }) => revision.revisionId)).to.deep.equal(vectors.map(vector => vector.revisionId));
    });
    for (const vector of vectors) {
        it(vector.name, () => {
            expect(canonicalJson(vector.preimage)).to.equal(vector.canonical);
            expect(canonicalDigest(vector.preimage)).to.equal(vector.revisionId);
            expect(parseRevision({ ...record(vector.preimage, PREIMAGE_FIELDS), revisionId: vector.revisionId }).revisionId).to.equal(vector.revisionId);
        });
    }
});
