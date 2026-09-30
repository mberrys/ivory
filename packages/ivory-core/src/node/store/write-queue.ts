// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import type { DatabaseSync } from 'node:sqlite';

const SQLITE_BUSY = 5;
const SQLITE_LOCKED = 6;
const INITIAL_BACKOFF_MS = 10;
const MAX_BACKOFF_MS = 200;

/** Runs jobs one at a time in submission order. The head job finishes before the next one starts. */
export class WriteQueue {
    protected tail: Promise<unknown> = Promise.resolve();

    enqueue<T>(job: () => Promise<T>): Promise<T> {
        const result = this.tail.then(() => job());
        this.tail = result.then(() => undefined, () => undefined);
        return result;
    }

    /** Resolves once every job enqueued so far has finished. */
    idle(): Promise<void> {
        return this.tail.then(() => undefined);
    }
}

export function isBusyError(error: unknown): boolean {
    const code = (error as { errcode?: unknown }).errcode;
    return code === SQLITE_BUSY || code === SQLITE_LOCKED;
}

export interface TransactionOutcome<T> {
    readonly commit: boolean;
    readonly value: T;
}

export type BusyResult<T> = { readonly busy: true } | { readonly busy: false; readonly value: T };

export const BUSY = Symbol('busy');

/**
 * Runs `body` in one `BEGIN IMMEDIATE` transaction on `db`. When another writer holds the lock, waits with
 * async backoff, outside any transaction, and tries again until `boundMs` has passed since the first attempt.
 *
 * `body` decides between COMMIT and ROLLBACK. It runs synchronously in the same call as BEGIN and
 * COMMIT/ROLLBACK, so nothing can interleave with the transaction, and an exception rolls it back.
 */
export async function runImmediateTransaction<T>(db: DatabaseSync, body: () => TransactionOutcome<T>, boundMs: number): Promise<BusyResult<T>> {
    return retryWhileBusy(() => attemptTransaction(db, body), boundMs);
}

/** Retries `attempt` while it reports the database busy, with the backoff and bound of {@link runImmediateTransaction}. */
export async function retryWhileBusy<T>(attempt: () => T | typeof BUSY, boundMs: number): Promise<BusyResult<T>> {
    const startedAt = Date.now();
    let backoff = INITIAL_BACKOFF_MS;
    for (;;) {
        const result = attempt();
        if (result !== BUSY) {
            return { busy: false, value: result };
        }
        const remaining = startedAt + boundMs - Date.now();
        if (remaining <= 0) {
            return { busy: true };
        }
        await sleep(Math.min(remaining, backoff + Math.random() * backoff / 2));
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    }
}

/** For statements that are not a transaction but can also find the database busy, such as switching to WAL. */
export function busyAsSentinel<T>(statement: () => T): T | typeof BUSY {
    try {
        return statement();
    } catch (error) {
        if (isBusyError(error)) {
            return BUSY;
        }
        throw error;
    }
}

function attemptTransaction<T>(db: DatabaseSync, body: () => TransactionOutcome<T>): T | typeof BUSY {
    try {
        db.exec('BEGIN IMMEDIATE');
    } catch (error) {
        if (isBusyError(error)) {
            return BUSY;
        }
        throw error;
    }
    // No await between here and COMMIT or ROLLBACK.
    try {
        const outcome = body();
        db.exec(outcome.commit ? 'COMMIT' : 'ROLLBACK');
        return outcome.value;
    } catch (error) {
        if (db.isTransaction) {
            try {
                db.exec('ROLLBACK');
            } catch {
                // The original error is the one worth reporting.
            }
        }
        throw error;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
