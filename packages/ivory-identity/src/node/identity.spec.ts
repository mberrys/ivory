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
import { IdentifierFormatError, isIdentifier } from '../common/identifier';
import { IDENTIFIER_SCHEME_VERSION } from '../common/identity-scheme';
import { digestHex } from './digest';
import {
    assertConsistentIdentity, computeQuoteSelector, createArtifactRecord, deriveArtifactId, deriveExecutionFingerprint, derivePassageId, deriveSourceVersionId,
    IdentifierCollisionError, IdentityDerivationError, mintIdentifier, sourceContentDigest
} from './identity';
import { BASELINE_INPUTS, FIXTURE_POLICY_VERSION, FIXTURE_SOURCE_ID, runPipeline } from './test/identity-fixtures';

const CONTENT_DIGEST = sourceContentDigest(BASELINE_INPUTS.bytes);

function fingerprint(overrides: Partial<Parameters<typeof deriveExecutionFingerprint>[0]> = {}): string {
    return deriveExecutionFingerprint({
        transformation: 'docling.convert',
        transformationVersion: '2.4.1',
        inputIds: [deriveSourceVersionId({ sourceId: FIXTURE_SOURCE_ID, contentDigest: CONTENT_DIGEST }).id],
        parameters: { ocr: true },
        policyVersion: FIXTURE_POLICY_VERSION,
        ...overrides
    }).id;
}

describe('minting', () => {

    it('mints a well-formed identifier for each minted kind', () => {
        for (const kind of ['project', 'corpus', 'source', 'execution'] as const) {
            expect(isIdentifier(mintIdentifier(kind), kind), kind).to.be.true;
        }
    });

    it('never mints the same identifier twice', () => {
        const minted = new Set(Array.from({ length: 1000 }, () => mintIdentifier('source')));
        expect(minted.size).to.equal(1000);
    });

    it('refuses to mint a derived kind', () => {
        for (const kind of ['sourceVersion', 'passage', 'artifact', 'fingerprint'] as const) {
            expect(() => mintIdentifier(kind), kind).to.throw(IdentifierFormatError);
        }
    });
});

describe('deriveSourceVersionId', () => {

    it('depends on the source and the bytes', () => {
        const baseline = deriveSourceVersionId({ sourceId: FIXTURE_SOURCE_ID, contentDigest: CONTENT_DIGEST });
        const otherBytes = deriveSourceVersionId({ sourceId: FIXTURE_SOURCE_ID, contentDigest: digestHex('other bytes') });
        expect(otherBytes.id).to.not.equal(baseline.id);
    });

    it('retains the full digest and the preimage that produced it', () => {
        const derived = deriveSourceVersionId({ sourceId: FIXTURE_SOURCE_ID, contentDigest: CONTENT_DIGEST });
        expect(derived.digest).to.match(/^[0-9a-f]{64}$/);
        expect(derived.id).to.equal(`sv_${derived.digest.slice(0, 32)}`);
        expect(derived.preimage).to.contain(FIXTURE_SOURCE_ID).and.to.contain(CONTENT_DIGEST);
    });

    it('rejects a source identifier of the wrong kind', () => {
        expect(() => deriveSourceVersionId({ sourceId: mintIdentifier('corpus'), contentDigest: CONTENT_DIGEST })).to.throw(IdentifierFormatError);
    });

    it('rejects a truncated content digest', () => {
        expect(() => deriveSourceVersionId({ sourceId: FIXTURE_SOURCE_ID, contentDigest: CONTENT_DIGEST.slice(0, 32) })).to.throw(IdentityDerivationError);
    });
});

describe('deriveExecutionFingerprint', () => {

    it('ignores the order in which dependencies were assembled', () => {
        const a = mintIdentifier('source');
        const b = mintIdentifier('source');
        expect(fingerprint({ inputIds: [a, b] })).to.equal(fingerprint({ inputIds: [b, a] }));
    });

    it('rejects a dependency listed twice', () => {
        const id = mintIdentifier('source');
        expect(() => fingerprint({ inputIds: [id, id] })).to.throw(IdentityDerivationError, 'listed twice');
    });

    it('distinguishes a parameter value from its string form', () => {
        expect(fingerprint({ parameters: { chunkSize: 512 } })).to.not.equal(fingerprint({ parameters: { chunkSize: '512' } }));
        expect(fingerprint({ parameters: { ocr: true } })).to.not.equal(fingerprint({ parameters: { ocr: 'true' } }));
    });

    it('is unaffected by the key order of the parameters', () => {
        expect(fingerprint({ parameters: { a: 1, b: 2 } })).to.equal(fingerprint({ parameters: { b: 2, a: 1 } }));
    });

    it('distinguishes an absent parameter from an empty one', () => {
        expect(fingerprint({ parameters: {} })).to.not.equal(fingerprint({ parameters: { ocr: '' } }));
    });

    it('separates parameters that would collide under naive concatenation', () => {
        expect(fingerprint({ parameters: { a: 'x', b: 'yz' } })).to.not.equal(fingerprint({ parameters: { a: 'xy', b: 'z' } }));
    });

    it('changes when the policy version changes', () => {
        expect(fingerprint({ policyVersion: 'iv-policy/2' })).to.not.equal(fingerprint());
    });

    it('rejects a non-finite numeric parameter', () => {
        expect(() => fingerprint({ parameters: { temperature: Number.NaN } })).to.throw(IdentityDerivationError, 'finite');
    });

    it('rejects an empty transformation name or version', () => {
        expect(() => fingerprint({ transformation: '' })).to.throw(IdentityDerivationError);
        expect(() => fingerprint({ transformationVersion: '' })).to.throw(IdentityDerivationError);
    });
});

describe('deriveArtifactId', () => {

    it('reproduces a deterministic transformation from its fingerprint alone', () => {
        const fp = fingerprint();
        const first = deriveArtifactId({ fingerprint: fp, outputRole: 'text', determinism: 'deterministic' });
        const second = deriveArtifactId({ fingerprint: fp, outputRole: 'text', determinism: 'deterministic' });
        expect(second.id).to.equal(first.id);
    });

    it('distinguishes the outputs of one computation by role', () => {
        const fp = fingerprint();
        const text = deriveArtifactId({ fingerprint: fp, outputRole: 'text', determinism: 'deterministic' });
        const layout = deriveArtifactId({ fingerprint: fp, outputRole: 'layout', determinism: 'deterministic' });
        expect(layout.id).to.not.equal(text.id);
    });

    it('distinguishes two observed outputs of the same computation', () => {
        const fp = fingerprint();
        const first = deriveArtifactId({ fingerprint: fp, outputRole: 'summary', determinism: 'observed', outputDigest: digestHex('first answer') });
        const second = deriveArtifactId({ fingerprint: fp, outputRole: 'summary', determinism: 'observed', outputDigest: digestHex('second answer') });
        expect(second.id).to.not.equal(first.id);
    });

    it('never gives an observed output the identifier a deterministic one would get', () => {
        const fp = fingerprint();
        const observed = deriveArtifactId({ fingerprint: fp, outputRole: 'text', determinism: 'observed', outputDigest: digestHex('text') });
        const deterministic = deriveArtifactId({ fingerprint: fp, outputRole: 'text', determinism: 'deterministic' });
        expect(observed.id).to.not.equal(deterministic.id);
    });

    it('requires an observed transformation to declare its output digest', () => {
        expect(() => deriveArtifactId({ fingerprint: fingerprint(), outputRole: 'summary', determinism: 'observed' }))
            .to.throw(IdentityDerivationError, 'must supply the digest');
    });

    it('refuses to fold an output digest into a deterministic artifact', () => {
        expect(() => deriveArtifactId({
            fingerprint: fingerprint(), outputRole: 'text', determinism: 'deterministic', outputDigest: digestHex('text')
        })).to.throw(IdentityDerivationError, 'reproducible');
    });
});

describe('derivePassageId', () => {

    const identities = runPipeline(BASELINE_INPUTS);

    function passage(spans: { start: number, end: number }[]): string {
        return derivePassageId({
            sourceVersionId: identities.sourceVersionId,
            extractionArtifactId: identities.extractionArtifactId,
            spans
        }).id;
    }

    it('distinguishes adjacent spans of equal length', () => {
        expect(passage([{ start: 10, end: 20 }])).to.not.equal(passage([{ start: 20, end: 30 }]));
    });

    it('distinguishes one span from two spans covering the same characters', () => {
        expect(passage([{ start: 10, end: 30 }])).to.not.equal(passage([{ start: 10, end: 20 }, { start: 20, end: 30 }]));
    });

    it('separates span lists whose digits would run together without framing', () => {
        expect(passage([{ start: 1, end: 2 }, { start: 3, end: 45 }])).to.not.equal(passage([{ start: 1, end: 23 }, { start: 45, end: 46 }]));
    });

    it('is bound to the extraction the offsets were measured in', () => {
        const other = derivePassageId({
            sourceVersionId: identities.sourceVersionId,
            extractionArtifactId: deriveArtifactId({ fingerprint: fingerprint({ transformationVersion: '9.9.9' }), outputRole: 'text', determinism: 'deterministic' }).id,
            spans: [{ start: 10, end: 20 }]
        }).id;
        expect(other).to.not.equal(passage([{ start: 10, end: 20 }]));
    });

    it('rejects spans that are empty, inverted, negative, or out of order', () => {
        expect(() => passage([])).to.throw();
        expect(() => passage([{ start: 20, end: 10 }])).to.throw();
        expect(() => passage([{ start: -1, end: 10 }])).to.throw();
        expect(() => passage([{ start: 30, end: 40 }, { start: 10, end: 20 }])).to.throw();
        expect(() => passage([{ start: 10, end: 25 }, { start: 20, end: 30 }])).to.throw();
    });

    it('rejects an extraction identifier of the wrong kind', () => {
        expect(() => derivePassageId({
            sourceVersionId: identities.sourceVersionId,
            extractionArtifactId: identities.chunkFingerprint,
            spans: [{ start: 0, end: 5 }]
        })).to.throw(IdentifierFormatError);
    });
});

describe('computeQuoteSelector', () => {

    it('recovers the same selector across whitespace and Unicode composition differences', () => {
        const composed = computeQuoteSelector({ prefix: 'as ', exact: 'Adaé reported', suffix: ' in 2019' });
        const decomposed = computeQuoteSelector({ prefix: ' as', exact: 'Adaé reported', suffix: '\nin  2019' });
        expect(decomposed).to.deep.equal(composed);
    });

    it('distinguishes different quotations', () => {
        const first = computeQuoteSelector({ prefix: 'a', exact: 'trust declined', suffix: 'b' });
        const second = computeQuoteSelector({ prefix: 'a', exact: 'trust increased', suffix: 'b' });
        expect(second.exactDigest).to.not.equal(first.exactDigest);
    });

    it('records the normalization version it was computed under', () => {
        expect(computeQuoteSelector({ prefix: '', exact: 'x', suffix: '' }).normalizationVersion).to.equal('iv-norm/1');
    });
});

describe('createArtifactRecord', () => {

    const identities = runPipeline(BASELINE_INPUTS);

    const input = {
        identity: deriveArtifactId({ fingerprint: identities.extractionFingerprint, outputRole: 'text', determinism: 'deterministic' as const }),
        sourceVersionIds: [identities.sourceVersionId],
        transformation: 'docling.convert',
        transformationVersion: '2.4.1',
        determinism: 'deterministic' as const,
        executionFingerprint: identities.extractionFingerprint,
        executionId: mintIdentifier('execution'),
        outputRole: 'text'
    };

    it('states the source versions, transformation, fingerprint, and execution behind an artifact', () => {
        const record = createArtifactRecord(input);
        expect(record.id).to.equal(identities.extractionArtifactId);
        expect(record.sourceVersionIds).to.deep.equal([identities.sourceVersionId]);
        expect(record.transformation).to.equal('docling.convert');
        expect(record.executionFingerprint).to.equal(identities.extractionFingerprint);
        expect(isIdentifier(record.executionId, 'execution')).to.be.true;
        expect(record.identifierSchemeVersion).to.equal(IDENTIFIER_SCHEME_VERSION);
    });

    it('refuses an artifact that declares no source version', () => {
        expect(() => createArtifactRecord({ ...input, sourceVersionIds: [] })).to.throw(IdentityDerivationError);
    });

    it('refuses a source version slot holding something else', () => {
        expect(() => createArtifactRecord({ ...input, sourceVersionIds: [identities.singleSpanPassageId] })).to.throw(IdentifierFormatError);
    });

    it('refuses a fingerprint in the execution slot', () => {
        expect(() => createArtifactRecord({ ...input, executionId: identities.extractionFingerprint })).to.throw(IdentifierFormatError);
    });
});

describe('assertConsistentIdentity', () => {

    const derived = deriveSourceVersionId({ sourceId: FIXTURE_SOURCE_ID, contentDigest: CONTENT_DIGEST });

    it('accepts a re-derivation of the same object', () => {
        expect(() => assertConsistentIdentity(derived, deriveSourceVersionId({ sourceId: FIXTURE_SOURCE_ID, contentDigest: CONTENT_DIGEST }))).to.not.throw();
    });

    it('ignores unrelated identifiers', () => {
        const other = deriveSourceVersionId({ sourceId: FIXTURE_SOURCE_ID, contentDigest: digestHex('other') });
        expect(() => assertConsistentIdentity(derived, other)).to.not.throw();
    });

    it('fails closed when one identifier carries two preimages', () => {
        const forged = { ...derived, preimage: `${derived.preimage}tampered` };
        expect(() => assertConsistentIdentity(derived, forged)).to.throw(IdentifierCollisionError);
    });

    it('reports both preimages so the collision can be investigated', () => {
        const forged = { ...derived, preimage: 'a different preimage' };
        try {
            assertConsistentIdentity(derived, forged);
            expect.fail('expected a collision');
        } catch (error) {
            expect(error).to.be.instanceOf(IdentifierCollisionError);
            expect((error as IdentifierCollisionError).existingPreimage).to.equal(derived.preimage);
            expect((error as IdentifierCollisionError).incomingPreimage).to.equal('a different preimage');
        }
    });
});
