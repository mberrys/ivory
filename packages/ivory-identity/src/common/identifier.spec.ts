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
import {
    formatIdentifier,
    identifierResourceUri,
    IdentifierFormatError,
    isIdentifier,
    parseIdentifier,
    parseResourceUri,
    tryParseIdentifier,
} from './identifier';
import { IDENTIFIER_KINDS } from './identity-scheme';

const DIGEST = '0b7bd0e7bd2d4f2f9c4e6a1d8f3b5c72';
const PROJECT_ID = formatIdentifier('project', DIGEST);
const PASSAGE_ID = formatIdentifier('passage', '1f0c9a3e5b7d2c4a6e8f0b1d3c5a7e92');

describe('identifier grammar', () => {
    it('formats and parses every kind', () => {
        for (const kind of IDENTIFIER_KINDS) {
            const id = formatIdentifier(kind, DIGEST);
            expect(parseIdentifier(id), kind).to.deep.equal({ kind, digest: DIGEST });
        }
    });

    it('gives every kind a distinct prefix', () => {
        const ids = IDENTIFIER_KINDS.map(kind => formatIdentifier(kind, DIGEST));
        expect(new Set(ids).size).to.equal(IDENTIFIER_KINDS.length);
    });

    it('rejects a digest that is not exactly 32 lowercase hex characters', () => {
        expect(() => formatIdentifier('source', DIGEST.toUpperCase())).to.throw(IdentifierFormatError);
        expect(() => formatIdentifier('source', DIGEST.slice(0, 31))).to.throw(IdentifierFormatError);
        expect(() => formatIdentifier('source', `${DIGEST}0`)).to.throw(IdentifierFormatError);
        expect(() => formatIdentifier('source', 'g'.repeat(32))).to.throw(IdentifierFormatError);
    });

    it('rejects malformed references rather than coercing them', () => {
        for (const value of [
            '',
            'src',
            'src_',
            '_'.concat(DIGEST),
            `src-${DIGEST}`,
            `unknown_${DIGEST}`,
            ` src_${DIGEST}`,
            `src_${DIGEST} `,
        ]) {
            expect(isIdentifier(value), JSON.stringify(value)).to.be.false;
        }
    });

    it('rejects an identifier that has been upper-cased in transit', () => {
        expect(isIdentifier(`src_${DIGEST}`.toUpperCase())).to.be.false;
    });

    it('refuses to read one kind as another', () => {
        expect(tryParseIdentifier(PASSAGE_ID, 'sourceVersion')).to.be.undefined;
        expect(() => parseIdentifier(PASSAGE_ID, 'sourceVersion')).to.throw(IdentifierFormatError);
    });

    it('does not confuse the source and source-version prefixes', () => {
        expect(parseIdentifier(formatIdentifier('source', DIGEST)).kind).to.equal('source');
        expect(parseIdentifier(formatIdentifier('sourceVersion', DIGEST)).kind).to.equal('sourceVersion');
    });
});

describe('identifier carriage safety', () => {
    it('survives URL encoding unchanged', () => {
        for (const kind of IDENTIFIER_KINDS) {
            const id = formatIdentifier(kind, DIGEST);
            expect(encodeURIComponent(id), kind).to.equal(id);
        }
    });

    it('survives a JSON round-trip unchanged', () => {
        expect(JSON.parse(JSON.stringify({ id: PASSAGE_ID })).id).to.equal(PASSAGE_ID);
    });

    it('needs no escaping in a URL path, a query value, or a file name', () => {
        const url = new URL(`https://example.org/p/${PASSAGE_ID}?ref=${PASSAGE_ID}`);
        expect(url.pathname).to.equal(`/p/${PASSAGE_ID}`);
        expect(url.searchParams.get('ref')).to.equal(PASSAGE_ID);
        // Only lowercase letters, digits, and one underscore, so nothing needs escaping anywhere.
        expect(PASSAGE_ID).to.match(/^[a-z]+_[0-9a-f]+$/);
    });

    it('is unchanged by trimming and case-preserving transport', () => {
        expect(PASSAGE_ID.trim()).to.equal(PASSAGE_ID);
        expect(PASSAGE_ID.toLowerCase()).to.equal(PASSAGE_ID);
    });
});

describe('resource URIs', () => {
    it('round-trips an unscoped reference', () => {
        const uri = identifierResourceUri('passage', PASSAGE_ID);
        expect(uri).to.equal(`ivory://passage/${PASSAGE_ID}`);
        expect(parseResourceUri(uri)).to.deep.equal({ kind: 'passage', id: PASSAGE_ID });
    });

    it('round-trips a project-scoped reference', () => {
        const uri = identifierResourceUri('passage', PASSAGE_ID, PROJECT_ID);
        expect(uri).to.equal(`ivory://project/${PROJECT_ID}/passage/${PASSAGE_ID}`);
        expect(parseResourceUri(uri)).to.deep.equal({ kind: 'passage', id: PASSAGE_ID, projectId: PROJECT_ID });
    });

    it('round-trips every kind', () => {
        for (const kind of IDENTIFIER_KINDS) {
            const id = formatIdentifier(kind, DIGEST);
            expect(parseResourceUri(identifierResourceUri(kind, id)), kind).to.deep.equal({ kind, id });
        }
    });

    it('does not confuse an unscoped project reference with a scoped one', () => {
        expect(parseResourceUri(`ivory://project/${PROJECT_ID}`)).to.deep.equal({ kind: 'project', id: PROJECT_ID });
    });

    it('parses as a standard URI', () => {
        const url = new URL(identifierResourceUri('passage', PASSAGE_ID, PROJECT_ID));
        expect(url.protocol).to.equal('ivory:');
        expect(url.href).to.equal(identifierResourceUri('passage', PASSAGE_ID, PROJECT_ID));
    });

    it('rejects a URI whose identifier does not match its declared kind', () => {
        expect(parseResourceUri(`ivory://source-version/${PASSAGE_ID}`)).to.be.undefined;
    });

    it('rejects unknown schemes, unknown kinds, and malformed shapes', () => {
        for (const uri of [
            `https://passage/${PASSAGE_ID}`,
            `ivory://unknown/${PASSAGE_ID}`,
            `ivory://passage/${PASSAGE_ID}/extra`,
            'ivory://passage',
            `ivory://corpus/${PROJECT_ID}/passage/${PASSAGE_ID}`,
        ]) {
            expect(parseResourceUri(uri), uri).to.be.undefined;
        }
    });

    it('refuses to build a URI from an identifier of the wrong kind', () => {
        expect(() => identifierResourceUri('sourceVersion', PASSAGE_ID)).to.throw(IdentifierFormatError);
        expect(() => identifierResourceUri('passage', PASSAGE_ID, PASSAGE_ID)).to.throw(IdentifierFormatError);
    });
});
