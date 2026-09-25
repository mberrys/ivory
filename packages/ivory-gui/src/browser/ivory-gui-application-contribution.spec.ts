// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { enableJSDOM } from '@theia/core/lib/browser/test/jsdom';

let disableJSDOM = enableJSDOM();

import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
FrontendApplicationConfigProvider.set({});

import { expect } from 'chai';
import { IvoryGuiApplicationContribution } from './ivory-gui-application-contribution';

disableJSDOM();

describe('Ivory GUI application contribution', () => {
    before(() => disableJSDOM = enableJSDOM());
    after(() => disableJSDOM());

    it('sets and removes the reversible prototype marker', () => {
        const contribution = new IvoryGuiApplicationContribution();

        contribution.initialize();
        expect(document.documentElement.dataset.ivoryGui).to.equal('prototype');

        contribution.onStop();
        expect(document.documentElement.dataset.ivoryGui).to.equal(undefined);
    });
});
