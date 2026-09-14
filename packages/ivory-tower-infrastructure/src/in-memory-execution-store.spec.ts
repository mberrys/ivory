// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ExecutionRecord } from '@ivory-tower/domain';
import { expect } from 'chai';
import { InMemoryExecutionStore } from './in-memory-execution-store';

function execution(id: string, idempotencyKey: string): ExecutionRecord {
    const now = '2026-08-02T12:00:00.000Z';
    return {
        id,
        kind: 'convert',
        status: 'queued',
        contractVersion: 1,
        idempotencyKey,
        attempt: 0,
        leaseToken: undefined,
        leaseUntil: undefined,
        progress: 0,
        createdAt: now,
        updatedAt: now,
        result: undefined,
        failure: undefined,
    };
}

describe('InMemoryExecutionStore', () => {
    it('rejects concurrent writes that reuse an idempotency key', async () => {
        const store = new InMemoryExecutionStore();
        const first = execution('execution-1', 'same-request');
        const second = execution('execution-2', 'same-request');

        const results = await Promise.allSettled([
            store.createAndEnqueue(first, {
                executionId: first.id,
                kind: first.kind,
                contractVersion: 1,
                attempt: 0,
                jobKey: 'execution:1',
                input: {},
            }),
            store.createAndEnqueue(second, {
                executionId: second.id,
                kind: second.kind,
                contractVersion: 1,
                attempt: 0,
                jobKey: 'execution:2',
                input: {},
            }),
        ]);

        expect(results.filter(result => result.status === 'fulfilled')).to.have.length(1);
        expect(results.filter(result => result.status === 'rejected')).to.have.length(1);
        expect((await store.findByIdempotencyKey('same-request'))?.id).to.be.oneOf(['execution-1', 'execution-2']);
    });
});
