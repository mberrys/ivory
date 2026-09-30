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
 * The child host of a kill cycle: a `cli` host that admits a blob and commits `qual.put` for key after key until it is killed.
 * Arguments: project directory, JSON {@link KillChildConfig}. It tells the parent about each step over IPC:
 * `intent` before the step, `ack` once `commit` has resolved, which is the client acknowledgement.
 */

import { CommitOutcome, openProjectStore, qualificationHandlerModule } from '@ivory/core/lib/node';
import { Workload } from '../seeded-random';
import { KillChildConfig } from './kill-types';

async function main(): Promise<void> {
    const [projectDir, configJson] = process.argv.slice(2);
    const config = JSON.parse(configJson) as KillChildConfig;
    const store = await openProjectStore(projectDir, {
        hostKind: 'cli',
        handlerModules: [qualificationHandlerModule],
        qualification: { synchronous: config.synchronous, failpoint: config.failpoint }
    });
    process.on('disconnect', () => process.exit(0));
    process.send?.({ type: 'ready', processId: store.processId, pid: process.pid });
    for (let index = 0; ; index++) {
        const key = Workload.key(config.cycle, index);
        process.send?.({ type: 'intent', key, index });
        const blob = await store.admitBlob(Workload.bytes(config.seed, config.cycle, index));
        const outcome = await store.commit({ kind: 'qual.put', input: { key, blob }, principal: 'qual', idempotencyKey: key });
        if (CommitOutcome.isRefusal(outcome)) {
            process.send?.({ type: 'refused', key, refusal: outcome.refusal });
            process.exit(4);
        }
        process.send?.({ type: 'ack', key, seq: outcome.receipt.seq, digest: outcome.receipt.digest, blob });
    }
}

main().catch(error => {
    console.error(error);
    process.exit(3);
});
