// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { createHash } from 'crypto';
import { ExactRef } from '../common/exact-ref';
import { IvoryContractError } from '../common/ivory-contract-error';
import { ResearchGraph } from '../common/research-graph';
import { Sha256Digest } from '../common/sha256-digest';

/** Byte identity is distinct from a canonical JSON identity. */
export function blobDigest(bytes: Uint8Array): Sha256Digest {
    return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

/**
 * Bounded V5 UTF-8 selector check, with no remap, normalization or support judgment.
 * Core must supply the retained blob; this function performs no filesystem access.
 */
export function verifyFragment(input: { readonly graph: ResearchGraph; readonly fragment: ExactRef; readonly bytes: Uint8Array }): {
    readonly quote: string; readonly quoteDigest: Sha256Digest; readonly representationDigest: Sha256Digest
} {
    const fragment = input.graph.get(input.fragment, 'fragment');
    const representation = input.graph.get(fragment.body.representation);
    if (representation.kind !== 'representation' && representation.kind !== 'artifact') {
        throw new IvoryContractError('wrong-type', 'fragments cite representations or artifacts');
    }
    if (blobDigest(input.bytes) !== representation.body.blob || representation.body.blob !== fragment.body.representationDigest) {
        throw new IvoryContractError('digest-mismatch', 'retained representation bytes do not match the exact digest');
    }
    const { start, end, quote } = fragment.body.selector;
    const bytes = Buffer.from(input.bytes);
    const boundary = (offset: number): boolean => offset === bytes.length || (bytes[offset] & 0xc0) !== 0x80;
    if (end > bytes.length || !boundary(start) || !boundary(end)) {
        throw new IvoryContractError('selector-mismatch', 'selector must be within the representation at UTF-8 code point boundaries');
    }
    try {
        // Validate the whole representation, including malformed bytes outside the selected span.
        new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
        throw new IvoryContractError('selector-mismatch', 'representation is not valid UTF-8 text');
    }
    const span = bytes.subarray(start, end);
    if (!span.equals(Buffer.from(quote, 'utf8'))) {
        throw new IvoryContractError('selector-mismatch', 'selector quote does not equal the retained byte span');
    }
    return Object.freeze({ quote, quoteDigest: blobDigest(span), representationDigest: representation.body.blob });
}
