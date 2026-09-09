/**
 * Interrupt-storm success is computed from per-cycle results.
 * Missing or empty results fail closed; claimed booleans are ignored.
 */

export function summarizeStormCycle({ index, fault, result, childExitedBeforeReopen }) {
    const dangling = result?.afterRetry?.invariants?.danglingVisibleBlobs;
    return {
        index,
        fault,
        acknowledgedBeforeRetry: result?.acknowledgedBeforeRetry != null,
        acknowledgedReceiptId: result?.acknowledgedBeforeRetry?.receipt_id,
        receiptId: result?.retry?.receiptId,
        replayed: result?.retry?.replayed === true,
        revisionCount: Array.isArray(result?.retry?.revisions) ? result.retry.revisions.length : 0,
        danglingVisibleBlobCount: Array.isArray(dangling) ? dangling.length : Number.POSITIVE_INFINITY,
        childExitedBeforeReopen: childExitedBeforeReopen === true,
    };
}

export function evaluateStormResults(results) {
    if (!Array.isArray(results) || results.length === 0) {
        return {
            acknowledgedNeverLost: false,
            oneEffectPerKey: false,
            noVisibleUninstalledBlob: false,
            childrenExitedBeforeReopen: false,
            measuredFromResults: false,
            resultCount: Array.isArray(results) ? 0 : 0,
        };
    }
    const noVisibleUninstalledBlob = results.every(row => row.danglingVisibleBlobCount === 0);
    const childrenExitedBeforeReopen = results.every(row => row.childExitedBeforeReopen === true);
    const acknowledgedNeverLost = results.every(row => {
        if (!row.acknowledgedBeforeRetry) {
            return row.replayed !== true;
        }
        return row.receiptId === row.acknowledgedReceiptId && row.replayed === true;
    });
    const oneEffectPerKey = results.every(row => {
        if (row.acknowledgedBeforeRetry) {
            return row.receiptId === row.acknowledgedReceiptId;
        }
        return row.replayed !== true && row.revisionCount === 1;
    });
    return {
        acknowledgedNeverLost,
        oneEffectPerKey,
        noVisibleUninstalledBlob,
        childrenExitedBeforeReopen,
        measuredFromResults: true,
        resultCount: results.length,
    };
}
