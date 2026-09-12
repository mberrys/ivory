import { promises as fs } from 'node:fs';

export const FAULT_POINTS = Object.freeze([
    'beforeBlobInstall',
    'afterBlobInstall',
    'beforeDbCommit',
    'afterDbCommit',
    'beforeOutboxDelivery',
    'afterOutboxDelivery',
    'beforeOutputPublish',
    'afterOutputPublish',
    'duringMigration',
]);

export async function maybeFault(point) {
    if (process.env.IVORY_N2_FAULT !== point) {
        return;
    }
    const marker = process.env.IVORY_N2_READY;
    if (marker) {
        await fs.writeFile(marker, point, 'utf8');
    }
    process.abort();
}

export function enospcWhere() {
    return process.env.IVORY_N2_ENOSPC;
}
