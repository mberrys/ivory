// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { randomUUID } from 'node:crypto';
import { ExecutionJob, ExecutionStorePort } from '@ivory-tower/adapters';
import { ExecutionFailure } from '@ivory-tower/domain';
import { captureIvoryException } from '@ivory-tower/infrastructure';

export interface ExecutionHandlerContext {
    readonly signal: AbortSignal;
    reportProgress(progress: number, payload?: unknown): Promise<void>;
}

export type ExecutionHandler = (job: ExecutionJob, context: ExecutionHandlerContext) => Promise<unknown>;

export type ExecutionHandlerRegistry = ReadonlyMap<ExecutionJob['kind'], ExecutionHandler>;

export class ExecutionProcessor {
    constructor(
        private readonly store: ExecutionStorePort,
        private readonly handlers: ExecutionHandlerRegistry,
        private readonly leaseDurationMs = 60_000,
        private readonly cancellationPollIntervalMs = Math.min(1_000, Math.max(25, leaseDurationMs / 4)),
    ) {}

    async process(job: ExecutionJob, signal: AbortSignal): Promise<void> {
        const leaseToken = randomUUID();
        const leaseUntil = new Date(Date.now() + this.leaseDurationMs).toISOString();
        if (!(await this.store.markRunning(job.executionId, leaseToken, leaseUntil))) {
            return;
        }
        if (signal.aborted || (await this.isCancellationRequested(job.executionId))) {
            await this.store.cancelRunning(job.executionId, leaseToken);
            return;
        }
        const handler = this.handlers.get(job.kind);
        if (handler === undefined) {
            await this.store.fail(job.executionId, leaseToken, {
                code: 'handler_unavailable',
                message: `No handler is registered for ${job.kind}.`,
                retryable: false,
            });
            return;
        }
        const handlerController = new AbortController();
        const relayAbort = () => handlerController.abort(signal.reason);
        signal.addEventListener('abort', relayAbort, { once: true });
        const stopCancellationMonitor = this.monitorCancellation(job.executionId, handlerController);
        try {
            const result = await handler(job, {
                signal: handlerController.signal,
                reportProgress: async (progress, payload) => {
                    if (!(await this.store.updateProgress(job.executionId, leaseToken, progress, payload))) {
                        throw new Error('Execution lease was lost while reporting progress.');
                    }
                },
            });
            if (handlerController.signal.aborted || (await this.isCancellationRequested(job.executionId))) {
                await this.store.cancelRunning(job.executionId, leaseToken);
                return;
            }
            await this.store.complete(job.executionId, leaseToken, result);
        } catch (error) {
            if (handlerController.signal.aborted || (await this.isCancellationRequested(job.executionId))) {
                await this.store.cancelRunning(job.executionId, leaseToken);
                return;
            }
            const failure = classifyFailure(error);
            if (!failure.retryable) {
                captureIvoryException(error, {
                    stage: 'worker_execution',
                    executionId: job.executionId,
                    kind: job.kind,
                    attempt: job.attempt,
                    retryable: failure.retryable,
                });
            }
            if (failure.retryable) {
                await this.store.retry(job.executionId, leaseToken, failure);
                throw error;
            }
            await this.store.fail(job.executionId, leaseToken, failure);
        } finally {
            stopCancellationMonitor();
            signal.removeEventListener('abort', relayAbort);
        }
    }

    private async isCancellationRequested(executionId: string): Promise<boolean> {
        return (await this.store.get(executionId))?.status === 'cancelling';
    }

    private monitorCancellation(executionId: string, controller: AbortController): () => void {
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const poll = async (): Promise<void> => {
            if (stopped || controller.signal.aborted) {
                return;
            }
            try {
                if (await this.isCancellationRequested(executionId)) {
                    controller.abort(new Error('Execution cancellation was requested.'));
                    return;
                }
            } catch {
                // The lease-guarded terminal write remains the source of truth
                // if a transient read fails while the handler is running.
            }
            if (!stopped && !controller.signal.aborted) {
                timer = setTimeout(() => {
                    poll().catch(() => undefined);
                }, this.cancellationPollIntervalMs);
            }
        };
        timer = setTimeout(() => {
            poll().catch(() => undefined);
        }, this.cancellationPollIntervalMs);
        return () => {
            stopped = true;
            if (timer !== undefined) {
                clearTimeout(timer);
            }
        };
    }
}

function classifyFailure(error: unknown): ExecutionFailure {
    if (error instanceof Error) {
        const retryable = 'retryable' in error && typeof error.retryable === 'boolean' ? error.retryable : true;
        return { code: 'worker_failure', message: error.message, retryable };
    }
    return { code: 'worker_failure', message: 'Worker failed with an unknown error.', retryable: true };
}
