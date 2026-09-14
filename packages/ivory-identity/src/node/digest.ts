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

import { createHash, randomBytes } from 'crypto';
import { DIGEST_ALGORITHM, IDENTIFIER_DIGEST_LENGTH } from '../common/identity-scheme';

/**
 * Hashes bytes with {@link DIGEST_ALGORITHM} and returns the full lowercase hex digest.
 *
 * This is the only place Ivory Tower computes a digest. The algorithm itself is the platform's
 * (`node:crypto`); what Ivory Tower owns is which bytes reach it, which is decided by
 * `canonicalPreimage` and the derivation rules in `identity.ts`.
 */
export function digestHex(data: Uint8Array | string): string {
    return createHash(DIGEST_ALGORITHM)
        .update(typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data))
        .digest('hex');
}

/**
 * Truncates a full digest to the {@link IDENTIFIER_DIGEST_LENGTH} leading hex characters carried
 * by an identifier. The full digest is retained by the caller so that a truncation collision is
 * detectable rather than silently accepted; see `docs/iv-17-identifiers.md` §9.
 */
export function truncateDigest(fullDigest: string): string {
    return fullDigest.slice(0, IDENTIFIER_DIGEST_LENGTH);
}

/**
 * Returns {@link IDENTIFIER_DIGEST_LENGTH} hex characters of cryptographic randomness, the
 * payload of a minted identifier.
 *
 * Random bytes are used rather than a UUID because a UUID spends six of its bits on version and
 * variant markers that carry no meaning here; this yields the full 128 bits.
 */
export function randomDigest(): string {
    return randomBytes(IDENTIFIER_DIGEST_LENGTH / 2).toString('hex');
}
