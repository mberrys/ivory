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

import { NORMALIZATION_VERSION } from './identity-scheme';

/**
 * A half-open character range `[start, end)` in the extracted text of one extraction artifact.
 *
 * Offsets are counted in UTF-16 code units of that text, which is what a JavaScript
 * `string.slice` uses, so a stored span can be applied without a separate index.
 */
export interface TextSpan {
    readonly start: number;
    readonly end: number;
}

/**
 * How a passage was located in the text it is anchored to.
 *
 * `exact` means the position selector applied to the extraction it was derived from.
 * `approximate` means the passage was recovered into a different extraction via its quote
 * selector. Approximate anchors are always labelled and can never satisfy IV-35's
 * exact-passage release criterion.
 */
export type AnchorConfidence = 'exact' | 'approximate';

/**
 * The recovery half of a passage anchor, modelled on the W3C Web Annotation text quote
 * selector. It carries digests rather than the quoted text so that an anchor can be stored,
 * logged, and exported without duplicating source content.
 *
 * A quote selector never participates in passage identity. It exists so that when an extraction
 * changes, a prior passage can be re-located in the new text — producing a *new* passage plus a
 * lineage edge, never a silent rewrite of the old one.
 */
export interface QuoteSelector {
    readonly prefixDigest: string;
    readonly exactDigest: string;
    readonly suffixDigest: string;
    readonly normalizationVersion: string;
}

/** Thrown when a passage anchor is not well formed. Never recovered from silently. */
export class PassageAnchorError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PassageAnchorError';
    }
}

/**
 * Validates the spans of a passage and returns them unchanged.
 *
 * A passage may cover more than one span — a quotation interrupted by a footnote marker or a
 * running header is one passage over two ranges — so spans are a list. They must be non-empty,
 * each half-open and non-degenerate, and in strictly ascending, non-overlapping order. The
 * order is not sorted for the caller: an unordered span list means the extraction step produced
 * something the identity layer cannot interpret, and guessing would produce a stable identifier
 * for an unstable meaning.
 */
export function validateSpans(spans: readonly TextSpan[]): readonly TextSpan[] {
    if (spans.length === 0) {
        throw new PassageAnchorError('a passage must cover at least one span');
    }
    let previousEnd = -1;
    for (const span of spans) {
        if (!Number.isInteger(span.start) || !Number.isInteger(span.end)) {
            throw new PassageAnchorError(`span offsets must be integers, got [${span.start}, ${span.end})`);
        }
        if (span.start < 0 || span.end <= span.start) {
            throw new PassageAnchorError(`span [${span.start}, ${span.end}) must be a non-empty half-open range with a non-negative start`);
        }
        if (span.start < previousEnd) {
            throw new PassageAnchorError(`span [${span.start}, ${span.end}) overlaps or precedes the previous span, which ended at ${previousEnd}`);
        }
        previousEnd = span.end;
    }
    return spans;
}

/**
 * Normalizes text before it enters a quote selector, under {@link NORMALIZATION_VERSION}.
 *
 * Unicode NFC composition makes a decomposed and a composed rendering of the same character
 * compare equal, and whitespace runs collapse to a single space because extraction backends
 * disagree about line breaks inside a paragraph. This normalization applies *only* to quote
 * selectors. Source bytes are hashed exactly as received and are never normalized.
 */
export function normalizeSelectorText(text: string): string {
    return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** The normalization version that {@link normalizeSelectorText} currently implements. */
export function selectorNormalizationVersion(): string {
    return NORMALIZATION_VERSION;
}
