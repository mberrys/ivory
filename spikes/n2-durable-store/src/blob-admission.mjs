import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { BlobIntegrityError, DiskFullError } from './errors.mjs';
import { enospcWhere, maybeFault } from './fault.mjs';
import { casPath } from './paths.mjs';

/**
 * Spike-local CAS admission matching ObjectStorePort putImmutable/get, plus
 * staging + fsync. Production FilesystemObjectStore.putImmutable is not crash-safe
 * and is left unchanged until P2.
 */
export class CasBlobAdmission {
    constructor(objectsRoot, stagingRoot) {
        this.objectsRoot = resolve(objectsRoot);
        this.stagingRoot = resolve(stagingRoot);
    }

    resolveKey(key) {
        const target = resolve(join(this.objectsRoot, key));
        if (target !== this.objectsRoot && !target.startsWith(`${this.objectsRoot}${sep}`)) {
            throw new Error('Object key escapes the configured object-store root.');
        }
        return target;
    }

    get(key) {
        return readFile(this.resolveKey(key));
    }

    async putImmutable(key, content, _contentType) {
        const digest = createHash('sha256').update(content).digest('hex');
        await this.admitBytes(content, digest);
        return { key, etag: digest };
    }

    async admitFile(sourcePath, expectedDigest) {
        const digest = await sha256File(sourcePath);
        if (expectedDigest !== undefined && digest !== expectedDigest) {
            throw new BlobIntegrityError(expectedDigest, `hashed ${digest}`);
        }
        const size = (await stat(sourcePath)).size;
        const stagingPath = join(this.stagingRoot, `${digest}.part`);
        await mkdir(this.stagingRoot, { recursive: true });
        if (enospcWhere() === 'blob') {
            throw new DiskFullError('blob');
        }
        await copyFsync(sourcePath, stagingPath);
        await this.installStaged(digest, stagingPath, size);
        return { digest, byteSize: size };
    }

    async admitBytes(content, expectedDigest) {
        const digest = createHash('sha256').update(content).digest('hex');
        if (expectedDigest !== undefined && digest !== expectedDigest) {
            throw new BlobIntegrityError(expectedDigest, `hashed ${digest}`);
        }
        const stagingPath = join(this.stagingRoot, `${digest}.part`);
        await mkdir(this.stagingRoot, { recursive: true });
        if (enospcWhere() === 'blob') {
            throw new DiskFullError('blob');
        }
        const handle = await open(stagingPath, 'w');
        await handle.writeFile(content);
        await handle.sync();
        await handle.close();
        await this.installStaged(digest, stagingPath, content.byteLength);
        return { digest, byteSize: content.byteLength };
    }

    async installStaged(digest, stagingPath, byteSize) {
        await maybeFault('beforeBlobInstall');
        const dest = casPath(this.objectsRoot, digest);
        await mkdir(dirname(dest), { recursive: true });
        try {
            const existing = await sha256File(dest);
            if (existing !== digest) {
                throw new BlobIntegrityError(digest, 'immutable collision');
            }
            await unlink(stagingPath).catch(error => {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            });
            await maybeFault('afterBlobInstall');
            return { digest, byteSize };
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
        await rename(stagingPath, dest);
        const installed = await open(dest, 'r+');
        await installed.sync();
        await installed.close();
        await maybeFault('afterBlobInstall');
        return { digest, byteSize };
    }

    async verifyInstalled(digest) {
        const dest = casPath(this.objectsRoot, digest);
        try {
            const actual = await sha256File(dest);
            if (actual !== digest) {
                throw new BlobIntegrityError(digest, 'hash mismatch');
            }
            return (await stat(dest)).size;
        } catch (error) {
            if (error instanceof BlobIntegrityError) {
                throw error;
            }
            throw new BlobIntegrityError(digest, error.code === 'ENOENT' ? 'missing' : error.message);
        }
    }
}

export function sha256File(filePath) {
    return new Promise((resolveHash, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolveHash(hash.digest('hex')));
    });
}

async function copyFsync(sourcePath, destPath) {
    const source = await open(sourcePath, 'r');
    const dest = await open(destPath, 'w');
    try {
        const buffer = Buffer.alloc(1024 * 1024);
        let position = 0;
        while (true) {
            const { bytesRead } = await source.read(buffer, 0, buffer.length, position);
            if (bytesRead === 0) {
                break;
            }
            await dest.write(buffer.subarray(0, bytesRead));
            position += bytesRead;
        }
        await dest.sync();
    } finally {
        await source.close();
        await dest.close();
    }
}
