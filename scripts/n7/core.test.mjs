// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, ProposalCore } from '../../packages/ivory-tower-agent-experiment/lib/core.js';
import { recordedCandidate } from '../../packages/ivory-tower-agent-experiment/lib/provider.js';
import { digestCanonical, deterministicId } from '../../packages/ivory-tower-research-kernel/lib/node/canonical.js';
import { ResearchKernel } from '../../packages/ivory-tower-research-kernel/lib/node/kernel.js';

function setup() {
    const f = fixture();
    const core = new ProposalCore(f.kernel, [f.fragment], f.claim, 'recorded', 'fixture/1');
    const excerpt = core.readExcerpt(f.fragment);
    const candidate = recordedCandidate(excerpt);
    return { ...f, core, excerpt, candidate };
}
const accept = (f, proposal, key = 'accept-1') => f.core.accept(proposal.id, proposal.digest, key, 'researcher');

test('acceptance publishes exactly one model claim/link with shared human acceptance activity', () => {
    const f = setup();
    const before = f.kernel.sequence;
    const p = f.core.propose(f.candidate);
    assert.equal(f.kernel.sequence, before);
    const receipt = accept(f, p);
    assert.equal(f.kernel.sequence, before + 2);
    const claim = f.kernel.getRevision(receipt.claimRef);
    const link = f.kernel.getRevision(receipt.linkRef);
    assert.equal(claim.payload.authorType, 'model');
    assert.equal(link.payload.linkAuthorType, 'model');
    assert.equal(claim.activityId, link.activityId);
    const activity = f.kernel.getActivity(receipt.activityId);
    assert.equal(activity.actor, 'researcher');
    assert.equal(activity.proposal.digest, p.digest);
    assert.deepEqual(link.payload.targets, [f.fragment]);
    assert.deepEqual(f.kernel.resolveCitation(link.payload.targets[0]).quote, f.excerpt.quote);
    assert.equal(f.kernel.getRevision(f.claim).payload.authorType, 'human');
});

test('identical concurrent acceptance and retry after revocation return one original receipt', async () => {
    const f = setup(); const p = f.core.propose(f.candidate); const before = f.kernel.sequence;
    const receipts = await Promise.all(Array.from({ length: 20 }, () => Promise.resolve().then(() => accept(f, p))));
    receipts.forEach(receipt => assert.deepEqual(receipt, receipts[0]));
    f.core.revoke();
    assert.deepEqual(accept(f, p), receipts[0]);
    assert.equal(f.kernel.sequence, before + 2);
    assert.throws(() => accept(f, p, 'different-key'), /idempotency_conflict/);
});

test('reusing a receipt key for different proposal content has no partial effect', () => {
    const f = setup(); const p1 = f.core.propose(f.candidate); accept(f, p1);
    const before = f.kernel.sequence;
    const p2 = f.core.propose({ ...f.candidate, text: 'A different interpretation.' });
    assert.throws(() => accept(f, p2), /idempotency_conflict/);
    assert.equal(f.kernel.sequence, before);
    assert.equal(f.core.preview(p2.id).state, 'pending');
});

test('claim head change fences a prepared proposal', () => {
    const f = setup(); const p = f.core.propose(f.candidate);
    f.kernel.reviseClaim({ claimRef: f.claim, expectedHead: f.claim.revisionId, text: 'Revised by researcher.', actor: 'researcher' });
    const before = f.kernel.sequence;
    assert.throws(() => accept(f, p), /stale_proposal/);
    assert.equal(f.kernel.sequence, before);
});

test('decline preserves accepted state and cannot be reversed by resubmitting the proposal', () => {
    const f = setup(); const before = f.kernel.sequence; const p = f.core.propose(f.candidate);
    f.core.decline(p.id); f.core.propose(f.candidate);
    assert.throws(() => accept(f, p), /proposal_declined/);
    assert.equal(f.kernel.sequence, before);
});

test('preview mutation and changed digest cannot change the stored proposal', () => {
    const f = setup(); const p = f.core.propose(f.candidate); const preview = f.core.preview(p.id);
    preview.envelope.candidate.text = 'Unapproved change';
    assert.throws(() => f.core.accept(p.id, digestCanonical(preview.envelope), 'key', 'researcher'), /approval_mismatch/);
    const receipt = accept(f, p);
    assert.equal(f.kernel.getRevision(receipt.claimRef).payload.text, f.candidate.text);
});

test('scope checks reject other projects, ungranted and invented revisions', () => {
    const f = setup();
    for (const ref of [f.privateSource, f.ungranted, { ...f.fragment, revisionId: 'invented' }, { ...f.fragment, revisionId: 'latest' }]) {
        assert.throws(() => f.core.readExcerpt(ref), /scope_denied/);
    }
});

test('proposals require a prior read and exact matching excerpt digest', () => {
    const f = setup();
    const fresh = new ProposalCore(f.kernel, [f.fragment], f.claim, 'recorded', 'fixture/1');
    assert.throws(() => fresh.propose(f.candidate), /unretrieved/);
    assert.throws(() => f.core.propose({ ...f.candidate, excerptDigest: '0'.repeat(64) }), /mismatched/);
    assert.throws(() => f.core.propose({ ...f.candidate, fragmentRef: f.ungranted }), /unretrieved/);
    assert.throws(() => f.core.propose({ ...f.candidate, capabilities: ['accept', 'shell'] }));
});

test('capability revocation fences reads, proposals and first acceptance', () => {
    const f = setup(); const p = f.core.propose(f.candidate); const before = f.kernel.sequence;
    f.core.revoke();
    assert.throws(() => f.core.readExcerpt(f.fragment), /revoked/);
    assert.throws(() => f.core.propose(f.candidate), /revoked/);
    assert.throws(() => accept(f, p), /revoked/);
    assert.equal(f.kernel.sequence, before);
});

test('source correction retains original excerpt and exact evidence reference', () => {
    const f = setup(); const p = f.core.propose(f.candidate);
    f.kernel.replaceSource({ sourceId: f.source.objectId, expectedHead: f.source.revisionId, name: 'Corrected', bytes: 'Replacement text.', actor: 'researcher' });
    assert.deepEqual(f.core.readExcerpt(f.fragment), f.excerpt);
    const receipt = accept(f, p);
    assert.equal(f.kernel.resolveCitation(f.kernel.getRevision(receipt.linkRef).payload.targets[0]).quote, f.excerpt.quote);
});

test('failure during staged link construction rolls back claim, activity and receipt', t => {
    const f = setup(); const before = f.kernel.sequence;
    const p = f.core.propose(f.candidate);
    const original = ResearchKernel.prototype.append;
    // Fault injection after the staged claim exists; no production test hook is added.
    const append = t.mock.method(ResearchKernel.prototype, 'append', function (...args) {
        if (args[0] === 'evidenceLink') throw new Error('injected_link_failure');
        return original.apply(this, args);
    });
    assert.throws(() => accept(f, p), /injected_link_failure/);
    assert.equal(f.kernel.sequence, before);
    assert.equal(f.kernel.getHead(deterministicId('clm', { proposal: p.digest })), undefined);
    assert.equal(f.kernel.getHead(deterministicId('evl', { proposal: p.digest })), undefined);
    assert.equal(f.core.preview(p.id).state, 'pending');
    append.mock.restore();
    assert.doesNotThrow(() => accept(f, p)); // The failed attempt did not consume the receipt key.
});
