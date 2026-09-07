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

import { TextSpan } from '../../common/passage-anchor';
import { digestHex } from '../digest';
import {
    deriveArtifactId, deriveExecutionFingerprint, derivePassageId, deriveSourceVersionId, sourceContentDigest
} from '../identity';

/**
 * A deterministic corpus for the IV-17 verification suite.
 *
 * Everything here is fixed in code: no files, no clock, no randomness, no network. That is what
 * lets the suite run the same pipeline twice and compare every generated identifier, then mutate
 * exactly one input and observe precisely which identifiers move.
 */

/** A minted source identifier, pinned so the fixtures stay reproducible across runs. */
export const FIXTURE_SOURCE_ID = 'src_0b7bd0e7bd2d4f2f9c4e6a1d8f3b5c72';

/** A second minted source, used to show that identical bytes under a different source differ. */
export const FIXTURE_OTHER_SOURCE_ID = 'src_9a1c4e8f2b6d40a3b8e5c7f1d2a4b6e8';

export const FIXTURE_POLICY_VERSION = 'iv-policy/1';

/** A revised policy, used to show that a policy change reaches every computation. */
export const FIXTURE_REVISED_POLICY_VERSION = 'iv-policy/2';

const encoder = new TextEncoder();

/** Bibliographic metadata. Deliberately never read by {@link runPipeline}; see below. */
export interface FixtureMetadata {
    readonly title: string;
    readonly author: string;
    readonly year: number;
}

/** Every input the fixture pipeline is allowed to depend on. */
export interface PipelineInputs {
    readonly sourceId: string;
    readonly bytes: Uint8Array;
    readonly parserVersion: string;
    readonly chunkSize: number;
    readonly embeddingModel: string;
    readonly policyVersion: string;
    /**
     * Present so the boundary suite can correct it and assert that nothing moves. The pipeline
     * never reads it, and that is the point: this fixture fails the day metadata leaks into a
     * preimage, which is what would silently break a citation after a typo is fixed.
     */
    readonly metadata: FixtureMetadata;
}

/** Every identifier the fixture pipeline produces, keyed for partition assertions. */
export interface PipelineIdentities {
    readonly sourceId: string;
    readonly sourceVersionId: string;
    readonly extractionFingerprint: string;
    readonly extractionArtifactId: string;
    readonly singleSpanPassageId: string;
    readonly multiSpanPassageId: string;
    readonly chunkFingerprint: string;
    readonly chunkArtifactId: string;
    readonly embeddingFingerprint: string;
    readonly embeddingArtifactId: string;
}

/** The keys of {@link PipelineIdentities}, in ladder order. */
export type IdentityKey = keyof PipelineIdentities;

export const IDENTITY_KEYS: readonly IdentityKey[] = [
    'sourceId',
    'sourceVersionId',
    'extractionFingerprint',
    'extractionArtifactId',
    'singleSpanPassageId',
    'multiSpanPassageId',
    'chunkFingerprint',
    'chunkArtifactId',
    'embeddingFingerprint',
    'embeddingArtifactId'
];

/** The text of the fixture document, as the bytes that would be ingested. */
export const FIXTURE_DOCUMENT =
    'Institutional trust in survey research declined between 1998 and 2016. '
    + 'The decline was sharpest among respondents with no prior contact with the institution. '
    + 'We report response rates by wave in Table 2.';

/** A single contiguous quotation. */
export const SINGLE_SPAN: readonly TextSpan[] = [{ start: 0, end: 70 }];

/** A quotation interrupted by an intervening sentence, carried as two ascending ranges. */
export const MULTI_SPAN: readonly TextSpan[] = [{ start: 71, end: 120 }, { start: 164, end: 196 }];

/** The unmutated inputs every boundary case is compared against. */
export const BASELINE_INPUTS: PipelineInputs = {
    sourceId: FIXTURE_SOURCE_ID,
    bytes: encoder.encode(FIXTURE_DOCUMENT),
    parserVersion: '2.4.1',
    chunkSize: 512,
    embeddingModel: 'text-embedding-3-large',
    policyVersion: FIXTURE_POLICY_VERSION,
    metadata: {
        title: 'Institutional Trust and Survey Nonresponse',
        author: 'Okonkwo, A.',
        year: 2019
    }
};

/**
 * Derives the full identity ladder for one set of inputs.
 *
 * Source bytes to source version, extraction, passages, chunks, embeddings — the shape of the
 * real ingestion path, with every step reduced to its identifying inputs.
 */
export function runPipeline(inputs: PipelineInputs): PipelineIdentities {
    const sourceVersionId = deriveSourceVersionId({
        sourceId: inputs.sourceId,
        contentDigest: sourceContentDigest(inputs.bytes)
    }).id;

    const extractionFingerprint = deriveExecutionFingerprint({
        transformation: 'docling.convert',
        transformationVersion: inputs.parserVersion,
        inputIds: [sourceVersionId],
        parameters: { ocr: true, layout: 'preserve' },
        policyVersion: inputs.policyVersion
    }).id;

    const extractionArtifactId = deriveArtifactId({
        fingerprint: extractionFingerprint,
        outputRole: 'text',
        determinism: 'deterministic'
    }).id;

    const passageId = (spans: readonly TextSpan[]): string => derivePassageId({
        sourceVersionId,
        extractionArtifactId,
        spans
    }).id;

    const chunkFingerprint = deriveExecutionFingerprint({
        transformation: 'chunker.fixed-window',
        transformationVersion: '1.2.0',
        inputIds: [extractionArtifactId],
        parameters: { chunkSize: inputs.chunkSize, overlap: 64 },
        policyVersion: inputs.policyVersion
    }).id;

    const chunkArtifactId = deriveArtifactId({
        fingerprint: chunkFingerprint,
        outputRole: 'chunks',
        determinism: 'deterministic'
    }).id;

    const embeddingFingerprint = deriveExecutionFingerprint({
        transformation: 'embedding.encode',
        transformationVersion: '1.0.0',
        inputIds: [chunkArtifactId],
        parameters: { model: inputs.embeddingModel },
        policyVersion: inputs.policyVersion
    }).id;

    // An embedding provider is an `observed` transformation: identical inputs need not return
    // identical vectors, so the output digest joins the artifact's preimage. The fixture stands
    // in for the provider with a digest derived from the model, keeping the suite deterministic
    // while still exercising the observed path.
    const embeddingArtifactId = deriveArtifactId({
        fingerprint: embeddingFingerprint,
        outputRole: 'vectors',
        determinism: 'observed',
        outputDigest: digestHex(`vectors of ${inputs.embeddingModel} over ${chunkArtifactId}`)
    }).id;

    return {
        sourceId: inputs.sourceId,
        sourceVersionId,
        extractionFingerprint,
        extractionArtifactId,
        singleSpanPassageId: passageId(SINGLE_SPAN),
        multiSpanPassageId: passageId(MULTI_SPAN),
        chunkFingerprint,
        chunkArtifactId,
        embeddingFingerprint,
        embeddingArtifactId
    };
}

/** Applies one controlled mutation to the baseline inputs. */
export function mutate(patch: Partial<PipelineInputs>): PipelineInputs {
    return { ...BASELINE_INPUTS, ...patch };
}

/** The fixture document with one sentence revised, standing in for replaced source bytes. */
export function revisedDocumentBytes(): Uint8Array {
    return encoder.encode(FIXTURE_DOCUMENT.replace('1998 and 2016', '1998 and 2020'));
}
