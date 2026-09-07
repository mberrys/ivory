// *****************************************************************************
// Copyright (C) 2026 Berry Studio and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { createResearchClients } from './clients';
import { buildAdvisingAgencyFixture } from './fixture';
import { ExpectedHeadConflictError, ResearchKernel, ResearchKernelError } from './kernel';

describe('N1 research identity kernel', () => {
    it('keeps the same command trace identical through cli and studio clients', () => {
        const first = buildAdvisingAgencyFixture(createResearchClients(new ResearchKernel()).cli);
        const second = buildAdvisingAgencyFixture(createResearchClients(new ResearchKernel()).studio);

        expect(first.snapshot1.snapshotId).to.equal(second.snapshot1.snapshotId);
        expect(first.snapshot1.digest).to.equal(second.snapshot1.digest);
        expect(first.snapshot1.manifest).to.deep.equal(second.snapshot1.manifest);
        expect(first.snapshot2.snapshotId).to.equal(second.snapshot2.snapshotId);
        expect(first.snapshot2.digest).to.equal(second.snapshot2.digest);
    });

    it('preserves the original citation through source replacement and claim revision', () => {
        const fixture = buildAdvisingAgencyFixture();
        const oldCitation = fixture.kernel.resolveCitation(fixture.fragment, fixture.snapshot1.snapshotId);
        expect(oldCitation.quote).to.equal('Maya said advising made the next step visible.');
        expect(fixture.kernel.resolveCitation(fixture.fragment, fixture.snapshot2.snapshotId).quote).to.equal(oldCitation.quote);
        expect(fixture.kernel.getRevision(fixture.fragment).payload).to.deep.include({
            sourceRef: fixture.t1,
        });
        expect(fixture.t1Replacement.revisionId).to.not.equal(fixture.t1.revisionId);
    });

    it('keeps S1 closed over semantic references and ignores an activity back-link', () => {
        const fixture = buildAdvisingAgencyFixture();
        const memberKeys = fixture.snapshot1.manifest.members.map(member => `${member.ref.objectId}/${member.ref.revisionId}`);
        expect(memberKeys.join('\n')).to.not.include(fixture.unrelatedNote.objectId);
        expect(fixture.snapshot1.manifest.members).to.deep.include({
            ref: fixture.t1,
            role: 'selected',
            revisionDigest: fixture.kernel.getRevision(fixture.t1).digest,
        });
        expect(fixture.snapshot1.manifest.members.some(member => member.ref.revisionId === fixture.codebook2.revisionId)).to.equal(false);
    });

    it('requires explicit carry-forward and leaves old links on the old claim revision', () => {
        const fixture = buildAdvisingAgencyFixture();
        const preview = fixture.kernel.previewCarryForward(fixture.claimA1, fixture.claimA2);
        expect(preview.links.map(link => link.objectId)).to.include(fixture.challengeA1.objectId);
        expect(fixture.carriedLinks).to.have.length(1);
        const oldLink = fixture.kernel.getRevision(fixture.challengeA1).payload as { claimRef: typeof fixture.claimA1 };
        const newLink = fixture.kernel.getRevision(fixture.carriedLinks[0]).payload as { claimRef: typeof fixture.claimA2 };
        expect(oldLink.claimRef).to.deep.equal(fixture.claimA1);
        expect(newLink.claimRef).to.deep.equal(fixture.claimA2);
    });

    it('rejects latest pointers and confidence scores', () => {
        const fixture = buildAdvisingAgencyFixture();
        expect(() =>
            fixture.kernel.createEvidenceLink({
                key: 'latest-is-not-a-reference',
                claimRef: { ...fixture.claimA1, revisionId: 'latest' },
                targets: [fixture.fragment],
                role: 'supports',
                rationale: 'invalid',
                linkAuthor: 'Maya',
            }),
        ).to.throw(ResearchKernelError);
        expect(() =>
            fixture.kernel.createEvidenceLink({
                key: 'confidence-is-not-provenance',
                claimRef: fixture.claimA1,
                targets: [fixture.fragment],
                role: 'supports',
                rationale: 'invalid',
                linkAuthor: 'Maya',
                confidence: 0.99,
            }),
        ).to.throw('confidence score');
    });

    it('rejects stale expected heads and keeps overlapping annotations independent', () => {
        const fixture = buildAdvisingAgencyFixture();
        expect(() =>
            fixture.kernel.reviseClaim({
                claimRef: fixture.claimA1,
                expectedHead: 'rev_stale',
                text: 'stale',
                actor: 'Maya',
            }),
        ).to.throw(ExpectedHeadConflictError);
        const maya = fixture.kernel.getRevision(fixture.annotationMaya).payload as { actor: string };
        const jordan = fixture.kernel.getRevision(fixture.annotationJordan).payload as { actor: string };
        expect(maya.actor).to.equal('Maya');
        expect(jordan.actor).to.equal('Jordan');
    });

    it('renders attribution separately from endorsement for a reader', () => {
        const fixture = buildAdvisingAgencyFixture();
        const explanation = fixture.kernel.explainClaim(fixture.snapshot1.snapshotId, fixture.claimA1);
        expect(explanation.text).to.include('Jordan differs from claim author Maya');
        expect(explanation.text).to.include('codebook edition 1');
        expect(explanation.text).to.include('This is attribution, not endorsement.');
        expect(explanation.text).to.include('Maya said advising made the next step visible.');
    });
});
