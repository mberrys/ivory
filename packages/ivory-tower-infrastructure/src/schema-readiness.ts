// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { Pool } from 'pg';

export const IVORY_RUNTIME_MIGRATIONS = ['001_runtime_topology.sql', '002_source_rights.sql'] as const;

export async function isIvoryRuntimeReady(pool: Pool): Promise<boolean> {
    for (const version of IVORY_RUNTIME_MIGRATIONS) {
        const migration = await pool.query<{ present: boolean }>(
            'SELECT EXISTS (SELECT 1 FROM ivory_schema_migrations WHERE version = $1) AS present',
            [version],
        );
        if (migration.rows[0]?.present !== true) {
            return false;
        }
    }
    const queue = await pool.query<{ present: boolean }>("SELECT to_regclass('graphile_worker.jobs') IS NOT NULL AS present");
    return queue.rows[0]?.present === true;
}

export async function assertIvoryRuntimeReady(pool: Pool): Promise<void> {
    if (!(await isIvoryRuntimeReady(pool))) {
        throw new Error(`Ivory Tower schema is incompatible or not migrated (${IVORY_RUNTIME_MIGRATIONS.join(', ')}).`);
    }
}
