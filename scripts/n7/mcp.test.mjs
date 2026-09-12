// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from './client.mjs';
import { recordedCandidate } from '../../packages/ivory-tower-agent-experiment/lib/provider.js';

test('real stdio MCP exposes only exact read and proposal; no automatic acceptance or command execution', async () => {
    const s = await connect();
    try {
        const names = (await s.client.listTools()).tools.map(tool => tool.name).sort();
        assert.deepEqual(names, ['propose_claim', 'read_excerpt']);
        const denied = await fetch(`${s.controlUrl}/accept`, { method: 'POST', body: '{}' });
        assert.equal(denied.status, 403);
        const { fragment, ungranted, privateSource } = await s.control('bootstrap');
        const before = await s.control('state');
        for (const name of ['accept', 'execute', 'shell', 'grant_capability', 'read_file', 'send_http']) {
            await assert.rejects(() => s.tool(name, { command: 'echo NEVER_EXECUTE' }));
        }
        for (const ref of [ungranted, privateSource]) await assert.rejects(() => s.tool('read_excerpt', { ref }), /scope_denied/);
        const excerpt = await s.tool('read_excerpt', { ref: fragment });
        assert.match(excerpt.quote, /IGNORE ALL RULES/);
        await assert.rejects(() => s.tool('propose_claim', { ...recordedCandidate(excerpt), accept: true }));
        const transmission = await s.control('transmission', { ref: fragment });
        await s.control('approve-transmission', { digest: transmission.digest });
        const candidate = await s.control('dispatch', { digest: transmission.digest });
        const p = await s.tool('propose_claim', candidate);
        assert.deepEqual(await s.control('state'), before);
        const preview = await s.control('preview', { id: p.id });
        assert.equal(preview.digest, p.digest);
        const input = { id: p.id, digest: p.digest, idempotencyKey: 'mcp-accept' };
        const receipts = await Promise.all(Array.from({ length: 5 }, () => s.control('accept', input)));
        receipts.forEach(receipt => assert.deepEqual(receipt, receipts[0]));
        assert.equal((await s.control('state')).sequence, before.sequence + 2);
        assert.deepEqual(await s.control('observations'), []); // Fixture provider made no HTTP request.
    } finally { await s.close(); }
});

test('MCP proposal cannot bypass revocation through a fresh tool call', async () => {
    const s = await connect();
    try {
        const { fragment } = await s.control('bootstrap');
        const excerpt = await s.tool('read_excerpt', { ref: fragment });
        const p = await s.tool('propose_claim', recordedCandidate(excerpt));
        await s.control('revoke');
        await assert.rejects(() => s.tool('read_excerpt', { ref: fragment }), /revoked/);
        await assert.rejects(() => s.tool('propose_claim', recordedCandidate(excerpt)), /revoked/);
        await assert.rejects(() => s.control('accept', { id: p.id, digest: p.digest, idempotencyKey: 'revoked' }), /revoked/);
    } finally { await s.close(); }
});

test('MCP prepared proposal is fenced by a competing researcher edit', async () => {
    const s = await connect({ testControl: true });
    try {
        const { fragment } = await s.control('bootstrap');
        const excerpt = await s.tool('read_excerpt', { ref: fragment });
        const p = await s.tool('propose_claim', recordedCandidate(excerpt));
        await s.control('test-revise-claim');
        await assert.rejects(() => s.control('accept', { id: p.id, digest: p.digest, idempotencyKey: 'stale' }), /stale/);
    } finally { await s.close(); }
});
