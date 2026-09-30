// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { writeFileSync } from 'fs';
import { StoreFailpoint, StoreFailpointConfig } from '../../../common/store-protocol';

let configured: StoreFailpointConfig | undefined;
let hits = 0;

/** Arms the failpoint of this thread's module instance. The store worker calls it once, with what `openProjectStore` was given. */
export function configureFailpoint(config: StoreFailpointConfig | undefined): void {
    configured = config;
    hits = 0;
}

/**
 * A place where the qualification harness may kill the host. Does nothing unless `name` is the configured failpoint.
 * On hit number `afterHits` it writes the marker file synchronously and kills the whole process with SIGKILL, from
 * whichever thread it runs on.
 */
export function failpoint(name: StoreFailpoint): void {
    if (configured === undefined || configured.name !== name || ++hits !== configured.afterHits) {
        return;
    }
    writeFileSync(configured.markerFile, JSON.stringify({ name, pid: process.pid }));
    process.kill(process.pid, 'SIGKILL');
    // The kill may take a moment to land, and nothing after the failpoint may run in the meantime.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30_000);
}
