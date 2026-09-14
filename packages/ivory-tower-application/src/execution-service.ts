// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ClockPort, ExecutionJob, ExecutionIdPort, ExecutionStorePort, ExecutionTransactionPort } from '@ivory-tower/adapters';
import { CreateExecutionRequest, CONTRACT_VERSION } from '@ivory-tower/contracts';
import { ExecutionEvent, ExecutionRecord } from '@ivory-tower/domain';

export interface CreateExecutionResult {
    readonly record: ExecutionRecord;
    readonly replayed: boolean;
}

export class ExecutionService {
    constructor(
        private readonly transaction: ExecutionTransactionPort,
        private readonly store: ExecutionStorePort,
        private readonly ids: ExecutionIdPort,
        private readonly clock: ClockPort,
    ) {}

    async create(request: CreateExecutionRequest, idempotencyKey: string): Promise<CreateExecutionResult> {
        if (idempotencyKey.trim().length === 0) {
            throw new Error('An Idempotency-Key header is required.');
        }
        const existing = await this.store.findByIdempotencyKey(idempotencyKey);
        if (existing !== undefined) {
            return { record: existing, replayed: true };
        }

        const now = this.clock.now().toISOString();
        const record: ExecutionRecord = {
            id: this.ids.next(),
            kind: request.kind,
            status: 'queued',
            contractVersion: request.contractVersion ?? CONTRACT_VERSION,
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
        const job: ExecutionJob = {
            executionId: record.id,
            kind: record.kind,
            contractVersion: record.contractVersion,
            attempt: record.attempt,
            jobKey: `execution:${record.id}`,
            input: request.input,
        };
        try {
            return { record: await this.transaction.createAndEnqueue(record, job), replayed: false };
        } catch (error) {
            const concurrent = await this.store.findByIdempotencyKey(idempotencyKey);
            if (concurrent !== undefined) {
                return { record: concurrent, replayed: true };
            }
            throw error;
        }
    }

    get(executionId: string): Promise<ExecutionRecord | undefined> {
        return this.store.get(executionId);
    }

    events(executionId: string, afterSequence?: number): Promise<readonly ExecutionEvent[]> {
        return this.store.listEvents(executionId, afterSequence);
    }

    cancel(executionId: string): Promise<ExecutionRecord | undefined> {
        return this.store.cancel(executionId);
    }
}
