import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DurableStore } from '../src/durable-store.mjs';
import { killProcess } from '../src/interrupt-harness.mjs';
import { stat } from 'node:fs/promises';

const CHILD = fileURLToPath(new URL('../src/child.mjs', import.meta.url));

async function waitForFile(path, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            await stat(path);
            return;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 25));
        }
    }
    throw new Error(`Timed out waiting for ${path}`);
}

test('interrupted migration recovers on reopen', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-'));
    const ready = join(projectRoot, '.ivory', 'local', 'ready');
    const child = spawn(process.execPath, [CHILD, '--project', projectRoot, '--mode', 'migrate'], {
        env: { ...process.env, IVORY_N2_FAULT: 'duringMigration', IVORY_N2_READY: ready },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
        await waitForFile(ready, 60_000);
        killProcess(child.pid);
        await new Promise(resolve => child.once('exit', resolve));
        const store = new DurableStore();
        await store.open(projectRoot);
        const versions = (await store.pg.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(row => row.version);
        assert.deepEqual(versions, ['001_revision_activity.sql', '002_search.sql', '003_snapshot_manifest_text.sql']);
        await store.close();
    } finally {
        await rm(projectRoot, { recursive: true, force: true });
    }
});
