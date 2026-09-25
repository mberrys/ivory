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
import { Container } from '@theia/core/shared/inversify';
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

    it('renders when resolved through the production DI container', async () => {
        const container = new Container();
        container.bind(IvoryDashboardWidget).toSelf();

        const resolved = container.get(IvoryDashboardWidget);
        widget = resolved;
        React.act(() => MessageLoop.flush());
        await new Promise<void>(resolve => setImmediate(resolve));
        React.act(() => MessageLoop.flush());

        expect(resolved.node.querySelector('main[data-ivory-dashboard="true"]')).not.to.equal(undefined);
        expect(resolved.node.querySelector('h1')?.textContent).to.equal('Ivory evidence workspace');
    });

    it('renders the dashboard as a named main landmark', () => {
        React.act(() => {
            widget.update();
            MessageLoop.flush();
        });
        expect(widget.node.querySelector('main[data-ivory-dashboard="true"]')).not.to.equal(undefined);
        expect(widget.node.querySelector('h1')?.textContent).to.equal('Ivory evidence workspace');
    });

    it('filters evidence from the search field and exposes an empty state', () => {
        React.act(() => {
            widget.update();
            MessageLoop.flush();
        });
        expect(widget.node.querySelector('input[type="search"]')).not.to.equal(undefined);
        expect(widget.node.querySelectorAll('.ivory-evidence-card')).to.have.length(3);

        React.act(() => {
            widget.setQueryForTest('token');
            MessageLoop.flush();
        });
        expect(widget.node.querySelectorAll('.ivory-evidence-card')).to.have.length(1);
        expect(widget.node.querySelector('.ivory-evidence-card h3')?.textContent).to.equal('Token provenance');

        React.act(() => {
            widget.setQueryForTest('not-found');
            MessageLoop.flush();
        });
        expect(widget.node.querySelector('.ivory-empty-state')?.textContent).to.equal('No evidence matches this query.');
    });

    it('exposes the command button by its accessible name', () => {
        React.act(() => {
            widget.update();
            MessageLoop.flush();
        });
        const button = widget.node.querySelector('button');
        expect(button?.getAttribute('aria-label')).to.equal('Run evidence check');
    });
});

