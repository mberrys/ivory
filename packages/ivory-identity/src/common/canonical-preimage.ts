// *****************************************************************************
// Copyright (C) 2026 Berry Studio and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { PREIMAGE_VERSION } from './identity-scheme';

/** Separates a field's name, byte length, and value. */
const UNIT_SEPARATOR = '\x1f';

/** Terminates a field. */
const RECORD_SEPARATOR = '\x1e';

const FIELD_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9._-]*$/;

const encoder = new TextEncoder();

/** One named field of a canonical preimage. Field order is significant. */
export interface PreimageField {
    readonly name: string;
    readonly value: string;
}

/** Thrown when a preimage cannot be built unambiguously. Never recovered from silently. */
export class CanonicalPreimageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CanonicalPreimageError';
    }
}

/**
 * Builds the canonical preimage that a derived identifier hashes.
 *
 * Ivory Tower does not hash `JSON.stringify` output. Two different objects must never produce
 * the same preimage, and plain concatenation cannot promise that: `'ab' + 'c'` and `'a' + 'bc'`
 * are the same bytes, so two different passages could hash to one identifier and one citation
 * would resolve to the other's evidence. Every field is therefore framed with its name and its
 * UTF-8 byte length:
 *
 * ```
 * v <US> 12 <US> iv-preimage/1 <RS> d <US> 13 <US> sourceVersion <RS> sourceId <US> 36 <US> src_… <RS> …
 * ```
 *
 * The length prefix makes the framing self-delimiting, so no value can impersonate a field
 * boundary regardless of the characters it contains. The `v` field pins the framing version and
 * the `d` field pins the domain, so a passage preimage can never equal an artifact preimage even
 * if their fields coincide.
 *
 * Field order is part of the contract: callers pass a fixed order per domain, and reordering
 * yields a different identifier. Names must be unique and match `/^[a-zA-Z][a-zA-Z0-9._-]*$/`.
 *
 * Preimages nest safely: because the outer framing length-prefixes every value, a preimage may
 * itself be the value of a field, which is how execution parameters are folded in.
 *
 * @param domain the object kind being identified, e.g. `sourceVersion`.
 * @param fields the identifying fields, in the domain's declared order.
 */
export function canonicalPreimage(domain: string, fields: readonly PreimageField[]): string {
    if (!FIELD_NAME_PATTERN.test(domain)) {
        throw new CanonicalPreimageError(`preimage domain '${domain}' must match ${FIELD_NAME_PATTERN}`);
    }
    if (fields.length === 0) {
        throw new CanonicalPreimageError(`preimage for domain '${domain}' has no fields`);
    }
    const seen = new Set<string>();
    const framed = [frame('v', PREIMAGE_VERSION), frame('d', domain)];
    for (const field of fields) {
        if (!FIELD_NAME_PATTERN.test(field.name)) {
            throw new CanonicalPreimageError(`preimage field name '${field.name}' must match ${FIELD_NAME_PATTERN}`);
        }
        if (seen.has(field.name)) {
            throw new CanonicalPreimageError(`preimage field '${field.name}' is declared twice in domain '${domain}'`);
        }
        seen.add(field.name);
        framed.push(frame(field.name, field.value));
    }
    return framed.join('');
}

/** Encodes a preimage to the exact bytes that are hashed. */
export function preimageBytes(preimage: string): Uint8Array {
    return encoder.encode(preimage);
}

function frame(name: string, value: string): string {
    const byteLength = encoder.encode(value).length;
    return `${name}${UNIT_SEPARATOR}${byteLength}${UNIT_SEPARATOR}${value}${RECORD_SEPARATOR}`;
}
