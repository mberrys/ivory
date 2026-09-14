// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ExecutionEvent, ExecutionFailure, ExecutionRecord, assertExecutionTransition } from '@ivory-tower/domain';
import { ExecutionJob, ExecutionStorePort, ExecutionTransactionPort } from '@ivory-tower/adapters';

function clone<T>(value: T): T {
    return structuredClone(value);
}

export class InMemoryExecutionStore implements ExecutionStorePort, ExecutionTransactionPort {
    private readonly records = new Map<string, ExecutionRecord>();
    private readonly executionIdsByIdempotencyKey = new Map<string, string>();
    private readonly eventsByExecution = new Map<string, ExecutionEvent[]>();

    async createAndEnqueue(record: ExecutionRecord, _job: ExecutionJob): Promise<ExecutionRecord> {
        if (this.executionIdsByIdempotencyKey.has(record.idempotencyKey)) {
            throw new Error(`Duplicate idempotency key: ${record.idempotencyKey}`);
        }
        if (this.records.has(record.id)) {
            throw new Error(`Duplicate execution id: ${record.id}`);
        }
        this.records.set(record.id, clone(record));
        this.executionIdsByIdempotencyKey.set(record.idempotencyKey, record.id);
        await this.appendEvent(record.id, 'status', { status: record.status });
        return clone(record);
    }

    async findByIdempotencyKey(idempotencyKey: string): Promise<ExecutionRecord | undefined> {
        const executionId = this.executionIdsByIdempotencyKey.get(idempotencyKey);
        const record = executionId === undefined ? undefined : this.records.get(executionId);
        return record === undefined ? undefined : clone(record);
    }

    async get(executionId: string): Promise<ExecutionRecord | undefined> {
        const record = this.records.get(executionId);
        return record === undefined ? undefined : clone(record);
    }

    async listEvents(executionId: string, afterSequence = 0): Promise<readonly ExecutionEvent[]> {
        return (this.eventsByExecution.get(executionId) ?? []).filter(event => event.sequence > afterSequence).map(clone);
    }

    async appendEvent(executionId: string, type: ExecutionEvent['type'], payload: unknown): Promise<ExecutionEvent> {
        const events = this.eventsByExecution.get(executionId) ?? [];
        const event: ExecutionEvent = {
            id: `${executionId}:${events.length + 1}`,
            executionId,
            sequence: events.length + 1,
            type,
            payload: clone(payload),
            occurredAt: new Date().toISOString(),
        };
        events.push(event);
        this.eventsByExecution.set(executionId, events);
        return clone(event);
    }

    async markRunning(executionId: string, leaseToken: string, leaseUntil: string): Promise<boolean> {
        const current = this.records.get(executionId);
        if (current === undefined || current.status !== 'queued') {
            return false;
        }
        assertExecutionTransition(current.status, 'running');
        const updated = { ...current, status: 'running' as const, leaseToken, leaseUntil, updatedAt: new Date().toISOString() };
        this.records.set(executionId, updated);
        await this.appendEvent(executionId, 'status', { status: updated.status });
        return true;
    }

    async updateProgress(executionId: string, leaseToken: string, progress: number, payload?: unknown): Promise<boolean> {
        const current = this.records.get(executionId);
        if (current === undefined || current.leaseToken !== leaseToken || current.status !== 'running') {
            return false;
        }
        const updated = { ...current, progress: Math.min(1, Math.max(0, progress)), updatedAt: new Date().toISOString() };
        this.records.set(executionId, updated);
        await this.appendEvent(executionId, 'progress', payload ?? { progress: updated.progress });
        return true;
    }

    async complete(executionId: string, leaseToken: string, result: unknown): Promise<boolean> {
        return this.finish(executionId, leaseToken, 'succeeded', result);
    }

    async fail(executionId: string, leaseToken: string, failure: ExecutionFailure): Promise<boolean> {
        return this.finish(executionId, leaseToken, 'failed', undefined, failure);
    }

    async retry(executionId: string, leaseToken: string, failure: ExecutionFailure): Promise<boolean> {
        const current = this.records.get(executionId);
        if (current === undefined || current.leaseToken !== leaseToken || current.status !== 'running') {
            return false;
        }
        const updated = {
            ...current,
            status: 'queued' as const,
            failure,
            leaseToken: undefined,
            leaseUntil: undefined,
            updatedAt: new Date().toISOString(),
        };
        this.records.set(executionId, updated);
        await this.appendEvent(executionId, 'error', failure);
        await this.appendEvent(executionId, 'status', { status: updated.status });
        return true;
    }

    async cancelRunning(executionId: string, leaseToken: string): Promise<boolean> {
        const current = this.records.get(executionId);
        if (current === undefined || current.leaseToken !== leaseToken || !['running', 'cancelling'].includes(current.status)) {
            return false;
        }
        const updated = {
            ...current,
            status: 'cancelled' as const,
            leaseToken: undefined,
            leaseUntil: undefined,
            updatedAt: new Date().toISOString(),
        };
        this.records.set(executionId, updated);
        await this.appendEvent(executionId, 'status', { status: updated.status });
        return true;
    }

    async cancel(executionId: string): Promise<ExecutionRecord | undefined> {
        const current = this.records.get(executionId);
        if (current === undefined || current.status === 'succeeded' || current.status === 'failed' || current.status === 'cancelled') {
            return current === undefined ? undefined : clone(current);
        }
        const next: ExecutionRecord['status'] = current.status === 'queued' ? 'cancelled' : 'cancelling';
        assertExecutionTransition(current.status, next);
        const updated = { ...current, status: next, updatedAt: new Date().toISOString() };
        this.records.set(executionId, updated);
        await this.appendEvent(executionId, 'status', { status: next });
        return clone(updated);
    }

    private async finish(
        executionId: string,
        leaseToken: string,
        status: 'succeeded' | 'failed',
        result: unknown,
        failure?: ExecutionFailure,
    ): Promise<boolean> {
        const current = this.records.get(executionId);
        if (current === undefined || current.leaseToken !== leaseToken || current.status !== 'running') {
            return false;
        }
        assertExecutionTransition(current.status, status);
        const updated = {
            ...current,
            status,
            result: clone(result),
            failure: clone(failure),
            progress: status === 'succeeded' ? 1 : current.progress,
            leaseToken: undefined,
            leaseUntil: undefined,
            updatedAt: new Date().toISOString(),
        };
        this.records.set(executionId, updated);
        await this.appendEvent(executionId, status === 'succeeded' ? 'complete' : 'error', status === 'succeeded' ? { result } : failure);
        return true;
    }
}
