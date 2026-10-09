// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { Sha256Digest } from '@ivory/contracts';
import { createHash, randomBytes } from 'crypto';
import { closeSync, createReadStream, fstatSync, openSync, promises as fs, readSync, statSync, unlinkSync } from 'fs';
import type { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import { GcResult, IvoryStoreError } from '../../common/store-protocol';
import { fsyncDirectory, fsyncFile } from '../durable-fs';
import { ProjectLayout } from '../project-layout';
import { failpoint } from './qualification/failpoint';
import { runImmediateTransaction } from './write-queue';

export interface CasContext {
    readonly layout: ProjectLayout;
    /** Tags the staging files, so that recovery can tell whose they are. */
    readonly processId: string;
}

export type BlobCheck = 'valid' | 'corrupt' | 'missing';

/** The steps of admission that the specs replace to force the errors Windows raises. */
export interface CasFsOps {
    /** Atomically installs a complete file without replacing an existing name. */
    install(from: string, to: string): Promise<void>;
    /** Hashes the file and compares it with `digest`. */
    verify(file: string, digest: Sha256Digest): Promise<BlobCheck>;
}

export const defaultCasFsOps: CasFsOps = {
    install: (from, to) => fs.link(from, to),
    verify: async (file, digest) => {
        const hash = createHash('sha256');
        try {
            if (!(await fs.lstat(file)).isFile()) {
                return 'corrupt';
            }
            for await (const chunk of createReadStream(file)) {
                hash.update(chunk);
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return 'missing';
            }
            throw error;
        }
        return `sha256:${hash.digest('hex')}` === digest ? 'valid' : 'corrupt';
    }
};

const INSTALL_RACE_CODES = ['EPERM', 'EBUSY', 'EEXIST'];
const GC_BATCH_SIZE = 64;

/**
 * Stores the bytes and returns their digest. Runs before and outside any transaction: the blob is staged,
 * made durable, and only then linked to its name, so a name under CAS always holds complete bytes.
 * A blob already in the store is verified and touched, which restarts its GC grace, and is never overwritten.
 */
export async function admitBlob(
    context: CasContext, bytes: Uint8Array, ops: CasFsOps = defaultCasFsOps, expectedDigest?: Sha256Digest
): Promise<Sha256Digest> {
    if (!(bytes instanceof Uint8Array) || (expectedDigest !== undefined && !Sha256Digest.is(expectedDigest))) {
        throw new IvoryStoreError('invalid-argument', 'admission requires bytes and an optional sha256 digest');
    }
    const digest: Sha256Digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    if (expectedDigest !== undefined && digest !== expectedDigest) {
        throw new IvoryStoreError('digest-mismatch', 'the supplied bytes do not match the expected digest');
    }
    const target = ProjectLayout.blobPath(context.layout, digest);
    const staging = path.join(context.layout.casStaging, `${context.processId}-${randomBytes(8).toString('hex')}.tmp`);
    await fs.mkdir(context.layout.casStaging, { recursive: true });
    try {
        await stage(staging, bytes);
        if (await ops.verify(staging, digest) !== 'valid') {
            throw new IvoryStoreError('cas-corrupt', 'the staged bytes failed digest verification');
        }
        failpoint('beforeBlobInstall');
        if (await touchExisting(target, digest, ops)) {
            await fsyncFile(target);
            await fsyncDirectory(path.dirname(target));
            failpoint('afterBlobInstall');
            return digest;
        }
        await place(context, staging, target, digest, ops);
        failpoint('afterBlobInstall');
        return digest;
    } finally {
        await fs.rm(staging, { force: true }).catch(() => undefined);
    }
}

async function stage(staging: string, bytes: Uint8Array): Promise<void> {
    const handle = await fs.open(staging, 'wx');
    try {
        const half = bytes.length >> 1;
        await handle.writeFile(bytes.subarray(0, half));
        failpoint('duringBlobStage');
        await handle.writeFile(bytes.subarray(half));
        await handle.sync();
    } finally {
        await handle.close();
    }
}

/** True when the blob is there, intact and now touched. A blob that is there but wrong is never overwritten. */
async function touchExisting(target: string, digest: Sha256Digest, ops: CasFsOps): Promise<boolean> {
    const check = await ops.verify(target, digest);
    if (check === 'missing') {
        return false;
    }
    if (check === 'corrupt') {
        throw new IvoryStoreError('cas-corrupt', `the blob ${digest} is in the store with other bytes than its digest names; verify will report it`);
    }
    const now = new Date();
    try {
        await fs.utimes(target, now, now);
    } catch (error) {
        // GC removed it between the check and the touch, so it has to be placed again.
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return false;
        }
        throw error;
    }
    return true;
}

/** The directories from the topmost one that does not exist down to `directory`, in creation order. */
async function missingDirectories(directory: string): Promise<string[]> {
    const missing: string[] = [];
    for (let current = directory; ; current = path.dirname(current)) {
        try {
            await fs.stat(current);
            return missing;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || path.dirname(current) === current) {
                throw error;
            }
            missing.unshift(current);
        }
    }
}

async function place(context: CasContext, staging: string, target: string, digest: Sha256Digest, ops: CasFsOps): Promise<void> {
    const targetDir = path.dirname(target);
    const missing = await missingDirectories(targetDir);
    await fs.mkdir(targetDir, { recursive: true });
    // Every directory made now has an entry in its parent that must be flushed.
    for (const directory of missing) {
        await fsyncDirectory(path.dirname(directory));
    }
    try {
        await ops.install(staging, target);
    } catch (error) {
        // A competing installation may have appeared. Verify and touch it without overwriting its bytes.
        if (!INSTALL_RACE_CODES.includes((error as NodeJS.ErrnoException).code ?? '') || !await touchExisting(target, digest, ops)) {
            throw error;
        }
    }
    await fsyncFile(target);
    await fsyncDirectory(targetDir);
    if (await ops.verify(target, digest) !== 'valid') {
        await fs.rm(target, { force: true });
        await fsyncDirectory(targetDir);
        throw new IvoryStoreError('cas-corrupt', 'the installed bytes failed durable readback');
    }
}

/** Checks the actual bytes inside a synchronous commit, before recording a semantic reference. */
export function checkBlobSync(layout: ProjectLayout, digest: Sha256Digest): BlobCheck {
    let handle: number;
    try {
        handle = openSync(ProjectLayout.blobPath(layout, digest), 'r');
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return 'missing';
        }
        throw error;
    }
    try {
        if (!fstatSync(handle).isFile()) {
            return 'corrupt';
        }
        const hash = createHash('sha256');
        const buffer = Buffer.alloc(128 * 1024);
        for (let count = readSync(handle, buffer); count > 0; count = readSync(handle, buffer)) {
            hash.update(buffer.subarray(0, count));
        }
        return `sha256:${hash.digest('hex')}` === digest ? 'valid' : 'corrupt';
    } finally {
        closeSync(handle);
    }
}

/** Staging and unreferenced installations have no semantic visibility, even after an interrupted admission. */
export async function readReferencedBlob(db: DatabaseSync, layout: ProjectLayout, digest: Sha256Digest): Promise<Uint8Array> {
    if (!Sha256Digest.is(digest)) {
        throw new IvoryStoreError('invalid-argument', 'a blob is read by its sha256 digest');
    }
    if (!db.prepare('SELECT 1 FROM blob_refs WHERE digest = ? LIMIT 1').get(digest)) {
        throw new IvoryStoreError('blob-unreferenced', 'no committed semantic reference exists for this blob');
    }
    let bytes: Buffer;
    try {
        bytes = await fs.readFile(ProjectLayout.blobPath(layout, digest));
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            throw new IvoryStoreError('blob-missing', 'the referenced blob is missing');
        }
        throw error;
    }
    if (`sha256:${createHash('sha256').update(bytes).digest('hex')}` !== digest) {
        throw new IvoryStoreError('cas-corrupt', 'the referenced blob failed digest verification');
    }
    return bytes;
}

export interface GcOptions extends CasContext {
    readonly db: DatabaseSync;
    readonly writerBusyBoundMs: number;
    /** Only blobs whose mtime is at least this old are candidates. */
    readonly graceMs: number;
}

interface GcCandidate {
    readonly digest: Sha256Digest;
    readonly file: string;
}

/**
 * Deletes blobs that no commit references and that were not admitted within the grace period.
 * Runs in short write transactions: the mtime and the references are checked again inside each one, and the
 * unlink happens inside it, so it cannot interleave with a commit's `requireBlob`. Stops at the first batch that
 * cannot get the write lock in time and counts what is left as skipped.
 */
export async function collectGarbage(options: GcOptions): Promise<GcResult> {
    const candidates = await listCandidates(options.layout, options.graceMs);
    let deleted = 0;
    let skipped = 0;
    for (let start = 0; start < candidates.length; start += GC_BATCH_SIZE) {
        const batch = candidates.slice(start, start + GC_BATCH_SIZE);
        const result = await runImmediateTransaction(options.db, () => ({ commit: true, value: deleteBatch(options.db, batch, options.graceMs) }), options.writerBusyBoundMs);
        if (result.busy) {
            skipped += candidates.length - start;
            break;
        }
        deleted += result.value.deleted;
        skipped += result.value.skipped;
    }
    return { deleted, skipped };
}

function isOldEnough(mtimeMs: number, graceMs: number): boolean {
    return graceMs <= 0 || Date.now() - mtimeMs >= graceMs;
}

async function listCandidates(layout: ProjectLayout, graceMs: number): Promise<GcCandidate[]> {
    const candidates: GcCandidate[] = [];
    for (const first of await listDirectories(layout.casRoot)) {
        for (const second of await listDirectories(path.join(layout.casRoot, first))) {
            const directory = path.join(layout.casRoot, first, second);
            for (const name of await fs.readdir(directory)) {
                const digest = ProjectLayout.digestOfBlobName(name);
                if (!digest) {
                    continue;
                }
                const file = path.join(directory, name);
                try {
                    if (isOldEnough((await fs.stat(file)).mtimeMs, graceMs)) {
                        candidates.push({ digest, file });
                    }
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                        throw error;
                    }
                }
            }
        }
    }
    return candidates;
}

async function listDirectories(directory: string): Promise<string[]> {
    try {
        return (await fs.readdir(directory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

/** Synchronous on purpose: it runs between BEGIN and COMMIT. */
function deleteBatch(db: DatabaseSync, batch: readonly GcCandidate[], graceMs: number): GcResult {
    const referenced = db.prepare('SELECT 1 AS referenced FROM blob_refs WHERE digest = ? LIMIT 1');
    let deleted = 0;
    let skipped = 0;
    for (const candidate of batch) {
        let mtimeMs: number;
        try {
            mtimeMs = statSync(candidate.file).mtimeMs;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                skipped++;
                continue;
            }
            throw error;
        }
        if (!isOldEnough(mtimeMs, graceMs) || referenced.get(candidate.digest) !== undefined) {
            skipped++;
            continue;
        }
        try {
            unlinkSync(candidate.file);
            deleted++;
        } catch (error) {
            if (['EPERM', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '')) {
                // Windows keeps a file that something has open. It is tried again by the next GC.
                skipped++;
                continue;
            }
            throw error;
        }
    }
    return { deleted, skipped };
}
