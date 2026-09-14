// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Pool } from 'pg';
import { runMigrations as runGraphileMigrations } from 'graphile-worker';

const packageRoot = join(dirname(__dirname), '..');

export interface IvoryMigrationOptions {
    /** Apply migrations through this filename, inclusive. Intended for migration verification only. */
    upToMigration?: string;
}

export function resolveIvoryMigrationBatch(availableMigrations: readonly string[], upToMigration?: string): string[] {
    const migrations = [...availableMigrations].filter(file => file.endsWith('.sql')).sort();
    if (upToMigration === undefined) {
        return migrations;
    }
    if (!migrations.includes(upToMigration)) {
        throw new Error(`Unknown Ivory migration upper boundary: ${upToMigration}.`);
    }
    return migrations.filter(migration => migration <= upToMigration);
}

export async function runIvoryMigrations(
    connectionString: string,
    migrationsDirectory = join(packageRoot, 'migrations'),
    options: IvoryMigrationOptions = {},
): Promise<void> {
    const pool = new Pool({ connectionString });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('ivory-tower-schema'))");
        await client.query(
            'CREATE TABLE IF NOT EXISTS ivory_schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
        );
        const applied = new Set(
            (await client.query<{ version: string }>('SELECT version FROM ivory_schema_migrations')).rows.map(row => row.version),
        );
        const availableMigrations = (await readdir(migrationsDirectory)).filter(file => file.endsWith('.sql'));
        const migrations = resolveIvoryMigrationBatch(availableMigrations, options.upToMigration);
        for (const migration of migrations) {
            if (applied.has(migration)) {
                continue;
            }
            await client.query(await readFile(join(migrationsDirectory, migration), 'utf8'));
            await client.query('INSERT INTO ivory_schema_migrations (version) VALUES ($1)', [migration]);
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
    await runGraphileMigrations({ connectionString, schema: 'graphile_worker', taskList: {} });
}

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString === undefined || connectionString.length === 0) {
        throw new Error('DATABASE_URL is required for ivory-migrate.');
    }
    const upToMigration = process.env.IVORY_MIGRATIONS_UP_TO;
    runIvoryMigrations(connectionString, join(packageRoot, 'migrations'), {
        upToMigration: upToMigration === undefined || upToMigration.length === 0 ? undefined : upToMigration,
    }).catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
