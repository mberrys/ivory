// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

export type ExecutionKind = 'ingest' | 'convert' | 'index' | 'retrieve' | 'generate' | 'validate' | 'export';

export type ExecutionStatus = 'queued' | 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled';

export type ExecutionEventType = 'status' | 'progress' | 'token' | 'error' | 'complete';

export interface ExecutionFailure {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
}

export interface ExecutionRecord {
    readonly id: string;
    readonly kind: ExecutionKind;
    readonly status: ExecutionStatus;
    readonly contractVersion: number;
    readonly idempotencyKey: string;
    readonly attempt: number;
    readonly leaseToken: string | undefined;
    readonly leaseUntil: string | undefined;
    readonly progress: number;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly result: unknown;
    readonly failure: ExecutionFailure | undefined;
}

export interface ExecutionEvent {
    readonly id: string;
    readonly executionId: string;
    readonly sequence: number;
    readonly type: ExecutionEventType;
    readonly payload: unknown;
    readonly occurredAt: string;
}

const terminalStatuses: ReadonlySet<ExecutionStatus> = new Set(['succeeded', 'failed', 'cancelled']);

export function isTerminalExecutionStatus(status: ExecutionStatus): boolean {
    return terminalStatuses.has(status);
}

export function canTransitionExecution(from: ExecutionStatus, to: ExecutionStatus): boolean {
    if (isTerminalExecutionStatus(from)) {
        return false;
    }
    if (from === 'queued') {
        return to === 'running' || to === 'cancelling' || to === 'cancelled';
    }
    if (from === 'running') {
        return to === 'cancelling' || to === 'succeeded' || to === 'failed' || to === 'cancelled';
    }
    return from === 'cancelling' && (to === 'cancelled' || to === 'failed');
}

export function assertExecutionTransition(from: ExecutionStatus, to: ExecutionStatus): void {
    if (!canTransitionExecution(from, to)) {
        throw new Error(`Invalid execution transition: ${from} -> ${to}`);
    }
}
