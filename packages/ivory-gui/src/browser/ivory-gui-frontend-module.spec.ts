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

const moduleSource = readFileSync('src/browser/ivory-gui-frontend-module.ts', 'utf8');

describe('Ivory GUI frontend module build boundary', () => {
    it('imports package-source assets instead of missing lib-relative CSS files', () => {
        expect(moduleSource).to.contain('../../src/browser/style/ivory-gui.css');
        expect(moduleSource).to.contain('../../src/browser/tokens/ivory-semantic-tokens.css');
        expect(moduleSource).to.contain('../../src/browser/tokens/liquidify.generated.css');
        expect(moduleSource).not.to.contain("import './style/ivory-gui.css'");
    });
});
