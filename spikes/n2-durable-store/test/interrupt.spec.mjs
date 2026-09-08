import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FAULT_POINTS } from '../src/fault.mjs';
import { interruptAndReopen } from '../src/interrupt-harness.mjs';

const commitPoints = FAULT_POINTS.filter(point => point !== 'duringMigration');

for (const fault of commitPoints) {
    test(`interrupt at ${fault} recovers with one semantic effect`, async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-'));
        try {
            const result = await interruptAndReopen({
                projectRoot,
                fault,
                command: {
                    idempotencyKey: `idem-${fault}`,
                    expectedHeads: [{ objectId: `doc-${fault}` }],
                    activity: { operation: 'admit-source', actor: 'interrupt' },
                    revisions: [{
                        objectId: `doc-${fault}`,
                        objectType: 'document',
                        payload: { title: fault, text: `body-${fault}` },
                    }],
                    blobs: [{ text: `blob-${fault}` }],
                },
            });
            assert.equal(result.afterRetry.invariants.danglingVisibleBlobs.length, 0);
            assert.ok(result.retry.receiptId);
            assert.equal(result.afterRetry.visible.payload.title, fault);
            if (result.acknowledgedBeforeRetry !== null) {
                assert.equal(result.retry.receiptId, result.acknowledgedBeforeRetry.receipt_id);
                assert.equal(result.retry.replayed, true);
            } else {
                assert.notEqual(result.retry.replayed, true);
            }
        } finally {
            await rm(projectRoot, { recursive: true, force: true });
        }
    });
}
