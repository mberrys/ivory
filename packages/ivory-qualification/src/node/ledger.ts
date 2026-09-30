// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { createHash } from 'crypto';
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync } from 'fs';
import * as path from 'path';

/** What the evidence record says about a ledger file. */
export interface LedgerSummary {
    readonly file: string;
    readonly rows: number;
    readonly sha256: string;
}

/**
 * A JSONL file with one row per event. Rows are written as they happen and flushed to stable storage every 50 rows and at the end,
 * so a run that dies still leaves its rows behind.
 */
export class Ledger {
    static readonly FLUSH_EVERY = 50;

    protected readonly fd: number;
    protected count = 0;
    protected closed = false;

    constructor(readonly file: string) {
        mkdirSync(path.dirname(file), { recursive: true });
        this.fd = openSync(file, 'w');
    }

    get rows(): number {
        return this.count;
    }

    append(row: object): void {
        writeSync(this.fd, `${JSON.stringify(row)}\n`);
        if (++this.count % Ledger.FLUSH_EVERY === 0) {
            fsyncSync(this.fd);
        }
    }

    /** Flushes and closes the file. The digest covers the final bytes. */
    close(): LedgerSummary {
        if (!this.closed) {
            this.closed = true;
            fsyncSync(this.fd);
            closeSync(this.fd);
        }
        return { file: path.basename(this.file), rows: this.count, sha256: createHash('sha256').update(readFileSync(this.file)).digest('hex') };
    }
}
