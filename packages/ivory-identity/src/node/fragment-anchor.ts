// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { computeQuoteSelector, derivePassageId } from './identity';
import { AnchorConfidence, PassageAnchorError, QuoteSelector, TextSpan, normalizeSelectorText, validateSpans } from '../common/passage-anchor';

/** A page-local position that can be displayed without re-running extraction. */
export interface PageCoordinate {
    readonly page: number;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly unit: 'pt' | 'px' | 'normalized';
}

/** The persisted text needed to validate or recover a fragment. */
export interface TextRepresentation {
    readonly sourceVersionId: string;
    readonly artifactId: string;
    readonly text: string;
    readonly coordinates?: readonly PageCoordinate[];
}

/** A citation whose position is exact for one immutable representation. */
export interface FragmentAnchor {
    readonly sourceVersionId: string;
    readonly artifactId: string;
    readonly passageId: string;
    readonly spans: readonly TextSpan[];
    readonly quote: QuoteSelector;
    readonly coordinates: readonly PageCoordinate[];
    readonly confidence: AnchorConfidence;
}

/** Text and geometry shown to a researcher when an anchor is inspected. */
export interface InspectableFragment {
    readonly exact: string;
    readonly prefix: string;
    readonly suffix: string;
    readonly coordinates: readonly PageCoordinate[];
}

export type RemapOutcome = 'exact' | 'ambiguous' | 'unresolved';

export interface RemapCandidate {
    readonly spans: readonly TextSpan[];
    readonly inspectable: InspectableFragment;
}

export interface FragmentRemapResult {
    readonly outcome: RemapOutcome;
    /** A new anchor is returned only for a unique match, and remains approximate. */
    readonly anchor?: FragmentAnchor;
    readonly candidates: readonly RemapCandidate[];
    readonly reason?: string;
}

/** Creates an anchor from a representation while retaining enough data for inspection. */
export function createFragmentAnchor(
    representation: TextRepresentation,
    spans: readonly TextSpan[],
    coordinates: readonly PageCoordinate[] = representation.coordinates ?? [],
): FragmentAnchor {
    const checkedSpans = validateTextSpans(representation.text, spans);
    const inspectable = inspectFragment(representation.text, checkedSpans, coordinates);
    const passageId = derivePassageId({
        sourceVersionId: representation.sourceVersionId,
        extractionArtifactId: representation.artifactId,
        spans: checkedSpans,
    }).id;
    return {
        sourceVersionId: representation.sourceVersionId,
        artifactId: representation.artifactId,
        passageId,
        spans: checkedSpans,
        quote: computeQuoteSelector(inspectable),
        coordinates,
        confidence: 'exact',
    };
}

/** Reads the exact quote and its surrounding context without hiding source text. */
export function inspectFragment(
    text: string,
    spans: readonly TextSpan[],
    coordinates: readonly PageCoordinate[] = [],
    contextLength = 96,
): InspectableFragment {
    const checkedSpans = validateTextSpans(text, spans);
    const first = checkedSpans[0];
    const last = checkedSpans[checkedSpans.length - 1];
    return {
        exact: checkedSpans.map(span => text.slice(span.start, span.end)).join('\n'),
        prefix: text.slice(Math.max(0, first.start - contextLength), first.start),
        suffix: text.slice(last.end, Math.min(text.length, last.end + contextLength)),
        coordinates,
    };
}

/**
 * Resolves an old anchor against a new representation.
 *
 * A representation with the same artifact id is checked at its stored position. A different
 * representation is searched by quote and context digests. There is deliberately no
 * best-effort ranking: zero candidates is unresolved and more than one is ambiguous.
 */
export function remapFragmentAnchor(
    anchor: FragmentAnchor,
    previous: TextRepresentation,
    next: TextRepresentation,
    coordinates: readonly PageCoordinate[] = next.coordinates ?? [],
): FragmentRemapResult {
    if (anchor.sourceVersionId !== previous.sourceVersionId) {
        return { outcome: 'unresolved', candidates: [], reason: 'anchor and representations do not share a source version' };
    }
    const original = inspectFragment(previous.text, anchor.spans, anchor.coordinates);
    if (anchor.artifactId === next.artifactId) {
        if (anchor.sourceVersionId !== next.sourceVersionId) {
            return { outcome: 'unresolved', candidates: [], reason: 'same artifact id cannot be reused across source versions' };
        }
        const current = inspectFragment(next.text, anchor.spans, coordinates);
        if (sameSelector(anchor.quote, current)) {
            return { outcome: 'exact', anchor: { ...anchor, coordinates }, candidates: [{ spans: anchor.spans, inspectable: current }] };
        }
        return { outcome: 'unresolved', candidates: [], reason: 'stored position no longer contains its stored quote' };
    }

    if (anchor.spans.length !== 1) {
        return { outcome: 'unresolved', candidates: [], reason: 'multi-span quote recovery requires a structured selector' };
    }

    const normalized = normalizeWithBoundaries(next.text);
    const exact = normalizeSelectorText(original.exact);
    const prefix = normalizeSelectorText(original.prefix);
    const suffix = normalizeSelectorText(original.suffix);
    const candidates: RemapCandidate[] = [];
    let searchFrom = 0;
    while (exact.length > 0) {
        const hit = normalized.value.indexOf(exact, searchFrom);
        if (hit < 0) {
            break;
        }
        const end = hit + exact.length;
        const candidatePrefix = contextBeforeQuote(normalized.value, hit, prefix.length);
        const candidateSuffix = contextAfterQuote(normalized.value, end, suffix.length);
        if (
            sameDigest(anchor.quote.exactDigest, exact) &&
            sameDigest(anchor.quote.prefixDigest, candidatePrefix) &&
            sameDigest(anchor.quote.suffixDigest, candidateSuffix)
        ) {
            const spans = [{ start: normalized.starts[hit], end: normalized.ends[end - 1] }];
            const inspectable = inspectFragment(next.text, spans, coordinates);
            // Zero-false-exact: a mapped span whose recovered text no longer normalizes to the
            // stored quotation is not a match, even if search offsets landed uniquely.
            if (normalizeSelectorText(inspectable.exact) === exact) {
                candidates.push({ spans, inspectable });
            }
        }
        searchFrom = hit + 1;
    }

    if (candidates.length !== 1) {
        return {
            outcome: candidates.length === 0 ? 'unresolved' : 'ambiguous',
            candidates,
            reason:
                candidates.length === 0
                    ? 'no candidate matched the exact quote and context'
                    : 'more than one candidate matched the exact quote and context',
        };
    }
    const candidate = candidates[0];
    const derived = createFragmentAnchor(next, candidate.spans, candidate.inspectable.coordinates);
    return {
        outcome: 'exact',
        candidates,
        anchor: { ...derived, confidence: 'approximate' },
    };
}

function sameSelector(selector: QuoteSelector, inspectable: InspectableFragment): boolean {
    return (
        sameDigest(selector.prefixDigest, normalizeSelectorText(inspectable.prefix)) &&
        sameDigest(selector.exactDigest, normalizeSelectorText(inspectable.exact)) &&
        sameDigest(selector.suffixDigest, normalizeSelectorText(inspectable.suffix))
    );
}

function sameDigest(expected: string, text: string): boolean {
    return computeQuoteSelector({ prefix: '', exact: text, suffix: '' }).exactDigest === expected;
}

function validateTextSpans(text: string, spans: readonly TextSpan[]): readonly TextSpan[] {
    const checked = validateSpans(spans);
    for (const span of checked) {
        if (span.end > text.length) {
            throw new PassageAnchorError(`span [${span.start}, ${span.end}) exceeds text length ${text.length}`);
        }
    }
    return checked;
}

interface NormalizedText {
    readonly value: string;
    readonly starts: readonly number[];
    readonly ends: readonly number[];
}

/**
 * Stored prefix/suffix digests are computed from trimmed selector text, so candidate slices
 * must skip the collapsed separator adjacent to the quotation rather than consume it as context.
 */
function contextBeforeQuote(value: string, hit: number, length: number): string {
    let end = hit;
    while (end > 0 && value[end - 1] === ' ') {
        end -= 1;
    }
    return value.slice(Math.max(0, end - length), end);
}

function contextAfterQuote(value: string, quoteEnd: number, length: number): string {
    let start = quoteEnd;
    while (start < value.length && value[start] === ' ') {
        start += 1;
    }
    return value.slice(start, start + length);
}

/** Normalizes search text while retaining source offsets for the resulting match. */
function normalizeWithBoundaries(text: string): NormalizedText {
    const starts: number[] = [];
    const ends: number[] = [];
    let value = '';
    for (const match of text.matchAll(/\S+/gu)) {
        const origin = match.index;
        if (value.length > 0) {
            value += ' ';
            starts.push(origin - 1);
            ends.push(origin);
        }
        const originalToken = match[0];
        const token = originalToken.normalize('NFC');
        value += token;
        mapNormalizedTokenOffsets(origin, originalToken, token, starts, ends);
    }
    return { value, starts, ends };
}

/** Maps each normalized character onto the original UTF-16 range that produced it. */
function mapNormalizedTokenOffsets(
    origin: number,
    originalToken: string,
    token: string,
    starts: number[],
    ends: number[],
): void {
    if (token.length === originalToken.length) {
        for (let index = 0; index < token.length; index += 1) {
            starts.push(origin + index);
            ends.push(origin + index + 1);
        }
        return;
    }
    let consumed = 0;
    for (let index = 0; index < token.length; index += 1) {
        const start = consumed;
        let next = consumed + 1;
        while (next <= originalToken.length && originalToken.slice(0, next).normalize('NFC') !== token.slice(0, index + 1)) {
            next += 1;
        }
        consumed = next <= originalToken.length ? next : originalToken.length;
        starts.push(origin + start);
        ends.push(origin + Math.max(consumed, start + 1));
    }
}
