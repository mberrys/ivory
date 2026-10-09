// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { StoreProtocol } from '../../../common/store-protocol';
import { startOrAttachCore } from '../../core-client';
import { startCoreService } from '../../core-service';
import { testHandlerModule } from '../../test/spec-helpers';

async function main(): Promise<void> {
    const [projectDir, kind] = process.argv.slice(2);
    const core = kind === 'client' ? await startOrAttachCore(projectDir) : await startCoreService(projectDir, { handlerModules: [testHandlerModule] });
    const release = (): void => {
        core.close().then(() => process.exit(0), () => process.exit(3));
    };
    process.on('message', (message: unknown) => {
        if (typeof message === 'object' && message && 'type' in message && message.type === 'release') {
            release();
        }
    });
    process.on('disconnect', release);
    process.send?.({ type: 'ready', identity: core.identity });
}

main().catch(error => {
    process.send?.({ type: 'failed', error: StoreProtocol.errorPayload(error) }, () => process.exit(3));
});
