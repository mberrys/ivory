// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * The hosts of a latency run, one process each. Arguments: role, project directory, JSON {@link LatencyRoleConfig}.
 * Each opens the project, tells the parent it is ready, waits for the schedule, does its work until the end and reports.
 *
 * - `workbench`: a render tick and a commit every 500 ms, watching its event loop.
 * - `cli`: holds the write lock for `holdMs` in a loop.
 * - `mcp`: `head()` at 10 Hz and `recover()` every 2 s.
 * - `victim`: opens the store, admits a blob and waits to be killed.
 */

import { CommitOutcome, openProjectStore, ProjectStore, qualificationHandlerModule } from '@ivory/core/lib/node';
import { randomBytes } from 'crypto';
import { monitorEventLoopDelay } from 'perf_hooks';
import { sleep } from '../managed-child';
import {
    CommitRecord, HistogramMs, LatencyRole, LatencyRoleConfig, LatencySchedule, ObservationRecord, PercentilesMs, RecoveryRecord, RoleReport
} from './latency-types';

const HOST_KIND: Readonly<Record<LatencyRole, string>> = { workbench: 'workbench', cli: 'cli', mcp: 'mcp', victim: 'cli' };
const RENDER_TICK_MS = 16;
const COMMIT_EVERY_MS = 500;
const BLOB_BYTES = 4096;
const CLI_IDLE_MS = 1000;
const MCP_HEAD_EVERY_MS = 100;
const MCP_RECOVER_EVERY_MS = 2000;
const SETTLE_MS = 30_000;

/** What the render tick computes. It lives at module level so that the work cannot be optimized away. */
let renderWork = 0;

/** Collects what `head()` returned, one entry per distinct (seq, digest). */
class ObservationLog {
    protected readonly seen = new Map<string, { seq: number; digest: string; firstAt: number; count: number }>();
    errors = 0;

    record(head: { seq: number; digest: string } | undefined): void {
        if (head) {
            const key = `${head.seq}:${head.digest}`;
            const entry = this.seen.get(key);
            if (entry) {
                entry.count++;
            } else {
                this.seen.set(key, { ...head, firstAt: Date.now(), count: 1 });
            }
        }
    }

    list(): ObservationRecord[] {
        return [...this.seen.values()];
    }
}

function percentile(sorted: readonly number[], p: number): number {
    return sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.ceil(p / 100 * sorted.length) - 1)];
}

function latencyOf(commits: readonly CommitRecord[]): PercentilesMs {
    const sorted = commits.filter(commit => commit.measured).map(commit => commit.ms).sort((a, b) => a - b);
    return { count: sorted.length, p50: percentile(sorted, 50), p99: percentile(sorted, 99), max: sorted[sorted.length - 1] ?? 0 };
}

async function sleepUntil(time: number): Promise<void> {
    await sleep(Math.max(0, time - Date.now()));
}

async function commitRecord(
    store: ProjectStore, schedule: LatencySchedule, principal: string, key: string, kind: string, input: unknown
): Promise<CommitRecord> {
    const startedAt = Date.now();
    const measured = startedAt >= schedule.measureStart && startedAt < schedule.endAt;
    try {
        const outcome = await store.commit({ kind, input, principal, idempotencyKey: key });
        const ms = Date.now() - startedAt;
        return CommitOutcome.isRefusal(outcome)
            ? { key, principal, startedAt, ms, measured, result: outcome.refusal.code, message: outcome.refusal.message }
            : { key, principal, startedAt, ms, measured, result: 'committed', seq: outcome.receipt.seq, digest: outcome.receipt.digest };
    } catch (error) {
        return { key, principal, startedAt, ms: Date.now() - startedAt, measured, result: 'error', message: (error as Error).message };
    }
}

async function runWorkbench(store: ProjectStore, schedule: LatencySchedule): Promise<Partial<RoleReport>> {
    const observations = new ObservationLog();
    let advances = 0;
    let observing = Promise.resolve();
    store.onDidAdvance(() => {
        advances++;
        observing = observing.then(() => store.head()).then(head => observations.record(head), () => {
            observations.errors++;
        });
    });
    // The render tick does trivial work, so any delay it sees comes from the event loop being held up.
    const render = setInterval(() => {
        for (let i = 0; i < 100; i++) {
            renderWork += Math.sqrt(i);
        }
    }, RENDER_TICK_MS);
    const histogram = monitorEventLoopDelay({ resolution: 10 });
    const pending: Promise<CommitRecord>[] = [];
    await sleepUntil(schedule.t0);
    setTimeout(() => histogram.enable(), Math.max(0, schedule.measureStart - Date.now()));
    let index = 0;
    const commits = setInterval(() => {
        const key = `w${index++}`;
        pending.push((async () => {
            try {
                const blob = await store.admitBlob(randomBytes(BLOB_BYTES));
                return await commitRecord(store, schedule, 'workbench', key, 'qual.put', { key, blob });
            } catch (error) {
                return { key, principal: 'workbench', startedAt: Date.now(), ms: 0, measured: false, result: 'error', message: (error as Error).message };
            }
        })());
    }, COMMIT_EVERY_MS);
    await sleepUntil(schedule.endAt);
    histogram.disable();
    clearInterval(commits);
    clearInterval(render);
    const records = await Promise.race([Promise.all(pending), sleep(SETTLE_MS).then(() => undefined)]);
    if (records === undefined) {
        throw new Error(`the workbench's commits did not settle within ${SETTLE_MS} ms`);
    }
    await observing;
    const ms = (nanoseconds: number): number => nanoseconds / 1e6;
    const summary: HistogramMs = {
        count: histogram.count,
        min: ms(histogram.min),
        mean: ms(histogram.mean),
        p50: ms(histogram.percentile(50)),
        p90: ms(histogram.percentile(90)),
        p99: ms(histogram.percentile(99)),
        max: ms(histogram.max)
    };
    return {
        commits: records,
        observations: observations.list(),
        observationErrors: observations.errors,
        histogram: summary,
        commitLatency: latencyOf(records),
        advances
    };
}

async function runCli(store: ProjectStore, schedule: LatencySchedule, config: LatencyRoleConfig): Promise<Partial<RoleReport>> {
    const commits: CommitRecord[] = [];
    await sleepUntil(schedule.t0);
    for (let index = 0; Date.now() < schedule.endAt; index++) {
        commits.push(await commitRecord(store, schedule, 'cli', `h${index}`, 'qual.hold', { ms: config.holdMs }));
        await sleep(CLI_IDLE_MS);
    }
    return { commits };
}

async function runMcp(store: ProjectStore, schedule: LatencySchedule): Promise<Partial<RoleReport>> {
    const observations = new ObservationLog();
    const recoveries: RecoveryRecord[] = [];
    let heading = false;
    let recovering = false;
    await sleepUntil(schedule.t0);
    const head = setInterval(() => {
        if (!heading) {
            heading = true;
            store.head().then(value => observations.record(value), () => {
                observations.errors++;
            }).finally(() => {
                heading = false;
            });
        }
    }, MCP_HEAD_EVERY_MS);
    const recover = setInterval(() => {
        if (!recovering) {
            recovering = true;
            const startedAt = Date.now();
            store.recover().then(recovery => {
                recoveries.push({ startedAt, endedAt: Date.now(), recovery });
            }, () => {
                observations.errors++;
            }).finally(() => {
                recovering = false;
            });
        }
    }, MCP_RECOVER_EVERY_MS);
    await sleepUntil(schedule.endAt);
    clearInterval(head);
    clearInterval(recover);
    while (heading || recovering) {
        await sleep(20);
    }
    return { observations: observations.list(), observationErrors: observations.errors, recoveries };
}

async function main(): Promise<void> {
    const [role, projectDir, configJson] = process.argv.slice(2) as [LatencyRole, string, string];
    const config = JSON.parse(configJson) as LatencyRoleConfig;
    const startedAt = Date.now();
    const store = await openProjectStore(projectDir, { hostKind: HOST_KIND[role], handlerModules: [qualificationHandlerModule] });
    const open = { startedAt, endedAt: Date.now(), recovery: store.openRecovery };
    process.on('disconnect', () => process.exit(0));
    if (role === 'victim') {
        // An admission that completes leaves no staging file behind, so the lease is all that is left when the victim is killed.
        await store.admitBlob(randomBytes(BLOB_BYTES));
        process.send?.({ type: 'ready', role, processId: store.processId, pid: process.pid, open });
        return;
    }
    const schedule = await new Promise<LatencySchedule>(resolve => {
        process.on('message', (message: { type?: string } & LatencySchedule) => {
            if (message.type === 'go') {
                resolve(message);
            }
        });
        process.send?.({ type: 'ready', role, processId: store.processId, pid: process.pid, open });
    });
    const part = role === 'workbench' ? await runWorkbench(store, schedule) : role === 'cli' ? await runCli(store, schedule, config) : await runMcp(store, schedule);
    await store.close();
    const report: RoleReport = {
        type: 'report', role, processId: store.processId, commits: [], observations: [], observationErrors: 0, recoveries: [], ...part
    };
    process.send?.(report, () => process.exit(0));
}

main().catch(error => {
    console.error(error);
    process.exit(3);
});
