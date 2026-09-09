import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateStormResults, summarizeStormCycle } from '../src/storm-results.mjs';

function goodAckedRow(index = 0) {
    return {
        index,
        fault: 'afterDbCommit',
        acknowledgedBeforeRetry: true,
        acknowledgedReceiptId: `r-${index}`,
        receiptId: `r-${index}`,
        replayed: true,
        revisionCount: 0,
        danglingVisibleBlobCount: 0,
        childExitedBeforeReopen: true,
    };
}

function goodFreshRow(index = 0) {
    return {
        index,
        fault: 'beforeDbCommit',
        acknowledgedBeforeRetry: false,
        acknowledgedReceiptId: undefined,
        receiptId: `r-${index}`,
        replayed: false,
        revisionCount: 1,
        danglingVisibleBlobCount: 0,
        childExitedBeforeReopen: true,
    };
}

test('empty or missing results fail closed instead of vacuous pass', () => {
    for (const results of [undefined, null, [], 'not-an-array']) {
        const flags = evaluateStormResults(results);
        assert.equal(flags.measuredFromResults, false);
        assert.equal(flags.acknowledgedNeverLost, false);
        assert.equal(flags.oneEffectPerKey, false);
        assert.equal(flags.noVisibleUninstalledBlob, false);
        assert.equal(flags.childrenExitedBeforeReopen, false);
    }
});

test('successful cycles computed from results pass all storm flags', () => {
    const flags = evaluateStormResults([goodAckedRow(0), goodFreshRow(1)]);
    assert.equal(flags.measuredFromResults, true);
    assert.equal(flags.resultCount, 2);
    assert.equal(flags.acknowledgedNeverLost, true);
    assert.equal(flags.oneEffectPerKey, true);
    assert.equal(flags.noVisibleUninstalledBlob, true);
    assert.equal(flags.childrenExitedBeforeReopen, true);
});

test('lost acknowledged receipt fails acknowledgedNeverLost and oneEffectPerKey', () => {
    const flags = evaluateStormResults([
        {
            ...goodAckedRow(0),
            receiptId: 'other-receipt',
        },
    ]);
    assert.equal(flags.acknowledgedNeverLost, false);
    assert.equal(flags.oneEffectPerKey, false);
});

test('dangling visible blob fails noVisibleUninstalledBlob', () => {
    const flags = evaluateStormResults([{ ...goodFreshRow(0), danglingVisibleBlobCount: 1 }]);
    assert.equal(flags.noVisibleUninstalledBlob, false);
    assert.equal(flags.acknowledgedNeverLost, true);
});

test('replay without an acknowledged receipt fails acknowledgedNeverLost', () => {
    const flags = evaluateStormResults([{ ...goodFreshRow(0), replayed: true, revisionCount: 0 }]);
    assert.equal(flags.acknowledgedNeverLost, false);
    assert.equal(flags.oneEffectPerKey, false);
});

test('two revisions on a fresh retry fails oneEffectPerKey', () => {
    const flags = evaluateStormResults([{ ...goodFreshRow(0), revisionCount: 2 }]);
    assert.equal(flags.oneEffectPerKey, false);
    assert.equal(flags.acknowledgedNeverLost, true);
});

test('child still alive before reopen fails childrenExitedBeforeReopen', () => {
    const flags = evaluateStormResults([{ ...goodFreshRow(0), childExitedBeforeReopen: false }]);
    assert.equal(flags.childrenExitedBeforeReopen, false);
});

test('summarizeStormCycle maps a live cycle into measurable fields', () => {
    const row = summarizeStormCycle({
        index: 3,
        fault: 'afterBlobInstall',
        childExitedBeforeReopen: true,
        result: {
            acknowledgedBeforeRetry: { receipt_id: 'abc' },
            retry: { receiptId: 'abc', replayed: true, revisions: [] },
            afterRetry: { invariants: { danglingVisibleBlobs: [] } },
        },
    });
    assert.deepEqual(row, {
        index: 3,
        fault: 'afterBlobInstall',
        acknowledgedBeforeRetry: true,
        acknowledgedReceiptId: 'abc',
        receiptId: 'abc',
        replayed: true,
        revisionCount: 0,
        danglingVisibleBlobCount: 0,
        childExitedBeforeReopen: true,
    });
});

test('summarizeStormCycle fails closed when afterRetry invariants are missing', () => {
    const row = summarizeStormCycle({
        index: 0,
        fault: 'beforeBlobInstall',
        childExitedBeforeReopen: true,
        result: {
            acknowledgedBeforeRetry: null,
            retry: { receiptId: 'x', replayed: false, revisions: [{ revisionId: '1' }] },
        },
    });
    assert.equal(row.danglingVisibleBlobCount, Number.POSITIVE_INFINITY);
    assert.equal(evaluateStormResults([row]).noVisibleUninstalledBlob, false);
});
