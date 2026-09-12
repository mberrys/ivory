import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { DurableStore, DiskFullError, BlobIntegrityError } from '../src/durable-store.mjs';
import { casPath } from '../src/paths.mjs';

const CHILD = fileURLToPath(new URL('../src/child.mjs', import.meta.url));

test('second writer fails closed', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-'));
    const store = new DurableStore();
    await store.open(projectRoot);
    const child = spawn(process.execPath, [CHILD, '--project', projectRoot, '--mode', 'probe-lock'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const stderr = await new Promise(resolve => {
        let text = '';
        child.stderr.on('data', chunk => {
            text += chunk;
        });
        child.once('exit', () => resolve(text));
    });
    assert.notEqual(child.exitCode, 0);
    assert.match(`${stderr}`, /live writer|WriterContentionError/);
    await store.close();
    await rm(projectRoot, { recursive: true, force: true });
});

test('missing and corrupted blobs are not treated as installed', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-'));
    const store = new DurableStore();
    await store.open(projectRoot);
    const receipt = await store.commit({
        idempotencyKey: 'k-blob',
        expectedHeads: [{ objectId: 'doc-c' }],
        revisions: [{ objectId: 'doc-c', objectType: 'document', payload: { title: 'C', text: 'payload' } }],
        blobs: [{ bytes: Buffer.from('payload-bytes') }],
    });
    const digest = (await store.getVisible('doc-c')).blobDigest;
    const path = casPath(store.layout.objects, digest);
    await rm(path);
    await assert.rejects(() => store.getVisible('doc-c'), BlobIntegrityError);

    await store.blobs.admitBytes(Buffer.from('payload-bytes'), digest);
    await writeFile(path, 'corrupted-not-the-digest');
    await assert.rejects(() => store.getVisible('doc-c'), BlobIntegrityError);
    await store.close();
    await rm(projectRoot, { recursive: true, force: true });
    void receipt;
});

test('ENOSPC during blob admission does not create a receipt', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-'));
    const store = new DurableStore();
    await store.open(projectRoot);
    process.env.IVORY_N2_ENOSPC = 'blob';
    try {
        await assert.rejects(() => store.commit({
            idempotencyKey: 'k-enospc',
            expectedHeads: [{ objectId: 'doc-e' }],
            revisions: [{ objectId: 'doc-e', objectType: 'document', payload: { title: 'E', text: 'nope' } }],
            blobs: [{ bytes: Buffer.from('will-fail') }],
        }), DiskFullError);
        const visible = await store.getVisible('doc-e');
        assert.equal(visible, undefined);
        const receipts = await store.pg.query('SELECT * FROM receipts WHERE idempotency_key = $1', ['k-enospc']);
        assert.equal(receipts.rows.length, 0);
    } finally {
        delete process.env.IVORY_N2_ENOSPC;
        await store.close();
        await rm(projectRoot, { recursive: true, force: true });
    }
});

test('ENOSPC during database commit leaves no acknowledged receipt', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-'));
    const store = new DurableStore();
    await store.open(projectRoot);
    process.env.IVORY_N2_ENOSPC = 'db';
    try {
        await assert.rejects(() => store.commit({
            idempotencyKey: 'k-enospc-db',
            expectedHeads: [{ objectId: 'doc-f' }],
            revisions: [{ objectId: 'doc-f', objectType: 'document', payload: { title: 'F', text: 'disk' } }],
            blobs: [{ bytes: Buffer.from('installed-then-db-fails') }],
        }), DiskFullError);
        const receipts = await store.pg.query('SELECT * FROM receipts WHERE idempotency_key = $1', ['k-enospc-db']);
        assert.equal(receipts.rows.length, 0);
        const visible = await store.getVisible('doc-f');
        assert.equal(visible, undefined);
    } finally {
        delete process.env.IVORY_N2_ENOSPC;
        await store.close();
        await rm(projectRoot, { recursive: true, force: true });
    }
});
