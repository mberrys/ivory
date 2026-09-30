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
import { ExactRef } from './exact-ref';
import { refusalCode } from './test/refusal-code';

describe('ExactRef', () => {

    const ref = { projectId: 'p1', objectId: 'o1', revisionId: 'r1' };

    describe('parse', () => {

        it('returns a frozen copy', () => {
            const parsed = ExactRef.parse(ref);
            expect(parsed).to.deep.equal(ref);
            expect(parsed).to.not.equal(ref);
            expect(Object.isFrozen(parsed)).to.be.true;
        });

        it(`accepts an identifier of exactly ${ExactRef.MAX_ID_LENGTH} characters`, () => {
            expect(refusalCode(() => ExactRef.parse({ ...ref, objectId: 'x'.repeat(ExactRef.MAX_ID_LENGTH) }))).to.be.undefined;
        });

        class Ref {
            projectId = 'p1';
            objectId = 'o1';
            revisionId = 'r1';
        }
        const malformed: [string, unknown][] = [
            ['a missing field', { projectId: 'p1', objectId: 'o1' }],
            ['an extra field', { ...ref, kind: 'Source' }],
            ['a non-string field', { ...ref, revisionId: 1 }],
            ['a blank field', { ...ref, objectId: ' \t' }],
            ['the latest selector', { ...ref, revisionId: ExactRef.LATEST }],
            ['an overlong field', { ...ref, objectId: 'x'.repeat(ExactRef.MAX_ID_LENGTH + 1) }],
            ['an array', ['p1', 'o1', 'r1']],
            ['a class instance', new Ref()],
            ['undefined', undefined]
        ];
        for (const [name, value] of malformed) {
            it(`refuses ${name}`, () => {
                expect(refusalCode(() => ExactRef.parse(value))).to.equal('invalid-exact-ref');
            });
        }

        it('refuses a ref into another project', () => {
            expect(refusalCode(() => ExactRef.parse(ref, 'p2'))).to.equal('cross-project-ref');
        });
    });

    it('is() answers without throwing', () => {
        expect(ExactRef.is(ref)).to.be.true;
        expect(ExactRef.is({ ...ref, revisionId: ExactRef.LATEST })).to.be.false;
    });

    it('equals() compares all three identifiers', () => {
        expect(ExactRef.equals(ref, { ...ref })).to.be.true;
        expect(ExactRef.equals(ref, { ...ref, revisionId: 'r2' })).to.be.false;
    });

    it('key() keeps refs apart whose identifiers concatenate to the same text', () => {
        const a = { projectId: 'p', objectId: 'ab', revisionId: 'c' };
        const b = { projectId: 'p', objectId: 'a', revisionId: 'bc' };
        expect(ExactRef.key(a)).to.not.equal(ExactRef.key(b));
        expect(ExactRef.key(a)).to.equal(ExactRef.key({ ...a }));
    });

    it('compare() orders by project, object, then revision', () => {
        const refs = [
            { projectId: 'p2', objectId: 'a', revisionId: 'a' },
            { projectId: 'p1', objectId: 'b', revisionId: 'a' },
            { projectId: 'p1', objectId: 'a', revisionId: 'b' },
            { projectId: 'p1', objectId: 'a', revisionId: 'a' }
        ];
        expect([...refs].sort(ExactRef.compare)).to.deep.equal([...refs].reverse());
    });
});
