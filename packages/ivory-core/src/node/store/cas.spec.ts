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
import { expect } from 'chai';
import { createHash } from 'crypto';
import { closeSync, existsSync, openSync, promises as fs, readdirSync } from 'fs';
import type { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import { IvoryStoreError } from '../../common/store-protocol';
import { ProjectLayout } from '../project-layout';
import { SpecKit } from '../test/spec-helpers';
import { admitBlob, CasContext, CasFsOps, collectGarbage, defaultCasFsOps } from './cas';
import { ensureSchema, openWriteConnection } from './store-schema';

const digestOf = (bytes: Uint8Array): Sha256Digest => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const HOUR = 60 * 60 * 1000;

async function backdate(file: string, ageMs: number): Promise<void> {
    const then = new Date(Date.now() - ageMs);
    await fs.utimes(file, then, then);
}

function eperm(): NodeJS.ErrnoException {
    return Object.assign(new Error('EPERM: operation not permitted, install'), { code: 'EPERM' });
}

describe('content-addressed blobs', function (): void {
    // Every store is a worker thread and a WAL database with full synchronous, and some specs start other processes.
    this.timeout(60000);

    const kit = new SpecKit();
    let context: CasContext;

    beforeEach(async () => {
        context = { layout: ProjectLayout.of(await kit.project()), processId: 'spec-process' };
    });
    afterEach(() => kit.dispose());

    const stagingFiles = (): string[] => readdirSync(context.layout.casStaging);
    const target = (bytes: Uint8Array): string => ProjectLayout.blobPath(context.layout, digestOf(bytes));

    describe('admission', () => {

        it('stores the bytes under the digest, and leaves no staging file', async () => {
            const bytes = Buffer.from('hello');
            const digest = await admitBlob(context, bytes);
            expect(digest).to.equal('sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
            expect(target(bytes)).to.match(/[\\/]sha256[\\/]2c[\\/]f2[\\/]2cf24dba5fb0a30e/);
            expect(await fs.readFile(target(bytes))).to.deep.equal(bytes);
            expect(stagingFiles()).to.be.empty;
        });

        it('admits the empty blob', async () => {
            const digest = await admitBlob(context, new Uint8Array());
            expect(digest).to.equal('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
            expect((await fs.stat(target(new Uint8Array()))).size).to.equal(0);
        });

        it('admits the same bytes twice, concurrently, to one blob', async () => {
            const bytes = Buffer.from('twice');
            const digests = await Promise.all([1, 2, 3, 4].map(() => admitBlob(context, bytes)));
            expect(new Set(digests).size).to.equal(1);
            expect(await fs.readFile(target(bytes))).to.deep.equal(bytes);
            expect(stagingFiles()).to.be.empty;
        });

        it('tags the staging file with the process id', async () => {
            let staged: string[] = [];
            const ops: CasFsOps = {
                ...defaultCasFsOps,
                install: async (from, to) => {
                    staged = stagingFiles();
                    await defaultCasFsOps.install(from, to);
                }
            };
            await admitBlob(context, Buffer.from('tagged'), ops);
            expect(staged).to.have.length(1);
            expect(staged[0]).to.match(/^spec-process-[0-9a-f]{16}\.tmp$/);
        });

        it('refuses a name that holds other bytes, and does not overwrite them', async () => {
            const bytes = Buffer.from('the real bytes');
            const file = target(bytes);
            await fs.mkdir(path.dirname(file), { recursive: true });
            await fs.writeFile(file, 'damaged');
            let error: unknown;
            try {
                await admitBlob(context, bytes);
            } catch (e) {
                error = e;
            }
            expect(error).to.be.instanceOf(IvoryStoreError).with.property('code', 'cas-corrupt');
            expect(await fs.readFile(file, 'utf8')).to.equal('damaged');
            expect(stagingFiles()).to.be.empty;
        });
    });

    describe('Windows EPERM on install onto an open blob', () => {

        it('admits the same bytes while a handle is open on the blob, without an install, and refreshes the mtime', async () => {
            const bytes = Buffer.from('held open');
            await admitBlob(context, bytes);
            const file = target(bytes);
            await backdate(file, 48 * HOUR);
            const before = (await fs.stat(file)).mtimeMs;
            let installs = 0;
            const ops: CasFsOps = { ...defaultCasFsOps, install: (from, to) => { installs++; return defaultCasFsOps.install(from, to); } };
            const held = openSync(file, 'r');
            try {
                expect(await admitBlob(context, bytes, ops)).to.equal(digestOf(bytes));
            } finally {
                closeSync(held);
            }
            expect(installs, 'the install is skipped').to.equal(0);
            expect((await fs.stat(file)).mtimeMs - before, 'the mtime moved forward').to.be.greaterThan(47 * HOUR);
            expect(stagingFiles()).to.be.empty;
        });

        it('admits the blob when the install fails with EPERM but the blob has appeared and verifies', async () => {
            const bytes = Buffer.from('appeared meanwhile');
            const ops: CasFsOps = {
                ...defaultCasFsOps,
                install: async (from, to) => {
                    // Someone else placed the same bytes, and holds them open, so this install is refused.
                    await fs.copyFile(from, to);
                    throw eperm();
                }
            };
            expect(await admitBlob(context, bytes, ops)).to.equal(digestOf(bytes));
            expect(await fs.readFile(target(bytes))).to.deep.equal(bytes);
            expect(stagingFiles()).to.be.empty;
        });

        it('rejects when the install fails with EPERM and there is no blob', async () => {
            const bytes = Buffer.from('nothing appeared');
            const ops: CasFsOps = { ...defaultCasFsOps, install: () => Promise.reject(eperm()) };
            let error: NodeJS.ErrnoException | undefined;
            try {
                await admitBlob(context, bytes, ops);
            } catch (e) {
                error = e as NodeJS.ErrnoException;
            }
            expect(error?.code).to.equal('EPERM');
            expect(existsSync(target(bytes))).to.be.false;
            expect(stagingFiles()).to.be.empty;
        });

        it('rejects when the install fails with EPERM and what is there does not verify', async () => {
            const bytes = Buffer.from('something else appeared');
            const ops: CasFsOps = {
                ...defaultCasFsOps,
                install: async (_from, to) => {
                    await fs.writeFile(to, 'other bytes');
                    throw eperm();
                }
            };
            let code: string | undefined;
            try {
                await admitBlob(context, bytes, ops);
            } catch (e) {
                code = (e as NodeJS.ErrnoException).code;
            }
            expect(code).to.equal('cas-corrupt');
            expect(stagingFiles()).to.be.empty;
        });

        it('does not treat other errors from the install as a race', async () => {
            const bytes = Buffer.from('disk trouble');
            const ops: CasFsOps = {
                ...defaultCasFsOps,
                install: async (from, to) => {
                    await fs.copyFile(from, to);
                    throw Object.assign(new Error('EIO'), { code: 'EIO' });
                }
            };
            let code: string | undefined;
            try {
                await admitBlob(context, bytes, ops);
            } catch (e) {
                code = (e as NodeJS.ErrnoException).code;
            }
            expect(code).to.equal('EIO');
        });
    });

    describe('installation corruption', () => {
        it('detects corrupted staging before publishing a digest name', async () => {
            const bytes = Buffer.from('staging fixture');
            const ops: CasFsOps = {
                ...defaultCasFsOps,
                verify: async (file, digest) => {
                    if (file.endsWith('.tmp')) {
                        await fs.writeFile(file, 'corrupt staging');
                    }
                    return defaultCasFsOps.verify(file, digest);
                }
            };
            let error: unknown;
            await admitBlob(context, bytes, ops).catch(caught => { error = caught; });
            expect(error).to.be.instanceOf(IvoryStoreError).with.property('code', 'cas-corrupt');
            expect(existsSync(target(bytes))).to.be.false;
            expect(stagingFiles()).to.be.empty;
        });

        it('detects a corrupted installation on durable readback and removes that invalid name', async () => {
            const bytes = Buffer.from('readback fixture');
            const ops: CasFsOps = {
                ...defaultCasFsOps,
                install: async (_from, to) => { await fs.writeFile(to, 'corrupt install'); }
            };
            let error: unknown;
            await admitBlob(context, bytes, ops).catch(caught => { error = caught; });
            expect(error).to.be.instanceOf(IvoryStoreError).with.property('code', 'cas-corrupt');
            expect(existsSync(target(bytes))).to.be.false;
            expect(stagingFiles()).to.be.empty;
        });

        it('cannot replace a different blob that wins the publication race', async () => {
            const bytes = Buffer.from('publication fixture');
            const ops: CasFsOps = {
                ...defaultCasFsOps,
                install: async (from, to) => {
                    await fs.writeFile(to, 'race winner');
                    await defaultCasFsOps.install(from, to);
                }
            };
            let error: unknown;
            await admitBlob(context, bytes, ops).catch(caught => { error = caught; });
            expect(error).to.be.instanceOf(IvoryStoreError).with.property('code', 'cas-corrupt');
            expect(await fs.readFile(target(bytes), 'utf8')).to.equal('race winner');
            expect(stagingFiles()).to.be.empty;
        });
    });

    describe('garbage collection', () => {
        let db: DatabaseSync;

        beforeEach(async () => {
            db = await openWriteConnection(context.layout.store, 50, 1000);
            await ensureSchema(db, 'project-1', 1000);
        });
        afterEach(() => db.close());

        const gc = (graceMs: number, writerBusyBoundMs = 1000): ReturnType<typeof collectGarbage> => collectGarbage({ ...context, db, graceMs, writerBusyBoundMs });

        function reference(digest: Sha256Digest): void {
            db.prepare(`INSERT INTO commits(seq, prev_digest, digest, receipt_digest, principal_key, idem_key, request_digest, library_build, receipt_json)
                VALUES (1, 'p', 'd', 'r', 'principal', 'key', 'q', 'spec', '{}')`).run();
            db.prepare('INSERT INTO blob_refs(digest, commit_seq) VALUES (?, 1)').run(digest);
        }

        it('deletes unreferenced blobs older than the grace period and keeps the rest', async () => {
            const old = Buffer.from('old orphan');
            const young = Buffer.from('young orphan');
            const referenced = Buffer.from('old but referenced');
            for (const bytes of [old, young, referenced]) {
                await admitBlob(context, bytes);
            }
            await backdate(target(old), 2 * HOUR);
            await backdate(target(referenced), 2 * HOUR);
            reference(digestOf(referenced));
            expect(await gc(HOUR), 'the young blob is not a candidate, the referenced one is skipped').to.deep.equal({ deleted: 1, skipped: 1 });
            expect(existsSync(target(old))).to.be.false;
            expect(existsSync(target(young))).to.be.true;
            expect(existsSync(target(referenced))).to.be.true;
        });

        it('with no grace deletes every unreferenced blob, in batches', async () => {
            const blobs = Array.from({ length: 70 }, (_, index) => Buffer.from(`blob ${index}`));
            await Promise.all(blobs.map(bytes => admitBlob(context, bytes)));
            reference(digestOf(blobs[0]));
            expect(await gc(0)).to.deep.equal({ deleted: 69, skipped: 1 });
            expect(existsSync(target(blobs[0]))).to.be.true;
            expect(existsSync(target(blobs[69]))).to.be.false;
        });

        it('leaves files that are not blob names alone', async () => {
            await admitBlob(context, Buffer.from('a blob'));
            const stray = `${target(Buffer.from('a blob'))}.part`;
            await fs.writeFile(stray, 'stray');
            expect(await gc(0)).to.deep.equal({ deleted: 1, skipped: 0 });
            expect(existsSync(stray)).to.be.true;
        });

        it('stops and counts the rest as skipped when another writer holds the lock past the bound', async () => {
            await admitBlob(context, Buffer.from('waiting'));
            const other = await openWriteConnection(context.layout.store, 50, 1000);
            other.exec('BEGIN IMMEDIATE');
            try {
                expect(await gc(0, 150)).to.deep.equal({ deleted: 0, skipped: 1 });
            } finally {
                other.exec('ROLLBACK');
                other.close();
            }
            expect(await gc(0)).to.deep.equal({ deleted: 1, skipped: 0 });
        });

        it('has nothing to do in an empty store', async () => {
            expect(await gc(0)).to.deep.equal({ deleted: 0, skipped: 0 });
        });
    });
});
