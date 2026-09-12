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

import {
    IDENTIFIER_DIGEST_LENGTH,
    IDENTIFIER_KINDS,
    IDENTIFIER_PREFIXES,
    IDENTIFIER_URI_SEGMENTS,
    IdentifierKind,
    IVORY_URI_SCHEME,
} from './identity-scheme';

/**
 * Grammar of an Ivory Tower identifier: a typed prefix, an underscore, and
 * {@link IDENTIFIER_DIGEST_LENGTH} lowercase hex characters.
 *
 * The grammar is deliberately narrow so that an identifier needs no escaping anywhere it is
 * carried: URL paths and query values, file names, JSON, log lines, BibTeX and CSL fields,
 * and MCP resource URIs. It is fixed-length, ASCII-only, and case-stable, so a system that
 * upper-cases or trims it produces something that fails to parse rather than something that
 * silently addresses a different object.
 */
export const IDENTIFIER_PATTERN = new RegExp(`^(${Object.values(IDENTIFIER_PREFIXES).join('|')})_[0-9a-f]{${IDENTIFIER_DIGEST_LENGTH}}$`);

const KIND_BY_PREFIX: ReadonlyMap<string, IdentifierKind> = new Map(IDENTIFIER_KINDS.map(kind => [IDENTIFIER_PREFIXES[kind], kind]));

const KIND_BY_URI_SEGMENT: ReadonlyMap<string, IdentifierKind> = new Map(
    IDENTIFIER_KINDS.map(kind => [IDENTIFIER_URI_SEGMENTS[kind], kind]),
);

/** An identifier decomposed into the kind it types and the digest it carries. */
export interface ParsedIdentifier {
    readonly kind: IdentifierKind;
    /** The {@link IDENTIFIER_DIGEST_LENGTH}-character lowercase hex digest, without the prefix. */
    readonly digest: string;
}

/** An `ivory://` resource URI decomposed into its parts. */
export interface ParsedResourceUri {
    readonly kind: IdentifierKind;
    readonly id: string;
    /** The project the reference is scoped to, if the URI used the project-scoped form. */
    readonly projectId?: string;
}

/** Thrown when a value does not satisfy the identifier scheme. Never recovered from silently. */
export class IdentifierFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'IdentifierFormatError';
    }
}

/**
 * Composes an identifier from a kind and a digest. The digest is validated, because an
 * identifier built from a malformed digest would be indistinguishable from a valid one later.
 */
export function formatIdentifier(kind: IdentifierKind, digest: string): string {
    if (!new RegExp(`^[0-9a-f]{${IDENTIFIER_DIGEST_LENGTH}}$`).test(digest)) {
        throw new IdentifierFormatError(
            `expected ${IDENTIFIER_DIGEST_LENGTH} lowercase hex characters for a '${kind}' identifier, got '${digest}'`,
        );
    }
    return `${IDENTIFIER_PREFIXES[kind]}_${digest}`;
}

/**
 * Parses an identifier, optionally asserting its kind.
 *
 * @throws {IdentifierFormatError} if the value does not match {@link IDENTIFIER_PATTERN}, or if
 * `expectedKind` is given and the value types a different kind. Passing a passage identifier
 * where a source version is expected is a programming error, not a lookup miss.
 */
export function parseIdentifier(value: string, expectedKind?: IdentifierKind): ParsedIdentifier {
    const parsed = tryParseIdentifier(value, expectedKind);
    if (!parsed) {
        const suffix = expectedKind ? ` of kind '${expectedKind}'` : '';
        throw new IdentifierFormatError(`'${value}' is not an Ivory Tower identifier${suffix}`);
    }
    return parsed;
}

/** Parses an identifier, returning `undefined` rather than throwing when it does not match. */
export function tryParseIdentifier(value: string, expectedKind?: IdentifierKind): ParsedIdentifier | undefined {
    if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
        return undefined;
    }
    const separator = value.indexOf('_');
    const kind = KIND_BY_PREFIX.get(value.slice(0, separator));
    if (!kind || (expectedKind && kind !== expectedKind)) {
        return undefined;
    }
    return { kind, digest: value.slice(separator + 1) };
}

/** True when `value` is a well-formed identifier, and of `kind` when one is given. */
export function isIdentifier(value: string, kind?: IdentifierKind): boolean {
    return tryParseIdentifier(value, kind) !== undefined;
}

/**
 * Builds the canonical resource URI for an object, e.g. `ivory://source-version/sv_1f0c…`.
 *
 * Passing `projectId` produces the project-scoped form `ivory://project/prj_…/passage/psg_…`,
 * which is what an MCP client authorized for a single project (IV-70) receives.
 */
export function identifierResourceUri(kind: IdentifierKind, id: string, projectId?: string): string {
    parseIdentifier(id, kind);
    const segment = IDENTIFIER_URI_SEGMENTS[kind];
    if (projectId === undefined) {
        return `${IVORY_URI_SCHEME}://${segment}/${id}`;
    }
    parseIdentifier(projectId, 'project');
    return `${IVORY_URI_SCHEME}://${IDENTIFIER_URI_SEGMENTS.project}/${projectId}/${segment}/${id}`;
}

/**
 * Parses a resource URI produced by {@link identifierResourceUri}, returning `undefined` when
 * the value is not one. The two forms are told apart by segment count, so an unscoped project
 * reference (`ivory://project/prj_…`) never collides with the scoped form.
 */
export function parseResourceUri(uri: string): ParsedResourceUri | undefined {
    const prefix = `${IVORY_URI_SCHEME}://`;
    if (typeof uri !== 'string' || !uri.startsWith(prefix)) {
        return undefined;
    }
    const segments = uri.slice(prefix.length).split('/');
    if (segments.length === 2) {
        const kind = KIND_BY_URI_SEGMENT.get(segments[0]);
        return kind && isIdentifier(segments[1], kind) ? { kind, id: segments[1] } : undefined;
    }
    if (segments.length === 4 && segments[0] === IDENTIFIER_URI_SEGMENTS.project) {
        const kind = KIND_BY_URI_SEGMENT.get(segments[2]);
        if (kind && isIdentifier(segments[1], 'project') && isIdentifier(segments[3], kind)) {
            return { kind, id: segments[3], projectId: segments[1] };
        }
    }
    return undefined;
}
