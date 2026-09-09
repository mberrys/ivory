import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir, lstat, rename, mkdtemp, rm, rmdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { DurableStore } from '../n2-durable-store/src/durable-store.mjs';
import { kernelApi } from './fixture.mjs';

const { canonicalize, digestBytes, digestCanonical } = kernelApi;
export { canonicalize, digestBytes };
const requireThat = (condition, message) => { if (!condition) { throw new Error(message); } };
export async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }
export async function writeJson(path, value) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, canonicalize(value) + '\n');
}
export function safePath(path) {
    requireThat(typeof path === 'string' && path.length > 0 && !path.includes('\\') && !path.includes(':') &&
        path.split('/').every(part => part && part !== '.' && part !== '..' && !/[<>"|?*\x00-\x1f]/.test(part) && !/[. ]$/.test(part) &&
            !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(part)), `Unsafe path: ${path}`);
    return path;
}
async function inventory(root, relative = '') {
    const files = [];
    for (const name of (await readdir(join(root, relative))).sort()) {
        const path = relative ? `${relative}/${name}` : name;
        safePath(path);
        const stat = await lstat(join(root, path));
        requireThat(!stat.isSymbolicLink(), `Symlink forbidden: ${path}`);
        if (stat.isDirectory()) { files.push(...await inventory(root, path)); }
        else { requireThat(stat.isFile(), `Non-regular file: ${path}`); files.push(path); }
    }
    return files;
}
async function requireEmpty(root) {
    try {
        const stat = await lstat(root);
        requireThat(stat.isDirectory() && !stat.isSymbolicLink() && (await readdir(root)).length === 0,
            'Destination must be absent or an empty regular directory');
    } catch (error) { if (error.code !== 'ENOENT') { throw error; } }
}

export function inspectRecords(dump) {
    const study = dump.revisions.find(row => row.object_id === 'n6-study')?.payload;
    requireThat(study?.format === 'ivory-n6-study/1', 'Unsupported study format');
    const rows = new Map(dump.revisions.map(row => [row.revision_id, row]));
    requireThat(rows.size === dump.revisions.length, 'Duplicate revisions');
    const objects = new Map(dump.objects.map(row => [row.object_id, row.object_type]));
    const activities = new Set(dump.activities.map(row => row.activity_id));
    const blobs = new Set(dump.blob_refs.map(row => row.digest));
    const records = new Map(dump.revisions.filter(row => row.object_id !== 'n6-study').map(row => [row.revision_id, row.payload]));
    const get = ref => {
        const record = records.get(ref?.revisionId);
        requireThat(ref?.projectId === study.projectId && record && record.objectId === ref.objectId && ref.revisionId !== 'latest',
            'Dangling or non-exact reference');
        return record;
    };
    for (const row of dump.revisions) {
        requireThat(objects.has(row.object_id) && activities.has(row.activity_id), 'Missing object or activity');
        requireThat(!row.blob_digest || blobs.has(row.blob_digest), 'Missing blob reference');
        if (row.predecessor_id) {
            requireThat(rows.get(row.predecessor_id)?.object_id === row.object_id, 'Invalid predecessor');
        }
        if (row.object_id === 'n6-study') { continue; }
        const r = row.payload;
        requireThat(r.schemaVersion === 'n1-revision/1', 'Unsupported revision schema');
        requireThat(r.revisionId === row.revision_id && r.objectId === row.object_id && r.objectType === objects.get(row.object_id), 'Revision identity mismatch');
        requireThat(r.activityId === row.activity_id && r.predecessor?.revisionId === (row.predecessor_id ?? undefined), 'Revision lineage mismatch');
        const digest = digestCanonical({ schemaVersion: r.schemaVersion, objectId: r.objectId, predecessor: r.predecessor,
            payload: r.payload, exactRefs: r.exactRefs, activityId: r.activityId });
        requireThat(r.digest === digest, 'Revision digest mismatch');
        requireThat(r.revisionId === `rev_${digest.slice(0, 32)}`, 'Revision identifier digest mismatch');
        for (const ref of r.exactRefs) { get(ref); }
        const p = r.payload;
        const semanticRefs = { source: [], artifact: p.sourceRefs, fragment: [p.sourceRef, p.artifactRef],
            codebook: [], annotation: [p.fragmentRef, p.codebookRef], claim: [], evidenceLink: [p.claimRef, ...(p.targets ?? [])] }[r.objectType];
        assert.deepEqual(r.exactRefs, semanticRefs, 'Semantic references differ from payload');
        if (r.predecessor) {
            const old = get(r.predecessor);
            requireThat(old.revisionNumber + 1 === r.revisionNumber && old.projectSequence < r.projectSequence, 'Invalid revision history');
        }
        if (r.objectType === 'source') {
            requireThat(digestBytes(Buffer.from(r.payload.contentBase64, 'base64')) === row.blob_digest, 'Source blob mismatch');
            requireThat(p.contentDigest === row.blob_digest, 'Source content digest mismatch');
        }
        if (r.objectType === 'artifact') {
            requireThat(p.outputDigest === digestBytes(Buffer.from(p.output)), 'Artifact digest mismatch');
        }
        if (r.objectType === 'evidenceLink') {
            requireThat(get(p.claimRef).objectType === 'claim' && ['supports', 'challenges', 'qualifies', 'contextualizes'].includes(p.role), 'Invalid evidence link');
        }
        if (r.objectType === 'annotation') {
            requireThat(get(p.fragmentRef).objectType === 'fragment' && get(p.codebookRef).objectType === 'codebook' &&
                get(p.codebookRef).payload.codes.some(code => code.id === p.codeId), 'Invalid annotation code');
        }
    }
    for (const h of dump.heads) {
        requireThat(rows.get(h.revision_id)?.object_id === h.object_id, 'Invalid head');
        const sequence = rows.get(h.revision_id).payload.projectSequence;
        requireThat(![...records.values()].some(r => r.objectId === h.object_id && r.projectSequence > sequence), 'Stale head');
    }
    requireThat(new Set(dump.heads.map(h => h.object_id)).size === objects.size, 'Missing or duplicate heads');
    for (const edge of dump.edges) {
        requireThat(activities.has(edge.activity_id) && (!edge.from_revision_id || rows.has(edge.from_revision_id)) &&
            (!edge.to_revision_id || rows.has(edge.to_revision_id)), 'Dangling provenance edge');
    }
    for (const receipt of dump.receipts) { requireThat(activities.has(receipt.activity_id), 'Dangling receipt'); }
    for (const snapshot of dump.snapshots) {
        const ids = JSON.parse(snapshot.member_revision_ids_text ?? JSON.stringify(snapshot.member_revision_ids));
        requireThat(ids.every(id => rows.has(id)), 'Dangling storage snapshot');
        requireThat(snapshot.digest === digestBytes(Buffer.from(JSON.stringify({ seq: snapshot.at_seq, memberIds: ids,
            content: ids.map(id => rows.get(id).content_digest) }))), 'Storage snapshot digest mismatch');
    }
    for (const snapshot of study.snapshots) {
        requireThat(snapshot.digest === digestCanonical(snapshot.manifest), 'Snapshot digest mismatch');
        const closure = new Set(), visiting = new Set();
        const visit = ref => {
            requireThat(!visiting.has(ref.revisionId), 'Semantic cycle');
            if (closure.has(ref.revisionId)) { return; }
            visiting.add(ref.revisionId);
            const r = get(ref);
            requireThat(r.projectSequence <= snapshot.manifest.projectSequence, 'Snapshot references future evidence');
            r.exactRefs.forEach(visit);
            visiting.delete(ref.revisionId); closure.add(ref.revisionId);
        };
        [...snapshot.manifest.selected, ...snapshot.manifest.context].forEach(visit);
        assert.deepEqual([...closure].sort(), snapshot.manifest.members.map(m => m.ref.revisionId).sort(), 'Snapshot closure mismatch');
        for (const member of snapshot.manifest.members) {
            requireThat(get(member.ref).digest === member.revisionDigest, 'Snapshot member digest mismatch');
        }
    }
    const resolveCitation = ref => {
        const fragment = get(ref);
        requireThat(fragment.objectType === 'fragment' && fragment.payload.selector.kind === 'text', 'Unsupported citation');
        const source = get(fragment.payload.sourceRef), artifact = get(fragment.payload.artifactRef);
        requireThat(source.objectType === 'source' && artifact.objectType === 'artifact', 'Citation type mismatch');
        const selector = fragment.payload.selector;
        const original = Buffer.from(source.payload.contentBase64, 'base64').toString('utf8');
        requireThat(Number.isInteger(selector.start) && Number.isInteger(selector.end) && selector.start >= 0 && selector.end > selector.start &&
            [original, artifact.payload.output].some(text => text.slice(selector.start, selector.end) === selector.quote), 'Citation selector mismatch');
        return { ref, quote: selector.quote, sourceName: source.payload.name, sourceRevisionId: source.revisionId,
            current: dump.heads.find(h => h.object_id === source.objectId)?.revision_id === source.revisionId };
    };
    // Validate all retained fragments, including ones not cited by the dossier.
    for (const r of records.values()) {
        if (r.objectType === 'fragment') { resolveCitation({ projectId: study.projectId, objectId: r.objectId, revisionId: r.revisionId }); }
    }
    return { study, records, citations: study.citations.map(resolveCitation) };
}

export async function exportStudy(project, destination) {
    requireThat((await lstat(join(project, '.ivory/store'))).isDirectory(), 'Existing study required');
    await requireEmpty(destination);
    const store = new DurableStore();
    await store.open(project);
    try { await store.exportSemantic(destination); } finally { await store.close(); }
    const dump = await json(join(destination, 'records/state.json'));
    const { study } = inspectRecords(dump);
    await writeJson(join(destination, 'records/state.json'), dump);
    const manifest = await json(join(destination, 'manifest.json'));
    await writeJson(join(destination, 'manifest.json'), manifest);
    for (const [path, digest] of Object.entries(study.files)) {
        safePath(path);
        const bytes = await readFile(join(destination, 'blobs', digest));
        await mkdir(dirname(join(destination, path)), { recursive: true });
        await writeFile(join(destination, path), bytes);
    }
    const files = {};
    for (const path of await inventory(destination)) { files[path] = digestBytes(await readFile(join(destination, path))); }
    await writeJson(join(destination, 'ivory.project.json'), { format: 'ivory-n6-portable/1', projectId: study.projectId,
        projectSequence: manifest.projectSeq, files });
    return validateExport(destination);
}

export async function validateExport(source) {
    const stat = await lstat(source);
    requireThat(stat.isDirectory() && !stat.isSymbolicLink(), 'Export root must be a regular directory');
    const paths = await inventory(source);
    const manifest = await json(join(source, 'ivory.project.json'));
    requireThat(manifest.format === 'ivory-n6-portable/1', 'Unsupported portable format');
    assert.deepEqual(paths.filter(p => p !== 'ivory.project.json').sort(), Object.keys(manifest.files).sort(), 'Export inventory mismatch');
    const folded = new Set();
    for (const [path, digest] of Object.entries(manifest.files)) {
        safePath(path);
        requireThat(!folded.has(path.toLowerCase()), 'Case-colliding export paths'); folded.add(path.toLowerCase());
        requireThat(digestBytes(await readFile(join(source, path))) === digest, `File digest mismatch: ${path}`);
    }
    const dump = await json(join(source, 'records/state.json'));
    const result = inspectRecords(dump);
    const storage = await json(join(source, 'manifest.json'));
    requireThat(manifest.projectId === result.study.projectId && Number(manifest.projectSequence) === Number(storage.projectSeq), 'Project identity/sequence mismatch');
    requireThat(Number(storage.projectSeq) === Math.max(...dump.receipts.map(r => Number(r.project_seq))), 'Receipt sequence mismatch');
    const digests = dump.blob_refs.map(b => b.digest).sort();
    assert.deepEqual([...storage.blobs].sort(), digests, 'Blob inventory mismatch');
    assert.deepEqual(Object.keys(storage.hashes).sort(), digests, 'Blob hash inventory mismatch');
    for (const blob of dump.blob_refs) {
        requireThat(/^[0-9a-f]{64}$/.test(blob.digest), 'Invalid blob digest');
        const bytes = await readFile(join(source, 'blobs', blob.digest));
        requireThat(bytes.length === Number(blob.byte_size) && digestBytes(bytes) === blob.digest && storage.hashes[blob.digest] === blob.digest, 'Blob integrity mismatch');
    }
    for (const [path, digest] of Object.entries(result.study.files)) {
        safePath(path);
        requireThat(path === 'README.md' || /^(analysis|writing|environments)\//.test(path), 'Authoring path outside allowed directories');
        requireThat(digests.includes(digest) && manifest.files[path] === digest, 'Authoring file is not captured');
    }
    return { ...result, manifest, dump };
}

export async function restoreStudy(source, destination) {
    const result = await validateExport(source);
    await requireEmpty(destination);
    await mkdir(dirname(resolve(destination)), { recursive: true });
    const staging = await mkdtemp(join(dirname(resolve(destination)), '.n6-restore-'));
    try {
        await new DurableStore().importSemantic(source, staging);
        for (const path of Object.keys(result.study.files)) {
            await mkdir(dirname(join(staging, path)), { recursive: true });
            await writeFile(join(staging, path), await readFile(join(source, path)));
        }
        await writeJson(join(staging, 'ivory.project.json'), { format: 'ivory-n6-study/1', projectId: result.study.projectId });
        // Recheck the input and reconstructed store before publishing the destination.
        await validateExport(source);
        const check = await inspectProject(staging);
        assert.equal(canonicalize(check.dump), canonicalize(result.dump), 'Restored semantic records differ');
        await requireEmpty(destination);
        // Remove only an empty destination directory, immediately before publication.
        if ((await lstat(destination).catch(() => undefined))?.isDirectory()) {
            await rmdir(destination);
        }
        await rename(staging, destination);
        return { projectId: result.study.projectId, citations: result.citations.length };
    } finally { await rm(staging, { recursive: true, force: true }); }
}

export async function inspectProject(project) {
    const temporary = await mkdtemp(join(tmpdir(), 'ivory-n6-inspect-'));
    try { return await exportStudy(project, temporary); }
    finally { await rm(temporary, { recursive: true, force: true }); }
}
