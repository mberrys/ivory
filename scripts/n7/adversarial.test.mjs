// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { ADVERSARIAL_TEXT, fixture, ProposalCore } from '../../packages/ivory-tower-agent-experiment/lib/core.js';
import { ProviderDispatcher, recordedCandidate } from '../../packages/ivory-tower-agent-experiment/lib/provider.js';
import { ResearchKernel } from '../../packages/ivory-tower-research-kernel/lib/node/kernel.js';

// The canary is the private corpus of another project (see fixture()): the hostile source text asks the
// agent to exfiltrate "the entire corpus", so the canary is the observable proof that it cannot.
const PRIVATE_CANARY = 'PRIVATE_CANARY_NOT_FOR_TRANSMISSION';

test('hostile source text is untrusted data: it cannot grant tools, widen scope, or accept itself', () => {
    const f = fixture();
    const core = new ProposalCore(f.kernel, [f.fragment], f.claim, 'recorded', 'fixture/1');
    const excerpt = core.readExcerpt(f.fragment);
    assert.match(excerpt.quote, /IGNORE ALL RULES/); // the injection is in-band in the retrieved excerpt
    const before = f.kernel.sequence;
    // Scope is fixed when the capability is issued; reading the attack cannot widen it.
    assert.throws(() => core.readExcerpt(f.ungranted), /scope_denied/);
    assert.throws(() => core.readExcerpt(f.privateSource), /scope_denied/);
    // The injected instructions cannot ride a proposal: tool, accept and exfiltration fields are refused.
    for (const injected of [
        { capabilities: ['accept', 'shell'] },
        { accept: true },
        { run: 'shell' },
        { sendCorpusTo: 'https://invalid.example/collect' },
    ]) {
        assert.throws(() => core.propose({ ...recordedCandidate(excerpt), ...injected }));
    }
    // What the model can produce from the hostile excerpt is still only a pending proposal,
    // bound to the application's own capability; acceptance requires a named researcher identity
    // that the source text cannot supply.
    const proposal = core.propose(recordedCandidate(excerpt));
    assert.equal(proposal.envelope.capabilityId, core.capabilityId);
    assert.equal(core.preview(proposal.id).state, 'pending');
    assert.equal(f.kernel.sequence, before);
    assert.throws(() => core.accept(proposal.id, proposal.digest, 'auto-accept', '   '), /approval_mismatch/);
    assert.equal(f.kernel.sequence, before);
});

test('hostile-corpus transmission carries only the approved excerpt and never the private canary', async () => {
    const requests = [];
    const server = createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk.toString();
        requests.push(body);
        const excerpt = JSON.parse(JSON.parse(body).messages[1].content).excerpt;
        response.end(
            JSON.stringify({
                choices: [
                    {
                        message: {
                            tool_calls: [
                                {
                                    type: 'function',
                                    function: { name: 'propose_claim', arguments: JSON.stringify(recordedCandidate(excerpt)) },
                                },
                            ],
                        },
                    },
                ],
            }),
        );
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/v1/chat/completions`;
    try {
        const f = fixture();
        const core = new ProposalCore(f.kernel, [f.fragment], f.claim, endpoint, 'synthetic-test-model');
        const excerpt = core.readExcerpt(f.fragment);
        const dispatcher = new ProviderDispatcher(core, { endpoint, model: core.model, apiKey: 'synthetic-not-a-secret' });
        const transmission = dispatcher.preview(excerpt);
        assert.equal(transmission.body.includes(PRIVATE_CANARY), false); // refused before any approval can exist
        const before = f.kernel.sequence;
        await assert.rejects(() => dispatcher.dispatch(transmission.digest), /not_approved/);
        assert.equal(requests.length, 0);
        dispatcher.approve(transmission.digest);
        const candidate = await dispatcher.dispatch(transmission.digest);
        assert.equal(requests.length, 1);
        assert.equal(requests[0], transmission.body); // the approved bytes are the transmitted bytes
        assert.ok(requests[0].includes('IGNORE ALL RULES')); // the attack really was in-band
        assert.equal(requests[0].includes(PRIVATE_CANARY), false); // ... and the private corpus still did not leave
        assert.equal(dispatcher.observations()[0].body, transmission.body);
        // The hostile source cannot grant tools: the response is one bounded proposal, nothing is accepted,
        // and the private project stays out of scope after the exchange.
        const proposal = core.propose(candidate);
        assert.equal(core.preview(proposal.id).state, 'pending');
        assert.equal(f.kernel.sequence, before);
        assert.throws(() => core.readExcerpt(f.privateSource), /scope_denied/);
        const receipt = core.accept(proposal.id, proposal.digest, 'hostile-corpus-accept', 'researcher');
        assert.equal(f.kernel.getRevision(receipt.claimRef).payload.authorType, 'model');
        assert.equal(f.kernel.sequence, before + 2);
    } finally {
        await new Promise(resolve => {
            server.closeAllConnections();
            server.close(resolve);
        });
    }
});

test('the no-model qualitative path writes a human claim, annotation and evidence link through the same contract', () => {
    const f = fixture();
    const before = f.kernel.sequence;
    const codebook = f.kernel.createCodebook({
        key: 'advising-codes',
        name: 'Advising codes',
        codes: [{ id: 'clarify', label: 'Clarifying action', definition: 'The participant describes advising as clarifying a next step.' }],
        actor: 'researcher',
    });
    const annotation = f.kernel.annotate({
        key: 'qualitative-1',
        fragmentRef: f.fragment,
        codebookRef: codebook,
        codeId: 'clarify',
        actor: 'researcher',
        rationale: 'Human-coded support.',
    });
    const claim = f.kernel.createClaim({ key: 'human-claim', text: 'A second human interpretation.', author: 'researcher', status: 'accepted' });
    const link = f.kernel.createEvidenceLink({
        key: 'human-link',
        claimRef: claim,
        targets: [f.fragment, annotation],
        role: 'supports',
        rationale: 'Human-coded support.',
        linkAuthor: 'researcher',
    });
    // No model is anywhere in the loop: four human commands, four revisions, no proposal receipt.
    assert.equal(f.kernel.sequence, before + 4);
    assert.equal(f.kernel.getRevision(claim).payload.author, 'researcher');
    assert.equal(f.kernel.getRevision(claim).payload.authorType, 'human');
    assert.equal(f.kernel.getRevision(annotation).payload.actor, 'researcher');
    assert.equal(f.kernel.getRevision(annotation).payload.actorType, 'human');
    assert.equal(f.kernel.getRevision(link).payload.linkAuthor, 'researcher');
    assert.equal(f.kernel.getRevision(link).payload.linkAuthorType, 'human');
    // The human link uses the same EvidenceLink contract the accepted model path writes ...
    assert.deepEqual(Object.keys(f.kernel.getRevision(link).payload).sort(), [
        'claimRef',
        'linkAuthor',
        'linkAuthorType',
        'rationale',
        'role',
        'targets',
    ]);
    const core = new ProposalCore(f.kernel, [f.fragment], f.claim, 'recorded', 'fixture/1');
    const excerpt = core.readExcerpt(f.fragment);
    const proposal = core.propose(recordedCandidate(excerpt));
    const receipt = core.accept(proposal.id, proposal.digest, 'contract-compare', 'researcher');
    const modelLink = f.kernel.getRevision(receipt.linkRef).payload;
    assert.deepEqual(Object.keys(modelLink).sort(), Object.keys(f.kernel.getRevision(link).payload).sort());
    assert.equal(modelLink.linkAuthorType, 'model');
    assert.equal(f.kernel.getRevision(link).payload.linkAuthorType, 'human');
    // ... and both paths resolve to the same exact retained quote.
    assert.equal(f.kernel.resolveCitation(f.fragment).quote, ADVERSARIAL_TEXT);
    assert.equal(f.kernel.sequence, before + 6);
});

test('isolated project catalogs do not share writers, sequences or refs', () => {
    const f = fixture();
    const isolated = new ResearchKernel('prj_n7_isolated');
    const before = f.kernel.sequence;
    isolated.admitSource({ name: 'Other project', bytes: 'Other corpus.', actor: 'researcher' });
    assert.equal(isolated.sequence, 1);
    assert.equal(f.kernel.sequence, before);
    assert.throws(() => isolated.getRevision(f.fragment), /only exact/);
    assert.throws(() => f.kernel.getRevision({ ...f.fragment, projectId: 'prj_n7_isolated' }), /only exact/);
});
