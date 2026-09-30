// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { DatabaseSync } from 'node:sqlite';
import { IvoryStoreError } from '../../common/store-protocol';
import { busyAsSentinel, retryWhileBusy, runImmediateTransaction } from './write-queue';

export const SCHEMA_VERSION = 1;

const SCHEMA_V1 = [
    'CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT',
    `CREATE TABLE commits (
        seq INTEGER PRIMARY KEY,
        prev_digest TEXT NOT NULL,
        digest TEXT NOT NULL UNIQUE,
        receipt_digest TEXT NOT NULL,
        principal_key TEXT NOT NULL,
        idem_key TEXT NOT NULL,
        request_digest TEXT NOT NULL,
        library_build TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        UNIQUE (principal_key, idem_key)
    ) STRICT`,
    `CREATE TABLE blob_refs (
        digest TEXT NOT NULL,
        commit_seq INTEGER NOT NULL REFERENCES commits(seq),
        PRIMARY KEY (digest, commit_seq)
    ) STRICT`,
    'CREATE INDEX blob_refs_digest ON blob_refs(digest)'
];

/** The one connection that writes. Only the store worker opens it. */
export async function openWriteConnection(file: string, busyTimeoutMs: number, writerBusyBoundMs: number): Promise<DatabaseSync> {
    const db = new DatabaseSync(file, { timeout: busyTimeoutMs, enableForeignKeyConstraints: true });
    try {
        const pragmas = await retryWhileBusy(() => busyAsSentinel(() => {
            db.exec('PRAGMA journal_mode=WAL');
            db.exec('PRAGMA synchronous=FULL');
        }), writerBusyBoundMs);
        if (pragmas.busy) {
            throw new IvoryStoreError('writer-busy', `${file} stayed locked for ${writerBusyBoundMs} ms while it was opened`);
        }
        return db;
    } catch (error) {
        db.close();
        throw error;
    }
}

/** The one connection that reads. Every read the store serves goes through it, never through the write connection. */
export function openReadConnection(file: string, busyTimeoutMs: number): DatabaseSync {
    try {
        return new DatabaseSync(file, { readOnly: true, timeout: busyTimeoutMs });
    } catch (error) {
        throw new IvoryStoreError('store-mismatch', `${file} cannot be opened for reading: ${(error as Error).message}`);
    }
}

/** Creates schema v1 in a store without one, and checks that an existing one is v1 and belongs to `projectId`. */
export async function ensureSchema(db: DatabaseSync, projectId: string, writerBusyBoundMs: number): Promise<void> {
    const result = await runImmediateTransaction(db, () => {
        if (!hasMeta(db)) {
            for (const statement of SCHEMA_V1) {
                db.exec(statement);
            }
            const insert = db.prepare('INSERT INTO meta(key, value) VALUES (?, ?)');
            insert.run('schema_version', String(SCHEMA_VERSION));
            insert.run('project_id', projectId);
        } else {
            assertMeta(db, projectId);
        }
        return { commit: true, value: undefined };
    }, writerBusyBoundMs);
    if (result.busy) {
        throw new IvoryStoreError('writer-busy', `the store stayed locked for ${writerBusyBoundMs} ms while its schema was checked`);
    }
}

/** Checks that a store opened for reading has schema v1 and belongs to `projectId`. */
export function assertStoreMatches(db: DatabaseSync, projectId: string): void {
    if (!hasMeta(db)) {
        throw new IvoryStoreError('store-mismatch', 'store.sqlite has no schema');
    }
    assertMeta(db, projectId);
}

function hasMeta(db: DatabaseSync): boolean {
    return db.prepare('SELECT 1 AS present FROM sqlite_master WHERE type = \'table\' AND name = \'meta\'').get() !== undefined;
}

function assertMeta(db: DatabaseSync, projectId: string): void {
    const version = metaValue(db, 'schema_version');
    if (version !== String(SCHEMA_VERSION)) {
        throw new IvoryStoreError('unsupported-schema', `store.sqlite has schema version ${version ?? 'none'}, this build reads ${SCHEMA_VERSION}`);
    }
    const stored = metaValue(db, 'project_id');
    if (stored !== projectId) {
        throw new IvoryStoreError('store-mismatch', `store.sqlite belongs to project ${stored ?? 'none'}, the manifest says ${projectId}`);
    }
}

function metaValue(db: DatabaseSync, key: string): string | undefined {
    const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
    return row === undefined ? undefined : String(row.value);
}
