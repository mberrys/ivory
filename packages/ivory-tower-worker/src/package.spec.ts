// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ExecutionJob } from '@ivory-tower/adapters';
import { InMemoryExecutionStore } from '@ivory-tower/infrastructure';
import { ExecutionProcessor } from './execution-processor';
import { expect } from 'chai';

describe('@ivory-tower/worker package', () => {
    it('fences duplicate delivery after the first worker claims an execution', async () => {
        const store = new InMemoryExecutionStore();
        const record = {
            id: 'execution-1',
            kind: 'convert' as const,
            status: 'queued' as const,
            contractVersion: 1,
            idempotencyKey: 'key-1',
            attempt: 0,
            leaseToken: undefined,
            leaseUntil: undefined,
            progress: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            result: undefined,
            failure: undefined,
        };
        await store.createAndEnqueue(record, {
            executionId: record.id,
            kind: record.kind,
            contractVersion: 1,
            attempt: 0,
            jobKey: 'execution:1',
            input: {},
        });
        const job: ExecutionJob = {
            executionId: record.id,
            kind: record.kind,
            contractVersion: 1,
            attempt: 0,
            jobKey: 'execution:1',
            input: {},
        };
        let calls = 0;
        const processor = new ExecutionProcessor(
            store,
            new Map([
                [
                    'convert',
                    async () => {
                        calls += 1;
                        return { ok: true };
                    },
                ],
            ]),
        );
        await Promise.all([processor.process(job, new AbortController().signal), processor.process(job, new AbortController().signal)]);
        expect(calls).to.equal(1);
        expect((await store.get(record.id))?.status).to.equal('succeeded');
    });

    it('aborts a handler and records cancellation requested while it is running', async () => {
        const store = new InMemoryExecutionStore();
        const record = {
            id: 'execution-2',
            kind: 'convert' as const,
            status: 'queued' as const,
            contractVersion: 1,
            idempotencyKey: 'key-2',
            attempt: 0,
            leaseToken: undefined,
            leaseUntil: undefined,
            progress: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            result: undefined,
            failure: undefined,
        };
        await store.createAndEnqueue(record, {
            executionId: record.id,
            kind: record.kind,
            contractVersion: 1,
            attempt: 0,
            jobKey: 'execution:2',
            input: {},
        });
        const job: ExecutionJob = {
            executionId: record.id,
            kind: record.kind,
            contractVersion: 1,
            attempt: 0,
            jobKey: 'execution:2',
            input: {},
        };
        let startedResolve!: () => void;
        const started = new Promise<void>(resolve => {
            startedResolve = resolve;
        });
        const processor = new ExecutionProcessor(
            store,
            new Map([
                [
                    'convert',
                    async (_job, context) => {
                        startedResolve();
                        await new Promise(resolve => setTimeout(resolve, 100));
                        expect(context.signal.aborted).to.equal(true);
                        return { shouldNotBeCommitted: true };
                    },
                ],
            ]),
            100,
            10,
        );

        const processing = processor.process(job, new AbortController().signal);
        await started;
        expect((await store.cancel(record.id))?.status).to.equal('cancelling');
        await processing;

        expect((await store.get(record.id))?.status).to.equal('cancelled');
    });
});
