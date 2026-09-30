// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { CommitHandler, CommitTransaction } from '../store/commit-handler';

/**
 * A handler that breaks the rule. It is built without `defineCommitHandler`, which would not let it compile, and it
 * is not named `*-handlers.ts`, which the lint rule would refuse. It writes a row, awaits, and only then writes another.
 */
const asyncWrite = {
    kind: 'test.async',
    parse: (input: unknown) => input,
    apply: async (tx: CommitTransaction) => {
        tx.run('CREATE TABLE IF NOT EXISTS test_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT');
        tx.run('INSERT INTO test_kv(key, value) VALUES (\'async\', \'before-await\')');
        await Promise.resolve();
        tx.run('INSERT INTO test_kv(key, value) VALUES (\'async-late\', \'after-await\')');
        return 'done';
    }
};

export const commitHandlers: CommitHandler[] = [asyncWrite as unknown as CommitHandler];
