// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ExecutionJob, ExecutionQueuePort } from '@ivory-tower/adapters';
import { Job, Runner, TaskList, WorkerUtils, makeWorkerUtils, run } from 'graphile-worker';

export class GraphileWorkerQueueAdapter implements ExecutionQueuePort {
    constructor(private readonly workerUtils: WorkerUtils) {}

    async enqueue(job: ExecutionJob): Promise<{ id: string }> {
        const queued: Job = await this.workerUtils.addJob('ivory-execution', job, {
            jobKey: job.jobKey,
            maxAttempts: 25,
        });
        return { id: String(queued.id) };
    }
}

export async function createGraphileWorkerUtils(connectionString: string): Promise<WorkerUtils> {
    return makeWorkerUtils({ connectionString, schema: 'graphile_worker' });
}

export interface GraphileExecutionProcessor {
    process(job: ExecutionJob, abortSignal: AbortSignal): Promise<void>;
}

export function createGraphileTaskList(processor: GraphileExecutionProcessor): TaskList {
    return {
        'ivory-execution': async (payload, helpers) => {
            await processor.process(payload as ExecutionJob, helpers.abortSignal);
        },
    };
}

export function startGraphileWorker(connectionString: string, processor: GraphileExecutionProcessor): Promise<Runner> {
    return run({
        connectionString,
        schema: 'graphile_worker',
        concurrency: 2,
        taskList: createGraphileTaskList(processor),
        minResetLockedInterval: 60_000,
        maxResetLockedInterval: 120_000,
    });
}
