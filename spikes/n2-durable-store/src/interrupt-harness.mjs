import { spawn } from 'node:child_process';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DurableStore, sha256Json } from './durable-store.mjs';
import { FAULT_POINTS } from './fault.mjs';
import { killProcess, waitForChildExit } from './child-exit.mjs';
import { appendLedgerRow, cycleRowPasses, deriveStormSummary } from './storm-ledger.mjs';

const CHILD = fileURLToPath(new URL('./child.mjs', import.meta.url));

export { killProcess, waitForChildExit };

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

/**
 * One measured kill/reopen cycle. Never throws on an invariant violation: the
 * violation is returned as booleans so the caller can keep every row. Throws
 * only when the harness itself cannot proceed — notably when the interrupted
 * child is still alive after the kill, in which case reopening the store as if
 * the interrupt had completed would be a lie.
 */
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
        await killProcess(child.pid);
        try {
            await waitForChildExit(child);
        } catch (exitError) {
            throw new Error(`${error.message}. ${exitError.message}. stderr=${stderr}`);
        }
        throw new Error(`${error.message}. stderr=${stderr}`);
    }
    await killProcess(child.pid);
    await waitForChildExit(child);

    const store = new DurableStore();
    await store.open(projectRoot);
    const objectId = command.revisions?.[0]?.objectId;
    const expectedPayload = command.revisions?.[0]?.payload;
    const expectedDigest = expectedPayload === undefined ? undefined : sha256Json(expectedPayload);

    try {
        const acknowledgedRow = (await store.pg.query(
            'SELECT * FROM receipts WHERE idempotency_key = $1',
            [command.idempotencyKey],
        )).rows[0] ?? null;
        const receiptCountBeforeRetry = (await store.pg.query(
            'SELECT count(*)::int AS n FROM receipts WHERE idempotency_key = $1',
            [command.idempotencyKey],
        )).rows[0].n;

        const visibleBeforeRetry = objectId === undefined
            ? undefined
            : await store.getVisible(objectId).catch(() => undefined);
        const beforeRetry = {
            visible: visibleBeforeRetry ?? (objectId === undefined ? undefined : { error: 'not visible' }),
            invariants: await store.invariantReport(),
        };

        const retry = await store.commit({
            ...command,
            blobs: (command.blobs ?? []).map(blob => (
                blob.text !== undefined ? { ...blob, bytes: Buffer.from(blob.text, 'utf8') } : blob
            )),
        });

        const receiptCountAfterRetry = (await store.pg.query(
            'SELECT count(*)::int AS n FROM receipts WHERE idempotency_key = $1',
            [command.idempotencyKey],
        )).rows[0].n;
        const revisionCountAfterRetry = objectId === undefined
            ? 0
            : (await store.pg.query(
                'SELECT count(*)::int AS n FROM revisions WHERE object_id = $1',
                [objectId],
            )).rows[0].n;

        const visibleAfterRetry = objectId === undefined
            ? undefined
            : await store.getVisible(objectId).catch(() => undefined);
        const afterRetry = {
            visible: visibleAfterRetry,
            invariants: await store.invariantReport(),
        };

        let blobVerifiedAfterRetry = false;
        if (typeof visibleAfterRetry?.blobDigest === 'string') {
            try {
                await store.blobs.verifyInstalled(visibleAfterRetry.blobDigest);
                blobVerifiedAfterRetry = true;
            } catch {
                blobVerifiedAfterRetry = false;
            }
        }

        const acknowledged = acknowledgedRow !== null;
        return {
            fault,
            beforeRetry,
            acknowledgedBeforeRetry: acknowledgedRow,
            retry,
            afterRetry,
            childExitedBeforeReopen: true,
            acknowledged,
            receiptCountBeforeRetry,
            visibleBeforeRetry: visibleBeforeRetry !== undefined,
            payloadMatchesBeforeRetry:
                expectedDigest !== undefined && visibleBeforeRetry?.contentDigest === expectedDigest,
            receiptCountAfterRetry,
            revisionCountAfterRetry,
            visibleAfterRetry: visibleAfterRetry !== undefined,
            payloadMatchesAfterRetry:
                expectedDigest !== undefined && visibleAfterRetry?.contentDigest === expectedDigest,
            blobVerifiedAfterRetry,
            retryReplayed: retry.replayed === true,
            receiptMatchesAcknowledged:
                acknowledgedRow === null ? null : retry.receiptId === acknowledgedRow.receipt_id,
            danglingVisibleBlobs: afterRetry.invariants.danglingVisibleBlobs.length,
        };
    } finally {
        await store.close();
    }
}

function toLedgerRow(index, observation) {
    return {
        index,
        fault: observation.fault,
        childExitedBeforeReopen: observation.childExitedBeforeReopen === true,
        acknowledged: observation.acknowledged,
        receiptCountBeforeRetry: observation.receiptCountBeforeRetry,
        visibleBeforeRetry: observation.visibleBeforeRetry,
        payloadMatchesBeforeRetry: observation.payloadMatchesBeforeRetry,
        receiptCountAfterRetry: observation.receiptCountAfterRetry,
        revisionCountAfterRetry: observation.revisionCountAfterRetry,
        visibleAfterRetry: observation.visibleAfterRetry,
        payloadMatchesAfterRetry: observation.payloadMatchesAfterRetry,
        blobVerifiedAfterRetry: observation.blobVerifiedAfterRetry,
        retryReplayed: observation.retryReplayed,
        receiptMatchesAcknowledged: observation.receiptMatchesAcknowledged,
        danglingVisibleBlobs: observation.danglingVisibleBlobs,
        error: null,
    };
}

function failedRow(index, fault, error) {
    return {
        index,
        fault,
        childExitedBeforeReopen: false,
        acknowledged: false,
        receiptCountBeforeRetry: 0,
        visibleBeforeRetry: false,
        payloadMatchesBeforeRetry: false,
        receiptCountAfterRetry: 0,
        revisionCountAfterRetry: 0,
        visibleAfterRetry: false,
        payloadMatchesAfterRetry: false,
        blobVerifiedAfterRetry: false,
        retryReplayed: false,
        receiptMatchesAcknowledged: null,
        danglingVisibleBlobs: -1,
        error: `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}`.slice(0, 400),
    };
}

/**
 * Runs the storm to completion no matter what each cycle finds: a violation is recorded
 * and the loop continues, so a failing run still yields a full per-cycle ledger. The
 * ledger is appended per cycle, so a crash mid-run preserves every completed cycle.
 */
export async function runInterruptStorm({ projectRoot, cycles, ledgerPath, onCycle }) {
    const points = FAULT_POINTS.filter(point => point !== 'duringMigration');
    const rows = [];
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
        let row;
        try {
            row = toLedgerRow(index, await interruptAndReopen({ projectRoot, command, fault }));
        } catch (error) {
            row = failedRow(index, fault, error);
        }
        row.pass = cycleRowPasses(row);
        rows.push(row);
        if (ledgerPath !== undefined) {
            await appendLedgerRow(ledgerPath, row);
        }
        onCycle?.(index, fault, row);
    }
    return { rows, summary: deriveStormSummary(rows) };
}
