// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { IvoryContractError } from './ivory-contract-error';

// In a `u` regex a surrogate pair reads as one astral code point, so only unpaired halves match.
const LONE_SURROGATE = /\p{Cs}/u;

/**
 * Serializes `value` as RFC 8785 JSON Canonicalization Scheme text.
 *
 * Every Ivory digest is taken over the UTF-8 bytes of this text, so a value hashes
 * the same in the Core, the CLI and the Python workers. The input must be I-JSON
 * (RFC 7493): plain objects, arrays, strings without lone surrogates, finite
 * numbers, booleans and `null`. Anything else is refused instead of being dropped
 * or converted the way `JSON.stringify` would.
 */
export function canonicalJson(value: unknown): string {
    return serialize(value, new Set<object>());
}

/** True for object literals and `Object.create(null)`, false for arrays and class instances. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || !value || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    // eslint-disable-next-line no-null/no-null
    return prototype === Object.prototype || prototype === null;
}

function serialize(value: unknown, ancestors: Set<object>): string {
    // eslint-disable-next-line no-null/no-null
    if (value === null || typeof value === 'boolean') {
        return String(value);
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new IvoryContractError('non-finite-number', `${value} has no JSON representation`);
        }
        // RFC 8785 specifies ECMAScript's Number-to-String, which is what JSON.stringify emits; -0 becomes "0".
        return JSON.stringify(value);
    }
    if (typeof value === 'string') {
        return serializeString(value);
    }
    if (Array.isArray(value)) {
        return enter(value, ancestors, () => {
            const items: string[] = [];
            for (let index = 0; index < value.length; index++) {
                if (!(index in value)) {
                    throw new IvoryContractError('unsupported-value', `array hole at index ${index} is not I-JSON`);
                }
                items.push(serialize(value[index], ancestors));
            }
            return `[${items.join(',')}]`;
        });
    }
    if (isPlainObject(value)) {
        return enter(value, ancestors, () => {
            // The default sort compares UTF-16 code units, which is the member order RFC 8785 requires.
            const members = Object.keys(value).sort().map(key => `${serializeString(key)}:${serialize(value[key], ancestors)}`);
            return `{${members.join(',')}}`;
        });
    }
    throw new IvoryContractError('unsupported-value', `${describe(value)} is not I-JSON`);
}

function serializeString(value: string): string {
    if (LONE_SURROGATE.test(value)) {
        throw new IvoryContractError('lone-surrogate', 'strings must not contain unpaired UTF-16 surrogates');
    }
    // Without lone surrogates, JSON.stringify escapes exactly what RFC 8785 escapes: '"', '\' and
    // U+0000-U+001F, using \b \t \n \f \r where they exist and lowercase \u00xx otherwise.
    return JSON.stringify(value);
}

function enter(container: object, ancestors: Set<object>, serializeMembers: () => string): string {
    if (ancestors.has(container)) {
        throw new IvoryContractError('cyclic-value', 'a value that contains itself has no JSON representation');
    }
    ancestors.add(container);
    try {
        return serializeMembers();
    } finally {
        ancestors.delete(container);
    }
}

function describe(value: unknown): string {
    if (typeof value === 'object' && value) {
        return Object.getPrototypeOf(value)?.constructor?.name ?? 'object';
    }
    return typeof value;
}
