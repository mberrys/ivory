// *****************************************************************************
// Copyright (C) 2026 Berry Studio and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0.
//
// This Source Code may also be made available under the Secondary Licenses
// set forth in the Eclipse Public License v. 2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { createHash } from 'node:crypto';

/** A small RFC-8785-shaped canonical JSON encoder for the kernel's JSON data model. */
export function canonicalize(value: unknown): string {
    // eslint-disable-next-line no-null/no-null
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error('canonical JSON cannot contain a non-finite number');
        }
        return Object.is(value, -0) ? '0' : JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(item => canonicalize(item)).join(',')}]`;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, item]) => item !== undefined)
            .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
        return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(',')}}`;
    }
    throw new Error(`canonical JSON cannot contain ${typeof value}`);
}

export function digestCanonical(value: unknown): string {
    return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}

export function digestBytes(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

export function deterministicId(prefix: string, value: unknown): string {
    return `${prefix}_${digestCanonical(value).slice(0, 32)}`;
}

export function encodeBytes(bytes: Uint8Array | string): string {
    return typeof bytes === 'string' ? Buffer.from(bytes, 'utf8').toString('base64') : Buffer.from(bytes).toString('base64');
}

export function decodeBytes(encoded: string): Uint8Array {
    return new Uint8Array(Buffer.from(encoded, 'base64'));
}
