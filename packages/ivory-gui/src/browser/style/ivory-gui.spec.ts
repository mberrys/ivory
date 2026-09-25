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
const semanticStylesheet = readFileSync('src/browser/tokens/ivory-semantic-tokens.css', 'utf8');
const generatedStylesheet = readFileSync('src/browser/tokens/liquidify.generated.css', 'utf8');
const rootThemeBlock = stylesheet.match(
    /html\[data-ivory-gui='prototype'\] \{([\s\S]*?)\n\}/
)?.[1] ?? '';
const semanticLightThemeBlock = semanticStylesheet.match(
    /html\[data-ivory-gui='prototype'\] \{([\s\S]*?)\n\}/
)?.[1] ?? '';
const effectiveLightThemeBlock = `${semanticLightThemeBlock}\n${rootThemeBlock}`;
// The light aliases live before the dark override, exactly as the cascade sees them.
const generatedLightBlock = generatedStylesheet.split('body.theia-dark {')[0];

/**
 * Resolve a light-theme semantic role the way the browser does: follow the
 * var(--verified-upstream-*, fallback) reference to the checked-in upstream
 * alias, and fall back to the inline literal when no alias is declared for
 * that theme.
 */
function lightThemeValue(variable: string): string {
    const matches = [...effectiveLightThemeBlock.matchAll(
        new RegExp(`--ivory-${variable}:\\s*([^;]+);`, 'g')
    )];
    if (matches.length === 0) {
        throw new Error(`Missing light-theme color for ${variable}`);
    }
    const declared = matches[matches.length - 1][1].trim();
    const reference = /^var\(\s*(--verified-upstream-[\w-]+)\s*,\s*(.+)\)$/.exec(declared);
    if (!reference) {
        return declared;
    }
    const alias = reference[1].replace('--verified-upstream-', '');
    const upstream = generatedLightBlock.match(
        new RegExp(`--verified-upstream-${alias}:\\s*([^;]+);`)
    )?.[1].trim();
    return upstream ?? reference[2].replace(/\)$/, '').trim();
}

function parseColor(value: string): { channels: [number, number, number]; alpha: number } {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
    if (hex) {
        const digits = hex[1].length === 3
            ? hex[1].split('').map(digit => digit + digit).join('')
            : hex[1];
        return {
            channels: [0, 2, 4].map(offset => Number.parseInt(digits.slice(offset, offset + 2), 16)) as [number, number, number],
            alpha: 1
        };
    }
    const functional = /^rgba?\(([^)]+)\)$/i.exec(value);
    if (functional) {
        const parts = functional[1].split(',').map(part => part.trim());
        return {
            channels: [Number(parts[0]), Number(parts[1]), Number(parts[2])],
            alpha: parts.length > 3 ? Number(parts[3]) : 1
        };
    }
    throw new Error(`Unrecognized color value: ${value}`);
}

/** Composite a possibly translucent color over an opaque backdrop. */
function lightThemeColor(variable: string, backdrop?: string): string {
    const { channels, alpha } = parseColor(lightThemeValue(variable));
    if (alpha === 1) {
        return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
    }
    const under = parseColor(backdrop ?? '#ffffff');
    return `#${channels.map((channel, index) => {
        const composited = Math.round(channel * alpha + under.channels[index] * (1 - alpha));
        return composited.toString(16).padStart(2, '0');
    }).join('')}`;
}

function linearize(channel: number): number {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
    const channels = [0, 2, 4].map(offset => linearize(Number.parseInt(color.slice(1 + offset, 3 + offset), 16)));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
    const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
    return (values[0] + 0.05) / (values[1] + 0.05);
}

function blendOn(foreground: string, alpha: number, background: string): string {
    const backgroundChannels = [0, 2, 4].map(offset => Number.parseInt(background.slice(1 + offset, 3 + offset), 16));
    const channels = [0, 2, 4].map(offset => {
        const value = Number.parseInt(foreground.slice(1 + offset, 3 + offset), 16);
        return Math.round(value * alpha + backgroundChannels[offset / 2] * (1 - alpha));
    });
    return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

describe('Ivory Poteto visual contract', () => {
    it('keeps every shell override behind the reversible activation marker', () => {
        expect(stylesheet).to.contain("html[data-ivory-gui='prototype']");
        expect(stylesheet).not.to.contain("html:not([data-ivory-gui='prototype'])");
    });

    it('maps light and dark themes to the semantic surface roles', () => {
        expect(semanticStylesheet).to.contain("html[data-ivory-gui='prototype'] {");
        expect(semanticStylesheet).to.contain('body.theia-dark');
        expect(stylesheet).to.contain('--theia-editor-background: var(--ivory-canvas)');
        expect(stylesheet).to.contain('--theia-sideBar-background: var(--ivory-surface)');
        expect(stylesheet).to.contain('--theia-statusBar-background: var(--ivory-ink)');
        expect(stylesheet).to.contain('--theia-quickInput-background: var(--ivory-surface-raised)');
        expect(stylesheet).to.contain('--theia-quickInputList-focusBackground: var(--ivory-accent-soft)');
        expect(stylesheet).to.contain('--theia-widget-shadow: rgba(0, 0, 0, 0.16)');
        expect(stylesheet).to.contain('html[data-ivory-gui=\'prototype\'] body.theia-dark');
        expect(stylesheet).to.contain('--theia-widget-shadow: rgba(0, 0, 0, 0.38)');
        expect(stylesheet).not.to.contain('46, 38, 28');
        expect(stylesheet).to.contain('color: var(--ivory-surface)');
        expect(stylesheet).to.contain(
            "html[data-ivory-gui='prototype'] body.theia-light,\n" +
            "html[data-ivory-gui='prototype'] body.theia-dark {\n" +
            '    --theia-editor-background: var(--ivory-canvas);'
        );
        expect(stylesheet).to.contain(
            "html[data-ivory-gui='prototype'] #theia-top-panel {\n" +
            '    min-height: 34px;\n' +
            '    background: var(--ivory-surface);\n' +
            '    color: var(--ivory-ink);'
        );
    });

    it('preserves native high-contrast palettes and the Poteto font on Windows', () => {
        expect(stylesheet).to.contain(
            "html[data-ivory-gui='prototype'] body.theia-light,\n" +
            "html[data-ivory-gui='prototype'] body.theia-dark {"
        );
        expect(semanticStylesheet).to.contain(
            "html[data-ivory-gui='prototype'] body.theia-hc,\n" +
            "html[data-ivory-gui='prototype'] body.theia-hcLight {"
        );
        for (const variable of [
            '--ivory-canvas: var(--theia-editor-background, #000000)',
            '--ivory-surface: var(--theia-sideBar-background, var(--theia-editor-background, #000000))',
            '--ivory-surface-raised: var(--theia-input-background, var(--theia-editor-background, #000000))',
            '--ivory-ink: var(--theia-foreground, var(--theia-editor-foreground, #ffffff))',
            '--ivory-muted: var(--theia-descriptionForeground, var(--ivory-ink))',
            '--ivory-accent: var(--theia-focusBorder, var(--ivory-ink))',
            '--ivory-accent-soft: var(--theia-list-activeSelectionBackground, var(--theia-editor-background, #000000))',
            '--ivory-border: var(--theia-contrastBorder, var(--theia-widget-border, var(--ivory-ink)))',
            '--ivory-focus: var(--theia-focusBorder, var(--ivory-ink))'
        ]) {
            expect(semanticStylesheet).to.contain(variable);
        }
        expect(stylesheet).to.contain(
            "html[data-ivory-gui='prototype'] body {\n" +
            "    --theia-ui-font-family: 'Avenir Next', 'Segoe UI', sans-serif;"
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

    it('keeps small light-theme text at WCAG AA contrast', () => {
        const surface = lightThemeColor('surface');
        const canvas = lightThemeColor('canvas');
        const accent = lightThemeColor('accent');
        // Upstream declares ink and muted as translucent black, so they must be
        // composited over the surface they actually sit on before measuring.
        const muted = lightThemeColor('muted', surface);
        const ink = lightThemeColor('ink', canvas);
        const success = lightThemeColor('success');
        const warning = lightThemeColor('warning');
        const successTint = blendOn(success, 0.14, canvas);
        const warningTint = blendOn(warning, 0.14, canvas);

        expect(contrastRatio(muted, surface), 'muted text').to.be.greaterThanOrEqual(4.5);
        expect(contrastRatio(accent, surface), 'accent text').to.be.greaterThanOrEqual(4.5);
        expect(contrastRatio(surface, accent), 'button text').to.be.greaterThanOrEqual(4.5);
        expect(contrastRatio(success, successTint), 'verified status').to.be.greaterThanOrEqual(4.5);
        expect(contrastRatio(warning, warningTint), 'queued status').to.be.greaterThanOrEqual(4.5);
        expect(contrastRatio(ink, canvas)).to.be.greaterThanOrEqual(4.5);
    });

    it('keeps semantic roles in the token bridge instead of duplicating them in the shell layer', () => {
        for (const role of ['canvas', 'surface', 'surface-raised', 'ink', 'muted', 'accent', 'border', 'focus', 'success', 'warning', 'danger', 'radius', 'shadow']) {
            expect(semanticStylesheet).to.contain(`--ivory-${role}:`);
            expect(rootThemeBlock).not.to.contain(`--ivory-${role}:`);
        }
        expect(stylesheet).to.contain('var(--ivory-ink)');
        expect(stylesheet).to.contain('var(--ivory-accent)');
    });

    it('keeps keyboard focus visible and respects reduced motion', () => {
        expect(stylesheet).to.contain(':focus-visible');
        expect(stylesheet).to.contain('@media (prefers-reduced-motion: reduce)');
        expect(stylesheet).to.contain('animation-duration: 0.01ms !important');
    });
});
