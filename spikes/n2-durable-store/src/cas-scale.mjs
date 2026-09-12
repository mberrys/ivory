import { createHash } from 'node:crypto';
import { mkdir, open, rm, stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256File } from './blob-admission.mjs';

const CHUNK_BYTES = 4 * 1024 * 1024;

/**
 * Physical CAS admission proof.
 *
 * The fixture is generated from a non-zero repeating pattern, so it cannot be a sparse
 * hole: a hole reads back as zeros, and verifyInstalled() re-hashes the installed file
 * against the digest of the pattern, so a hole fails the check. `admitFile` is the same
 * code path `DurableStore.commit` uses for real uploads (stage -> fsync -> atomic rename).
 */
export async function runCasAdmissionExercise(store, { bytes, workRoot, bindObjectId }) {
    await mkdir(workRoot, { recursive: true });
    const sourcePath = join(workRoot, `cas-source-${bytes}.bin`);

    const spaceBefore = await statfs(workRoot);
    const freeBytesBefore = spaceBefore.bavail * spaceBefore.bsize;
    const requiredBytes = Math.ceil(bytes * 2.5);
    if (freeBytesBefore < requiredBytes) {
        throw new Error(`CAS admission needs ${requiredBytes} free bytes at ${workRoot}; found ${freeBytesBefore}.`);
    }

    const pattern = createHash('sha256').update(`ivory-n2-cas-pattern:${bytes}`).digest();
    const chunk = Buffer.alloc(CHUNK_BYTES);
    for (let offset = 0; offset < chunk.length; offset += pattern.length) {
        pattern.copy(chunk, offset);
    }

    const writeStarted = Date.now();
    await writePatternFile(sourcePath, chunk, bytes);
    const casSourceWriteMs = Date.now() - writeStarted;
    const sourceSize = (await stat(sourcePath)).size;
    if (sourceSize !== bytes) {
        throw new Error(`CAS source is ${sourceSize} bytes, expected ${bytes}.`);
    }

    const digestStarted = Date.now();
    const digest = await sha256File(sourcePath);
    const casSourceDigestMs = Date.now() - digestStarted;

    const admissionStarted = Date.now();
    const admitted = await store.blobs.admitFile(sourcePath, digest);
    const casAdmissionMs = Date.now() - admissionStarted;
    if (admitted.digest !== digest || admitted.byteSize !== bytes) {
        throw new Error('CAS admission returned an unexpected digest or byte size.');
    }

    const casStagingLeftover = await stat(join(store.layout.staging, `${digest}.part`))
        .then(() => true)
        .catch(() => false);

    const verifyStarted = Date.now();
    const casVerifiedBytes = await store.blobs.verifyInstalled(digest);
    const casVerifyMs = Date.now() - verifyStarted;
    if (casVerifiedBytes !== bytes) {
        throw new Error(`Installed CAS blob is ${casVerifiedBytes} bytes, expected ${bytes}.`);
    }

    let binding = { casBindingVerified: false, casBindingMs: null };
    if (bindObjectId !== undefined) {
        const bindingStarted = Date.now();
        await store.commit({
            idempotencyKey: `cas-bind-${bindObjectId}`,
            expectedHeads: [{ objectId: bindObjectId }],
            activity: { operation: 'admit-source', actor: 'n2-cas' },
            revisions: [{
                objectId: bindObjectId,
                objectType: 'source',
                payload: { title: '10 GiB CAS source', digest },
                blobDigest: digest,
            }],
            blobs: [{ stagingPath: sourcePath, digest }],
        });
        const visible = await store.getVisible(bindObjectId);
        if (visible?.blobDigest !== digest) {
            throw new Error('CAS binding did not become visible.');
        }
        binding = { casBindingVerified: true, casBindingMs: Date.now() - bindingStarted };
    }

    await rm(sourcePath, { force: true });
    const spaceAfter = await statfs(workRoot);
    const freeBytesAfter = spaceAfter.bavail * spaceAfter.bsize;

    return {
        blobBytes: bytes,
        largeDigest: digest,
        largeBlob: {
            kind: 'cas-admitted-bytes',
            logicalByteSize: bytes,
            physicalBytesCopied: bytes,
            casAdmissionPath: true,
            contentAddressedScaleProof: true,
            digestSource: 'sha256-of-pattern-file',
            createdAs: 'cas-stage-fsync-rename',
            digest,
        },
        casAdmissionPath: true,
        casVerificationPath: true,
        physicalBytesCopied: bytes,
        casVerifiedBytes,
        casStagingLeftover,
        casSourceRemoved: true,
        casSourceWriteMs,
        casSourceDigestMs,
        casAdmissionMs,
        casVerifyMs,
        freeBytesBefore,
        freeBytesAfter,
        freeBytesDelta: freeBytesBefore - freeBytesAfter,
        sparsePlaceholder: false,
        nonSparseProof:
            'the installed file re-hashed to the digest of the generated non-zero pattern; a sparse hole reads back as zeros and would fail that hash',
        ...binding,
    };
}

async function writePatternFile(path, chunk, bytes) {
    const handle = await open(path, 'w');
    try {
        let remaining = bytes;
        while (remaining > 0) {
            const length = Math.min(remaining, chunk.length);
            await handle.write(chunk, 0, length);
            remaining -= length;
        }
        await handle.sync();
    } finally {
        await handle.close();
    }
}
