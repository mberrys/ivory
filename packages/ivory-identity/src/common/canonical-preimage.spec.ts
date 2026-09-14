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
import { canonicalPreimage, CanonicalPreimageError, preimageBytes } from './canonical-preimage';
import { PREIMAGE_VERSION } from './identity-scheme';

describe('canonicalPreimage', () => {
    it('is stable for the same domain and fields', () => {
        expect(canonicalPreimage('passage', [{ name: 'a', value: 'x' }])).to.equal(
            canonicalPreimage('passage', [{ name: 'a', value: 'x' }]),
        );
    });

    it('pins the framing version and the domain', () => {
        const preimage = canonicalPreimage('passage', [{ name: 'a', value: 'x' }]);
        expect(preimage).to.contain(PREIMAGE_VERSION);
        expect(preimage.startsWith(`v\x1f${PREIMAGE_VERSION.length}\x1f${PREIMAGE_VERSION}\x1ed\x1f7\x1fpassage\x1e`)).to.be.true;
    });

    it('separates identical fields belonging to different domains', () => {
        const fields = [{ name: 'a', value: 'x' }];
        expect(canonicalPreimage('artifact', fields)).to.not.equal(canonicalPreimage('passage', fields));
    });

    it('separates values that plain concatenation would merge', () => {
        const left = canonicalPreimage('passage', [
            { name: 'a', value: 'ab' },
            { name: 'b', value: 'c' },
        ]);
        const right = canonicalPreimage('passage', [
            { name: 'a', value: 'a' },
            { name: 'b', value: 'bc' },
        ]);
        expect(right).to.not.equal(left);
    });

    it('is not fooled by a value containing the field separators', () => {
        const injected = canonicalPreimage('passage', [{ name: 'a', value: 'x\x1eb\x1f1\x1fy' }]);
        const genuine = canonicalPreimage('passage', [
            { name: 'a', value: 'x' },
            { name: 'b', value: 'y' },
        ]);
        expect(injected).to.not.equal(genuine);
    });

    it('depends on field order', () => {
        const forward = canonicalPreimage('passage', [
            { name: 'a', value: 'x' },
            { name: 'b', value: 'y' },
        ]);
        const reversed = canonicalPreimage('passage', [
            { name: 'b', value: 'y' },
            { name: 'a', value: 'x' },
        ]);
        expect(reversed).to.not.equal(forward);
    });

    it('counts value length in UTF-8 bytes, not code units', () => {
        const preimage = canonicalPreimage('passage', [{ name: 'a', value: 'é' }]);
        expect(preimage).to.contain('a\x1f2\x1fé\x1e');
        // Every other character is ASCII, so the single two-byte character is the only difference.
        expect(preimageBytes(preimage).length).to.equal(preimage.length + 1);
    });

    it('distinguishes an empty value from an absent field', () => {
        expect(
            canonicalPreimage('passage', [
                { name: 'a', value: '' },
                { name: 'b', value: 'y' },
            ]),
        ).to.not.equal(canonicalPreimage('passage', [{ name: 'b', value: 'y' }]));
    });

    it('nests without ambiguity', () => {
        const inner = canonicalPreimage('parameters', [{ name: 'model', value: 's:large' }]);
        const nested = canonicalPreimage('artifact', [{ name: 'parameters', value: inner }]);
        expect(nested).to.contain(inner);
        expect(nested).to.not.equal(inner);
    });

    it('refuses a preimage with no fields', () => {
        expect(() => canonicalPreimage('passage', [])).to.throw(CanonicalPreimageError, 'no fields');
    });

    it('refuses a duplicated field name', () => {
        expect(() =>
            canonicalPreimage('passage', [
                { name: 'a', value: 'x' },
                { name: 'a', value: 'y' },
            ]),
        ).to.throw(CanonicalPreimageError, 'declared twice');
    });

    it('refuses field names and domains that could disturb the framing', () => {
        expect(() => canonicalPreimage('passage', [{ name: 'a\x1fb', value: 'x' }])).to.throw(CanonicalPreimageError);
        expect(() => canonicalPreimage('passage', [{ name: '', value: 'x' }])).to.throw(CanonicalPreimageError);
        expect(() => canonicalPreimage('passage', [{ name: '1a', value: 'x' }])).to.throw(CanonicalPreimageError);
        expect(() => canonicalPreimage('', [{ name: 'a', value: 'x' }])).to.throw(CanonicalPreimageError);
    });
});
