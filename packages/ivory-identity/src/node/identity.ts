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

import { canonicalPreimage, PreimageField, preimageBytes } from '../common/canonical-preimage';
import { formatIdentifier, IdentifierFormatError, parseIdentifier } from '../common/identifier';
import { DERIVED_KINDS, FULL_DIGEST_LENGTH, IDENTIFIER_SCHEME_VERSION, IdentifierKind, MINTED_KINDS } from '../common/identity-scheme';
import { normalizeSelectorText, QuoteSelector, selectorNormalizationVersion, TextSpan, validateSpans } from '../common/passage-anchor';
import { digestHex, randomDigest, truncateDigest } from './digest';

const FULL_DIGEST_PATTERN = new RegExp(`^[0-9a-f]{${FULL_DIGEST_LENGTH}}$`);

/**
 * A derived identifier together with the evidence needed to defend it.
 *
 * The full digest and the preimage are retained rather than discarded: they are what turns a
 * truncation collision from a silent mis-resolution into a detectable, reportable defect
 * (see `docs/iv-17-identifiers.md` §9).
 */
export interface DerivedIdentifier {
    /** The identifier, e.g. `sv_1f0c…`. */
    readonly id: string;
    /** The untruncated digest of {@link preimage}. */
    readonly digest: string;
    /** The exact canonical preimage that was hashed. */
    readonly preimage: string;
}

/** Whether a transformation is expected to reproduce its output byte-for-byte from its inputs. */
export type TransformationDeterminism = 'deterministic' | 'observed';

/** A value a transformation was configured with. Restricted so that serialization is unambiguous. */
export type ParameterValue = string | number | boolean;

/** Thrown when an identity cannot be derived from the inputs given. Never recovered from silently. */
export class IdentityDerivationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'IdentityDerivationError';
    }
}

/**
 * Thrown when two different preimages produce the same identifier.
 *
 * At 128 bits this is not expected to occur by chance; it means a defect or a deliberate attempt
 * to make one citation resolve to another's evidence. Either way the only safe response is to
 * reject the write and report both preimages.
 */
export class IdentifierCollisionError extends Error {
    constructor(
        readonly id: string,
        readonly existingPreimage: string,
        readonly incomingPreimage: string,
    ) {
        super(`identifier '${id}' was derived from two different preimages`);
        this.name = 'IdentifierCollisionError';
    }
}

/**
 * Allocates a new identifier of a minted kind.
 *
 * @throws {IdentifierFormatError} for a derived kind. A source version, passage, artifact, or
 * fingerprint is a function of its inputs; minting one would produce an identifier that nobody
 * else could ever reproduce, which is exactly the failure this scheme exists to prevent.
 */
export function mintIdentifier(kind: IdentifierKind): string {
    if (!MINTED_KINDS.includes(kind)) {
        throw new IdentifierFormatError(`'${kind}' is a derived kind and cannot be minted; derive it from its inputs instead`);
    }
    return formatIdentifier(kind, randomDigest());
}

/**
 * Hashes the raw bytes of a source exactly as received.
 *
 * No normalization, no re-encoding, no metadata: this digest is the sole content input to a
 * source version, which is why re-ingesting an unchanged file reproduces its identifier.
 */
export function sourceContentDigest(bytes: Uint8Array): string {
    return digestHex(bytes);
}

/** Inputs identifying one version of a source. */
export interface SourceVersionIdentityInput {
    /** The minted `src_` identifier this version belongs to. */
    readonly sourceId: string;
    /** The full digest of the raw bytes, from {@link sourceContentDigest}. */
    readonly contentDigest: string;
}

/**
 * Derives a source version identifier from its source and its bytes, and nothing else.
 *
 * Bibliographic metadata, parser versions, and chunking parameters are all excluded on purpose.
 * Correcting an author's name or upgrading the converter must not invalidate a citation, and
 * re-indexing the same bytes must reproduce the same reference.
 *
 * The source is part of the preimage so that the same PDF ingested as two distinct research
 * objects yields two distinct versions. De-duplicating an upload against an existing source by
 * content digest is a separate ingestion policy, not an identity rule.
 */
export function deriveSourceVersionId(input: SourceVersionIdentityInput): DerivedIdentifier {
    parseIdentifier(input.sourceId, 'source');
    assertFullDigest(input.contentDigest, 'contentDigest');
    return derive('sourceVersion', [
        { name: 'sourceId', value: input.sourceId },
        { name: 'contentDigest', value: input.contentDigest },
    ]);
}

/** Inputs fingerprinting one computation. */
export interface ExecutionFingerprintInput {
    /** Stable name of the transformation, e.g. `docling.convert`. */
    readonly transformation: string;
    /** Version of that transformation's implementation and of any model or binary it drives. */
    readonly transformationVersion: string;
    /** Identifiers of everything consumed. Order is not significant; see below. */
    readonly inputIds: readonly string[];
    /** Configuration the transformation ran under. */
    readonly parameters: Readonly<Record<string, ParameterValue>>;
    /** Version of the policy in force, so a policy change invalidates rather than silently reuses. */
    readonly policyVersion: string;
}

/**
 * Derives the fingerprint of a computation: what was run, on what, configured how, under which
 * policy. Two runs with identical inputs share a fingerprint; that is what makes a derived
 * artifact reproducible.
 *
 * Input identifiers are sorted before hashing, so the accidental order in which a caller
 * assembled its dependencies cannot change an artifact's identity. A transformation whose result
 * genuinely depends on input order must state that order in {@link ExecutionFingerprintInput.parameters},
 * where it is visible and intentional. Duplicate inputs are rejected rather than de-duplicated,
 * because a repeated dependency means the caller built the wrong list.
 */
export function deriveExecutionFingerprint(input: ExecutionFingerprintInput): DerivedIdentifier {
    assertNonEmpty(input.transformation, 'transformation');
    assertNonEmpty(input.transformationVersion, 'transformationVersion');
    assertNonEmpty(input.policyVersion, 'policyVersion');
    const inputIds = [...input.inputIds].sort();
    const seen = new Set<string>();
    for (const id of inputIds) {
        parseIdentifier(id);
        if (seen.has(id)) {
            throw new IdentityDerivationError(`input '${id}' is listed twice in the execution fingerprint`);
        }
        seen.add(id);
    }
    return derive(
        'executionFingerprint',
        [
            { name: 'transformation', value: input.transformation },
            { name: 'transformationVersion', value: input.transformationVersion },
            { name: 'inputCount', value: String(inputIds.length) },
            { name: 'inputIds', value: inputIds.join(',') },
            { name: 'parameters', value: canonicalParameters(input.parameters) },
            { name: 'policyVersion', value: input.policyVersion },
        ],
        'fingerprint',
    );
}

/** Inputs identifying one output of one computation. */
export interface ArtifactIdentityInput {
    /** The `fp_` fingerprint of the computation that produced this output. */
    readonly fingerprint: string;
    /** Which output of that computation this is, e.g. `text`, `layout`, `chunks`. */
    readonly outputRole: string;
    /** Whether the transformation reproduces its output from its inputs. */
    readonly determinism: TransformationDeterminism;
    /** Full digest of the output bytes. Required for `observed`, rejected for `deterministic`. */
    readonly outputDigest?: string;
}

/**
 * Derives a derived-artifact identifier.
 *
 * A `deterministic` transformation — a parser at a pinned version, a chunker, a hash — is a
 * function of its inputs, so its fingerprint and output role are enough, and re-running it
 * reproduces the same artifact identifier.
 *
 * An `observed` transformation — a model call, OCR with a nondeterministic backend — is not.
 * Identifying its output by fingerprint alone would give one identifier to two different
 * contents, so the output digest joins the preimage. Two runs then yield two artifacts sharing
 * one fingerprint, which is the honest record: the computation was the same, the result was not.
 *
 * The identifier itself stays opaque. What ties an artifact to its source versions,
 * transformation, and execution is its record; see {@link createArtifactRecord}.
 */
export function deriveArtifactId(input: ArtifactIdentityInput): DerivedIdentifier {
    parseIdentifier(input.fingerprint, 'fingerprint');
    assertNonEmpty(input.outputRole, 'outputRole');
    const fields: PreimageField[] = [
        { name: 'fingerprint', value: input.fingerprint },
        { name: 'outputRole', value: input.outputRole },
        { name: 'determinism', value: input.determinism },
    ];
    if (input.determinism === 'observed') {
        if (input.outputDigest === undefined) {
            throw new IdentityDerivationError("an 'observed' transformation must supply the digest of its output");
        }
        assertFullDigest(input.outputDigest, 'outputDigest');
        fields.push({ name: 'outputDigest', value: input.outputDigest });
    } else if (input.determinism === 'deterministic') {
        if (input.outputDigest !== undefined) {
            throw new IdentityDerivationError(
                "a 'deterministic' transformation must not include its output digest, otherwise its artifact identifier stops being reproducible from its inputs",
            );
        }
    } else {
        throw new IdentityDerivationError(`unknown determinism '${input.determinism}'`);
    }
    return derive('artifact', fields);
}

/** Inputs identifying an exact region of extracted text. */
export interface PassageIdentityInput {
    /** The `sv_` version the passage ultimately quotes. */
    readonly sourceVersionId: string;
    /** The `art_` extraction whose text the offsets are measured in. */
    readonly extractionArtifactId: string;
    /** One or more ascending, non-overlapping half-open ranges. */
    readonly spans: readonly TextSpan[];
}

/**
 * Derives a passage identifier.
 *
 * A character offset means nothing without the text it indexes, so the extraction artifact is
 * part of the identity. Upgrading a parser therefore produces new passages rather than
 * re-pointing old ones — which is the honest outcome, because the old offsets no longer describe
 * the new text. Prior passages remain stored and resolvable against the extraction they were
 * measured in, and a re-anchoring edge links old to new; nothing is rewritten in place.
 *
 * Chunk boundaries are deliberately absent. A retrieval chunk is an artifact that *references*
 * passages, so re-chunking a corpus changes chunk artifacts and leaves every passage citation
 * intact.
 *
 * The source version is included as well as the extraction, so that a passage carries its own
 * evidence of which bytes it came from. Callers must pass the source version that the extraction
 * was run against; this function cannot verify that relationship without the artifact record.
 */
export function derivePassageId(input: PassageIdentityInput): DerivedIdentifier {
    parseIdentifier(input.sourceVersionId, 'sourceVersion');
    parseIdentifier(input.extractionArtifactId, 'artifact');
    const spans = validateSpans(input.spans);
    return derive('passage', [
        { name: 'sourceVersionId', value: input.sourceVersionId },
        { name: 'extractionArtifactId', value: input.extractionArtifactId },
        { name: 'spanCount', value: String(spans.length) },
        { name: 'spans', value: spans.map(span => `${span.start}-${span.end}`).join(',') },
    ]);
}

/**
 * Computes the recovery selector for a passage: digests of the quoted text and of the text
 * immediately around it, under the current normalization version.
 *
 * This never contributes to passage identity. It exists so that a passage measured in one
 * extraction can be located again in a different one, producing a new passage marked
 * `approximate` plus a lineage edge.
 */
export function computeQuoteSelector(input: { prefix: string; exact: string; suffix: string }): QuoteSelector {
    return {
        prefixDigest: digestHex(normalizeSelectorText(input.prefix)),
        exactDigest: digestHex(normalizeSelectorText(input.exact)),
        suffixDigest: digestHex(normalizeSelectorText(input.suffix)),
        normalizationVersion: selectorNormalizationVersion(),
    };
}

/** Everything an artifact must state about where it came from. */
export interface ArtifactRecordInput {
    readonly identity: DerivedIdentifier;
    /** Every source version the artifact transitively depends on. */
    readonly sourceVersionIds: readonly string[];
    readonly transformation: string;
    readonly transformationVersion: string;
    readonly determinism: TransformationDeterminism;
    readonly executionFingerprint: string;
    /** The specific run that produced it. Two runs of one fingerprint are two executions. */
    readonly executionId: string;
    readonly outputRole: string;
    readonly outputDigest?: string;
}

/** The persisted provenance of a derived artifact. */
export interface ArtifactRecord extends ArtifactRecordInput {
    readonly id: string;
    readonly digest: string;
    readonly identifierSchemeVersion: string;
}

/**
 * Assembles the provenance record of a derived artifact.
 *
 * An opaque identifier cannot answer "where did this come from?"; this record can, and it is
 * what IV-79's pipeline-run manifests extend. Every referenced identifier is validated here, so
 * an artifact cannot be persisted claiming a passage as its source version.
 */
export function createArtifactRecord(input: ArtifactRecordInput): ArtifactRecord {
    parseIdentifier(input.identity.id, 'artifact');
    parseIdentifier(input.executionFingerprint, 'fingerprint');
    parseIdentifier(input.executionId, 'execution');
    if (input.sourceVersionIds.length === 0) {
        throw new IdentityDerivationError(`artifact '${input.identity.id}' must declare the source versions it derives from`);
    }
    for (const sourceVersionId of input.sourceVersionIds) {
        parseIdentifier(sourceVersionId, 'sourceVersion');
    }
    return {
        ...input,
        id: input.identity.id,
        digest: input.identity.digest,
        identifierSchemeVersion: IDENTIFIER_SCHEME_VERSION,
    };
}

/**
 * Fails closed when two derivations produce one identifier from different preimages.
 *
 * Call this wherever a derived identifier meets storage. The rule is never to reuse the existing
 * record on a mismatch: the two preimages describe different objects, and silently picking one
 * would make a citation resolve to evidence it does not quote.
 *
 * @throws {IdentifierCollisionError} on a mismatch.
 */
export function assertConsistentIdentity(existing: DerivedIdentifier, incoming: DerivedIdentifier): void {
    if (existing.id !== incoming.id) {
        return;
    }
    if (existing.digest !== incoming.digest || existing.preimage !== incoming.preimage) {
        throw new IdentifierCollisionError(existing.id, existing.preimage, incoming.preimage);
    }
}

function derive(domain: string, fields: readonly PreimageField[], kind?: IdentifierKind): DerivedIdentifier {
    const resolvedKind = kind ?? (domain as IdentifierKind);
    if (!DERIVED_KINDS.includes(resolvedKind)) {
        throw new IdentityDerivationError(`'${resolvedKind}' is not a derived kind`);
    }
    const preimage = canonicalPreimage(domain, fields);
    const digest = digestHex(preimageBytes(preimage));
    return { id: formatIdentifier(resolvedKind, truncateDigest(digest)), digest, preimage };
}

function canonicalParameters(parameters: Readonly<Record<string, ParameterValue>>): string {
    const names = Object.keys(parameters).sort();
    if (names.length === 0) {
        return '';
    }
    return canonicalPreimage(
        'parameters',
        names.map(name => ({ name, value: typedParameterValue(name, parameters[name]) })),
    );
}

function typedParameterValue(name: string, value: ParameterValue): string {
    if (typeof value === 'string') {
        return `s:${value}`;
    }
    if (typeof value === 'boolean') {
        return `b:${value}`;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new IdentityDerivationError(`parameter '${name}' must be a finite number, got ${value}`);
        }
        // Normalizes -0 to 0 so that two configurations a reader cannot tell apart hash alike.
        return `n:${value === 0 ? 0 : value}`;
    }
    throw new IdentityDerivationError(`parameter '${name}' must be a string, number, or boolean`);
}

function assertNonEmpty(value: string, name: string): void {
    if (typeof value !== 'string' || value.length === 0) {
        throw new IdentityDerivationError(`'${name}' is required and must not be empty`);
    }
}

function assertFullDigest(value: string, name: string): void {
    if (typeof value !== 'string' || !FULL_DIGEST_PATTERN.test(value)) {
        throw new IdentityDerivationError(`'${name}' must be ${FULL_DIGEST_LENGTH} lowercase hex characters, got '${value}'`);
    }
}
