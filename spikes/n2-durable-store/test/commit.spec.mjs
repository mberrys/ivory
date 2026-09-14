import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DurableStore } from '../src/durable-store.mjs';

async function withStore(fn) {
    const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-'));
    const store = new DurableStore();
    await store.open(projectRoot);
    try {
        return await fn(store, projectRoot);
    } finally {
        await store.close();
        await rm(projectRoot, { recursive: true, force: true });
    }
}

test('acknowledged commit is visible after reopen', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-'));
    const first = new DurableStore();
    await first.open(projectRoot);
    const receipt = await first.commit({
        idempotencyKey: 'k1',
        expectedHeads: [{ objectId: 'doc-a' }],
        activity: { operation: 'admit-source', actor: 'test' },
        revisions: [{ objectId: 'doc-a', objectType: 'document', payload: { title: 'A', text: 'hello' } }],
        blobs: [{ bytes: Buffer.from('hello-bytes') }],
    });
    await first.close();

    const second = new DurableStore();
    await second.open(projectRoot);
    const visible = await second.getVisible('doc-a');
    assert.equal(visible.payload.title, 'A');
    const replay = await second.commit({
        idempotencyKey: 'k1',
        expectedHeads: [{ objectId: 'doc-a' }],
        revisions: [{ objectId: 'doc-a', payload: { title: 'A', text: 'hello' } }],
        blobs: [{ bytes: Buffer.from('hello-bytes') }],
    });
    assert.equal(replay.receiptId, receipt.receiptId);
    assert.equal(replay.replayed, true);
    await second.close();
    await rm(projectRoot, { recursive: true, force: true });
});

test('expected-head conflict rejects a stale edit', async () => {
    await withStore(async store => {
        await store.commit({
            idempotencyKey: 'k-head-1',
            expectedHeads: [{ objectId: 'doc-b' }],
            revisions: [{ objectId: 'doc-b', objectType: 'document', payload: { title: 'one', text: 'x' } }],
            blobs: [{ bytes: Buffer.from('x') }],
        });
        await assert.rejects(() => store.commit({
            idempotencyKey: 'k-head-2',
            expectedHeads: [{ objectId: 'doc-b', headRevisionId: 'not-the-head' }],
            revisions: [{ objectId: 'doc-b', objectType: 'document', payload: { title: 'two', text: 'y' } }],
            blobs: [{ bytes: Buffer.from('y') }],
        }), /Expected head/);
    });
});

test('source search finds admitted document text', async () => {
    await withStore(async store => {
        await store.commit({
            idempotencyKey: 'k-search',
            expectedHeads: [{ objectId: 'doc-s' }],
            revisions: [{ objectId: 'doc-s', objectType: 'document', payload: { title: 'Interview', text: 'unique-search-token in transcript' } }],
            blobs: [{ bytes: Buffer.from('unique-search-token in transcript') }],
        });
        const hits = await store.searchSources('unique-search-token');
        assert.equal(hits.length, 1);
        assert.equal(hits[0].object_id, 'doc-s');
    });
});
