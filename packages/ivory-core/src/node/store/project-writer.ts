// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { randomUUID } from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { IvoryStoreError } from '../../common/store-protocol';
import { fsyncDirectory } from '../durable-fs';
import { ProjectLayout } from '../project-layout';

export interface ProjectWriter {
    readonly epoch: string;
    release(): void;
}

/**
 * The permanent lock database must never be replaced or deleted: doing so would let two processes
 * lock different inodes under the same name. PID and discovery records are never evidence of ownership.
 * The main thread holds this OS-backed lock until its store worker has stopped.
 */
export async function acquireProjectWriter(layout: ProjectLayout): Promise<ProjectWriter> {
    const db = new DatabaseSync(layout.writerLock, { timeout: 0 });
    try {
        db.exec('PRAGMA journal_mode=DELETE');
        db.exec('CREATE TABLE IF NOT EXISTS lock_anchor (id INTEGER PRIMARY KEY) STRICT');
        db.exec('BEGIN EXCLUSIVE');
        await fsyncDirectory(layout.projectDir);
    } catch (error) {
        db.close();
        if (error instanceof Error && 'errcode' in error && [5, 6].includes(Number(error.errcode))) {
            throw new IvoryStoreError('writer-owned', 'another Core already owns this project');
        }
        throw error;
    }
    let released = false;
    return {
        epoch: randomUUID(),
        release: () => {
            if (!released) {
                released = true;
                try {
                    db.exec('ROLLBACK');
                } finally {
                    db.close();
                }
            }
        }
    };
}
