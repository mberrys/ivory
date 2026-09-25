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
import { Container } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { bindRootContributionProvider, ContributionProvider } from '@theia/core/lib/common';
import { expect } from 'chai';
import ivoryGuiFrontendModule from './ivory-gui-frontend-module';
import { IvoryGuiApplicationContribution } from './ivory-gui-application-contribution';

const moduleSource = readFileSync('src/browser/ivory-gui-frontend-module.ts', 'utf8');

describe('Ivory GUI frontend module build boundary', () => {
    it('imports package-source assets instead of missing lib-relative CSS files', () => {
        expect(moduleSource).to.contain('../../src/browser/style/ivory-gui.css');
        expect(moduleSource).to.contain('../../src/browser/tokens/ivory-semantic-tokens.css');
        expect(moduleSource).to.contain('../../src/browser/tokens/liquidify.generated.css');
        expect(moduleSource).not.to.contain("import './style/ivory-gui.css'");
    });

    it('does not duplicate the application contribution provider', () => {
        const container = new Container();
        bindRootContributionProvider(container, FrontendApplicationContribution);
        container.load(ivoryGuiFrontendModule);

        const provider = container.getNamed<ContributionProvider<FrontendApplicationContribution>>(ContributionProvider, FrontendApplicationContribution);
        expect(provider.getContributions).to.be.a('function');
        expect(container.isBound(IvoryGuiApplicationContribution)).to.equal(true);
    });
});
