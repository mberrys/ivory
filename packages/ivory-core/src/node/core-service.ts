// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { randomBytes, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { IvoryStoreError, StoreProtocol } from '../common/store-protocol';
import { CoreCommand, CoreDescriptor, CoreIdentity, CORE_FORMAT, decodeBlob, MAX_MESSAGE_BYTES, parseCoreCommand } from './core-protocol';
import { fsyncDirectory } from './durable-fs';
import { ProjectLayout, readManifest } from './project-layout';
import { OpenProjectStoreOptions, openProjectStore } from './store-host';

export interface CoreService {
    readonly identity: CoreIdentity;
    close(): Promise<void>;
}

/** Product clients attach to this owner instead of opening another writable store. */
export async function startCoreService(projectDir: string, options: OpenProjectStoreOptions = {}): Promise<CoreService> {
    const manifest = await readManifest(projectDir);
    if (manifest.role !== 'live' || options.readOnly) {
        throw new IvoryStoreError('read-only-project', 'a headless Core requires a live project');
    }
    const layout = ProjectLayout.of(await fs.realpath(projectDir));
    const store = await openProjectStore(layout.projectDir, { ...options, hostKind: 'headless-core' });
    if (store.writerEpoch === undefined) {
        await store.close();
        throw new IvoryStoreError('writer-owned', 'the Core did not acquire ownership');
    }
    const identity: CoreIdentity = {
        format: CORE_FORMAT, projectId: manifest.projectId, storeInstanceId: manifest.storeInstanceId,
        projectDir: layout.projectDir,
        epoch: store.writerEpoch, pid: process.pid, processId: store.processId
    };
    const token = randomBytes(32).toString('hex');
    let closing: Promise<void> | undefined;
    const close = (): Promise<void> => closing ??= shutdown();
    const server = createServer((request, response) => {
        handle(request, response).catch(() => response.destroy());
    });
    server.requestTimeout = 15_000;
    server.headersTimeout = 10_000;
    server.keepAliveTimeout = 1000;
    const temporary = layout.coreDiscovery + '.' + identity.epoch + '.tmp';

    async function shutdown(): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
            server.closeAllConnections();
        }).catch(() => undefined);
        // Retire discovery before releasing ownership: an old owner must never unlink its successor's record.
        try {
            await fs.rm(layout.coreDiscovery, { force: true });
            await fsyncDirectory(layout.projectDir);
        } finally {
            await store.close();
        }
    }

    async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const supplied = Buffer.from(request.headers.authorization ?? '');
        const expected = Buffer.from('Bearer ' + token);
        if (request.method !== 'POST' || request.url !== '/core' || request.headers.host !== '127.0.0.1:' + descriptor.port
            || request.headers.origin !== undefined || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)
            || request.headers['x-ivory-epoch'] !== identity.epoch || closing) {
            response.writeHead(403, { Connection: 'close' }).end();
            return;
        }
        try {
            let length = 0;
            const chunks: Buffer[] = [];
            for await (const chunk of request) {
                const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                length += bytes.length;
                if (length > MAX_MESSAGE_BYTES) {
                    response.writeHead(413, { Connection: 'close' }).end();
                    return;
                }
                chunks.push(bytes);
            }
            const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const command = parseCoreCommand(input);
            const result = await execute(command);
            response.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' });
            if (command.op === 'stop') {
                response.once('finish', () => close().catch(() => undefined));
            }
            // eslint-disable-next-line no-null/no-null -- JSON requires a concrete absent-result value.
            response.end(JSON.stringify({ epoch: identity.epoch, ok: true, result: result ?? null }));
        } catch (error) {
            response.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' });
            const failure = error instanceof SyntaxError ? new IvoryStoreError('invalid-argument', 'invalid command JSON') : error;
            response.end(JSON.stringify({ epoch: identity.epoch, ok: false, error: StoreProtocol.errorPayload(failure) }));
        }
    }

    async function execute(command: CoreCommand): Promise<unknown> {
        switch (command.op) {
            case 'status': return { identity, headSeq: await store.headSeq(), recovery: store.openRecovery };
            case 'admitBlob': return store.admitBlob(decodeBlob(command.bytes), command.expectedDigest);
            case 'readBlob': return Buffer.from(await store.readBlob(command.digest)).toString('base64');
            case 'commit': return store.commit(command.request);
            case 'gc': return store.gc({ graceMs: command.graceMs });
            case 'head': return store.head();
            case 'receiptFor': return store.receiptFor(command.principal, command.idempotencyKey);
            case 'verifyChain': return store.verifyChain();
            case 'recover': return store.recover();
            case 'stop': return undefined;
            default: {
                const exhaustive: never = command;
                throw new Error('unhandled Core command ' + String(exhaustive));
            }
        }
    }

    let descriptor: CoreDescriptor;
    try {
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                server.off('error', reject);
                resolve();
            });
        });
        const address = server.address();
        if (!address || typeof address === 'string') {
            throw new IvoryStoreError('core-unavailable', 'no local Core endpoint was assigned');
        }
        descriptor = { ...identity, port: address.port, token };
        const discoveryHandle = await fs.open(temporary, 'wx', 0o600);
        try {
            await discoveryHandle.writeFile(JSON.stringify(descriptor) + '\n');
            await discoveryHandle.sync();
        } finally {
            await discoveryHandle.close();
        }
        await fs.rename(temporary, layout.coreDiscovery);
        await fsyncDirectory(layout.projectDir);
        return { identity, close };
    } catch (error) {
        server.close();
        server.closeAllConnections();
        await fs.rm(temporary, { force: true }).catch(() => undefined);
        await store.close();
        throw error;
    }
}
