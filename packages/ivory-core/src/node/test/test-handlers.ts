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
import { StoreRefusal } from '../../common/store-protocol';
import { CommitHandler, defineCommitHandler } from '../store/commit-handler';

const CREATE_TABLE = 'CREATE TABLE IF NOT EXISTS test_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT';

interface PutInput {
    readonly key: string;
    readonly value: string;
}

function parsePut(input: unknown): PutInput {
    const { key, value } = (input ?? {}) as Partial<PutInput>;
    if (typeof key !== 'string' || typeof value !== 'string') {
        throw new Error('a put has a string key and a string value');
    }
    return { key, value };
}

const put = defineCommitHandler({
    kind: 'test.put',
    parse: parsePut,
    apply: (tx, input) => {
        tx.run(CREATE_TABLE);
        tx.run('INSERT OR REPLACE INTO test_kv(key, value) VALUES (?, ?)', input.key, input.value);
        return { key: input.key, seq: tx.seq };
    }
});

const attach = defineCommitHandler({
    kind: 'test.attach',
    parse: (input: unknown) => {
        const { blob } = (input ?? {}) as { blob?: unknown };
        if (!Sha256Digest.is(blob)) {
            throw new Error('an attach names a blob by digest');
        }
        return { blob };
    },
    apply: (tx, input) => {
        tx.requireBlob(input.blob);
        return { blob: input.blob };
    }
});

const refuse = defineCommitHandler({
    kind: 'test.refuse',
    parse: parsePut,
    apply: (tx, input) => {
        tx.run(CREATE_TABLE);
        tx.run('INSERT OR REPLACE INTO test_kv(key, value) VALUES (?, ?)', input.key, input.value);
        throw new StoreRefusal('test-refused', 'refused by the handler', { key: input.key });
    }
});

const explode = defineCommitHandler({
    kind: 'test.explode',
    parse: parsePut,
    apply: (tx, input) => {
        tx.run(CREATE_TABLE);
        tx.run('INSERT OR REPLACE INTO test_kv(key, value) VALUES (?, ?)', input.key, input.value);
        throw new Error('the handler exploded');
    }
});

const endTransaction = defineCommitHandler({
    kind: 'test.end-transaction',
    parse: parsePut,
    apply: tx => {
        tx.run('COMMIT');
        return 'unreachable';
    }
});

const remove = defineCommitHandler({
    kind: 'test.remove',
    parse: (input: unknown) => parsePut({ value: '', ...(input as object) }),
    apply: (tx, input): void => {
        tx.run(CREATE_TABLE);
        tx.run('DELETE FROM test_kv WHERE key = ?', input.key);
    }
});

export const commitHandlers: CommitHandler[] = [put, attach, refuse, explode, endTransaction, remove];
