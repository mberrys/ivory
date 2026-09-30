// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { CommitOutcome, CommitSuccess, IvoryStoreError } from '../common/store-protocol';
import { qualificationHandlerModule } from './store/qualification/qualification-handler-module';
import { readQualKeys } from './store/test/sql-fixtures';
import { SpecKit, testHandlerModule } from './test/spec-helpers';

function succeeded<O = unknown>(outcome: CommitOutcome<O>): CommitSuccess<O> {
    if (CommitOutcome.isRefusal(outcome)) {
        throw new Error(`the commit was refused: ${JSON.stringify(outcome.refusal)}`);
    }
    return outcome;
}

describe('store host for qualification', function (): void {
    this.timeout(60000);

    const kit = new SpecKit();
    afterEach(() => kit.dispose());

    const openWithQual = async (directory: string): Promise<ReturnType<SpecKit['open']>> =>
        kit.open(directory, { handlerModules: [testHandlerModule, qualificationHandlerModule] });

    describe('head', () => {

        it('is undefined for an empty log and follows the commits after that', async () => {
            const store = await openWithQual(await kit.project());
            expect(await store.head()).to.be.undefined;
            const first = succeeded(await store.commit({ kind: 'qual.put', input: { key: 'a' }, principal: 'p', idempotencyKey: 'a' }));
            expect(await store.head()).to.deep.equal(first.receipt);
            const second = succeeded(await store.commit({ kind: 'qual.put', input: { key: 'b' }, principal: 'p', idempotencyKey: 'b' }));
            const head = await store.head();
            expect(head).to.deep.equal(second.receipt);
            expect(head?.seq).to.equal(await store.headSeq());
            expect(head?.digest).to.equal((await store.verifyChain()).headDigest);
        });

        it('rejects once the store is closed', async () => {
            const store = await openWithQual(await kit.project());
            await store.close();
            let error: unknown;
            await store.head().catch(caught => error = caught);
            expect(error).to.be.instanceOf(IvoryStoreError).with.property('code', 'store-closed');
        });
    });

    describe('receiptFor', () => {

        it('finds the commit of an idempotency key and nothing else', async () => {
            const store = await openWithQual(await kit.project());
            const committed = succeeded(await store.commit({ kind: 'qual.put', input: { key: 'a' }, principal: 'p', idempotencyKey: 'a' }));
            expect(await store.receiptFor('p', 'a')).to.deep.equal(committed.receipt);
            expect(await store.receiptFor('other', 'a')).to.be.undefined;
            expect(await store.receiptFor('p', 'b')).to.be.undefined;
        });

        it('does not report a commit that was refused', async () => {
            const store = await openWithQual(await kit.project());
            const missing = `sha256:${'0'.repeat(64)}`;
            const outcome = await store.commit({ kind: 'qual.put', input: { key: 'a', blob: missing }, principal: 'p', idempotencyKey: 'a' });
            expect(CommitOutcome.isRefusal(outcome) && outcome.refusal.code).to.equal('blob-missing');
            expect(await store.receiptFor('p', 'a')).to.be.undefined;
        });
    });

    describe('the synchronous option', () => {

        const synchronousOf = async (options?: { synchronous?: 'FULL' | 'OFF' }): Promise<number> => {
            const store = await kit.open(await kit.project(), { qualification: options });
            const outcome = succeeded<{ synchronous: number }>(await store.commit({ kind: 'test.synchronous', input: {}, principal: 'p', idempotencyKey: 'k' }));
            await store.close();
            return outcome.value.synchronous;
        };

        it('is FULL by default, and OFF when the qualification option says so', async () => {
            expect(await synchronousOf()).to.equal(2);
            expect(await synchronousOf({ synchronous: 'FULL' })).to.equal(2);
            expect(await synchronousOf({ synchronous: 'OFF' })).to.equal(0);
        });
    });

    describe('qualification handlers', () => {

        it('qual.put records the key, the blob and the sequence number, and replays', async () => {
            const directory = await kit.project();
            const store = await openWithQual(directory);
            const blob = await store.admitBlob(Buffer.from('bytes'));
            const request = { kind: 'qual.put', input: { key: 'a', blob }, principal: 'p', idempotencyKey: 'a' };
            const first = succeeded<{ key: string; seq: number }>(await store.commit(request));
            expect(first.value).to.deep.equal({ key: 'a', seq: 1 });
            succeeded(await store.commit({ kind: 'qual.put', input: { key: 'b' }, principal: 'p', idempotencyKey: 'b' }));
            const replay = succeeded(await store.commit(request));
            expect(replay.replayed).to.be.true;
            await store.close();
            expect(readQualKeys(directory)).to.deep.equal([{ key: 'a', blob, seq: 1 }, { key: 'b', blob: undefined, seq: 2 }]);
        });

        it('qual.put refuses a missing blob and invalid input', async () => {
            const store = await openWithQual(await kit.project());
            const code = async (input: unknown): Promise<string | undefined> => {
                const outcome = await store.commit({ kind: 'qual.put', input, principal: 'p', idempotencyKey: JSON.stringify(input) });
                return CommitOutcome.isRefusal(outcome) ? outcome.refusal.code : undefined;
            };
            expect(await code({ key: 'a', blob: `sha256:${'1'.repeat(64)}` })).to.equal('blob-missing');
            expect(await code({ key: '' })).to.equal('invalid-input');
            expect(await code({ key: 'a', blob: 'not-a-digest' })).to.equal('invalid-input');
            expect(await store.headSeq()).to.equal(0);
        });

        it('qual.hold blocks the transaction for the requested time and refuses more than 10 seconds', async () => {
            const store = await openWithQual(await kit.project());
            const startedAt = Date.now();
            const held = succeeded<{ held: number }>(await store.commit({ kind: 'qual.hold', input: { ms: 200 }, principal: 'p', idempotencyKey: 'h' }));
            expect(held.value).to.deep.equal({ held: 200 });
            expect(Date.now() - startedAt).to.be.at.least(190);
            for (const ms of [10_001, -1, 1.5, '5']) {
                const outcome = await store.commit({ kind: 'qual.hold', input: { ms }, principal: 'p', idempotencyKey: `h${ms}` });
                expect(CommitOutcome.isRefusal(outcome) && outcome.refusal.code, String(ms)).to.equal('invalid-input');
            }
        });
    });
});
