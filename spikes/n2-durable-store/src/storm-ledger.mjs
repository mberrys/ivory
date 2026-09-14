import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * One row per interruption/reopen cycle. These rows are the ONLY source of truth
 * for the crash-durability criteria: deriveStormSummary() computes the booleans
 * from them, so a boolean can never be true unless every measured row says so.
 *
 * @typedef {object} StormCycleRow
 * @property {number}  index
 * @property {string}  fault
 * @property {boolean} acknowledged                 a receipt was committed before the kill
 * @property {number}  receiptCountBeforeRetry
 * @property {boolean} visibleBeforeRetry           head revision readable before the retry
 * @property {boolean} payloadMatchesBeforeRetry    reopened payload digest equals the committed one
 * @property {number}  receiptCountAfterRetry
 * @property {number}  revisionCountAfterRetry
 * @property {boolean} visibleAfterRetry
 * @property {boolean} payloadMatchesAfterRetry
 * @property {boolean} blobVerifiedAfterRetry       referenced blob present and re-hashed
 * @property {boolean} retryReplayed
 * @property {boolean|null} receiptMatchesAcknowledged
 * @property {number}  danglingVisibleBlobs
 * @property {boolean} pass
 * @property {string|null} error
 */

export function cycleRowPasses(row) {
    if (row.error !== null && row.error !== undefined) {
        return false;
    }
    // The interrupted child must have really exited before the store was reopened.
    if (row.childExitedBeforeReopen !== true) {
        return false;
    }
    if (row.danglingVisibleBlobs !== 0) {
        return false;
    }
    if (row.visibleAfterRetry !== true || row.payloadMatchesAfterRetry !== true) {
        return false;
    }
    if (row.blobVerifiedAfterRetry !== true) {
        return false;
    }
    if (row.receiptCountAfterRetry !== 1 || row.revisionCountAfterRetry !== 1) {
        return false;
    }
    if (row.acknowledged === true) {
        // An acknowledged commit must survive the kill as a replay of the same receipt.
        if (row.receiptCountBeforeRetry !== 1) {
            return false;
        }
        if (row.visibleBeforeRetry !== true || row.payloadMatchesBeforeRetry !== true) {
            return false;
        }
        if (row.retryReplayed !== true || row.receiptMatchesAcknowledged !== true) {
            return false;
        }
        return true;
    }
    // Unacknowledged work must be retried into exactly one effect.
    if (row.receiptCountBeforeRetry !== 0) {
        return false;
    }
    if (row.visibleBeforeRetry !== false) {
        return false;
    }
    return row.receiptMatchesAcknowledged === null;
}

export function deriveStormSummary(rows) {
    const resultCount = rows.length;
    const failures = rows.filter(row => row.pass !== true);
    const acknowledged = rows.filter(row => row.acknowledged === true);
    const unacknowledged = rows.filter(row => row.acknowledged !== true);
    const measuredFromResults = resultCount > 0;
    return {
        resultCount,
        measuredFromResults,
        failedResultCount: failures.length,
        firstFailureIndex: failures.length > 0 ? failures[0].index : null,
        acknowledgedCount: acknowledged.length,
        unacknowledgedCount: unacknowledged.length,
        faults: [...new Set(rows.map(row => row.fault))].sort(),
        acknowledgedNeverLost:
            measuredFromResults
            && acknowledged.length > 0
            && acknowledged.every(row =>
                row.pass === true && row.visibleBeforeRetry === true && row.payloadMatchesBeforeRetry === true),
        oneEffectPerKey:
            measuredFromResults
            && rows.every(row =>
                row.receiptCountAfterRetry === 1
                && row.revisionCountAfterRetry === 1
                && (row.acknowledged !== true || row.receiptMatchesAcknowledged === true)),
        noVisibleUninstalledBlob:
            measuredFromResults
            && rows.every(row => row.danglingVisibleBlobs === 0 && row.blobVerifiedAfterRetry === true),
        childrenExitedBeforeReopen:
            measuredFromResults && rows.every(row => row.childExitedBeforeReopen === true),
    };
}

/** Truncates any previous ledger so a run can never append to a stale one. */
export async function openLedger(path) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, '', 'utf8');
}

export async function appendLedgerRow(path, row) {
    await appendFile(path, `${JSON.stringify(row)}\n`, 'utf8');
}

export async function readLedger(path) {
    const text = await readFile(path, 'utf8');
    return text
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => JSON.parse(line));
}

export function ledgerDigest(text) {
    return createHash('sha256').update(text).digest('hex');
}
