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

import { IdentifierFormatError, isIdentifier, parseIdentifier } from './identifier';
import { IdentifierKind } from './identity-scheme';

/**
 * A reference that once addressed an object and must keep resolving to it.
 *
 * Ivory Tower has no legacy identifiers yet, so this defines the migration *mechanism* rather
 * than performing one. The rule it encodes is that a scheme change never rewrites stored
 * identifiers in place: the object keeps the identifier it was created with, the new scheme adds
 * a canonical identifier, and an alias edge joins them. A citation written years ago keeps
 * resolving, and nothing has to be back-filled to make that true.
 */
export interface IdentifierAlias {
    /** The retired or foreign reference, in whatever shape it originally had. */
    readonly alias: string;
    /** Which scheme the alias came from, e.g. `iv-id/0` or `import.zotero`. */
    readonly aliasScheme: string;
    /** The identifier that is authoritative now. */
    readonly canonicalId: string;
    /** Why the alias exists, for audit. */
    readonly reason: string;
    readonly createdAt: string;
}

/**
 * Resolves a reference to its canonical identifier.
 *
 * The alias table is consulted first, because a retired reference can still be well formed — a
 * scheme change that alters only what an identifier *means* leaves its shape intact, and
 * resolving such a reference to itself would quietly point a citation at the wrong object. A
 * reference with no alias entry resolves to itself if it is a valid identifier. Anything else
 * returns `undefined`: an unresolvable reference is reported, never guessed at.
 *
 * Alias chains are rejected rather than followed. A canonical target that is itself an alias
 * means the table was built by rewriting instead of adding, which is the failure mode this
 * mechanism exists to prevent, and following the chain would hide it.
 *
 * A reference that resolves to a different kind than expected throws rather than returning
 * `undefined`: it is a wiring mistake, not a missing record.
 */
export function resolveIdentifier(
    reference: string,
    aliases: ReadonlyMap<string, IdentifierAlias>,
    expectedKind?: IdentifierKind
): string | undefined {
    const alias = aliases.get(reference);
    if (alias) {
        if (aliases.has(alias.canonicalId)) {
            throw new IdentifierFormatError(
                `alias '${reference}' resolves to '${alias.canonicalId}', which is itself an alias; aliases must point directly at a canonical identifier`
            );
        }
        parseIdentifier(alias.canonicalId, expectedKind);
        return alias.canonicalId;
    }
    if (isIdentifier(reference)) {
        parseIdentifier(reference, expectedKind);
        return reference;
    }
    return undefined;
}
