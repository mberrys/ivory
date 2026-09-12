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

/**
 * Version tags and constants of the Ivory Tower identifier scheme (IV-17).
 *
 * Every tag here participates in the canonical preimage of derived identifiers, so changing
 * any of them changes every identifier derived afterwards. A change is therefore a scheme
 * migration (see `docs/iv-17-identifiers.md` §10), never an in-place edit: existing records
 * keep their identifiers and gain alias edges.
 */

/**
 * Version of the identifier scheme as a whole: grammar, prefixes, digest algorithm, and
 * truncation width. Persisted on every identifier-bearing record as `identifierSchemeVersion`
 * so that a future scheme can be detected rather than guessed.
 */
export const IDENTIFIER_SCHEME_VERSION = 'iv-id/1';

/**
 * Version of the canonical preimage framing (see `canonical-preimage.ts`). Emitted as the
 * first framed field of every preimage.
 */
export const PREIMAGE_VERSION = 'iv-preimage/1';

/**
 * Version of the text normalization applied to passage quote selectors. Never applied to
 * source bytes, which are hashed exactly as received.
 */
export const NORMALIZATION_VERSION = 'iv-norm/1';

/** Digest algorithm backing every derived identifier. */
export const DIGEST_ALGORITHM = 'sha256';

/** Length in lowercase hex characters of a full {@link DIGEST_ALGORITHM} digest. */
export const FULL_DIGEST_LENGTH = 64;

/**
 * Length in lowercase hex characters of the digest carried by an identifier: 32 characters,
 * i.e. the leading 128 bits of the full digest. The full digest is persisted alongside the
 * identifier so a truncation collision can be detected rather than silently accepted.
 */
export const IDENTIFIER_DIGEST_LENGTH = 32;

/**
 * The kinds of object that carry an Ivory Tower identifier.
 *
 * `Minted` kinds are allocated once from a random source and are never re-derivable.
 * `Derived` kinds are a function of their inputs and are reproducible by anyone holding them.
 */
export type IdentifierKind = 'project' | 'corpus' | 'source' | 'sourceVersion' | 'passage' | 'execution' | 'artifact' | 'fingerprint';

/** All identifier kinds, in scheme order. */
export const IDENTIFIER_KINDS: readonly IdentifierKind[] = [
    'project',
    'corpus',
    'source',
    'sourceVersion',
    'passage',
    'execution',
    'artifact',
    'fingerprint',
];

/**
 * Kinds allocated from randomness. A minted identifier answers "which one is this?" and must
 * never be re-derived from content: a corrected metadata record or a re-scan of the same paper
 * has to stay the same `source`, and two runs of an identical computation are still two
 * distinct executions.
 */
export const MINTED_KINDS: readonly IdentifierKind[] = ['project', 'corpus', 'source', 'execution'];

/**
 * Kinds derived by hashing a canonical preimage. A derived identifier answers "what is this?"
 * and is reproducible from its inputs alone, which is what lets a citation survive re-indexing.
 */
export const DERIVED_KINDS: readonly IdentifierKind[] = ['sourceVersion', 'passage', 'artifact', 'fingerprint'];

/** The prefix that types an identifier, e.g. `sv` in `sv_1f0c…`. */
export const IDENTIFIER_PREFIXES: Readonly<Record<IdentifierKind, string>> = {
    project: 'prj',
    corpus: 'cor',
    source: 'src',
    sourceVersion: 'sv',
    passage: 'psg',
    execution: 'exec',
    artifact: 'art',
    fingerprint: 'fp',
};

/** The path segment naming a kind inside an `ivory://` resource URI. */
export const IDENTIFIER_URI_SEGMENTS: Readonly<Record<IdentifierKind, string>> = {
    project: 'project',
    corpus: 'corpus',
    source: 'source',
    sourceVersion: 'source-version',
    passage: 'passage',
    execution: 'execution',
    artifact: 'artifact',
    fingerprint: 'fingerprint',
};

/** Scheme of the resource URIs that address Ivory Tower objects, e.g. in MCP resource lists. */
export const IVORY_URI_SCHEME = 'ivory';
