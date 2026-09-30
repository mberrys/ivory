// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { canonicalJson } from '@ivory/contracts';
import { canonicalDigest } from '@ivory/contracts/lib/node';
import { expect } from 'chai';
import { existsSync, promises as fs, readdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import { CommitOutcome, CommitRequest, CommitSuccess, IvoryStoreError } from '../common/store-protocol';
import { createLeaseFile, processId } from './store/process-lease';
import { initProject, ProjectLayout } from './project-layout';
import { ProjectStore } from './store-host';
import { genesisDigest } from './store/commit-log';
import { breakPrevDigest, countBlobRefs, countRows, libraryBuilds, readKeyValues, tamperReceipt, writeStoreOfProject } from './store/test/sql-fixtures';
import { asyncHandlerModule, childScript, eventually, sleep, SpecKit, testHandlerModule } from './test/spec-helpers';

const HOUR = 60 * 60 * 1000;

function put(key: string, value = 'value', idempotencyKey = key, principal = 'principal'): CommitRequest {
    return { kind: 'test.put', input: { key, value }, principal, idempotencyKey };
}

function succeeded<O = unknown>(outcome: CommitOutcome<O>): CommitSuccess<O> {
    if (CommitOutcome.isRefusal(outcome)) {
        throw new Error(`the commit was refused: ${JSON.stringify(outcome.refusal)}`);
    }
    return outcome;
}

function refusalOf(outcome: CommitOutcome): { code: string; message: string; [detail: string]: unknown } {
    if (!CommitOutcome.isRefusal(outcome)) {
        throw new Error(`the commit succeeded: ${JSON.stringify(outcome)}`);
    }
    return outcome.refusal;
}

async function rejection(action: () => Promise<unknown>): Promise<Error> {
    try {
        await action();
    } catch (error) {
        return error as Error;
    }
    throw new Error('the action did not reject');
}

describe('store host', function (): void {
    // Every store is a worker thread and a WAL database with full synchronous, and some specs start other processes.
    this.timeout(90000);

    const kit = new SpecKit();
    afterEach(() => kit.dispose());

    describe('opening a project', () => {

        it('refuses a project without a manifest', async () => {
            const error = await rejection(async () => kit.open(await kit.tempDir()));
            expect(error).to.be.instanceOf(IvoryStoreError).with.property('code', 'invalid-manifest');
        });

        it('refuses a store that belongs to another project', async () => {
            const directory = await kit.project('project-1');
            await writeStoreOfProject(directory, 'project-2');
            const error = await rejection(() => kit.open(directory));
            expect(error).to.be.instanceOf(IvoryStoreError).with.property('code', 'store-mismatch');
            expect(readdirSync(ProjectLayout.of(directory).leases), 'the lease is released again').to.be.empty;
        });

        it('opens once per process, holds a lease while open, and can be opened again after close', async () => {
            const directory = await kit.project();
            const lease = path.join(ProjectLayout.of(directory).leases, `${processId}.sqlite`);
            const store = await kit.open(directory);
            expect(store.processId).to.equal(processId);
            expect(existsSync(lease)).to.be.true;
            expect(await rejection(() => kit.open(directory))).to.have.property('code', 'already-open');
            await store.close();
            await store.close();
            expect(existsSync(lease)).to.be.false;
            expect(await rejection(() => store.headSeq())).to.have.property('code', 'store-closed');
            const again = await kit.open(directory);
            expect(await again.headSeq()).to.equal(0);
        });

        it('fails to open, and leaves no lease behind, when a handler module is missing', async () => {
            const directory = await kit.project();
            await rejection(() => kit.open(directory, { handlerModules: [path.join(directory, 'missing.js')] }));
            expect(readdirSync(ProjectLayout.of(directory).leases)).to.be.empty;
            expect(await (await kit.open(directory)).headSeq()).to.equal(0);
        });

        it('refuses to start with the same handler kind registered twice', async () => {
            const error = await rejection(async () => kit.open(await kit.project(), { handlerModules: [testHandlerModule, testHandlerModule] }));
            expect(error).to.be.instanceOf(IvoryStoreError).with.property('code', 'duplicate-handler');
        });

        it('records the library build in every commit', async () => {
            const directory = await kit.project();
            const store = await kit.open(directory, { libraryBuild: '@ivory/core@spec' });
            succeeded(await store.commit(put('a')));
            expect(libraryBuilds(directory)).to.deep.equal(['@ivory/core@spec']);
            await store.close();
            const defaulted = await kit.open(directory);
            succeeded(await defaulted.commit(put('b')));
            expect(libraryBuilds(directory)).to.have.members(['@ivory/core@spec', `@ivory/core@${require('../../package.json').version}`]);
        });
    });

    describe('commit', () => {

        it('numbers commits from 1 in the order they were submitted, and chains them', async () => {
            const store = await kit.open(await kit.project());
            const outcomes = await Promise.all(Array.from({ length: 20 }, (_, index) => store.commit(put(`key-${index}`))));
            expect(outcomes.map(outcome => succeeded(outcome).receipt.seq)).to.deep.equal(Array.from({ length: 20 }, (_, index) => index + 1));
            expect(await store.headSeq()).to.equal(20);
            const verified = await store.verifyChain();
            expect(verified).to.deep.include({ ok: true, headSeq: 20, problems: [] as unknown[] });
            expect(verified.headDigest).to.equal(succeeded(outcomes[19]).receipt.digest);
        });

        it('returns the handler value and a receipt, and says it is not a replay', async () => {
            const store = await kit.open(await kit.project());
            const outcome = succeeded(await store.commit(put('a', 'one')));
            expect(outcome.value).to.deep.equal({ key: 'a', seq: 1 });
            expect(outcome.replayed).to.be.false;
            expect(outcome.receipt.digest).to.match(/^sha256:[0-9a-f]{64}$/);
        });

        it('commits and replays a handler that returns nothing', async () => {
            const store = await kit.open(await kit.project());
            const request = { kind: 'test.remove', input: { key: 'a' }, principal: 'tester', idempotencyKey: 'remove-a' };
            const first = succeeded(await store.commit(request));
            expect(first.value).to.equal(undefined);
            expect(succeeded(await store.commit(request))).to.deep.equal({ ...first, replayed: true });
            expect((await store.verifyChain()).ok).to.be.true;
        });

        it('replays the stored receipt for the same request under the same idempotency key', async () => {
            const directory = await kit.project();
            const store = await kit.open(directory);
            const first = succeeded(await store.commit(put('a', 'one', 'key')));
            const replay = succeeded(await store.commit(put('a', 'one', 'key')));
            expect(replay).to.deep.equal({ ...first, replayed: true });
            expect(await store.headSeq()).to.equal(1);
            expect(countRows(directory, 'commits')).to.equal(1);
        });

        it('refuses the same idempotency key for a different request, and does not run the handler', async () => {
            const directory = await kit.project();
            const store = await kit.open(directory);
            succeeded(await store.commit(put('a', 'one', 'key')));
            const refusal = refusalOf(await store.commit(put('a', 'two', 'key')));
            expect(refusal).to.include({ code: 'idempotency-conflict', seq: 1 });
            expect(readKeyValues(directory)).to.deep.equal([{ key: 'a', value: 'one' }]);
            expect(await store.headSeq()).to.equal(1);
        });

        it('keeps idempotency keys apart per principal', async () => {
            const store = await kit.open(await kit.project());
            succeeded(await store.commit(put('a', 'one', 'key', 'alice')));
            const other = succeeded(await store.commit(put('a', 'two', 'key', 'bob')));
            expect(other.receipt.seq).to.equal(2);
            expect(other.replayed).to.be.false;
        });

        it('keeps its receipts across a reopen', async () => {
            const directory = await kit.project();
            const original = await kit.open(directory);
            const first = succeeded(await original.commit(put('a', 'one', 'key')));
            await original.close();
            const reopened = await kit.open(directory);
            expect(await reopened.headSeq()).to.equal(1);
            expect(succeeded(await reopened.commit(put('a', 'one', 'key')))).to.deep.equal({ ...first, replayed: true });
            expect(succeeded(await reopened.commit(put('b'))).receipt.seq).to.equal(2);
            expect((await reopened.verifyChain()).ok).to.be.true;
        });

        describe('is refused, and consumes no sequence number, when', () => {
            let store: ProjectStore;
            beforeEach(async () => {
                store = await kit.open(await kit.project(), { maxInputBytes: 200 });
            });
            afterEach(async () => {
                expect(await store.headSeq(), 'no refusal consumed a seq').to.equal(0);
            });

            it('the kind is not registered', async () => {
                expect(refusalOf(await store.commit({ ...put('a'), kind: 'nobody.registered' })).code).to.equal('unknown-kind');
            });

            it('the principal is blank or too long', async () => {
                expect(refusalOf(await store.commit(put('a', 'v', 'k', ' '))).code).to.equal('invalid-input');
                expect(refusalOf(await store.commit(put('a', 'v', 'k', 'p'.repeat(257)))).code).to.equal('invalid-input');
            });

            it('the idempotency key is blank or too long', async () => {
                expect(refusalOf(await store.commit(put('a', 'v', ''))).code).to.equal('invalid-input');
                expect(refusalOf(await store.commit(put('a', 'v', 'k'.repeat(257)))).code).to.equal('invalid-input');
            });

            it('the input is not I-JSON', async () => {
                const refusal = refusalOf(await store.commit({ ...put('a'), input: { key: 'a', value: new Date() } }));
                expect(refusal).to.include({ code: 'invalid-input', contractCode: 'unsupported-value' });
                expect(refusalOf(await store.commit({ ...put('a'), input: undefined })).code).to.equal('invalid-input');
            });

            it('the handler does not parse the input', async () => {
                const refusal = refusalOf(await store.commit({ ...put('a'), input: { key: 1, value: 2 } }));
                expect(refusal.code).to.equal('invalid-input');
                expect(refusal.message).to.include('string key');
            });

        });

        it('refuses input that is larger than the bound, and accepts input that is exactly as large', async () => {
            const store = await kit.open(await kit.project(), { maxInputBytes: 200 });
            const request = (length: number): CommitRequest => put('a', 'x'.repeat(length));
            const overhead = Buffer.byteLength(canonicalJson(request(0).input), 'utf8');
            const refusal = refusalOf(await store.commit(request(200 - overhead + 1)));
            expect(refusal).to.include({ code: 'input-too-large', maxInputBytes: 200 });
            expect(await store.headSeq()).to.equal(0);
            expect(succeeded(await store.commit(request(200 - overhead))).receipt.seq).to.equal(1);
        });

        it('returns the refusal of a handler with its detail, rolls back its writes, and consumes no sequence number', async () => {
            const directory = await kit.project();
            const store = await kit.open(directory);
            const refusal = refusalOf(await store.commit({ ...put('a'), kind: 'test.refuse' }));
            expect(refusal).to.include({ code: 'test-refused', message: 'refused by the handler', key: 'a' });
            expect(readKeyValues(directory)).to.be.empty;
            expect(succeeded(await store.commit(put('b'))).receipt.seq).to.equal(1);
        });

        it('rolls back and rejects when a handler throws, and the next commit takes the same sequence number', async () => {
            const directory = await kit.project();
            const store = await kit.open(directory);
            const error = await rejection(() => store.commit({ ...put('a'), kind: 'test.explode' }));
            expect(error.message).to.equal('the handler exploded');
            expect(readKeyValues(directory)).to.be.empty;
            expect(succeeded(await store.commit(put('b'))).receipt.seq).to.equal(1);
        });

        it('rolls back and rejects a handler that ends the transaction itself', async () => {
            const directory = await kit.project();
            const store = await kit.open(directory);
            const error = await rejection(() => store.commit({ ...put('a'), kind: 'test.end-transaction' }));
            expect(error).to.be.instanceOf(IvoryStoreError).with.property('code', 'handler-transaction-control');
            expect(succeeded(await store.commit(put('b'))).receipt.seq).to.equal(1);
        });

        it('records the blobs a handler requires, once each', async () => {
            const directory = await kit.project();
            const store = await kit.open(directory);
            const digest = await store.admitBlob(Buffer.from('attachment'));
            succeeded(await store.commit({ kind: 'test.attach', input: { blob: digest }, principal: 'p', idempotencyKey: 'a' }));
            expect(countBlobRefs(directory, digest)).to.equal(1);
            expect(await store.gc({ graceMs: 0 })).to.deep.equal({ deleted: 0, skipped: 1 });
        });
    });

    describe('commit chain', () => {

        it('binds the genesis digest to the project id', async () => {
            expect(genesisDigest('project-1')).to.equal(canonicalDigest({ chain: 'ivory-commit-chain@1', projectId: 'project-1' }));
            expect(genesisDigest('project-1')).to.not.equal(genesisDigest('project-2'));
            const first = await kit.open(await kit.project('project-1'));
            const second = await kit.open(await kit.project('project-2'));
            expect((await first.verifyChain()).headDigest).to.equal(genesisDigest('project-1'));
            const sameRequest = put('a');
            expect(succeeded(await first.commit(sameRequest)).receipt.digest).to.not.equal(succeeded(await second.commit(sameRequest)).receipt.digest);
        });

        it('verifyChain flags a tampered receipt', async () => {
            const directory = await kit.project();
            const store = await kit.open(directory);
            for (const key of ['a', 'b', 'c']) {
                succeeded(await store.commit(put(key)));
            }
            tamperReceipt(directory, 2);
            const verified = await store.verifyChain();
            expect(verified.ok).to.be.false;
            expect(verified.problems).to.deep.equal([{ seq: 2, reason: 'receipt-digest-mismatch' }]);
        });

        it('verifyChain flags a broken prev_digest at the row, and not at the rows after it', async () => {
            const directory = await kit.project();
            const store = await kit.open(directory);
            for (const key of ['a', 'b', 'c']) {
                succeeded(await store.commit(put(key)));
            }
            breakPrevDigest(directory, 2);
            const verified = await store.verifyChain();
            expect(verified.ok).to.be.false;
            expect(verified.problems).to.deep.equal([{ seq: 2, reason: 'prev-digest-mismatch' }, { seq: 2, reason: 'digest-mismatch' }]);
        });
    });

    describe('change notices', () => {

        it('reports each commit of this store once, in order, and stops when disposed', async () => {
            const store = await kit.open(await kit.project());
            const seen: number[] = [];
            const subscription = store.onDidAdvance(seq => seen.push(seq));
            for (const key of ['a', 'b', 'c']) {
                succeeded(await store.commit(put(key)));
            }
            await eventually(() => seen.length === 3);
            await sleep(100);
            expect(seen).to.deep.equal([1, 2, 3]);
            subscription.dispose();
            succeeded(await store.commit(put('d')));
            await sleep(100);
            expect(seen).to.deep.equal([1, 2, 3]);
        });

        it('reports a commit that another process made once it is committed', async () => {
            const directory = await kit.project();
            const store = await kit.open(directory);
            const seen: number[] = [];
            store.onDidAdvance(seq => seen.push(seq));
            const child = kit.child(childScript('write-lock-holder'), directory, '--fake-commit');
            await child.next('locked');
            await sleep(100);
            expect(seen).to.be.empty;
            await child.release(true);
            await eventually(() => seen.length === 1);
            expect(seen).to.deep.equal([1]);
            expect(await store.headSeq()).to.equal(1);
        });
    });

    describe('concurrent writers', () => {

        it('refuses with writer-busy when another writer holds the lock past the bound', async () => {
            const directory = await kit.project();
            const store = await kit.open(directory, { writerBusyBoundMs: 300, busyTimeoutMs: 20 });
            const child = kit.child(childScript('write-lock-holder'), directory);
            await child.next('locked');
            const startedAt = Date.now();
            const refusal = refusalOf(await store.commit(put('a')));
            expect(refusal.code).to.equal('writer-busy');
            expect(Date.now() - startedAt).to.be.at.least(290);
            await child.release();
            expect(succeeded(await store.commit(put('a'))).receipt.seq, 'a refusal consumes no seq').to.equal(1);
        });

        it('serves commits that wait for a writer in the order they were submitted', async () => {
            const directory = await kit.project();
            const store = await kit.open(directory, { busyTimeoutMs: 20 });
            const child = kit.child(childScript('write-lock-holder'), directory, '--hold-ms=400');
            await child.next('locked');
            const outcomes = await Promise.all([store.commit(put('first')), store.commit(put('second')), store.commit(put('third'))]);
            expect(outcomes.map(outcome => succeeded(outcome).receipt.seq)).to.deep.equal([1, 2, 3]);
            expect(outcomes.map(outcome => (succeeded(outcome).value as { key: string }).key)).to.deep.equal(['first', 'second', 'third']);
            await child.exited;
            expect((await store.verifyChain()).ok).to.be.true;
        });

        it('waits for the write lock of a blob admission behind commits without reordering them', async () => {
            const store = await kit.open(await kit.project());
            const [first, digest, second] = await Promise.all([store.commit(put('a')), store.admitBlob(Buffer.from('between')), store.commit(put('b'))]);
            expect(succeeded(first).receipt.seq).to.equal(1);
            expect(digest).to.match(/^sha256:/);
            expect(succeeded(second).receipt.seq).to.equal(2);
        });
    });

    describe('read-only roles', () => {

        async function reopenAs(directory: string, role: string): Promise<ProjectStore> {
            const file = ProjectLayout.of(directory).manifest;
            const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
            writeFileSync(file, JSON.stringify({ ...manifest, role }));
            return kit.open(directory);
        }

        for (const role of ['backup', 'capsule']) {
            it(`a ${role} project reads, and refuses commit, admission, GC and recovery with read-only-project`, async () => {
                const directory = await kit.project();
                const live = await kit.open(directory);
                succeeded(await live.commit(put('a')));
                await live.close();
                const store = await reopenAs(directory, role);
                expect(await store.headSeq()).to.equal(1);
                expect((await store.verifyChain()).ok).to.be.true;
                expect(refusalOf(await store.commit(put('b'))).code).to.equal('read-only-project');
                for (const action of [() => store.admitBlob(Buffer.from('x')), () => store.gc(), () => store.recover()]) {
                    expect(await rejection(action)).to.be.instanceOf(IvoryStoreError).with.property('code', 'read-only-project');
                }
                expect(readdirSync(ProjectLayout.of(directory).leases), 'a read-only open takes no lease').to.be.empty;
                expect(await store.headSeq()).to.equal(1);
            });
        }

        it('refuses to open a read-only project that has no store', async () => {
            const directory = await kit.tempDir();
            await initProject(directory, { projectId: 'project-1', role: 'backup' });
            expect(await rejection(() => kit.open(directory))).to.have.property('code', 'store-mismatch');
        });
    });

    describe('negative cases', () => {

        describe('await between BEGIN and COMMIT', () => {

            it('rejects an async handler with handler-not-synchronous, rolls back what it wrote, and consumes no sequence number', async () => {
                const directory = await kit.project();
                const store = await kit.open(directory, { handlerModules: [testHandlerModule, asyncHandlerModule] });
                expect(succeeded(await store.commit(put('before'))).receipt.seq).to.equal(1);
                const error = await rejection(() => store.commit({ kind: 'test.async', input: {}, principal: 'p', idempotencyKey: 'async' }));
                expect(error).to.be.instanceOf(IvoryStoreError).with.property('code', 'handler-not-synchronous');
                expect(readKeyValues(directory), 'the row it wrote before awaiting is gone').to.deep.equal([{ key: 'before', value: 'value' }]);
                expect(countRows(directory, 'commits')).to.equal(1);
                // Its continuation after the await runs against a closed transaction. The worker must survive that.
                await sleep(50);
                expect(succeeded(await store.commit(put('after'))).receipt.seq, 'the next commit gets the expected seq').to.equal(2);
                expect(readKeyValues(directory).map(row => row.key)).to.deep.equal(['after', 'before']);
                expect(await store.verifyChain()).to.deep.include({ ok: true, headSeq: 2 });
            });

            it('rejects an async handler that is the first commit, so the table it created is rolled back too', async () => {
                const directory = await kit.project();
                const store = await kit.open(directory, { handlerModules: [testHandlerModule, asyncHandlerModule] });
                await rejection(() => store.commit({ kind: 'test.async', input: {}, principal: 'p', idempotencyKey: 'async' }));
                expect(readKeyValues(directory)).to.be.empty;
                expect(succeeded(await store.commit(put('a'))).receipt.seq).to.equal(1);
            });
        });

        describe('same-connection dirty read', () => {

            it('never reports a commit row that another connection has inserted but not committed', async () => {
                const directory = await kit.project();
                const store = await kit.open(directory);
                const seen: number[] = [];
                store.onDidAdvance(seq => seen.push(seq));
                const child = kit.child(childScript('write-lock-holder'), directory, '--fake-commit');
                await child.next('locked');
                expect(await store.headSeq(), 'headSeq').to.equal(0);
                expect(await store.verifyChain(), 'verifyChain').to.deep.include({ ok: true, headSeq: 0, problems: [] as unknown[] });
                await sleep(150);
                expect(seen, 'onDidAdvance after several polls').to.be.empty;
                await child.release(false);
                expect(await store.headSeq()).to.equal(0);
                await sleep(100);
                expect(seen).to.be.empty;
                expect(succeeded(await store.commit(put('a'))).receipt.seq).to.equal(1);
                await eventually(() => seen.length === 1);
                expect(seen).to.deep.equal([1]);
            });
        });

        describe('recover touching a live lease', () => {

            it('leaves a live host\'s lease and staging file alone, and sweeps both once that host is killed', async () => {
                const directory = await kit.project();
                const layout = ProjectLayout.of(directory);
                const store = await kit.open(directory);
                const child = kit.child(childScript('lease-holder'), directory);
                const { processId: childId } = await child.next('ready') as { processId: string };
                const lease = path.join(layout.leases, `${childId}.sqlite`);
                const staging = path.join(layout.casStaging, `${childId}-x.tmp`);

                const whileAlive = await store.recover();
                expect(whileAlive.skippedAlive).to.deep.equal([childId]);
                expect(whileAlive.swept).to.be.empty;
                expect(existsSync(lease) && existsSync(staging), 'the live lease and its staging file are untouched').to.be.true;

                await child.kill();
                const afterKill = await store.recover();
                expect(afterKill.swept).to.deep.equal([childId]);
                expect(existsSync(lease) || existsSync(staging), 'both are swept').to.be.false;
                expect(existsSync(path.join(layout.leases, `${processId}.sqlite`)), 'our own lease stays').to.be.true;
            });

            it('sweeps the leases of dead hosts when the store opens', async () => {
                const directory = await kit.project();
                const child = kit.child(childScript('lease-holder'), directory);
                const { processId: childId } = await child.next('ready') as { processId: string };
                await child.kill();
                const store = await kit.open(directory);
                expect(store.openRecovery.swept).to.deep.equal([childId]);
                expect(readdirSync(ProjectLayout.of(directory).casStaging)).to.be.empty;
            });

            it('skips a lease whose lock is free but whose pid is a live process', async () => {
                const directory = await kit.project();
                const layout = ProjectLayout.of(directory);
                const store = await kit.open(directory);
                const file = createLeaseFile(layout.leases, 'pid-reuse', { pid: process.pid, hostKind: 'spec' });
                writeFileSync(path.join(layout.casStaging, 'pid-reuse-1.tmp'), 'x');
                const report = await store.recover();
                expect(report.skippedAlive).to.deep.equal(['pid-reuse']);
                expect(existsSync(file) && existsSync(path.join(layout.casStaging, 'pid-reuse-1.tmp'))).to.be.true;
            });
        });

        describe('GC racing a staging dedup', () => {

            it('keeps an old orphan that was admitted again, because the dedup touched it, and a commit can then reference it', async () => {
                const directory = await kit.project();
                const layout = ProjectLayout.of(directory);
                const store = await kit.open(directory);
                const bytes = Buffer.from('an orphan that is about to be needed');
                const digest = await store.admitBlob(bytes);
                const file = ProjectLayout.blobPath(layout, digest);
                const longAgo = new Date(Date.now() - 48 * HOUR);
                await fs.utimes(file, longAgo, longAgo);

                expect(await store.admitBlob(bytes), 'dedup').to.equal(digest);
                expect(await store.gc({ graceMs: HOUR }), 'the touch made it a young blob, so it is not even a candidate').to.deep.equal({ deleted: 0, skipped: 0 });
                expect(existsSync(file)).to.be.true;
                expect(succeeded(await store.commit({ kind: 'test.attach', input: { blob: digest }, principal: 'p', idempotencyKey: 'a' })).receipt.seq).to.equal(1);
                expect(countBlobRefs(directory, digest)).to.equal(1);
            });

            it('refuses blob-missing, and records no reference, when GC deleted the blob before the commit', async () => {
                const directory = await kit.project();
                const store = await kit.open(directory);
                const digest = await store.admitBlob(Buffer.from('admitted and then collected'));
                expect(await store.gc({ graceMs: 0 })).to.deep.equal({ deleted: 1, skipped: 0 });
                const refusal = refusalOf(await store.commit({ kind: 'test.attach', input: { blob: digest }, principal: 'p', idempotencyKey: 'a' }));
                expect(refusal).to.include({ code: 'blob-missing', digest });
                expect(countBlobRefs(directory, digest)).to.equal(0);
                expect(countRows(directory, 'commits')).to.equal(0);
            });

            it('admits the blob again after GC deleted it', async () => {
                const store = await kit.open(await kit.project());
                const bytes = Buffer.from('collected and admitted again');
                const digest = await store.admitBlob(bytes);
                await store.gc({ graceMs: 0 });
                expect(await store.admitBlob(bytes)).to.equal(digest);
                expect(succeeded(await store.commit({ kind: 'test.attach', input: { blob: digest }, principal: 'p', idempotencyKey: 'a' })).receipt.seq).to.equal(1);
            });
        });
    });
});
