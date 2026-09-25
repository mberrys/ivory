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
// Comments routinely quote a role and its value while explaining why a value was
// rejected. Strip them before any block is read, or that prose is measured as if
// it were a declaration.
const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
// The checkout is CRLF, so a literal containing \n must not be compared
// against the file byte for byte.
const expectContains = (haystack: string, needle: string): void => {
    expect(haystack.replace(/\r\n/g, '\n')).to.contain(needle.replace(/\r\n/g, '\n'));
};

const rootThemeBlock = withoutComments(stylesheet).match(
    /html\[data-ivory-gui='prototype'\] \{([\s\S]*?)\n\}/
)?.[1] ?? '';
const semanticLightThemeBlock = withoutComments(semanticStylesheet).match(
    /html\[data-ivory-gui='prototype'\] \{([\s\S]*?)\n\}/
)?.[1] ?? '';
const effectiveLightThemeBlock = `${semanticLightThemeBlock}\n${rootThemeBlock}`;
// The light aliases live before the dark override, exactly as the cascade sees them.
const generatedLightBlock = generatedStylesheet.split('body.theia-dark {')[0];
const semanticDarkThemeBlock = withoutComments(semanticStylesheet).split('body.theia-dark {')[1]?.split('\n}')[0] ?? '';
const generatedDarkBlock = generatedStylesheet.split('body.theia-dark {')[1] ?? '';

/**
 * Resolve a semantic role the way the browser does: follow the
 * var(--verified-upstream-*, fallback) reference to the checked-in upstream
 * alias for that theme, and fall back to the inline literal when no alias is
 * declared. The dark block is self-contained; the light block is the semantic
 * defaults overridden by the shell layer, so the two slices differ.
 */
function themeValue(theme: 'light' | 'dark', variable: string): string {
    const block = theme === 'dark' ? semanticDarkThemeBlock : effectiveLightThemeBlock;
    const generated = theme === 'dark' ? generatedDarkBlock : generatedLightBlock;
    const matches = [...block.matchAll(
        new RegExp(`--ivory-${variable}:\\s*([^;]+);`, 'g')
    )];
    if (matches.length === 0) {
        throw new Error(`Missing ${theme}-theme color for ${variable}`);
    }
    const declared = matches[matches.length - 1][1].trim();
    const reference = /^var\(\s*(--verified-upstream-[\w-]+)\s*,\s*(.+)\)$/.exec(declared);
    if (!reference) {
        return declared;
    }
    const alias = reference[1].replace('--verified-upstream-', '');
    const upstream = generated.match(
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

/** Resolve a role and flatten any translucency against the backdrop it sits on. */
function themeColor(theme: 'light' | 'dark', variable: string, backdrop?: string): string {
    const { channels, alpha } = parseColor(themeValue(theme, variable));
    if (alpha === 1) {
        return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
    }
    const under = parseColor(backdrop ?? '#ffffff');
    return `#${channels.map((channel, index) => {
        const composited = Math.round(channel * alpha + under.channels[index] * (1 - alpha));
        return composited.toString(16).padStart(2, '0');
    }).join('')}`;
}

function lightThemeColor(variable: string, backdrop?: string): string {
    return themeColor('light', variable, backdrop);
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

/** The stylesheet with comments removed, so prose is never read as CSS. */
function declarationsOnlyForOrder(): string {
    return stylesheet.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('Ivory Poteto visual contract', () => {
    it('keeps every shell override behind the reversible activation marker', () => {
        expect(stylesheet).to.contain("html[data-ivory-gui='prototype']");
        expect(stylesheet).not.to.contain("html:not([data-ivory-gui='prototype'])");
        // Assert every top-level rule is scoped, not merely that the marker
        // appears somewhere. Split on top-level braces so a comma-separated
        // :is() list is read as the single rule it is.
        const css = declarationsOnlyForOrder();
        const rules = [...css.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].map(m => m[2].trim());
        expect(rules, 'top-level rules found').to.not.be.empty;
        const unscoped = rules.filter(selector => !selector.startsWith(
            "html[data-ivory-gui='prototype']") && !selector.startsWith('@'));
        expect(unscoped, `rules not behind the activation marker: ${unscoped.join(' | ')}`).to.be.empty;
        for (const forbidden of [':root', '@import', 'url(', '@font-face']) {
            expect(css, `stylesheet must not contain ${forbidden}`).to.not.contain(forbidden);
        }
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
        expect(stylesheet).to.contain('color: var(--ivory-on-accent)');
        expectContains(stylesheet,
            "html[data-ivory-gui='prototype'] body.theia-light,\n" +
            "html[data-ivory-gui='prototype'] body.theia-dark {\n" +
            '    --theia-editor-background: var(--ivory-canvas);');
        expectContains(stylesheet,
            "html[data-ivory-gui='prototype'] #theia-top-panel {\n" +
            '    min-height: 34px;\n' +
            '    background: var(--ivory-surface);\n' +
            '    color: var(--ivory-ink);');
    });

    it('preserves native high-contrast palettes and the Poteto font on Windows', () => {
        expectContains(stylesheet,
            "html[data-ivory-gui='prototype'] body.theia-light,\n" +
            "html[data-ivory-gui='prototype'] body.theia-dark {");
        expectContains(semanticStylesheet,
            "html[data-ivory-gui='prototype'] body.theia-hc,\n" +
            "html[data-ivory-gui='prototype'] body.theia-hcLight {");
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
        expectContains(stylesheet,
            "html[data-ivory-gui='prototype'] body {\n" +
            "    --theia-ui-font-family: 'Avenir Next', 'Segoe UI', sans-serif;");
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

        expect(contrastRatio(muted, surface), 'muted text').to.be.greaterThanOrEqual(4.5);
        expect(contrastRatio(accent, surface), 'accent text').to.be.greaterThanOrEqual(4.5);
        expect(contrastRatio(ink, canvas)).to.be.greaterThanOrEqual(4.5);
        // The pill paints its label in the status colour over a 14% tint of that
        // same role, and it sits on a card, so measure the real pair.
        const card = lightThemeColor('surface-raised', surface);
        const danger = lightThemeColor('danger');
        for (const [role, value] of [['success', success], ['warning', warning], ['danger', danger]] as const) {
            expect(contrastRatio(value, blendOn(value, 0.14, card)), `light ${role} pill label`)
                .to.be.greaterThanOrEqual(4.5);
        }
        expect(contrastRatio(lightThemeColor('focus'), card), 'light focus ring on card')
            .to.be.greaterThanOrEqual(3);
    });

    it('keeps small dark-theme text at WCAG AA contrast', () => {
        // The dark block resolves its own aliases, so it must be measured
        // against the dark values rather than reusing the light ones. Upstream
        // makes surface, surface-raised and muted translucent in dark, so each
        // is composited over the layer it actually sits on before measuring.
        const canvas = themeColor('dark', 'canvas');
        const surface = themeColor('dark', 'surface', canvas);
        const raised = themeColor('dark', 'surface-raised', surface);
        const ink = themeColor('dark', 'ink', canvas);
        const muted = themeColor('dark', 'muted', surface);
        const accent = themeColor('dark', 'accent', canvas);
        const success = themeColor('dark', 'success');
        const warning = themeColor('dark', 'warning');
        const danger = themeColor('dark', 'danger');
        // The label on the accent fill. This is its own role because --ivory-surface
        // is 60%-alpha glass in dark, so a surface-coloured label composites over
        // the accent and falls to 3.27:1.
        const onAccent = themeColor('dark', 'on-accent');
        const onAccentLight = themeColor('light', 'on-accent');

        // Small text (10-12px) is held to the stricter 4.5:1, not large-text 3:1.
        expect(contrastRatio(ink, canvas), 'dark ink on canvas').to.be.greaterThanOrEqual(4.5);
        expect(contrastRatio(muted, surface), 'dark muted on surface').to.be.greaterThanOrEqual(4.5);
        // The accent is used as 11-12px text (eyebrow, card source) and as the
        // button fill, so it must clear AA against every backdrop it lands on.
        expect(contrastRatio(accent, surface), 'dark accent on surface').to.be.greaterThanOrEqual(4.5);
        expect(contrastRatio(accent, canvas), 'dark accent on canvas').to.be.greaterThanOrEqual(4.5);
        expect(contrastRatio(accent, raised), 'dark accent on card').to.be.greaterThanOrEqual(4.5);
        expect(contrastRatio(onAccent, accent), 'dark button label').to.be.greaterThanOrEqual(4.5);
        // The hover state flips the fill to ink, so the same label must clear there too.
        expect(contrastRatio(onAccent, ink), 'dark button label on hover').to.be.greaterThanOrEqual(4.5);
        expect(contrastRatio(onAccentLight, themeColor('light', 'accent')), 'light button label')
            .to.be.greaterThanOrEqual(4.5);
        // Status pills are painted inside a card, so the 14% tint composites
        // over the raised card surface rather than the canvas.
        // .ivory-status-pill sets `color: var(--ivory-<status>)` and a 14% tint of
        // that same role as its background, so the painted pair is the status
        // colour on its own tint. Measuring ink here would pass regardless of
        // which status value is in play.
        for (const [role, value] of [['success', success], ['warning', warning], ['danger', danger]] as const) {
            const tint = blendOn(value, 0.14, raised);
            expect(contrastRatio(value, tint), `dark ${role} pill label`).to.be.greaterThanOrEqual(4.5);
        }
        // The accent is also the icon colour on an accent-soft selection row,
        // which is a non-text contrast (3:1), and the focus ring on a card.
        expect(contrastRatio(accent, themeColor('dark', 'accent-soft')), 'dark accent on selection row')
            .to.be.greaterThanOrEqual(3);
        expect(contrastRatio(themeColor('dark', 'focus'), raised), 'dark focus ring on card')
            .to.be.greaterThanOrEqual(3);
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

    it('does not let a component rule kill the keyboard focus ring', () => {
        // A `outline: none` anywhere in the shell layer silently removes the
        // focus indicator unless a matching :focus-visible rule outranks it.
        // The search input is the known case: its base rule is more specific
        // than the shared :is(...) focus rule, so it needs its own.
        // Comments are stripped first, so prose mentioning "outline: none" in
        // a rationale is not mistaken for a declaration.
        const declarationsOnly = stylesheet.replace(/\/\*[\s\S]*?\*\//g, '');
        const suppressors = [...declarationsOnly.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
            .filter(([, , body]) => /(^|;)\s*outline\s*:\s*none\s*(;|$)/.test(body))
            .map(([, selector]) => selector.trim());
        // Assert the specific known suppressor is present, rather than that some
        // suppressor exists: a bare `to.not.be.empty` makes the test depend on
        // the defect being there and fails if the defect is ever fixed.
        expect(suppressors.some(s => s.includes('.ivory-search-label input')),
            'the search input rule that suppresses the outline').to.equal(true);

        const focusRules = [...declarationsOnly.matchAll(/([^{}]+:focus-visible[^{}]*)\{([^{}]*)\}/g)]
            .filter(([, , body]) => /(^|;)\s*outline\s*:\s*(?!none)/.test(body));
        expect(focusRules.some(([, selector]) => selector.includes('.ivory-search-label input')),
            'the rule that restores the search input outline').to.equal(true);

        // Every selector that suppresses the outline must have a matching
        // :focus-visible rule, otherwise focus there is invisible. Compare with
        // any :focus-visible / :focus suffix removed, so the two spellings of
        // the shared marker prefix do not have to match character for character.
        const base = (selector: string): string =>
            selector.replace(/\s*:focus-visible|\s*:focus\b/g, '').replace(/\s*$/, '').trim();
        for (const selector of suppressors) {
            for (const part of selector.split(',')) {
                const wanted = base(part.trim());
                const covered = focusRules.some(([, ruleSelector]) =>
                    ruleSelector.split(',').some(focus => base(focus.trim()) === wanted));
                expect(covered, `no :focus-visible rule restores the outline for ${part.trim()}`).to.equal(true);
            }
        }
    });

    it('places the dark widget shadow after the rule that would otherwise win it', () => {
        // A declaration in an earlier rule of equal specificity is dead CSS:
        // the browser keeps the later one and no test that greps for the string
        // would notice. Assert the order, not just the presence.
        const shadowRules = [...declarationsOnlyForOrder()
            .matchAll(/([^{}]*body\.theia-(?:light|dark)[^{}]*)\{([^{}]*--theia-widget-shadow:[^{}]*)\}/g)]
            .map(match => ({ selector: match[1].trim(), index: match.index }));
        expect(shadowRules, 'rules that set --theia-widget-shadow').to.have.length.greaterThan(1);

        const dark = shadowRules.filter(rule => /body\.theia-dark/.test(rule.selector) && !/light/.test(rule.selector));
        const light = shadowRules.filter(rule => /body\.theia-light/.test(rule.selector) || /,/.test(rule.selector));
        expect(dark, 'a dark-only shadow rule').to.have.length.greaterThan(0);
        expect(light, 'a light/dark shared shadow rule').to.have.length.greaterThan(0);
        // The dark-only rule must be the later one.
        expect(dark[dark.length - 1].index).to.be.greaterThan(light[light.length - 1].index);
        expect(dark[dark.length - 1].selector).to.not.contain('theia-light,');
    });

    it('composes the side-tab selection bar with the elevation instead of replacing it', () => {
        // box-shadow does not accumulate: a later rule that sets only the inset
        // selection bar silently discards the drop shadow from the current-tab
        // rule above it. Both sides must list both shadows.
        const css = declarationsOnlyForOrder();
        for (const side of ['left', 'right']) {
            const body = css.match(new RegExp(
                `\\.lm-TabBar\\.theia-app-${side} \\.lm-TabBar-tab\\.lm-mod-current \\{([^{}]*)\\}`))?.[1];
            expect(body, `the ${side} current-tab rule`).to.be.a('string');
            expect(body, `${side} selection bar`).to.contain('inset');
            expect(body, `${side} elevation`).to.contain('0 2px 8px');
        }
    });

    it('maps every ordinary role in high contrast so none falls back to the light literals', () => {
        const semanticNoComments = withoutComments(semanticStylesheet);
const hcBlock = semanticNoComments.slice(semanticNoComments.indexOf('body.theia-hc,'));
        expect(hcBlock).to.contain('body.theia-hcLight');
        // Every colour role the ordinary block declares must also be declared
        // here, or it inherits the light Poteto literal underneath the HC
        // block. Non-colour roles (spacing, duration, easing) have no native
        // counterpart and correctly keep their values.
        const colourRoles = [...semanticStylesheet
            .slice(0, semanticStylesheet.indexOf('body.theia-hc,'))
            .matchAll(/^\s*(--ivory-(?:canvas|surface|surface-raised|ink|muted|accent|accent-soft|border|focus|success|warning|danger|on-accent)):/gm)]
            .map(match => match[1]);
        expect(colourRoles, 'ordinary colour roles found').to.not.be.empty;
        for (const role of new Set(colourRoles)) {
            expect(hcBlock, `high contrast does not remap ${role}`)
                .to.match(new RegExp(`${role}:`));
        }
        // No colour value in the HC block may be a Poteto or upstream literal.
        // Non-colour overrides (radius 0, no shadow) are deliberate: high
        // contrast drops the soft elevation the ordinary themes use.
        const hcColourRoles = new Set(colourRoles.map(role => role.replace('--ivory-', '')));
        for (const [role, value] of [...hcBlock.matchAll(/--ivory-[\w-]+:\s*([^;]+);/g)].map(m => [m[0].split(':')[0], m[1]])) {
            if (hcColourRoles.has(role.replace('--ivory-', ''))) {
                expect(value, `${role} under high contrast`).to.contain('var(--theia-');
            }
        }
        expect(hcBlock, 'high contrast drops the soft elevation').to.contain('--ivory-shadow: none');
    });
});
