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

const stylesheet = readFileSync('src/browser/style/ivory-gui.css', 'utf8');

describe('Ivory Poteto visual contract', () => {
    it('keeps every shell override behind the reversible activation marker', () => {
        expect(stylesheet).to.contain("html[data-ivory-gui='prototype']");
        expect(stylesheet).not.to.contain("html:not([data-ivory-gui='prototype'])");
    });

    it('maps light and dark themes to the semantic surface roles', () => {
        expect(stylesheet).to.contain('body.theia-light');
        expect(stylesheet).to.contain('body.theia-dark');
        expect(stylesheet).to.contain('--theia-editor-background: var(--ivory-canvas)');
        expect(stylesheet).to.contain('--theia-sideBar-background: var(--ivory-surface)');
        expect(stylesheet).to.contain('--theia-statusBar-background: var(--ivory-ink)');
        expect(stylesheet).to.contain('--theia-quickInput-background: var(--ivory-surface-raised)');
        expect(stylesheet).to.contain('--theia-quickInputList-focusBackground: var(--ivory-accent-soft)');
        expect(stylesheet).to.contain('color: var(--ivory-surface)');
        expect(stylesheet).to.contain(
            "html[data-ivory-gui='prototype'] body {\n" +
            '    --theia-editor-background: var(--ivory-canvas);'
        );
        expect(stylesheet).to.contain(
            "html[data-ivory-gui='prototype'] #theia-top-panel {\n" +
            '    min-height: 34px;\n' +
            '    background: var(--ivory-surface);\n' +
            '    color: var(--ivory-ink);'
        );
    });

    it('covers the existing workbench surfaces without replacing their DOM', () => {
        for (const selector of [
            '#theia-top-panel',
            '.theia-app-sidebar-container',
            '.theia-side-panel',
            '.theia-app-centers',
            '#theia-main-content-panel',
            '#theia-statusBar',
            '.lm-Menu',
            '.dialogOverlay',
            '[data-ivory-dashboard=\'true\']',
            '.ivory-evidence-card'
        ]) {
            expect(stylesheet).to.contain(selector);
        }
    });

    it('keeps keyboard focus visible and respects reduced motion', () => {
        expect(stylesheet).to.contain(':focus-visible');
        expect(stylesheet).to.contain('@media (prefers-reduced-motion: reduce)');
        expect(stylesheet).to.contain('animation-duration: 0.01ms !important');
    });
});
