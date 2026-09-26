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
import { canonicalJson } from './canonical-json';
import { IvoryContractErrorCode } from './ivory-contract-error';
import { refusalCode } from './test/refusal-code';

describe('canonicalJson', () => {

    it('sorts members and drops insignificant whitespace', () => {
        expect(canonicalJson({ b: [1, { d: true, c: 'x' }], a: 'y' })).to.equal('{"a":"y","b":[1,{"c":"x","d":true}]}');
    });

    it('writes negative zero as 0', () => {
        expect(canonicalJson(-0)).to.equal('0');
    });

    it('accepts an object without a prototype', () => {
        // eslint-disable-next-line no-null/no-null
        expect(canonicalJson(Object.assign(Object.create(null), { a: 1 }))).to.equal('{"a":1}');
    });

    it('accepts a value that two members share', () => {
        const shared = { a: 1 };
        expect(canonicalJson({ x: shared, y: [shared] })).to.equal('{"x":{"a":1},"y":[{"a":1}]}');
    });

    describe('refuses what JSON.stringify would silently drop or convert', () => {
        class Point {
            x = 1;
        }
        const cases: [string, unknown, IvoryContractErrorCode][] = [
            ['undefined', undefined, 'unsupported-value'],
            ['a member whose value is undefined', { a: undefined }, 'unsupported-value'],
            ['a function', () => 1, 'unsupported-value'],
            ['a symbol', Symbol('s'), 'unsupported-value'],
            ['a bigint', BigInt(1), 'unsupported-value'],
            ['a Date', new Date(0), 'unsupported-value'],
            ['a Map', new Map([['a', 1]]), 'unsupported-value'],
            ['a class instance', new Point(), 'unsupported-value'],
            ['an array hole', new Array(1), 'unsupported-value'],
            ['NaN', NaN, 'non-finite-number'],
            ['-Infinity', -Infinity, 'non-finite-number'],
            ['a lone surrogate', String.fromCharCode(0xd800), 'lone-surrogate'],
            ['a lone surrogate in a member name', { [String.fromCharCode(0xdc00)]: 1 }, 'lone-surrogate']
        ];
        for (const [name, value, code] of cases) {
            it(name, () => {
                expect(refusalCode(() => canonicalJson(value))).to.equal(code);
            });
        }

        it('a value that contains itself', () => {
            const cycle: unknown[] = [];
            cycle.push({ cycle });
            expect(refusalCode(() => canonicalJson(cycle))).to.equal('cyclic-value');
        });
    });
});
