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
import { filterIvoryEvidence, IvoryEvidence } from './ivory-dashboard-model';

const EVIDENCE: IvoryEvidence[] = [
    {
        title: 'Browser smoke proof',
        summary: 'The real browser bundle opens the evidence workspace.',
        source: 'examples/browser',
        kind: 'Browser',
        status: 'ready'
    },
    {
        title: 'Token provenance',
        summary: 'The pinned token source is recorded beside the semantic layer.',
        source: 'packages/ivory-gui/src/browser/tokens/SOURCE.md',
        kind: 'Provenance',
        status: 'verified'
    }
];

describe('Ivory evidence model', () => {
    it('returns every entry for an empty query', () => {
        expect(filterIvoryEvidence(EVIDENCE, '   ')).to.deep.equal(EVIDENCE);
    });

    it('matches a title case-insensitively', () => {
        expect(filterIvoryEvidence(EVIDENCE, 'sMoKe')).to.deep.equal([EVIDENCE[0]]);
    });

    it('does not return an entry for an absent query', () => {
        expect(filterIvoryEvidence(EVIDENCE, 'terminal')).to.deep.equal([]);
    });

    it('matches every indexed field', () => {
        expect(filterIvoryEvidence(EVIDENCE, 'source.md')).to.deep.equal([EVIDENCE[1]]);
        expect(filterIvoryEvidence(EVIDENCE, 'verified')).to.deep.equal([EVIDENCE[1]]);
    });
});
