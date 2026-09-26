// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { readFileSync } from 'fs';
import * as path from 'path';
import { canonicalJson } from '../common/canonical-json';
import { Sha256Digest } from '../common/sha256-digest';
import { refusalCode } from '../common/test/refusal-code';
import { canonicalDigest } from './canonical-digest';

interface CanonicalJsonVectors {
    readonly valid: readonly { name: string; json: string; canonical: string; digest: string }[];
    readonly invalid: readonly { name: string; json: string; code: string }[];
    readonly numbers: readonly { bits: string; canonical: string }[];
    readonly invalidNumbers: readonly { name: string; bits: string; code: string }[];
}

const vectors: CanonicalJsonVectors = JSON.parse(readFileSync(path.resolve(__dirname, '../../test-resources/canonical-json-vectors.json'), 'utf8'));
const double = (bits: string): number => Buffer.from(bits, 'hex').readDoubleBE(0);

describe('canonical JSON vectors shared with the Python implementation', () => {

    for (const vector of vectors.valid) {
        it(vector.name, () => {
            const value = JSON.parse(vector.json);
            expect(canonicalJson(value)).to.equal(vector.canonical);
            expect(canonicalDigest(value)).to.equal(vector.digest);
            expect(Sha256Digest.is(vector.digest)).to.be.true;
        });
    }

    for (const vector of vectors.invalid) {
        it(`refuses ${vector.name}`, () => {
            expect(refusalCode(() => canonicalDigest(JSON.parse(vector.json)))).to.equal(vector.code);
        });
    }

    it('serializes the RFC 8785 number samples', () => {
        for (const { bits, canonical } of vectors.numbers) {
            expect(canonicalJson(double(bits)), bits).to.equal(canonical);
        }
    });

    for (const vector of vectors.invalidNumbers) {
        it(`refuses ${vector.name}`, () => {
            expect(refusalCode(() => canonicalJson(double(vector.bits)))).to.equal(vector.code);
        });
    }
});
