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
 * The observer of a kill run: an `mcp` host that calls `head()` at 10 Hz for the whole run and streams what it saw to the
 * parent, which checks it against the final log (P1). Arguments: project directory.
 */

import { openProjectStore } from '@ivory/core/lib/node';

const SAMPLE_INTERVAL_MS = 100;

async function main(): Promise<void> {
    const [projectDir] = process.argv.slice(2);
    const store = await openProjectStore(projectDir, { hostKind: 'mcp', readOnly: true });
    let samples = 0;
    let errors = 0;
    let pending = false;
    const timer = setInterval(() => {
        if (pending) {
            return;
        }
        pending = true;
        store.head().then(head => {
            samples++;
            if (head) {
                process.send?.({ type: 'obs', seq: head.seq, digest: head.digest, t: Date.now() });
            }
        }, error => {
            errors++;
            process.send?.({ type: 'obs-error', message: (error as Error).message, t: Date.now() });
        }).finally(() => {
            pending = false;
        });
    }, SAMPLE_INTERVAL_MS);
    process.on('message', (message: { type?: string }) => {
        if (message.type === 'stop') {
            clearInterval(timer);
            store.close().then(() => {
                process.send?.({ type: 'stopped', samples, errors }, () => process.exit(0));
            });
        }
    });
    process.on('disconnect', () => process.exit(0));
    process.send?.({ type: 'ready', processId: store.processId, pid: process.pid });
}

main().catch(error => {
    console.error(error);
    process.exit(3);
});
