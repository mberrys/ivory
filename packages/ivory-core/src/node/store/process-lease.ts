// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, unlinkSync } from 'fs';
import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import { IvoryStoreError, RecoveryReport } from '../../common/store-protocol';
import { ProjectLayout } from '../project-layout';

/**
 * Names this process in every project it opens. Generated once at module load and handed to the
 * store workers, so the lease held by the main thread and the staging files written by a worker agree.
 */
export const processId: string = randomBytes(16).toString('hex');

const LEASE_SUFFIX = '.sqlite';
const SQLITE_BUSY = 5;

/**
 * A lease is a SQLite file in DELETE journal mode whose owner holds `BEGIN EXCLUSIVE` for as long as
 * it lives. The operating system drops the lock when the owner dies, however it dies, which is what
 * lets another host tell a live owner from a dead one without any bookkeeping of its own.
 */
export interface ProcessLease {
    readonly processId: string;
    readonly file: string;
    /** Rolls back, closes and deletes the lease file. Safe to call twice. */
    release(): void;
}

export interface LeaseRow {
    readonly pid: number;
    readonly hostKind: string;
}

/**
 * Creates `<leases>/<id>.sqlite` so that a file under that name always contains its row: the row is
 * written to `<id>.sqlite.init` and the file is renamed afterwards. The file is left unlocked.
 */
export function createLeaseFile(leasesDir: string, id: string, row: LeaseRow): string {
    mkdirSync(leasesDir, { recursive: true });
    const file = path.join(leasesDir, `${id}${LEASE_SUFFIX}`);
    const initializing = `${file}.init`;
    rmSync(initializing, { force: true });
    const db = new DatabaseSync(initializing);
    try {
        // Not WAL: EXCLUSIVE has to keep readers out, and a WAL reader would not be blocked.
        db.exec('PRAGMA journal_mode=DELETE');
        db.exec('CREATE TABLE lease(pid INTEGER, host_kind TEXT, started_at TEXT)');
        db.prepare('INSERT INTO lease(pid, host_kind, started_at) VALUES (?, ?, ?)').run(row.pid, row.hostKind, new Date().toISOString());
    } finally {
        db.close();
    }
    renameSync(initializing, file);
    return file;
}

/**
 * Takes this process's lease on a project. The gap between the rename in {@link createLeaseFile} and
 * `BEGIN EXCLUSIVE` is covered by the pid check of the probe.
 */
export function acquireLease(projectDir: string, hostKind: string, id: string = processId): ProcessLease {
    const layout = ProjectLayout.of(projectDir);
    const held = (): IvoryStoreError => new IvoryStoreError('already-open', `the lease ${id} on ${layout.projectDir} is already held`);
    // Renaming over a lease that is held would either fail, on Windows, or leave its holder locking a file that is no longer there.
    if (isHeld(path.join(layout.leases, `${id}${LEASE_SUFFIX}`))) {
        throw held();
    }
    let file: string;
    try {
        file = createLeaseFile(layout.leases, id, { pid: process.pid, hostKind });
    } catch (error) {
        throw ['EPERM', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '') ? held() : error;
    }
    const db = new DatabaseSync(file, { timeout: 0 });
    try {
        db.exec('BEGIN EXCLUSIVE');
    } catch {
        db.close();
        throw held();
    }
    let released = false;
    return {
        processId: id,
        file,
        release: () => {
            if (released) {
                return;
            }
            released = true;
            try {
                if (db.isTransaction) {
                    db.exec('ROLLBACK');
                }
            } finally {
                db.close();
            }
            try {
                unlinkSync(file);
            } catch {
                // A dead lease is swept by the next host that opens the project.
            }
        }
    };
}

type ProbeResult = 'alive' | 'malformed' | 'dead';

/**
 * Sweeps the leases of dead hosts: their staging files first, while the probe lock is still held,
 * then the lease file. A lease that is held, whose pid is alive, or that has no row is left alone.
 */
export function recoverDeadLeases(projectDir: string, ownProcessId: string): RecoveryReport {
    const layout = ProjectLayout.of(projectDir);
    const swept: string[] = [];
    const skippedAlive: string[] = [];
    const malformed: string[] = [];
    const deferred: string[] = [];
    let names: string[];
    try {
        names = readdirSync(layout.leases);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return { swept, skippedAlive, malformed, deferred };
        }
        throw error;
    }
    for (const name of names.filter(candidate => candidate.endsWith(LEASE_SUFFIX)).sort()) {
        const id = name.slice(0, -LEASE_SUFFIX.length);
        if (id === ownProcessId) {
            continue;
        }
        const file = path.join(layout.leases, name);
        const db = openForProbe(file);
        if (!db) {
            malformed.push(id);
            continue;
        }
        let closed = false;
        try {
            const result = probe(db);
            if (result === 'alive') {
                skippedAlive.push(id);
            } else if (result === 'malformed') {
                malformed.push(id);
            } else if (!removeStagingFiles(layout.casStaging, id)) {
                deferred.push(id);
            } else {
                db.exec('ROLLBACK');
                db.close();
                closed = true;
                try {
                    unlinkSync(file);
                    swept.push(id);
                } catch {
                    deferred.push(id);
                }
            }
        } finally {
            if (!closed) {
                try {
                    if (db.isTransaction) {
                        db.exec('ROLLBACK');
                    }
                } finally {
                    db.close();
                }
            }
        }
    }
    return { swept, skippedAlive, malformed, deferred };
}

/** True when the lease file exists and something holds its lock. */
function isHeld(file: string): boolean {
    const db = existsSync(file) ? openForProbe(file) : undefined;
    if (!db) {
        return false;
    }
    try {
        db.exec('BEGIN EXCLUSIVE');
        db.exec('ROLLBACK');
        return false;
    } catch (error) {
        return (error as { errcode?: number }).errcode === SQLITE_BUSY;
    } finally {
        db.close();
    }
}

function openForProbe(file: string): DatabaseSync | undefined {
    try {
        return new DatabaseSync(file, { timeout: 0 });
    } catch {
        return undefined;
    }
}

/** Leaves the database inside the exclusive transaction when it reports `dead`, so the caller sweeps under the lock. */
function probe(db: DatabaseSync): ProbeResult {
    try {
        db.exec('BEGIN EXCLUSIVE');
    } catch (error) {
        return (error as { errcode?: number }).errcode === SQLITE_BUSY ? 'alive' : 'malformed';
    }
    let pid: unknown;
    try {
        const rows = db.prepare('SELECT pid FROM lease').all();
        pid = rows.length === 1 ? rows[0].pid : undefined;
    } catch {
        return 'malformed';
    }
    if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
        return 'malformed';
    }
    return isProcessGone(pid) ? 'dead' : 'alive';
}

/**
 * Only a pid that does not exist proves the owner is gone. A pid that exists may belong to a reused pid or
 * to a live process that lost its lease, and both are left alone.
 */
function isProcessGone(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return false;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'ESRCH';
    }
}

/** True when nothing of the dead owner's is left in the staging directory. */
function removeStagingFiles(stagingDir: string, deadId: string): boolean {
    let names: string[];
    try {
        names = readdirSync(stagingDir);
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'ENOENT';
    }
    let clean = true;
    for (const name of names.filter(candidate => candidate.startsWith(`${deadId}-`))) {
        try {
            unlinkSync(path.join(stagingDir, name));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                clean = false;
            }
        }
    }
    return clean;
}
