// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { evaluateIvoryReadiness, IvorySqlQuery } from './runtime-readiness';

function queryFor(options: { postgres?: boolean; migrations?: readonly string[]; queue?: boolean }): IvorySqlQuery['query'] {
    return async <T extends Record<string, unknown> = Record<string, unknown>>(
        sql: string,
        params?: readonly unknown[],
    ): Promise<{ rows: T[] }> => {
        if (sql === 'SELECT 1') {
            if (options.postgres === false) {
                throw new Error('connect ECONNREFUSED');
            }
            return { rows: [{ ok: true }] as unknown as T[] };
        }
        if (sql.includes('ivory_schema_migrations')) {
            const version = String(params?.[0] ?? '');
            return { rows: [{ present: (options.migrations ?? []).includes(version) }] as unknown as T[] };
        }
        if (sql.includes('graphile_worker.jobs')) {
            return { rows: [{ present: options.queue === true }] as unknown as T[] };
        }
        throw new Error(`unexpected SQL: ${sql}`);
    };
}

describe('evaluateIvoryReadiness', () => {
    const allMigrations = ['001_runtime_topology.sql', '002_source_rights.sql'];

    it('is ready when postgres, schema, queue, and object store pass and Docling is skipped', async () => {
        const report = await evaluateIvoryReadiness({
            query: queryFor({ postgres: true, migrations: allMigrations, queue: true }),
            probeObjectStore: async () => undefined,
            includeDocling: false,
        });
        expect(report.status).to.equal('ready');
        expect(report.checks).to.deep.equal([
            { name: 'postgres', status: 'ok' },
            { name: 'schema', status: 'ok' },
            { name: 'queue', status: 'ok' },
            { name: 'objectStore', status: 'ok' },
            { name: 'docling', status: 'skipped' },
        ]);
    });

    it('is unavailable when postgres is down', async () => {
        const report = await evaluateIvoryReadiness({
            query: queryFor({ postgres: false, migrations: allMigrations, queue: true }),
            probeObjectStore: async () => undefined,
        });
        expect(report.status).to.equal('unavailable');
        expect(report.checks.find(check => check.name === 'postgres')?.status).to.equal('unavailable');
        expect(report.checks.find(check => check.name === 'schema')?.status).to.equal('unavailable');
        expect(report.checks.find(check => check.name === 'queue')?.status).to.equal('unavailable');
    });

    it('is unavailable when a required migration is missing', async () => {
        const report = await evaluateIvoryReadiness({
            query: queryFor({ postgres: true, migrations: ['001_runtime_topology.sql'], queue: true }),
            probeObjectStore: async () => undefined,
        });
        expect(report.status).to.equal('unavailable');
        expect(report.checks.find(check => check.name === 'schema')?.status).to.equal('unavailable');
    });

    it('is unavailable when the queue table is missing', async () => {
        const report = await evaluateIvoryReadiness({
            query: queryFor({ postgres: true, migrations: allMigrations, queue: false }),
            probeObjectStore: async () => undefined,
        });
        expect(report.status).to.equal('unavailable');
        expect(report.checks.find(check => check.name === 'queue')?.status).to.equal('unavailable');
    });

    it('is unavailable when object-store probe fails', async () => {
        const report = await evaluateIvoryReadiness({
            query: queryFor({ postgres: true, migrations: allMigrations, queue: true }),
            probeObjectStore: async () => {
                throw new Error('NoSuchBucket');
            },
        });
        expect(report.status).to.equal('unavailable');
        expect(report.checks.find(check => check.name === 'objectStore')?.status).to.equal('unavailable');
    });

    it('is degraded when only Docling is down', async () => {
        const report = await evaluateIvoryReadiness({
            query: queryFor({ postgres: true, migrations: allMigrations, queue: true }),
            probeObjectStore: async () => undefined,
            includeDocling: true,
            probeDocling: async () => {
                throw new Error('fetch failed');
            },
        });
        expect(report.status).to.equal('degraded');
        expect(report.checks.find(check => check.name === 'docling')?.status).to.equal('unavailable');
    });
});
