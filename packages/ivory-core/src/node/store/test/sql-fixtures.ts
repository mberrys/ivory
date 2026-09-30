// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Raw SQL against a project's store for the specs, kept in `store` so that no SQL leaks out of it.
 */

import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import { ensureSchema } from '../store-schema';

function withDatabase<T>(projectDir: string, readOnly: boolean, action: (db: DatabaseSync) => T): T {
    const db = new DatabaseSync(path.join(projectDir, 'store.sqlite'), { readOnly, timeout: 5000 });
    try {
        return action(db);
    } finally {
        db.close();
    }
}

/** The rows the test handlers wrote, or none when their table was rolled back with the commit that created it. */
export function readKeyValues(projectDir: string): { key: string; value: string }[] {
    return withDatabase(projectDir, true, db => {
        const table = db.prepare('SELECT 1 AS present FROM sqlite_master WHERE name = \'test_kv\'').get();
        return table ? db.prepare('SELECT key, value FROM test_kv ORDER BY key').all() as { key: string; value: string }[] : [];
    });
}

export function countRows(projectDir: string, table: 'commits' | 'blob_refs'): number {
    return withDatabase(projectDir, true, db => Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n));
}

export function countBlobRefs(projectDir: string, digest: string): number {
    return withDatabase(projectDir, true, db => Number(db.prepare('SELECT count(*) AS n FROM blob_refs WHERE digest = ?').get(digest)?.n));
}

export function libraryBuilds(projectDir: string): string[] {
    return withDatabase(projectDir, true, db => db.prepare('SELECT DISTINCT library_build FROM commits').all().map(row => String(row.library_build)));
}

export function tamperReceipt(projectDir: string, seq: number): void {
    withDatabase(projectDir, false, db => db.prepare('UPDATE commits SET receipt_json = ? WHERE seq = ?').run('{"seq":1,"kind":"forged","value":{}}', seq));
}

export function breakPrevDigest(projectDir: string, seq: number): void {
    withDatabase(projectDir, false, db => db.prepare('UPDATE commits SET prev_digest = ? WHERE seq = ?').run(`sha256:${'0'.repeat(64)}`, seq));
}

/** Creates a store of another project where `projectDir`'s store should be. */
export async function writeStoreOfProject(projectDir: string, foreignProjectId: string): Promise<void> {
    const db = new DatabaseSync(path.join(projectDir, 'store.sqlite'));
    try {
        await ensureSchema(db, foreignProjectId, 1000);
    } finally {
        db.close();
    }
}
