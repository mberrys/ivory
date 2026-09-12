import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DurableStore } from '../src/durable-store.mjs';

test('semantic export/import preserves records and blob hashes', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-'));
    const destRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-import-'));
    const exportDir = join(projectRoot, 'research-export');
    const store = new DurableStore();
    await store.open(projectRoot);
    const original = await store.commit({
        idempotencyKey: 'export-1',
        expectedHeads: [{ objectId: 'doc-export' }],
        revisions: [{ objectId: 'doc-export', objectType: 'document', payload: { title: 'Kept', text: 'retained-body' } }],
        blobs: [{ bytes: Buffer.from('retained-bytes') }],
    });
    const snapshot = await store.freezeUnchanged();
    await store.exportSemantic(exportDir);
    await store.close();

    const imported = new DurableStore();
    await imported.importSemantic(exportDir, destRoot);
    await imported.open(destRoot);
    const visible = await imported.getVisible('doc-export');
    assert.equal(visible.payload.title, 'Kept');
    assert.equal(visible.payload.text, 'retained-body');
    const importedSnapshot = (await imported.pg.query(
        'SELECT digest, member_revision_ids_text FROM snapshots WHERE snapshot_id = $1',
        [snapshot.snapshotId],
    )).rows[0];
    assert.equal(importedSnapshot.digest, snapshot.digest);
    assert.deepEqual(JSON.parse(importedSnapshot.member_revision_ids_text), [original.revisions[0].revisionId]);
    const replay = await imported.commit({
        idempotencyKey: 'export-1',
        expectedHeads: [{ objectId: 'doc-export' }],
        revisions: [{ objectId: 'doc-export', payload: { title: 'Kept', text: 'retained-body' } }],
        blobs: [{ bytes: Buffer.from('retained-bytes') }],
    });
    assert.equal(replay.replayed, true);
    await imported.close();
    await rm(projectRoot, { recursive: true, force: true });
    await rm(destRoot, { recursive: true, force: true });
    void original;
});

test('backup and restore reopen at the same sequence', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-'));
    const backupDir = await mkdtemp(join(tmpdir(), 'ivory-n2-bak-'));
    const restoredRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-rst-'));
    const store = new DurableStore();
    await store.open(projectRoot);
    await store.commit({
        idempotencyKey: 'bak-1',
        expectedHeads: [{ objectId: 'doc-bak' }],
        revisions: [{ objectId: 'doc-bak', objectType: 'document', payload: { title: 'Backup', text: 'snap' } }],
        blobs: [{ bytes: Buffer.from('backup-bytes') }],
    });
    const backup = await store.backup(backupDir);
    await store.close();
    const restored = new DurableStore();
    const report = await restored.restore(backupDir, restoredRoot);
    assert.equal(report.projectSeq, backup.projectSeq);
    await restored.open(restoredRoot);
    const visible = await restored.getVisible('doc-bak');
    assert.equal(visible.payload.title, 'Backup');
    await restored.close();
    await rm(projectRoot, { recursive: true, force: true });
    await rm(backupDir, { recursive: true, force: true });
    await rm(restoredRoot, { recursive: true, force: true });
});
