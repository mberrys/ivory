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
import { promises as fs } from 'fs';
import { IvoryStoreError } from '../common/store-protocol';
import { connectCore, startOrAttachCore } from './core-client';
import { MAX_BLOB_BYTES } from './core-protocol';
import { initProject } from './project-layout';

async function main(args: string[]): Promise<void> {
    const [command, projectDir, argument, expectedDigest] = args;
    if (!command || !projectDir) {
        throw new IvoryStoreError('invalid-argument', 'usage: core-cli init|start|status|admit|stop PROJECT [PROJECT_ID|FILE] [SHA256]');
    }
    if (command === 'init') {
        if (!argument || args.length !== 3) {
            throw new IvoryStoreError('invalid-argument', 'usage: core-cli init PROJECT PROJECT_ID');
        }
        process.stdout.write(JSON.stringify(await initProject(projectDir, { projectId: argument })) + '\n');
        return;
    }
    if (!['start', 'status', 'admit', 'stop'].includes(command) || (command !== 'admit' && args.length !== 2)) {
        throw new IvoryStoreError('invalid-argument', 'invalid Core command');
    }
    if (command === 'admit' && (!argument || args.length > 4 || (expectedDigest !== undefined && !Sha256Digest.is(expectedDigest)))) {
        throw new IvoryStoreError('invalid-argument', 'usage: core-cli admit PROJECT FILE [sha256:DIGEST]');
    }
    const core = command === 'start' || command === 'admit' ? await startOrAttachCore(projectDir) : await connectCore(projectDir);
    try {
        if (command === 'admit' && argument) {
            const handle = await fs.open(argument, 'r');
            let bytes: Buffer;
            try {
                const info = await handle.stat();
                if (!info.isFile() || info.size > MAX_BLOB_BYTES) {
                    throw new IvoryStoreError('invalid-argument', 'the Core admits regular files of at most 8 MiB');
                }
                bytes = await handle.readFile();
            } finally {
                await handle.close();
            }
            const digest = await core.admitBlob(bytes, Sha256Digest.is(expectedDigest) ? expectedDigest : undefined);
            process.stdout.write(JSON.stringify({ digest, byteLength: bytes.length, epoch: core.writerEpoch }) + '\n');
        } else if (command === 'stop') {
            await core.stop();
            process.stdout.write(JSON.stringify({ stopped: true, epoch: core.writerEpoch }) + '\n');
        } else {
            process.stdout.write(JSON.stringify({ ...core.identity, headSeq: await core.headSeq() }) + '\n');
        }
    } finally {
        await core.close();
    }
}

main(process.argv.slice(2)).catch(error => {
    process.stderr.write(JSON.stringify(storeProtocolError(error)) + '\n');
    process.exitCode = 1;
});

function storeProtocolError(error: unknown): { code: string; message: string } {
    return error instanceof IvoryStoreError ? { code: error.code, message: error.message } : { code: 'core-unavailable', message: 'Core command failed' };
}
