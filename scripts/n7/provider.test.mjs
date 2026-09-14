// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixture, ProposalCore } from '../../packages/ivory-tower-agent-experiment/lib/core.js';
import { ProviderDispatcher, recordedCandidate, RESPONSE_LIMIT } from '../../packages/ivory-tower-agent-experiment/lib/provider.js';
const observed = [];
after(() => {
    if (process.env.N7_EVIDENCE_DIR) {
        mkdirSync(process.env.N7_EVIDENCE_DIR, { recursive: true });
        writeFileSync(join(process.env.N7_EVIDENCE_DIR, 'transmissions.json'), JSON.stringify(observed, null, 2) + '\n');
    }
});
async function provider(handler) {
    const requests = [];
    const server = createServer(async (request, response) => {
        let body = ''; for await (const chunk of request) body += chunk.toString();
        requests.push(body);
        handler(response, JSON.parse(body), requests.length);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return { endpoint: `http://127.0.0.1:${server.address().port}/v1/chat/completions`, requests,
        close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}
function setup(endpoint, timeout = 30000) {
    const f = fixture();
    const core = new ProposalCore(f.kernel, [f.fragment], f.claim, endpoint, 'synthetic-test-model');
    const excerpt = core.readExcerpt(f.fragment);
    const dispatcher = new ProviderDispatcher(core, { endpoint, model: core.model, apiKey: 'synthetic-not-a-secret' }, timeout);
    const transmission = dispatcher.preview(excerpt);
    return { ...f, core, excerpt, dispatcher, transmission };
}
function responseFor(body, name = 'propose_claim') {
    const excerpt = JSON.parse(body.messages[1].content).excerpt;
    return { choices: [{ message: { tool_calls: [{ type: 'function', function: { name, arguments: JSON.stringify(recordedCandidate(excerpt)) } }] } }] };
}
const approve = f => f.dispatcher.approve(f.transmission.digest);
const dispatch = f => f.dispatcher.dispatch(f.transmission.digest);

test('actual serialized provider request equals approved preview and contains no undisclosed corpus', async () => {
    const p = await provider((res, body) => res.end(JSON.stringify(responseFor(body))));
    try {
        const f = setup(p.endpoint); const before = f.kernel.sequence;
        await assert.rejects(() => dispatch(f), /not_approved/);
        assert.equal(p.requests.length, 0);
        approve(f);
        const candidate = await dispatch(f);
        assert.equal(p.requests.length, 1);
        assert.equal(p.requests[0], f.transmission.body);
        assert.equal(f.dispatcher.observations()[0].body, p.requests[0]);
        assert.ok(!p.requests[0].includes('PRIVATE_CANARY_NOT_FOR_TRANSMISSION'));
        assert.ok(!p.requests[0].includes('synthetic-not-a-secret'));
        const proposal = f.core.propose(candidate);
        assert.equal(f.kernel.sequence, before);
        f.core.accept(proposal.id, proposal.digest, 'provider-accept', 'researcher');
        assert.equal(f.kernel.sequence, before + 2);
        await assert.rejects(() => dispatch(f), /not_approved/);
        observed.push({ scenario: 'approved-synthetic-request', preview: f.transmission, actualBody: p.requests[0], equal: true });
    } finally { await p.close(); }
});

test('modified preview content cannot alter transmitted bytes or grant approval to a changed digest', async () => {
    const p = await provider((res, body) => res.end(JSON.stringify(responseFor(body))));
    try {
        const f = setup(p.endpoint); const original = f.transmission.body;
        f.transmission.body = 'UNAPPROVED';
        assert.throws(() => f.dispatcher.approve('0'.repeat(64)), /unknown/);
        approve(f); await dispatch(f);
        assert.equal(p.requests[0], original);
    } finally { await p.close(); }
});

test('revocation before dispatch causes zero HTTP requests', async () => {
    const p = await provider(res => res.end('{}'));
    try {
        const f = setup(p.endpoint); approve(f); f.core.revoke();
        await assert.rejects(() => dispatch(f), /revoked/);
        assert.equal(p.requests.length, 0);
    } finally { await p.close(); }
});

test('mid-request revocation discards the late response without accepting state', async () => {
    let release; let received;
    const arrived = new Promise(resolve => { received = resolve; });
    const p = await provider((res, body) => { release = () => res.end(JSON.stringify(responseFor(body))); received(); });
    try {
        const f = setup(p.endpoint); approve(f); const before = f.kernel.sequence;
        const pending = dispatch(f);
        await arrived; f.core.revoke(); release();
        await assert.rejects(() => pending, /revoked/);
        assert.equal(f.kernel.sequence, before);
        assert.equal(p.requests.length, 1); // Already transmitted bytes cannot be recalled.
    } finally { await p.close(); }
});

test('redirect is not followed and cannot transmit corpus to another endpoint', async () => {
    const target = await provider(res => res.end('{}'));
    const redirect = await provider(res => { res.writeHead(307, { location: target.endpoint }); res.end(); });
    try {
        const f = setup(redirect.endpoint); approve(f);
        await assert.rejects(() => dispatch(f), /provider_response_failed/);
        assert.equal(redirect.requests.length, 1); assert.equal(target.requests.length, 0);
    } finally { await redirect.close(); await target.close(); }
});

for (const [name, handler, expected] of [
    ['arbitrary execution tool', (res, body) => res.end(JSON.stringify(responseFor(body, 'execute_shell'))), /unexpected_provider_tool/],
    ['malformed JSON', res => res.end('not-json'), /provider_response_failed/],
    ['oversized response', res => res.end('x'.repeat(RESPONSE_LIMIT + 1)), /response_too_large/],
    ['HTTP failure', res => { res.writeHead(503); res.end('untrusted secret-like diagnostic'); }, /provider_http_503/],
    ['invented proposal fields', (res, body) => {
        const response = responseFor(body); const fn = response.choices[0].message.tool_calls[0].function;
        fn.arguments = JSON.stringify({ ...JSON.parse(fn.arguments), accept: true }); res.end(JSON.stringify(response));
    }, /provider_response_failed/],
    ['multiple tool calls', (res, body) => { const response = responseFor(body); response.choices[0].message.tool_calls.push(response.choices[0].message.tool_calls[0]); res.end(JSON.stringify(response)); }, /unexpected_provider_tool/],
]) {
    test(`${name} fails closed with no accepted state or implicit retry`, async () => {
        const p = await provider(handler);
        try {
            const f = setup(p.endpoint); const before = f.kernel.sequence; approve(f);
            await assert.rejects(() => dispatch(f), expected);
            assert.equal(f.kernel.sequence, before); assert.equal(p.requests.length, 1);
        } finally { await p.close(); }
    });
}

test('provider timeout is bounded and leaves accepted state unchanged', async () => {
    const p = await provider(() => {});
    try {
        const f = setup(p.endpoint, 100); const before = f.kernel.sequence; approve(f);
        await assert.rejects(() => dispatch(f), /provider_timeout/);
        assert.equal(f.kernel.sequence, before);
    } finally { await p.close(); }
});

test('unapproved excerpt mutation and unsafe endpoint configuration are rejected before dispatch', () => {
    const f = setup('https://provider.example/v1/chat/completions');
    assert.throws(() => f.dispatcher.preview({ ...f.excerpt, quote: 'PRIVATE_CANARY' }), /excerpt_mismatch/);
    for (const endpoint of ['http://remote.example/api', 'https://user:password@remote.example/api', 'https://remote.example/api?token=secret']) {
        assert.throws(() => new ProviderDispatcher(f.core, { endpoint, model: f.core.model }), /invalid_endpoint/);
    }
});

test('oversized outbound context is rejected before any transmission can be approved', () => {
    const f = fixture();
    const text = 'x'.repeat(65536);
    const source = f.kernel.admitSource({ name: 'Large synthetic input', bytes: text, actor: 'researcher' });
    const artifact = f.kernel.admitArtifact({ key: 'large', sourceRefs: [source], output: text, actor: 'researcher' });
    const fragment = f.kernel.createFragment({ sourceRef: source, artifactRef: artifact,
        selector: { kind: 'text', start: 0, end: text.length, quote: text }, actor: 'researcher' });
    const core = new ProposalCore(f.kernel, [fragment], f.claim, 'provider', 'model');
    const dispatcher = new ProviderDispatcher(core, { endpoint: 'https://provider.example/v1/chat/completions', model: 'model' });
    assert.throws(() => dispatcher.preview(core.readExcerpt(fragment)), /request_too_large/);
    assert.deepEqual(dispatcher.observations(), []);
});
