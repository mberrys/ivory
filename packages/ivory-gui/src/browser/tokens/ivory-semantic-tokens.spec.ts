// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { readFileSync } from 'fs';
import { expect } from 'chai';

const semanticPath = 'src/browser/tokens/ivory-semantic-tokens.css';
const snapshotPath = 'src/browser/tokens/liquidify.generated.css';
const sourcePath = 'src/browser/tokens/liquidify.source.json';

const semantic = readFileSync(semanticPath, 'utf8');
const snapshot = readFileSync(snapshotPath, 'utf8');
const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as {
    revision: string;
    sourcePaths: string[];
};

describe('Ivory semantic token snapshot', () => {
    it('pins the reviewed LiqUIdify source', () => {
        expect(source.revision).to.equal('bc462c6e0bcc502938013b02c6434ac06c8350a0');
        expect(source.sourcePaths).to.deep.equal(['styled-system/styles.css', 'panda.config.ts']);
    });

    it('defines every required semantic role', () => {
        for (const token of [
            'ivory-canvas', 'ivory-surface', 'ivory-surface-raised', 'ivory-ink', 'ivory-muted',
            'ivory-accent', 'ivory-border', 'ivory-focus', 'ivory-success', 'ivory-warning', 'ivory-danger'
        ]) {
            expect(semantic).to.contain(`--${token}:`);
        }
    });

    it('keeps the vendored snapshot attributed and free of runtime imports', () => {
        expect(snapshot).to.contain('bc462c6e0bcc502938013b02c6434ac06c8350a0');
        expect(snapshot).not.to.contain('http://');
        expect(snapshot).not.to.contain('https://');
    });
});
