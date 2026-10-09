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
import * as path from 'path';
import { CommitRequest, IvoryStoreError, IvoryStoreErrorCode, StoreProtocol } from '../common/store-protocol';

export const CORE_FORMAT = 'ivory-core-service@1';
export const MAX_BLOB_BYTES = 8 * 1024 * 1024;
export const MAX_MESSAGE_BYTES = 12 * 1024 * 1024;

export interface CoreIdentity {
    readonly format: typeof CORE_FORMAT;
    readonly projectId: string;
    readonly storeInstanceId: string;
    readonly projectDir: string;
    readonly epoch: string;
    readonly processId: string;
    readonly pid: number;
}

/** Same-user bootstrap capability; never send the token in a status response or a log. */
export interface CoreDescriptor extends CoreIdentity {
    readonly port: number;
    readonly token: string;
}

export type CoreCommand =
    | { readonly op: 'status' | 'head' | 'verifyChain' | 'recover' | 'stop' }
    | { readonly op: 'admitBlob'; readonly bytes: string; readonly expectedDigest?: Sha256Digest }
    | { readonly op: 'readBlob'; readonly digest: Sha256Digest }
    | { readonly op: 'commit'; readonly request: CommitRequest }
    | { readonly op: 'gc'; readonly graceMs: number }
    | { readonly op: 'receiptFor'; readonly principal: string; readonly idempotencyKey: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && !!value && !Array.isArray(value);
}

export function parseCoreIdentity(value: unknown): CoreIdentity {
    if (!isRecord(value) || value.format !== CORE_FORMAT
        || !StoreProtocol.isIdentifier(value.projectId) || !StoreProtocol.isIdentifier(value.storeInstanceId)
        || typeof value.projectDir !== 'string' || !path.isAbsolute(value.projectDir)
        || typeof value.epoch !== 'string' || !/^[0-9a-f-]{36}$/.test(value.epoch)
        || typeof value.processId !== 'string' || !/^[0-9a-f]{32}$/.test(value.processId)
        || typeof value.pid !== 'number' || !Number.isSafeInteger(value.pid) || value.pid <= 0) {
        throw new IvoryStoreError('invalid-core-response', 'invalid Core identity');
    }
    return {
        format: CORE_FORMAT, projectId: value.projectId, storeInstanceId: value.storeInstanceId, projectDir: value.projectDir,
        epoch: value.epoch, processId: value.processId, pid: value.pid
    };
}

export function parseCoreDescriptor(value: unknown): CoreDescriptor {
    const identity = parseCoreIdentity(value);
    if (!isRecord(value) || typeof value.port !== 'number' || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535
        || typeof value.token !== 'string' || !/^[0-9a-f]{64}$/.test(value.token)) {
        throw new IvoryStoreError('invalid-core-response', 'invalid Core discovery record');
    }
    return { ...identity, port: value.port, token: value.token };
}

export function decodeBlob(value: unknown): Buffer {
    if (typeof value !== 'string' || value.length > Math.ceil(MAX_BLOB_BYTES / 3) * 4
        || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
        throw new IvoryStoreError('invalid-argument', 'invalid or oversized base64 bytes');
    }
    const bytes = Buffer.from(value, 'base64');
    if (bytes.length > MAX_BLOB_BYTES || bytes.toString('base64') !== value) {
        throw new IvoryStoreError('invalid-argument', 'invalid or oversized base64 bytes');
    }
    return bytes;
}

export function parseCoreCommand(value: unknown): CoreCommand {
    if (!isRecord(value)) {
        throw new IvoryStoreError('invalid-argument', 'a Core command must be an object');
    }
    switch (value.op) {
        case 'status': case 'head': case 'verifyChain': case 'recover': case 'stop':
            return { op: value.op };
        case 'admitBlob': {
            decodeBlob(value.bytes);
            if (typeof value.bytes === 'string' && (value.expectedDigest === undefined || Sha256Digest.is(value.expectedDigest))) {
                return { op: value.op, bytes: value.bytes, expectedDigest: value.expectedDigest };
            }
            break;
        }
        case 'readBlob':
            if (Sha256Digest.is(value.digest)) {
                return { op: value.op, digest: value.digest };
            }
            break;
        case 'commit': {
            const request = value.request;
            if (isRecord(request) && StoreProtocol.isIdentifier(request.kind) && StoreProtocol.isIdentifier(request.principal)
                && StoreProtocol.isIdentifier(request.idempotencyKey) && 'input' in request) {
                return {
                    op: value.op,
                    request: { kind: request.kind, input: request.input, principal: request.principal, idempotencyKey: request.idempotencyKey }
                };
            }
            break;
        }
        case 'gc':
            if (typeof value.graceMs === 'number' && Number.isSafeInteger(value.graceMs) && value.graceMs >= 0) {
                return { op: value.op, graceMs: value.graceMs };
            }
            break;
        case 'receiptFor':
            if (StoreProtocol.isIdentifier(value.principal) && StoreProtocol.isIdentifier(value.idempotencyKey)) {
                return { op: value.op, principal: value.principal, idempotencyKey: value.idempotencyKey };
            }
            break;
    }
    throw new IvoryStoreError('invalid-argument', 'invalid Core command');
}

const ERROR_CODES: readonly IvoryStoreErrorCode[] = [
    'invalid-manifest', 'project-exists', 'store-mismatch', 'unsupported-schema', 'already-open', 'writer-owned',
    'store-closed', 'worker-failed', 'duplicate-handler', 'invalid-handler-module', 'handler-not-synchronous',
    'handler-transaction-control', 'cas-corrupt', 'digest-mismatch', 'blob-missing', 'blob-unreferenced',
    'core-unavailable', 'invalid-core-response', 'read-only-project', 'writer-busy', 'invalid-argument'
];

export function parseCoreError(value: unknown): IvoryStoreError {
    if (isRecord(value) && typeof value.message === 'string') {
        const code = ERROR_CODES.find(candidate => candidate === value.code);
        if (code !== undefined) {
            return new IvoryStoreError(code, value.message);
        }
    }
    return new IvoryStoreError('invalid-core-response', 'invalid Core error response');
}
