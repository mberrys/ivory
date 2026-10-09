// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { StoreProtocol } from '../common/store-protocol';
import { startCoreService } from './core-service';

async function main(): Promise<void> {
    const [projectDir] = process.argv.slice(2);
    if (!projectDir) {
        throw new Error('a project directory is required');
    }
    const core = await startCoreService(projectDir);
    const stop = (): void => {
        core.close().then(() => { process.exitCode = 0; }, () => { process.exitCode = 1; });
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    if (process.connected) {
        process.send?.({ type: 'ready' }, () => {
            if (process.connected) {
                process.disconnect();
            }
        });
    }
}

main().catch(error => {
    if (process.connected) {
        process.send?.({ type: 'failed', error: StoreProtocol.errorPayload(error) }, () => {
            if (process.connected) {
                process.disconnect();
            }
            process.exitCode = 1;
        });
    } else {
        process.stderr.write('Core startup failed\n');
        process.exitCode = 1;
    }
});
