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
import { createReadStream, promises as fs, statSync, unlinkSync } from 'fs';
import type { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import { GcResult, IvoryStoreError } from '../../common/store-protocol';
import { fsyncDirectory } from '../durable-fs';
import { ProjectLayout } from '../project-layout';
import { runImmediateTransaction } from './write-queue';

export interface CasContext {
    readonly layout: ProjectLayout;
    /** Tags the staging files, so that recovery can tell whose they are. */
    readonly processId: string;
}

export type BlobCheck = 'valid' | 'corrupt' | 'missing';

/** The steps of admission that the specs replace to force the errors Windows raises. */
export interface CasFsOps {
    rename(from: string, to: string): Promise<void>;
    /** Hashes the file and compares it with `digest`. */
    verify(file: string, digest: Sha256Digest): Promise<BlobCheck>;
}

export const defaultCasFsOps: CasFsOps = {
    rename: (from, to) => fs.rename(from, to),
    verify: async (file, digest) => {
        const hash = createHash('sha256');
        try {
            for await (const chunk of createReadStream(file)) {
                hash.update(chunk as Buffer);
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

const RENAME_RACE_CODES = ['EPERM', 'EBUSY', 'EEXIST'];
const GC_BATCH_SIZE = 64;

/**
 * Stores the bytes and returns their digest. Runs before and outside any transaction: the blob is staged,
 * made durable, and only then renamed to its name, so a name under `cas/sha256` always holds complete bytes.
 * A blob already in the store is verified and touched, which restarts its GC grace, and is never overwritten.
 */
export async function admitBlob(context: CasContext, bytes: Uint8Array, ops: CasFsOps = defaultCasFsOps): Promise<Sha256Digest> {
    const digest: Sha256Digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const target = ProjectLayout.blobPath(context.layout, digest);
    const staging = path.join(context.layout.casStaging, `${context.processId}-${randomBytes(8).toString('hex')}.tmp`);
    await fs.mkdir(context.layout.casStaging, { recursive: true });
    await stage(staging, bytes);
    try {
        if (await touchExisting(target, digest, ops)) {
            return digest;
        }
        await place(context, staging, target, digest, ops);
        return digest;
    } finally {
        await fs.rm(staging, { force: true }).catch(() => undefined);
    }
}

async function stage(staging: string, bytes: Uint8Array): Promise<void> {
    const handle = await fs.open(staging, 'wx');
    try {
        await handle.writeFile(bytes);
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
        await ops.rename(staging, target);
    } catch (error) {
        // On Windows a rename onto a blob that something has open fails. If the blob is there and intact, it is admitted.
        if (RENAME_RACE_CODES.includes((error as NodeJS.ErrnoException).code ?? '') && await ops.verify(target, digest) === 'valid') {
            return;
        }
        throw error;
    }
    await fsyncDirectory(targetDir);
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
