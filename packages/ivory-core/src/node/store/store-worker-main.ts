// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { parentPort, workerData } from 'worker_threads';
import { StoreProtocol, StoreRequest, StoreResponse, StoreWorkerData, StoreWorkerEvent } from '../../common/store-protocol';
import { StoreRuntime } from './store-runtime';

/**
 * The entry point of the store worker thread. It speaks only messages: requests `{id, op, args}` in,
 * responses `{id, ok, result | error}` and change notices out. A refusal is a result, not an error.
 */

const port = parentPort;

function post(message: StoreResponse | StoreWorkerEvent): void {
    port?.postMessage(message);
}

async function serve(runtime: StoreRuntime, request: StoreRequest): Promise<unknown> {
    const args = request.args as { bytes?: Uint8Array; graceMs?: number; request?: unknown; principal?: unknown; idempotencyKey?: unknown } | undefined;
    switch (request.op) {
        case 'commit':
            return runtime.commit(args?.request);
        case 'admitBlob':
            return runtime.admitBlob(args?.bytes ?? new Uint8Array());
        case 'gc':
            return runtime.gc(args?.graceMs ?? StoreProtocol.DEFAULT_GC_GRACE_MS);
        case 'headSeq':
            return runtime.headSeq();
        case 'head':
            return runtime.head();
        case 'receiptFor':
            return runtime.receiptFor(args?.principal, args?.idempotencyKey);
        case 'verifyChain':
            return runtime.verifyChain();
        case 'recover':
            return runtime.recover();
        case 'close':
            await runtime.close();
            return undefined;
        default:
            throw new Error(`unknown store operation ${String(request.op)}`);
    }
}

async function main(): Promise<void> {
    const data = workerData as StoreWorkerData;
    let opened: Awaited<ReturnType<typeof StoreRuntime.open>>;
    try {
        opened = await StoreRuntime.open(data, seq => post({ type: 'advanced', seq }));
    } catch (error) {
        post({ type: 'startup-failed', error: StoreProtocol.errorPayload(error) });
        return;
    }
    const { runtime, recovery } = opened;
    port?.on('message', (request: StoreRequest) => {
        serve(runtime, request).then(
            result => post({ id: request.id, ok: true, result }),
            error => post({ id: request.id, ok: false, error: StoreProtocol.errorPayload(error) })
        ).catch(() => undefined);
    });
    post({ type: 'ready', recovery });
}

main().catch(error => post({ type: 'startup-failed', error: StoreProtocol.errorPayload(error) }));
