// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { Sha256Digest } from '@ivory/contracts';
import { CommitHandler, defineCommitHandler } from '../commit-handler';

/**
 * The commit kinds of the qualification harness (IV5-6). They are for qualification runs only, and no product host loads them.
 */

const MAX_HOLD_MS = 10_000;

const CREATE_TABLE = 'CREATE TABLE IF NOT EXISTS qual_kv (key TEXT PRIMARY KEY, blob TEXT, seq INTEGER NOT NULL) STRICT';

/** Records a key, and the blob it stands for, at the commit's sequence number. */
const put = defineCommitHandler({
    kind: 'qual.put',
    parse: (input: unknown) => {
        const { key, blob } = (input ?? {}) as { key?: unknown; blob?: unknown };
        if (typeof key !== 'string' || !key) {
            throw new Error('a qual.put has a non-empty string key');
        }
        if (blob !== undefined && !Sha256Digest.is(blob)) {
            throw new Error('the blob of a qual.put is a sha256 digest');
        }
        return { key, blob };
    },
    apply: (tx, input) => {
        tx.run(CREATE_TABLE);
        if (input.blob === undefined) {
            tx.run('INSERT INTO qual_kv(key, seq) VALUES (?, ?)', input.key, tx.seq);
        } else {
            tx.requireBlob(input.blob);
            tx.run('INSERT INTO qual_kv(key, blob, seq) VALUES (?, ?, ?)', input.key, input.blob, tx.seq);
        }
        return { key: input.key, seq: tx.seq };
    }
});

/** Holds the write lock for `ms`, the way a long transaction of a CLI host does, by blocking inside `apply`. */
const hold = defineCommitHandler({
    kind: 'qual.hold',
    parse: (input: unknown) => {
        const { ms } = (input ?? {}) as { ms?: unknown };
        if (typeof ms !== 'number' || !Number.isInteger(ms) || ms < 0 || ms > MAX_HOLD_MS) {
            throw new Error(`a qual.hold has an integer ms from 0 to ${MAX_HOLD_MS}`);
        }
        return { ms };
    },
    apply: (_tx, input) => {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, input.ms);
        return { held: input.ms };
    }
});

export const commitHandlers: CommitHandler[] = [put, hold];
