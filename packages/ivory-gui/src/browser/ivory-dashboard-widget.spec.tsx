// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { enableJSDOM, enableReactActEnvironment } from '@theia/core/lib/browser/test/jsdom';

let disableJSDOM = enableJSDOM();
let disableReactActEnvironment = enableReactActEnvironment();

import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
FrontendApplicationConfigProvider.set({});

import { expect } from 'chai';
import * as React from '@theia/core/shared/react';
import { MessageLoop } from '@theia/core/shared/@lumino/messaging';
import { IvoryDashboardWidget } from './ivory-dashboard-widget';

disableReactActEnvironment();
disableJSDOM();

describe('Ivory dashboard widget', () => {
    let widget: IvoryDashboardWidget;

    before(() => {
        disableJSDOM = enableJSDOM();
        disableReactActEnvironment = enableReactActEnvironment();
        FrontendApplicationConfigProvider.set({});
    });
    after(() => {
        disableReactActEnvironment();
        disableJSDOM();
    });

    beforeEach(() => {
        widget = new IvoryDashboardWidget();
    });

    afterEach(() => {
        React.act(() => {
            widget.dispose();
            MessageLoop.flush();
        });
    });

    it('renders the dashboard as a named main landmark', () => {
        React.act(() => {
            widget.update();
            MessageLoop.flush();
        });
        expect(widget.node.querySelector('main[data-ivory-dashboard="true"]')).not.to.equal(undefined);
        expect(widget.node.querySelector('h1')?.textContent).to.equal('Ivory evidence workspace');
    });
});

