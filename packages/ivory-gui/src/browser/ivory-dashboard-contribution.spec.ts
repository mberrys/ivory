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
import { IvoryDashboardContribution } from './ivory-dashboard-contribution';

disableJSDOM();

describe('Ivory dashboard contribution', () => {
    before(() => disableJSDOM = enableJSDOM());
    after(() => disableJSDOM());

    it('exposes a stable toggle command', () => {
        const contribution = new IvoryDashboardContribution();
        expect(contribution.toggleCommand).to.deep.include({
            id: 'ivory.dashboard.toggle',
            label: 'Toggle Ivory evidence workspace'
        });
    });
});
