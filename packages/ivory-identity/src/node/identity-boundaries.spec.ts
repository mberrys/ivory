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

import { expect } from 'chai';
import { IDENTIFIER_PATTERN } from '../common/identifier';
import { mintIdentifier } from './identity';
import {
    BASELINE_INPUTS, FIXTURE_OTHER_SOURCE_ID, FIXTURE_REVISED_POLICY_VERSION, IDENTITY_KEYS, IdentityKey, mutate, PipelineIdentities, revisedDocumentBytes, runPipeline
} from './test/identity-fixtures';

/**
 * The IV-17 verification clause, executed: run deterministic fixtures twice and compare every
 * generated identifier, then mutate one controlled input and verify the expected identity
 * boundary.
 *
 * Each boundary case asserts the whole partition — which identifiers moved *and* which held —
 * because a rule that over-invalidates destroys citations just as surely as one that
 * under-invalidates lets them drift.
 */
describe('identity boundaries', () => {

    const baseline = runPipeline(BASELINE_INPUTS);

    function expectPartition(mutated: PipelineIdentities, changed: readonly IdentityKey[]): void {
        const expectedToChange = new Set(changed);
        for (const key of IDENTITY_KEYS) {
            if (expectedToChange.has(key)) {
                expect(mutated[key], `${key} was expected to change`).to.not.equal(baseline[key]);
            } else {
                expect(mutated[key], `${key} was expected to hold`).to.equal(baseline[key]);
            }
        }
    }

    describe('determinism', () => {

        it('reproduces every identifier when the same inputs are run twice', () => {
            expect(runPipeline(BASELINE_INPUTS)).to.deep.equal(runPipeline(BASELINE_INPUTS));
        });

        it('reproduces every identifier from a separately constructed copy of the inputs', () => {
            // Guards against identity accidentally depending on object references rather than values.
            expect(runPipeline(mutate({}))).to.deep.equal(baseline);
        });

        it('produces well-formed identifiers throughout the ladder', () => {
            for (const key of IDENTITY_KEYS) {
                expect(baseline[key], key).to.match(IDENTIFIER_PATTERN);
            }
        });

        it('gives every rung of the ladder a distinct identifier', () => {
            const values = IDENTITY_KEYS.map(key => baseline[key]);
            expect(new Set(values).size).to.equal(values.length);
        });
    });

    describe('controlled mutations', () => {

        it('replacing the source bytes moves everything below the source', () => {
            expectPartition(runPipeline(mutate({ bytes: revisedDocumentBytes() })), [
                'sourceVersionId',
                'extractionFingerprint',
                'extractionArtifactId',
                'singleSpanPassageId',
                'multiSpanPassageId',
                'chunkFingerprint',
                'chunkArtifactId',
                'embeddingFingerprint',
                'embeddingArtifactId'
            ]);
        });

        it('correcting bibliographic metadata moves nothing', () => {
            expectPartition(runPipeline(mutate({
                metadata: { title: 'Institutional Trust and Survey Non-response', author: 'Okonkwo, Adaeze', year: 2019 }
            })), []);
        });

        it('bumping the parser version moves the extraction and everything below it, but not the source version', () => {
            expectPartition(runPipeline(mutate({ parserVersion: '2.5.0' })), [
                'extractionFingerprint',
                'extractionArtifactId',
                'singleSpanPassageId',
                'multiSpanPassageId',
                'chunkFingerprint',
                'chunkArtifactId',
                'embeddingFingerprint',
                'embeddingArtifactId'
            ]);
        });

        it('changing the chunk size moves the chunks and embeddings, but never a passage', () => {
            expectPartition(runPipeline(mutate({ chunkSize: 256 })), [
                'chunkFingerprint',
                'chunkArtifactId',
                'embeddingFingerprint',
                'embeddingArtifactId'
            ]);
        });

        it('changing the embedding model moves only the embeddings', () => {
            expectPartition(runPipeline(mutate({ embeddingModel: 'text-embedding-3-small' })), [
                'embeddingFingerprint',
                'embeddingArtifactId'
            ]);
        });

        it('changing the policy version reaches every computation but no source version', () => {
            expectPartition(runPipeline(mutate({ policyVersion: FIXTURE_REVISED_POLICY_VERSION })), [
                'extractionFingerprint',
                'extractionArtifactId',
                'singleSpanPassageId',
                'multiSpanPassageId',
                'chunkFingerprint',
                'chunkArtifactId',
                'embeddingFingerprint',
                'embeddingArtifactId'
            ]);
        });

        it('ingesting identical bytes under a different source yields a different version', () => {
            expectPartition(runPipeline(mutate({ sourceId: FIXTURE_OTHER_SOURCE_ID })), IDENTITY_KEYS);
        });
    });

    describe('citation survival', () => {

        it('re-indexing unchanged bytes preserves the source version and its passages', () => {
            const reindexed = runPipeline(BASELINE_INPUTS);
            expect(reindexed.sourceVersionId).to.equal(baseline.sourceVersionId);
            expect(reindexed.singleSpanPassageId).to.equal(baseline.singleSpanPassageId);
            expect(reindexed.multiSpanPassageId).to.equal(baseline.multiSpanPassageId);
        });

        it('leaves prior references derivable after the source bytes are replaced', () => {
            const revised = runPipeline(mutate({ bytes: revisedDocumentBytes() }));
            expect(revised.sourceVersionId).to.not.equal(baseline.sourceVersionId);
            // The point of AC-2: the earlier version is not overwritten or invalidated, it is
            // still derivable from the bytes it was made of, so citations against it hold.
            expect(runPipeline(BASELINE_INPUTS).sourceVersionId).to.equal(baseline.sourceVersionId);
        });

        it('separates a run from the computation it performs', () => {
            const first = runPipeline(BASELINE_INPUTS);
            const second = runPipeline(BASELINE_INPUTS);
            expect(second.extractionFingerprint, 'identical inputs share a fingerprint').to.equal(first.extractionFingerprint);
            expect(mintIdentifier('execution'), 'each run is its own execution').to.not.equal(mintIdentifier('execution'));
        });
    });
});
