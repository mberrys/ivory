import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { maybeFault } from './fault.mjs';

export async function runMigrations(pg, migrationsDirectory) {
    await pg.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
    const applied = new Set(
        (await pg.query('SELECT version FROM schema_migrations')).rows.map(row => row.version),
    );
    const files = (await readdir(migrationsDirectory)).filter(file => file.endsWith('.sql')).sort();
    for (const file of files) {
        if (applied.has(file)) {
            continue;
        }
        const sql = await readFile(join(migrationsDirectory, file), 'utf8');
        await pg.transaction(async tx => {
            await tx.exec(sql);
            await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        });
        await maybeFault('duringMigration');
    }
}
