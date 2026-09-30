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
 * A child process that plays another host holding the store's write lock. It sends `locked` once it holds
 * `BEGIN IMMEDIATE`, and releases on the `release` message, after `--hold-ms=N`, or when its parent goes away.
 * With `--fake-commit` it has also inserted a commit row that it has not committed.
 */

import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';

const [projectDir, ...flags] = process.argv.slice(2);
const holdMs = flags.map(flag => /^--hold-ms=(\d+)$/.exec(flag)).find(match => match)?.[1];
const db = new DatabaseSync(path.join(projectDir, 'store.sqlite'), { timeout: 5000 });
db.exec('BEGIN IMMEDIATE');
if (flags.includes('--fake-commit')) {
    db.prepare(`INSERT INTO commits(seq, prev_digest, digest, receipt_digest, principal_key, idem_key, request_digest, library_build, receipt_json)
        VALUES (1, 'x', 'sha256:fake', 'y', 'child', 'child', 'z', 'test', '{}')`).run();
}

function release(commit: boolean): void {
    if (db.isTransaction) {
        db.exec(commit ? 'COMMIT' : 'ROLLBACK');
    }
    db.close();
    process.exit(0);
}

process.on('message', (message: { type?: string; commit?: boolean }) => {
    if (message.type === 'release') {
        release(message.commit === true);
    }
});
process.on('disconnect', () => release(false));
if (holdMs !== undefined) {
    setTimeout(() => release(false), Number(holdMs));
}
process.send?.({ type: 'locked' });
