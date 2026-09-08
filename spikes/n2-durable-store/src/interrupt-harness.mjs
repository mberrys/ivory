import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DurableStore } from './durable-store.mjs';
import { FAULT_POINTS } from './fault.mjs';

const CHILD = fileURLToPath(new URL('./child.mjs', import.meta.url));

export function killProcess(pid) {
    if (process.platform === 'win32') {
        spawn('taskkill', ['/F', '/PID', String(pid), '/T'], { stdio: 'ignore' });
        return;
    }
    try {
        process.kill(pid, 'SIGKILL');
    } catch {
        /* already gone */
    }
}

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
    throw new Error(`Timed out waiting for fault marker ${path}`);
}

function waitExit(child) {
    return new Promise(resolve => {
        if (child.exitCode !== null || child.signalCode !== null) {
            resolve();
            return;
        }
        child.once('exit', () => resolve());
        setTimeout(resolve, 5000);
    });
}

export async function interruptAndReopen({ projectRoot, command, fault, readyTimeoutMs = 60_000 }) {
    await mkdir(join(projectRoot, '.ivory', 'local'), { recursive: true });
    const ready = join(projectRoot, '.ivory', 'local', 'ready');
    const commandPath = join(projectRoot, '.ivory', 'local', 'command.json');
    await rm(ready, { force: true });
    await writeFile(commandPath, JSON.stringify(command), 'utf8');

    const child = spawn(process.execPath, [CHILD, '--project', projectRoot, '--command', commandPath], {
        env: { ...process.env, IVORY_N2_FAULT: fault, IVORY_N2_READY: ready },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', chunk => {
        stderr += chunk;
    });
    try {
        await waitForFile(ready, readyTimeoutMs);
    } catch (error) {
        killProcess(child.pid);
        await waitExit(child);
        throw new Error(`${error.message}. stderr=${stderr}`);
    }
    killProcess(child.pid);
    await waitExit(child);

    const store = new DurableStore();
    await store.open(projectRoot);
    const beforeRetry = {
        visible: command.revisions?.[0] ? await store.getVisible(command.revisions[0].objectId).catch(error => ({ error: error.message })) : undefined,
        invariants: await store.invariantReport(),
    };
    const acknowledgedBeforeRetry = (await store.pg.query(
        'SELECT * FROM receipts WHERE idempotency_key = $1',
        [command.idempotencyKey],
    )).rows[0];
    const retry = await store.commit({
        ...command,
        blobs: (command.blobs ?? []).map(blob => (
            blob.text !== undefined ? { ...blob, bytes: Buffer.from(blob.text, 'utf8') } : blob
        )),
    });
    const afterRetry = {
        visible: command.revisions?.[0] ? await store.getVisible(command.revisions[0].objectId) : undefined,
        invariants: await store.invariantReport(),
    };
    await store.close();
    return { fault, beforeRetry, acknowledgedBeforeRetry: acknowledgedBeforeRetry ?? null, retry, afterRetry };
}

export async function runInterruptStorm({ projectRoot, cycles, onCycle }) {
    const points = FAULT_POINTS.filter(point => point !== 'duringMigration');
    const results = [];
    for (let index = 0; index < cycles; index += 1) {
        const fault = points[index % points.length];
        const command = {
            idempotencyKey: `n2-storm-${index}`,
            expectedHeads: [{ objectId: `doc-${index}` }],
            activity: { operation: 'admit-source', actor: 'n2-harness' },
            revisions: [{
                objectId: `doc-${index}`,
                objectType: 'document',
                payload: { title: `Doc ${index}`, text: `body ${index} unique-token` },
            }],
            blobs: [{ text: `blob-payload-${index}` }],
        };
        const result = await interruptAndReopen({ projectRoot, command, fault });
        if (result.afterRetry.invariants.danglingVisibleBlobs.length > 0) {
            throw new Error(`Visible uninstalled blob after ${fault} cycle ${index}`);
        }
        if (result.retry.replayed && result.acknowledgedBeforeRetry === null) {
            throw new Error(`Retry claimed replay without an acknowledged receipt at ${fault} cycle ${index}`);
        }
        if (!result.retry.replayed && result.retry.revisions.length !== 1) {
            throw new Error(`Retry did not produce one revision at ${fault} cycle ${index}`);
        }
        if (result.acknowledgedBeforeRetry !== null && result.retry.receiptId !== result.acknowledgedBeforeRetry.receipt_id) {
            throw new Error(`Idempotency key produced a second receipt at ${fault} cycle ${index}`);
        }
        results.push({ index, fault, acknowledgedBeforeRetry: result.acknowledgedBeforeRetry !== null, receiptId: result.retry.receiptId });
        onCycle?.(index, fault);
    }
    return results;
}
