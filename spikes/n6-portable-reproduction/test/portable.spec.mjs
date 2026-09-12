import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { mkdtemp, rm, cp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStudy } from '../fixture.mjs';
import { exportStudy, restoreStudy, validateExport, inspectProject, json, writeJson, digestBytes, canonicalize, safePath } from '../portable.mjs';
import { compare } from '../reproduce.mjs';

let root, exported, original;
before(async () => {
    root = await mkdtemp(join(tmpdir(), 'ivory-n6-contract-'));
    await createStudy(join(root, 'source'));
    exported = join(root, 'export');
    original = await exportStudy(join(root, 'source'), exported);
});
after(async () => { if (root) { await rm(root, { recursive: true, force: true }); } });

async function altered(name, change, reseal = false) {
    const directory = join(root, name);
    await cp(exported, directory, { recursive: true });
    const dump = await json(join(directory, 'records/state.json'));
    await change(directory, dump);
    if (reseal) {
        await writeJson(join(directory, 'records/state.json'), dump);
        const manifest = await json(join(directory, 'ivory.project.json'));
        manifest.files['records/state.json'] = digestBytes(await readFile(join(directory, 'records/state.json')));
        await writeJson(join(directory, 'ivory.project.json'), manifest);
    }
    return directory;
}

test('round trip preserves every record, edge, snapshot, blob, and old/current citation', async () => {
    const destination = join(root, 'restored');
    await restoreStudy(exported, destination);
    const restored = await inspectProject(destination);
    assert.equal(canonicalize(restored.dump), canonicalize(original.dump));
    assert.deepEqual(restored.citations, original.citations);
    assert.equal(restored.citations[0].current, false);
    assert.equal(restored.citations[2].current, true);
    assert.notEqual(restored.citations[0].quote, restored.citations[2].quote);
    assert.equal(restored.study.snapshots.length, 2);
    assert.ok(restored.dump.edges.length > 100);
    assert.equal([...restored.records.values()].filter(r => r.objectType === 'source').length, 32);
});

test('repeated exports at the same sequence have identical inventories and digests', async () => {
    const repeat = await exportStudy(join(root, 'source'), join(root, 'repeat'));
    assert.deepEqual(repeat.manifest, original.manifest);
});

test('missing and corrupted blobs fail before destination admission', async () => {
    const digest = original.dump.blob_refs[0].digest;
    const missing = await altered('missing', dir => rm(join(dir, 'blobs', digest)));
    await assert.rejects(restoreStudy(missing, join(root, 'missing-restored')), /inventory/);
    const corrupted = await altered('corrupted', dir => writeFile(join(dir, 'blobs', digest), 'corrupt'));
    await assert.rejects(validateExport(corrupted), /digest mismatch/);
});

test('tampered records fail their hashes', async () => {
    const directory = await altered('tampered', (dir) => writeFile(join(dir, 'records/state.json'), '{}'));
    await assert.rejects(validateExport(directory), /digest mismatch/);
});

test('resealed dangling provenance, heads, and snapshots are rejected semantically', async () => {
    const mutations = [
        dump => { dump.edges[0].to_revision_id = 'missing'; },
        dump => { dump.heads[0].revision_id = 'missing'; },
        dump => { dump.revisions.find(r => r.object_id === 'n6-study').payload.snapshots[0].manifest.members.pop(); },
    ];
    for (let i = 0; i < mutations.length; i++) {
        const directory = await altered(`dangling-${i}`, (_dir, dump) => mutations[i](dump), true);
        await assert.rejects(validateExport(directory), /Dangling|Invalid head|Snapshot digest/);
    }
});

test('source and revision identity cannot be silently reassigned', async () => {
    const directory = await altered('identity', (_dir, dump) => {
        const revision = dump.revisions.find(r => r.payload.objectType === 'source');
        revision.payload.payload.contentBase64 = Buffer.from('wrong source').toString('base64');
    }, true);
    await assert.rejects(validateExport(directory), /Revision digest/);
});

test('nonempty destination is preserved', async () => {
    const destination = join(root, 'occupied');
    await cp(exported, destination, { recursive: true });
    await writeFile(join(destination, 'sentinel'), 'keep');
    await assert.rejects(restoreStudy(exported, destination), /Destination/);
    assert.equal(await readFile(join(destination, 'sentinel'), 'utf8'), 'keep');
});

test('unsafe and ambiguous Windows paths cannot enter a portable project', () => {
    for (const path of ['../escape', '/absolute', 'C:/escape', 'a\\b', 'a/../b', 'a//b', 'NUL.txt', 'file.']) {
        assert.throws(() => safePath(path), /Unsafe/);
    }
});

test('format changes and unexpected files are rejected', async () => {
    const directory = await altered('extra', dir => writeFile(join(dir, 'secret.txt'), 'unexpected'));
    await assert.rejects(validateExport(directory), /inventory/);
    const version = await altered('version', async dir => {
        const manifest = await json(join(dir, 'ivory.project.json')); manifest.format = 'future';
        await writeJson(join(dir, 'ivory.project.json'), manifest);
    });
    await assert.rejects(validateExport(version), /Unsupported/);
});

test('analytical comparisons fail changes and nonfinite values but ignore presentation bytes', () => {
    const policy = original.study.comparisons;
    const result = { rowCount: 30, validCount: 27, missingCount: 3, sum: 405, mean: 15 };
    compare({ ...result, htmlDigest: 'presentation-a' }, policy);
    compare({ ...result, htmlDigest: 'presentation-b' }, policy);
    for (const change of [{ sum: 406 }, { mean: 15.1 }, { mean: NaN }, { mean: Infinity }, { rowCount: 29 }]) {
        assert.throws(() => compare({ ...result, ...change }, policy));
    }
});
