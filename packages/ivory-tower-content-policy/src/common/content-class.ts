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
 * The content classes Ivory Tower can distinguish, and the V1 safe subset.
 *
 * Implements `docs/iv-128-content-rights.md` §6 and §7. The classification exists because
 * copyright position is a property of the *class* of content, not of an individual file, and
 * because the product cannot decide what it may do with a source until it knows which class the
 * source belongs to.
 */

/**
 * A class of source content, chosen so that every member of a class shares a rights position.
 *
 * Splitting `arxivPreprint` from the other open classes is deliberate: arXiv items carry
 * per-item licences that are not uniformly open, so the class is safe to ingest but requires a
 * licence check before its text may leave the system.
 */
export type ContentClass =
    /** Explicitly open-licensed work: CC-BY, CC-BY-SA, CC0 and equivalents. */
    | 'openLicensed'
    /** The PubMed Central Open Access subset. Per-item licences, all permitting reuse. */
    | 'pmcOpenAccess'
    /** An arXiv item. Licences vary per item and are not uniformly open. */
    | 'arxivPreprint'
    /** An article in a DOAJ-listed open-access journal. */
    | 'doajJournal'
    /** A preprint from bioRxiv, medRxiv, SocArXiv, PsyArXiv and equivalents. */
    | 'preprintServer'
    /** Public-domain or openly licensed archival material. */
    | 'publicDomainArchive'
    /** Notes, memos, and manuscripts the researcher wrote. */
    | 'researcherAuthored'
    /** A subscription article available under an institutional licence. */
    | 'publisherLicensed'
    /** A book or chapter available under an institutional licence. */
    | 'institutionallyLicensedBook'
    /** Provenance cannot be evidenced. */
    | 'unknownProvenance'
    /** Known or suspected to originate from a shadow library. */
    | 'shadowLibrary';

/** Every content class, in the order §6 of the register presents them. */
export const CONTENT_CLASSES: readonly ContentClass[] = [
    'openLicensed',
    'pmcOpenAccess',
    'arxivPreprint',
    'doajJournal',
    'preprintServer',
    'publicDomainArchive',
    'researcherAuthored',
    'publisherLicensed',
    'institutionallyLicensedBook',
    'unknownProvenance',
    'shadowLibrary',
];

/**
 * The V1 safe subset (`docs/iv-128-content-rights.md` §7): content whose rights position is
 * established by the class itself, needing no institutional agreement and no statutory
 * exception.
 *
 * This is the default V1 corpus. It is not a degraded corpus — it is large enough to prove that
 * provenance-bearing evidence synthesis works, and it removes the largest legal unknown from
 * the critical path.
 */
export const SAFE_SUBSET: readonly ContentClass[] = [
    'openLicensed',
    'pmcOpenAccess',
    'arxivPreprint',
    'doajJournal',
    'preprintServer',
    'publicDomainArchive',
    'researcherAuthored',
];

/**
 * Classes that are refused outright, on any basis and under any topology.
 *
 * `shadowLibrary` follows *Bartz v. Anthropic*, where retaining pirated copies was not fair use
 * even though the use itself was. `unknownProvenance` is refused because a source that cannot
 * evidence its origin inherits that same position by default — which is why provenance
 * recording (IV-17) is a legal control and not merely a citation feature.
 */
export const ALWAYS_REFUSED: readonly ContentClass[] = ['unknownProvenance', 'shadowLibrary'];

/**
 * Classes whose text may be ingested on the strength of the class, but whose per-item licence
 * must be confirmed before the text may be transmitted to a third party.
 */
export const REQUIRES_ITEM_LICENCE_CHECK: readonly ContentClass[] = ['arxivPreprint'];

/** True when the class belongs to the V1 safe subset. */
export function isSafeSubset(contentClass: ContentClass): boolean {
    return SAFE_SUBSET.includes(contentClass);
}

/** True when the class is refused regardless of any asserted rights basis. */
export function isAlwaysRefused(contentClass: ContentClass): boolean {
    return ALWAYS_REFUSED.includes(contentClass);
}

/** True when the class needs a per-item licence confirmed before third-party transfer. */
export function requiresItemLicenceCheck(contentClass: ContentClass): boolean {
    return REQUIRES_ITEM_LICENCE_CHECK.includes(contentClass);
}
