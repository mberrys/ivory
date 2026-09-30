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
 * A child process that plays a host with a failpoint: it admits a blob and commits it, key after key, until the failpoint kills it.
 * Arguments: project directory, failpoint name, hit number, marker file.
 */

import { createHash } from 'crypto';
import { StoreFailpoint } from '../../../common/store-protocol';
import { openProjectStore } from '../../store-host';
import { qualificationHandlerModule } from '../qualification/qualification-handler-module';

async function main(): Promise<void> {
    const [projectDir, name, afterHits, markerFile] = process.argv.slice(2);
    const store = await openProjectStore(projectDir, {
        hostKind: 'test-child',
        handlerModules: [qualificationHandlerModule],
        qualification: { failpoint: { name: name as StoreFailpoint, afterHits: Number(afterHits), markerFile } }
    });
    process.on('disconnect', () => process.exit(0));
    process.send?.({ type: 'ready', processId: store.processId });
    for (let i = 0; ; i++) {
        const key = `k${i}`;
        const blob = await store.admitBlob(createHash('sha256').update(key).digest());
        await store.commit({ kind: 'qual.put', input: { key, blob }, principal: 'qual', idempotencyKey: key });
        process.send?.({ type: 'ack', key });
    }
}

main().catch(error => {
    console.error(error);
    process.exit(3);
});
