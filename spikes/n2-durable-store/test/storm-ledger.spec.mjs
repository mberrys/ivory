import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
    appendLedgerRow,
    cycleRowPasses,
    deriveStormSummary,
    ledgerDigest,
    openLedger,
    readLedger,
} from '../src/storm-ledger.mjs';

function acknowledgedRow(overrides = {}) {
    return {
        index: 0,
        fault: 'afterDbCommit',
        childExitedBeforeReopen: true,
        acknowledged: true,
        receiptCountBeforeRetry: 1,
        visibleBeforeRetry: true,
        payloadMatchesBeforeRetry: true,
        receiptCountAfterRetry: 1,
        revisionCountAfterRetry: 1,
        visibleAfterRetry: true,
        payloadMatchesAfterRetry: true,
        blobVerifiedAfterRetry: true,
        retryReplayed: true,
        receiptMatchesAcknowledged: true,
        danglingVisibleBlobs: 0,
        pass: true,
        error: null,
        ...overrides,
    };
}

function unacknowledgedRow(overrides = {}) {
    return acknowledgedRow({
        index: 1,
        fault: 'beforeBlobInstall',
        acknowledged: false,
        receiptCountBeforeRetry: 0,
        visibleBeforeRetry: false,
        payloadMatchesBeforeRetry: false,
        retryReplayed: false,
        receiptMatchesAcknowledged: null,
        ...overrides,
    });
}

test('a recovered acknowledged cycle passes', () => {
    assert.equal(cycleRowPasses(acknowledgedRow()), true);
});

test('an acknowledged cycle whose commit vanished fails', () => {
    const row = acknowledgedRow({ visibleBeforeRetry: false, payloadMatchesBeforeRetry: false });
    assert.equal(cycleRowPasses(row), false);
});

test('a second effect for one idempotency key fails', () => {
    assert.equal(cycleRowPasses({ ...unacknowledgedRow(), receiptCountAfterRetry: 2 }), false);
    assert.equal(cycleRowPasses({ ...unacknowledgedRow(), revisionCountAfterRetry: 2 }), false);
});

test('a visible reference to an uninstalled blob fails', () => {
    assert.equal(cycleRowPasses({ ...unacknowledgedRow(), danglingVisibleBlobs: 1 }), false);
    assert.equal(cycleRowPasses({ ...unacknowledgedRow(), blobVerifiedAfterRetry: false }), false);
});

test('a harness error fails the cycle it happened on', () => {
    assert.equal(cycleRowPasses({ ...unacknowledgedRow(), error: 'Error: boom' }), false);
});

test('a cycle whose interrupted child never exited fails', () => {
    assert.equal(cycleRowPasses({ ...unacknowledgedRow(), childExitedBeforeReopen: false }), false);
    assert.equal(cycleRowPasses({ ...acknowledgedRow(), childExitedBeforeReopen: false }), false);
});

test('the summary reports whether every interrupted child exited before reopen', () => {
    assert.equal(deriveStormSummary([acknowledgedRow(), unacknowledgedRow()]).childrenExitedBeforeReopen, true);
    assert.equal(
        deriveStormSummary([{ ...unacknowledgedRow(), childExitedBeforeReopen: false }]).childrenExitedBeforeReopen,
        false,
    );
    assert.equal(deriveStormSummary([]).childrenExitedBeforeReopen, false);
});

test('an empty ledger never derives a pass', () => {
    const summary = deriveStormSummary([]);
    assert.equal(summary.resultCount, 0);
    assert.equal(summary.measuredFromResults, false);
    assert.equal(summary.acknowledgedNeverLost, false);
    assert.equal(summary.oneEffectPerKey, false);
    assert.equal(summary.noVisibleUninstalledBlob, false);
});

test('a mixed ledger derives all three booleans from the rows', () => {
    const summary = deriveStormSummary([
        acknowledgedRow(),
        unacknowledgedRow(),
        acknowledgedRow({ index: 2, fault: 'afterOutputPublish' }),
    ]);
    assert.equal(summary.resultCount, 3);
    assert.equal(summary.failedResultCount, 0);
    assert.equal(summary.acknowledgedCount, 2);
    assert.equal(summary.unacknowledgedCount, 1);
    assert.equal(summary.measuredFromResults, true);
    assert.equal(summary.acknowledgedNeverLost, true);
    assert.equal(summary.oneEffectPerKey, true);
    assert.equal(summary.noVisibleUninstalledBlob, true);
    assert.deepEqual(summary.faults, ['afterDbCommit', 'afterOutputPublish', 'beforeBlobInstall']);
});

test('one lost acknowledged commit flips only acknowledgedNeverLost', () => {
    const summary = deriveStormSummary([
        acknowledgedRow(),
        unacknowledgedRow(),
        acknowledgedRow({ index: 2, pass: false, visibleBeforeRetry: false }),
    ]);
    assert.equal(summary.acknowledgedNeverLost, false);
    assert.equal(summary.oneEffectPerKey, true);
    assert.equal(summary.noVisibleUninstalledBlob, true);
    assert.equal(summary.failedResultCount, 1);
    assert.equal(summary.firstFailureIndex, 2);
});

test('no acknowledged cycle in the ledger is a failed derivation, not a pass', () => {
    const summary = deriveStormSummary([unacknowledgedRow(), unacknowledgedRow({ index: 2 })]);
    assert.equal(summary.acknowledgedNeverLost, false);
    assert.equal(summary.acknowledgedCount, 0);
});

test('the ledger round-trips through JSONL with a stable digest', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ivory-n2-ledger-'));
    try {
        const path = join(dir, 'storm-cycles.jsonl');
        await openLedger(path);
        await appendLedgerRow(path, acknowledgedRow());
        await appendLedgerRow(path, unacknowledgedRow());
        const rows = await readLedger(path);
        assert.equal(rows.length, 2);
        assert.equal(rows[0].fault, 'afterDbCommit');
        assert.equal(rows[1].acknowledged, false);
        const text = await readFile(path, 'utf8');
        assert.match(ledgerDigest(text), /^[0-9a-f]{64}$/);
        assert.equal(ledgerDigest(text), ledgerDigest(await readFile(path, 'utf8')));
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
