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
import { formatIdentifier, IdentifierFormatError } from './identifier';
import { IdentifierAlias, resolveIdentifier } from './identifier-alias';

const CANONICAL = formatIdentifier('source', '0b7bd0e7bd2d4f2f9c4e6a1d8f3b5c72');
const SUPERSEDED = formatIdentifier('source', '9a1c4e8f2b6d40a3b8e5c7f1d2a4b6e8');

function alias(from: string, to: string): IdentifierAlias {
    return {
        alias: from,
        aliasScheme: 'iv-id/0',
        canonicalId: to,
        reason: 'scheme migration fixture',
        createdAt: '2026-01-01T00:00:00.000Z',
    };
}

describe('resolveIdentifier', () => {
    const aliases = new Map([
        ['legacy-source-4711', alias('legacy-source-4711', CANONICAL)],
        [SUPERSEDED, alias(SUPERSEDED, CANONICAL)],
    ]);

    it('resolves a current identifier without consulting the alias table', () => {
        expect(resolveIdentifier(CANONICAL, new Map())).to.equal(CANONICAL);
    });

    it('resolves a foreign reference to its canonical identifier', () => {
        expect(resolveIdentifier('legacy-source-4711', aliases)).to.equal(CANONICAL);
    });

    it('resolves a superseded identifier to its canonical identifier', () => {
        expect(resolveIdentifier(SUPERSEDED, aliases)).to.equal(CANONICAL);
    });

    it('honours the expected kind', () => {
        expect(resolveIdentifier('legacy-source-4711', aliases, 'source')).to.equal(CANONICAL);
        expect(() => resolveIdentifier('legacy-source-4711', aliases, 'passage')).to.throw(IdentifierFormatError);
    });

    it('reports an unknown reference rather than guessing', () => {
        expect(resolveIdentifier('legacy-source-9999', aliases)).to.be.undefined;
        expect(resolveIdentifier('', aliases)).to.be.undefined;
    });

    it('refuses to follow an alias chain', () => {
        const chained = new Map([
            ['a', alias('a', SUPERSEDED)],
            [SUPERSEDED, alias(SUPERSEDED, CANONICAL)],
        ]);
        expect(() => resolveIdentifier('a', chained)).to.throw(IdentifierFormatError, 'itself an alias');
    });
});
