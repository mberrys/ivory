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
 * A child process that plays another host: it holds a lease on the project and has a staging file tagged with its process id.
 * It sends `ready` with its process id, and exits on `release` or when its parent goes away.
 */

import { writeFileSync } from 'fs';
import * as path from 'path';
import { acquireLease, processId } from '../process-lease';

const [projectDir] = process.argv.slice(2);
const lease = acquireLease(projectDir, 'test-child');
writeFileSync(path.join(projectDir, 'cas', 'tmp', `${processId}-x.tmp`), 'staged');

function release(): void {
    lease.release();
    process.exit(0);
}

process.on('message', (message: { type?: string }) => {
    if (message.type === 'release') {
        release();
    }
});
process.on('disconnect', release);
process.send?.({ type: 'ready', processId });
