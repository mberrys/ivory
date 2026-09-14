// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { IVORY_RUNTIME_MIGRATIONS } from './schema-readiness';

export type IvoryReadyCheckName = 'postgres' | 'schema' | 'queue' | 'objectStore' | 'docling';
export type IvoryReadyCheckStatus = 'ok' | 'unavailable' | 'skipped';
export type IvoryReadyStatus = 'ready' | 'degraded' | 'unavailable';

export interface IvoryReadyCheck {
    readonly name: IvoryReadyCheckName;
    readonly status: IvoryReadyCheckStatus;
}

export interface IvoryReadyReport {
    readonly status: IvoryReadyStatus;
    readonly checks: readonly IvoryReadyCheck[];
}

export interface IvorySqlQuery {
    query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
}

export interface EvaluateIvoryReadinessOptions {
    readonly query: IvorySqlQuery['query'];
    readonly probeObjectStore: () => Promise<void>;
    readonly probeDocling?: () => Promise<void>;
    readonly includeDocling?: boolean;
}

export async function evaluateIvoryReadiness(options: EvaluateIvoryReadinessOptions): Promise<IvoryReadyReport> {
    const checks: IvoryReadyCheck[] = [];
    const postgres = await probePostgres(options.query);
    checks.push({ name: 'postgres', status: postgres });
    if (postgres !== 'ok') {
        checks.push({ name: 'schema', status: 'unavailable' });
        checks.push({ name: 'queue', status: 'unavailable' });
    } else {
        checks.push({ name: 'schema', status: await probeSchema(options.query) });
        checks.push({ name: 'queue', status: await probeQueue(options.query) });
    }
    checks.push({ name: 'objectStore', status: await probeOptional(options.probeObjectStore) });
    if (options.includeDocling === true) {
        const probeDocling = options.probeDocling;
        checks.push({
            name: 'docling',
            status: probeDocling === undefined ? 'unavailable' : await probeOptional(probeDocling),
        });
    } else {
        checks.push({ name: 'docling', status: 'skipped' });
    }
    return { status: summarizeReadiness(checks), checks };
}

export function isIvoryReadyHttpOk(report: IvoryReadyReport): boolean {
    return report.status === 'ready' || report.status === 'degraded';
}

async function probePostgres(query: IvorySqlQuery['query']): Promise<IvoryReadyCheckStatus> {
    try {
        await query('SELECT 1');
        return 'ok';
    } catch {
        return 'unavailable';
    }
}

async function probeSchema(query: IvorySqlQuery['query']): Promise<IvoryReadyCheckStatus> {
    try {
        for (const version of IVORY_RUNTIME_MIGRATIONS) {
            const migration = await query<{ present: boolean }>(
                'SELECT EXISTS (SELECT 1 FROM ivory_schema_migrations WHERE version = $1) AS present',
                [version],
            );
            if (migration.rows[0]?.present !== true) {
                return 'unavailable';
            }
        }
        return 'ok';
    } catch {
        return 'unavailable';
    }
}

async function probeQueue(query: IvorySqlQuery['query']): Promise<IvoryReadyCheckStatus> {
    try {
        const queue = await query<{ present: boolean }>("SELECT to_regclass('graphile_worker.jobs') IS NOT NULL AS present");
        return queue.rows[0]?.present === true ? 'ok' : 'unavailable';
    } catch {
        return 'unavailable';
    }
}

async function probeOptional(probe: () => Promise<void>): Promise<IvoryReadyCheckStatus> {
    try {
        await probe();
        return 'ok';
    } catch {
        return 'unavailable';
    }
}

function summarizeReadiness(checks: readonly IvoryReadyCheck[]): IvoryReadyStatus {
    let degraded = false;
    for (const check of checks) {
        if (isRequiredReadyCheck(check.name) && check.status !== 'ok') {
            return 'unavailable';
        }
        if (check.name === 'docling' && check.status === 'unavailable') {
            degraded = true;
        }
    }
    return degraded ? 'degraded' : 'ready';
}

function isRequiredReadyCheck(name: IvoryReadyCheckName): boolean {
    switch (name) {
        case 'postgres':
        case 'schema':
        case 'queue':
        case 'objectStore':
            return true;
        case 'docling':
            return false;
        default: {
            const exhaustive: never = name;
            throw new Error(`Unhandled readiness check: ${String(exhaustive)}`);
        }
    }
}
