import { createHash } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';

export const SPARSE_ZERO_PLACEHOLDER = 'sparse-zero-placeholder';
export const CAS_ADMITTED_BYTES = 'cas-admitted-bytes';

/**
 * Metadata/search/snapshot scale fixture. The large blob is NOT created here: the real
 * 10 GiB payload is admitted through CasBlobAdmission.admitFile by cas-scale.mjs, which
 * records physicalBytesCopied and a largeBlob descriptor. The sparse-zero placeholder
 * below exists only as an explicit dev shortcut (`sparseBlobBytes`) and can never satisfy
 * a content-addressed scale proof.
 */
export async function loadScaleFixture(store, { documents = 1000, annotations = 100_000, sparseBlobBytes } = {}) {
    const started = Date.now();
    for (let index = 0; index < documents; index += 1) {
        const text = `Document ${index} searchable-token-${index % 17} qualitative transcript.`;
        await store.commit({
            idempotencyKey: `scale-doc-${index}`,
            expectedHeads: [{ objectId: `scale-doc-${index}` }],
            activity: { operation: 'admit-source', actor: 'n2-scale' },
            revisions: [{
                objectId: `scale-doc-${index}`,
                objectType: 'document',
                payload: { title: `Scale doc ${index}`, text },
            }],
            blobs: [{ bytes: Buffer.from(text, 'utf8') }],
        });
    }

    const batchSize = 500;
    for (let start = 0; start < annotations; start += batchSize) {
        const end = Math.min(start + batchSize, annotations);
        const objects = [];
        const revisions = [];
        const heads = [];
        for (let index = start; index < end; index += 1) {
            const objectId = `scale-ann-${index}`;
            const revisionId = `rev-ann-${index}`;
            const payload = { text: `annotation ${index} code=theme-${index % 40}` };
            const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
            objects.push(`(${sqlLiteral(objectId)}, 'annotation')`);
            revisions.push(`(${sqlLiteral(revisionId)}, ${sqlLiteral(objectId)}, 1, ${sqlLiteral(JSON.stringify(payload))}::jsonb, ${sqlLiteral(digest)}, ${sqlLiteral('scale-load')})`);
            heads.push(`(${sqlLiteral(objectId)}, ${sqlLiteral(revisionId)})`);
        }
        await store.pg.exec(`INSERT INTO objects (object_id, object_type) VALUES ${objects.join(',')} ON CONFLICT DO NOTHING`);
        await store.pg.exec(
            `INSERT INTO revisions (revision_id, object_id, schema_version, payload, content_digest, activity_id)
             VALUES ${revisions.join(',')} ON CONFLICT DO NOTHING`,
        );
        await store.pg.exec(
            `INSERT INTO heads (object_id, revision_id) VALUES ${heads.join(',')}
             ON CONFLICT (object_id) DO UPDATE SET revision_id = EXCLUDED.revision_id`,
        );
    }

    if (sparseBlobBytes !== undefined) {
        // Dev-only shortcut. Never qualifies: no payload bytes are copied, so the CAS
        // admission path is not exercised. Labelled explicitly so the gate can reject it.
        await mkdir(store.layout.staging, { recursive: true });
        await mkdir(store.layout.objects, { recursive: true });
        const digest = sha256OfZeros(sparseBlobBytes);
        const dest = join(store.layout.objects, digest.slice(0, 2), digest);
        await mkdir(join(store.layout.objects, digest.slice(0, 2)), { recursive: true });
        await createSparseFile(dest, sparseBlobBytes);
        await store.pg.query(
            'INSERT INTO blob_refs (digest, byte_size) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [digest, sparseBlobBytes],
        );
        const largeBlob = {
            kind: SPARSE_ZERO_PLACEHOLDER,
            logicalByteSize: sparseBlobBytes,
            physicalBytesCopied: 0,
            casAdmissionPath: false,
            contentAddressedScaleProof: false,
            digestSource: 'sha256-of-zeros-in-memory',
            createdAs: 'sparse-file-truncate',
            digest,
        };
        return {
            documents,
            annotations,
            loadMs: Date.now() - started,
            sparsePlaceholder: true,
            blobBytes: sparseBlobBytes,
            largeDigest: digest,
            largeBlob,
            physicalBytesCopied: 0,
            casAdmissionPath: false,
            casVerificationPath: false,
            casBindingVerified: false,
        };
    }

    return { documents, annotations, loadMs: Date.now() - started, sparsePlaceholder: false };
}

async function createSparseFile(path, size) {
    const handle = await open(path, 'w');
    await handle.truncate(size);
    await handle.sync();
    await handle.close();
}

export function sha256OfZeros(size) {
    const hash = createHash('sha256');
    const chunk = Buffer.alloc(1024 * 1024);
    let remaining = size;
    while (remaining > 0) {
        const n = Math.min(remaining, chunk.length);
        hash.update(n === chunk.length ? chunk : chunk.subarray(0, n));
        remaining -= n;
    }
    return hash.digest('hex');
}

/** Labels the large-blob fixture of a scale observation, however it was produced. */
export function describeLargeBlob(scale = {}) {
    const explicit = scale.largeBlob ?? {};
    const logicalByteSize = scale.blobBytes ?? explicit.logicalByteSize;
    const kind = explicit.kind ?? (logicalByteSize !== undefined ? SPARSE_ZERO_PLACEHOLDER : 'unspecified');
    const isSparseZeros = kind === SPARSE_ZERO_PLACEHOLDER;
    const casAdmissionPath = !isSparseZeros && explicit.casAdmissionPath === true;
    const physicalBytesCopied = isSparseZeros ? 0 : explicit.physicalBytesCopied;
    const contentAddressedScaleProof = !isSparseZeros
        && casAdmissionPath
        && Number.isFinite(logicalByteSize)
        && logicalByteSize > 0
        && physicalBytesCopied === logicalByteSize;
    return {
        kind,
        logicalByteSize,
        physicalBytesCopied,
        casAdmissionPath,
        contentAddressedScaleProof,
        digest: scale.largeDigest ?? explicit.digest,
        digestSource: explicit.digestSource ?? (isSparseZeros ? 'sha256-of-zeros-in-memory' : undefined),
        inferred: explicit.kind === undefined && isSparseZeros,
    };
}

export function isContentAddressedScaleProof(scale = {}) {
    return describeLargeBlob(scale).contentAddressedScaleProof === true;
}

export async function measureMetadata(store, samples = 40) {
    const times = [];
    for (let index = 0; index < samples; index += 1) {
        const objectId = `scale-doc-${index % 1000}`;
        const start = process.hrtime.bigint();
        await store.getVisible(objectId);
        times.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    times.sort((a, b) => a - b);
    return { p50: percentile(times, 0.5), p95: percentile(times, 0.95) };
}

export async function measureSearch(store, query = 'searchable-token-3') {
    const start = process.hrtime.bigint();
    const hits = await store.searchSources(query);
    return { ms: Number(process.hrtime.bigint() - start) / 1e6, hitCount: hits.length };
}

export async function measureSnapshot(store) {
    const start = process.hrtime.bigint();
    const snapshot = await store.freezeUnchanged();
    return { ms: Number(process.hrtime.bigint() - start) / 1e6, snapshot };
}

function sqlLiteral(value) {
    return `'${String(value).replaceAll("'", "''")}'`;
}

function percentile(sorted, p) {
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
    return sorted[index];
}
