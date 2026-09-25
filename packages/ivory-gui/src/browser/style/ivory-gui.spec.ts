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

/**
 * The percentage the status pill actually mixes into its own background. Read
 * from the stylesheet rather than hardcoded, so editing the CSS changes what is
 * measured: at 14% the labels sit near AA, and the first failure is around 19%.
 */
const pillTintFor = (() => {
    // Read the tint per role, by name. A single non-global match would return
    // only the first of the two separate declarations, so the queued pill would
    // be measured at whatever percentage the success pill happens to use, and
    // an unanchored --ivory-\w+ would match the 22% focus halo instead.
    const css = declarationsOnlyForOrder();
    const read = (role: 'success' | 'warning' | 'danger') => {
        const mix = css.match(new RegExp(
            `color-mix\\(in srgb, var\\(--ivory-${role}\\) ([\\d.]+)%, transparent\\)`));
        expect(mix, `the ${role} status pill tint percentage`).to.not.equal(undefined);
        return Number(mix![1]) / 100;
    };
    return read;
})();

/** The stylesheet with comments removed, so prose is never read as CSS. */
function declarationsOnlyForOrder(): string {
    return stylesheet.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every themed-body rule whose selector can match a high-contrast body. */
function hcCapableRules(css: string): RegExpExecArray[] {
    const attr = 'data-ivory-gui=\'prototype\'';
    const one = 'html\\[' + attr + '\\]\\s*body(?:\\.theia-\\w+)?';
    const rule = new RegExp('((?:' + one + '\\s*,\\s*)*' + one + ')\\s*\\{([^}]*)\\}', 'g');
    return [...css.matchAll(rule)].filter(m => /theia-hc/.test(m[1]));
}

/**
 * The themes each --theia-* role is published for, keyed by role name. Read
 * from the stylesheet rather than asserted literally, so a theme can be added
 * or removed without this quietly stopping checking anything.
 */
function themedBodyRoles(css: string, role: string): string[] {
    const attr = 'data-ivory-gui=\'prototype\'';
    const one = 'html\\[' + attr + '\\]\\s*body\\.theia-\\w+';
    const block = new RegExp('((?:' + one + '\\s*,\\s*)+' + one + ')\\s*\\{([^}]*)\\}', 'g');
    const found: string[] = [];
    for (const m of withoutComments(css).matchAll(block)) {
        if (m[2].includes(`--theia-${role}:`)) {
            found.push(...[...m[1].matchAll(/body\.theia-(\w+)/g)].map(x => x[1]));
        }
    }
    return [...new Set(found)];
}

/**
 * The colour variables Theia writes inline on <html> in its two high-contrast
 * themes, read from a live browser (computed styles on document.body under
 * body.theia-hc). A rule on <body> cannot read them through var(), so the
 * stylesheet tests cannot derive them; without these the high-contrast
 * contrast assertions were computed against a resolver that never saw a real
 * high-contrast value, and every number in them was fiction.
 */
const THEIA_HC_INLINES: Readonly<Record<string, string>> = Object.freeze({
    '--theia-editor-background': '#1e1e1e',
    '--theia-sideBar-background': '#252526',
    '--theia-input-background': '#3c3c3c',
    '--theia-foreground': '#cccccc',
    '--theia-descriptionForeground': 'rgba(204, 204, 204, 0.7)',
    '--theia-widget-border': '#303031',
    '--theia-focusBorder': '#007fd4',
    '--theia-list-activeSelectionBackground': '#094771',
    '--theia-list-inactiveSelectionBackground': '#094771',
    '--theia-menu-foreground': '#cccccc',
    '--theia-button-foreground': '#ffffff',
    '--theia-warningBackground': '#cccccc',
    '--theia-errorBackground': '#cccccc',
    '--theia-successBackground': '#cccccc',
    // Undefined in high contrast: Theia maps these to contrastBorder, which
    // has no default. A var() naming it falls through, which is the whole
    // reason the status bar had border-top-width: 0px.
    '--theia-contrastBorder': '',
    '--theia-statusBar-border': '',
    '--theia-statusBar-noFolderBorder': '',
});

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
        // Find the rule that publishes the editor background, rather than
        // matching a literal selector: the theme list has to be able to grow
        // without this assertion silently stopping.
        const editorRule = /\{([^}]*--theia-editor-background:[^}]*)\}/.exec(withoutComments(stylesheet));
        expect(editorRule, 'the editor background is published').to.not.equal(undefined);
        expect(editorRule![1]).to.contain('--theia-editor-background: var(--ivory-canvas)');
        // The ivory -> Theia push is deliberately light/dark only. In high
        // contrast Theia already owns these roles, and pushing them would make
        // each one reference an ivory role that references it back.
        const editorThemes = [...withoutComments(stylesheet).slice(
            0, withoutComments(stylesheet).indexOf(editorRule![0])
        ).matchAll(/body\.theia-(\w+)/g)].map(m => m[1]);
        expect([...new Set(editorThemes)], 'the push rule covers light and dark')
            .to.include.members(['light', 'dark']);
        expect(editorThemes, 'the push rule does not reach high contrast')
            .to.not.include.members(['hc', 'hcLight']);
        expectContains(stylesheet,
            "html[data-ivory-gui='prototype'] #theia-top-panel {\n" +
            '    min-height: 34px;\n' +
            '    background: var(--ivory-surface);\n' +
            '    color: var(--ivory-ink);');
    });

    it('preserves native high-contrast palettes and the Poteto font on Windows', () => {
        // Every role the package paints against must resolve to something in
        // EVERY theme. A role published for light and dark but not for HC falls
        // through to Theia's own value there, and Theia leaves statusBar.border
        // empty in HC: a live browser then computed border-top-width: 0px.
        for (const role of ['statusBar-border', 'list-hoverBackground']) {
            const themes = themedBodyRoles(stylesheet, role);
            for (const theme of ['light', 'dark', 'hc', 'hcLight']) {
                expect(themes, `${role} is published for body.theia-${theme}`).to.include(theme);
            }
        }

        // The real hazard is a same-element cycle, not a missing theme. A cycle
        // makes every property in it invalid at computed-value time, so the rule
        // matches, the declaration is present, and the computed value is still
        // empty -- which is how the whole HC branch used to resolve to nothing
        // while every structural test passed.
        const nc = withoutComments(stylesheet);
        const ncSemantic = withoutComments(semanticStylesheet);
        // Map each HC ivory role to the Theia role its value LEADS with. Only
        // that one matters: a fallback further down the chain never participates
        // in a cycle, because a var() only resolves the next name once the
        // previous one is defined.
        const hcIvoryLeader = new Map<string, string>();
        for (const m of ncSemantic.matchAll(/(--ivory-[\w-]+):\s*var\((--theia-[\w-]+)/g)) {
            hcIvoryLeader.set(m[1], m[2]);
        }
        const hcIvoryRoles = new Set(hcIvoryLeader.keys());
        expect(hcIvoryRoles.size, 'the HC block derives ivory roles from Theia roles')
            .to.be.greaterThan(0);
        // Only rules that can actually apply in HC matter here: a light/dark
        // rule never matches body.theia-hc, so a mutual reference between the
        // two files is inert there rather than cyclic.
        for (const m of hcCapableRules(nc)) {
            for (const d of m[2].matchAll(/(--theia-[\w-]+):\s*var\((--ivory-[\w-]+)\);/g)) {
                const leader = hcIvoryLeader.get(d[2]);
                expect(leader === d[1],
                    `${d[1]} must not point at ${d[2]}, which leads with ${leader} in high contrast`)
                    .to.equal(false);
            }
        }

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
            '--ivory-border: var(--theia-foreground, var(--ivory-ink))',
            '--ivory-focus: var(--theia-focusBorder, var(--ivory-ink))'
        ]) {
            expect(semanticStylesheet).to.contain(variable);
        }
        expectContains(stylesheet,
            "html[data-ivory-gui='prototype'] body {\n" +
            "    --theia-ui-font-family: 'Avenir Next', 'Segoe UI', sans-serif;");

        // Resolve the high-contrast roles against Theia's real inline values
        // and check the pairs the browser actually paints. Every one of these
        // figures was previously computed from a resolver that never saw a
        // high-contrast value, so they were fiction: the whole HC branch
        // resolved to nothing and the assertions still passed.
        const hc = resolveHighContrast();
        const textPairs: [string, string, string, number][] = [
            ['body text on canvas', hc.ink, hc.canvas, 4.5],
            ['body text on surface', hc.ink, hc.surface, 4.5],
            ['body text on surface-raised', hc.ink, hc['surface-raised'], 4.5],
            ['muted on canvas', hc.muted, hc.canvas, 4.5],
            ['muted on surface', hc.muted, hc.surface, 4.5],
            ['ink on the selection fill', hc.ink, hc['accent-soft'], 4.5],
            ['on-accent on the selection fill', hc['on-accent'], hc['accent-soft'], 4.5]
        ];
        for (const [name, fg, bg, need] of textPairs) {
            expect(contrastRatio(opaqueOn(fg, bg), bg), `high contrast: ${name}`)
                .to.be.greaterThanOrEqual(need);
        }
        const nonTextPairs: [string, string, string, number][] = [
            ['component border on canvas', hc.border, hc.canvas, 3],
            ['component border on surface', hc.border, hc.surface, 3],
            ['focus ring on the selection fill', hc['focus-on-soft'], hc['accent-soft'], 3],
            ['bar boundary on the bar fill', hc['border-on-ink'], hc.canvas, 3]
        ];
        for (const [name, fg, bg, need] of nonTextPairs) {
            expect(contrastRatio(fg, bg), `high contrast: ${name}`).to.be.greaterThanOrEqual(need);
        }

        // The card's own secondary label sits on the raised card fill, where
        // Theia's native high-contrast muted text does not reach 4.5:1. The
        // package paints that label, so the package uses the opaque ink there.
        expect(contrastRatio(opaqueOn(hc.muted, hc['surface-raised']), hc['surface-raised']),
            'high contrast: native muted on the raised card fill').to.be.below(4.5);
        expectContains(stylesheet, 'body.theia-hc .ivory-card-kind');
        expectContains(stylesheet, 'body.theia-hcLight .ivory-card-kind');

        // And the bar's own fill and boundary must differ, or the boundary
        // paints nothing. A live browser measured 1.00:1 when the fill was the
        // foreground and the boundary was the same foreground.
        expect(contrastRatio(hc['border-on-ink'], hc.canvas),
            'high contrast: the bar boundary against the bar fill')
            .to.be.greaterThanOrEqual(3);

        // The unfocused high-contrast selected row is signalled by a ring drawn
        // INSIDE the row, so the boundary it has to clear is the selection fill
        // it sits on, not the sidebar beside it. Assert the offset, because a
        // ring measured on the wrong backdrop is the difference between 6.08:1
        // and a number that only looks compliant.
        const hcSelection = withoutComments(stylesheet);
        const unfocusedRule = /body\.theia-hc[^}]*:not\(:focus-within\)[^{]*\{([^}]*)\}/.exec(hcSelection);
        expect(unfocusedRule, 'the unfocused high-contrast selected row is styled').to.not.equal(undefined);
        expect(unfocusedRule![1], 'the ring is drawn inside the row')
            .to.match(/outline-offset:\s*-1px/);
        expect(contrastRatio(hc['focus-on-soft'], hc['accent-soft']),
            'high contrast: the unfocused selection ring on the fill').to.be.greaterThanOrEqual(3);

        // Resolve the roles the BROWSER PAINTS, not the ivory roles behind
        // them. Theia writes --theia-statusBar-border inline on <html> and it
        // maps to contrastBorder there, which has no value; a body rule
        // pointing at it therefore resolves to nothing and the bar computes
        // border-top-width: 0px. Asserting the ivory role passed while the
        // painted role was empty, which is the defect this test exists for.
        const resolveRole = highContrastResolver();
        for (const role of ['--theia-statusBar-border', '--theia-statusBar-noFolderBorder',
            '--theia-list-hoverBackground', '--theia-list-hoverForeground']) {
            const value = resolveRole(role);
            expect(value, `high contrast: ${role} resolves to a real colour`)
                .to.match(/^(#[\da-f]{3,8}|rgba?\()/i);
        }
        const painted = {
            '--theia-statusBar-border': resolveRole('--theia-statusBar-border')
        };
        expect(contrastRatio(painted['--theia-statusBar-border'], hc.canvas),
            'high contrast: the painted bar boundary on the bar fill')
            .to.be.greaterThanOrEqual(3);
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
        // The card sits on the dashboard root, which paints the canvas
        // (the `[data-ivory-dashboard='true']` rule, which sets
        // `background: var(--ivory-canvas)`), not the surface role.
        const card = lightThemeColor('surface-raised', canvas);
        for (const [role, value] of [['success', success], ['warning', warning]] as const) {
            expect(contrastRatio(value, blendOn(value, pillTintFor(role), card)), `light ${role} pill label`)
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
        // The card and the search input paint on the dashboard root, which
        // paints the canvas. Modelling this over the
        // surface role instead shifted every card ratio by ~0.14.
        const raised = themeColor('dark', 'surface-raised', canvas);
        const ink = themeColor('dark', 'ink', canvas);
        const muted = themeColor('dark', 'muted', surface);
        const accent = themeColor('dark', 'accent', canvas);
        const success = themeColor('dark', 'success');
        const warning = themeColor('dark', 'warning');
        // The label on the accent fill. This is its own role because --ivory-surface
        // is 60%-alpha glass in dark, so a surface-coloured label composites over
        // the accent and falls to 3.65:1.
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
        for (const [role, value] of [['success', success], ['warning', warning]] as const) {
            const tint = blendOn(value, pillTintFor(role), raised);
            expect(contrastRatio(value, tint), `dark ${role} pill label`).to.be.greaterThanOrEqual(4.5);
        }
        // The focus ring is painted on a card, not on a selection fill.
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

    it('keeps every control-identifying border at 3:1 non-text contrast', () => {
        // WCAG 1.4.11: a boundary that identifies a control needs 3:1. The
        // search input and the evidence cards are bounded only by this border,
        // so a faint one makes them unfindable rather than merely subtle.
        for (const theme of ['light', 'dark'] as const) {
            const canvas = themeColor(theme, 'canvas');
            const surface = themeColor(theme, 'surface', canvas);
            const card = themeColor(theme, 'surface-raised', canvas);
            // A translucent border must be flattened against the backdrop it is
            // actually drawn on, then compared to that same backdrop. Flattening
            // against the canvas and comparing to a card mixes two different
            // surfaces and understates the ratio.
            for (const [name, backdrop] of [['canvas', canvas], ['surface', surface], ['card', card]] as const) {
                const border = themeColor(theme, 'border', backdrop);
                expect(contrastRatio(border, backdrop), `${theme} border on ${name}`)
                    .to.be.greaterThanOrEqual(3);
            }
        }
    });

    it('separates a card from the page by fill or by border', () => {
        // A card whose fill equals the canvas is a rectangle the eye cannot find.
        // Either the fill or the 3:1 border has to carry the separation.
        for (const theme of ['light', 'dark'] as const) {
            const canvas = themeColor(theme, 'canvas');
            const card = themeColor(theme, 'surface-raised', canvas);
            const border = themeColor(theme, 'border', canvas);
            const fillContrast = contrastRatio(card, canvas);
            const borderContrast = contrastRatio(border, canvas);
            expect(Math.max(fillContrast, borderContrast), `${theme} card separation`)
                .to.be.greaterThanOrEqual(3);
            // The card must also stay light enough (or dark enough) for the ink
            // painted on it, so flattening the raised role's alpha downwards
            // cannot quietly swallow the card into the canvas.
            const ink = themeColor(theme, 'ink', canvas);
            expect(contrastRatio(ink, card), `${theme} ink on a card`).to.be.greaterThanOrEqual(4.5);
        }
    });

    it('keeps the focus ring and its halo at 3:1 where they are painted', () => {
        // The ring is drawn on the dashboard root, the cards and the input.
        // The selected-row ring is a separate assertion below. An earlier draft
        // of this comment claimed no ring is ever drawn on a selection fill and
        // recorded 1.82:1 / 1.91:1 as a pair that must not be asserted. That was
        // wrong: packages/core/src/browser/style/tree.css:105 paints
        // `outline: var(--theia-focusBorder) solid 1px` on the same node as the
        // fill, so the pair is real and those figures were a genuine 1.4.11
        // failure. --ivory-focus-on-soft fixes it at 3.62:1.
        for (const theme of ['light', 'dark'] as const) {
            const canvas = themeColor(theme, 'canvas');
            const card = themeColor(theme, 'surface-raised', canvas);
            const focus = themeColor(theme, 'focus', canvas);
            expect(contrastRatio(focus, card), `${theme} focus ring on a card`).to.be.greaterThanOrEqual(3);
            expect(contrastRatio(focus, canvas), `${theme} focus ring on the canvas`).to.be.greaterThanOrEqual(3);
            // The halo is a low-alpha supplement and cannot reach 3:1 by
            // itself, so it is not held to the non-text minimum; assert only
            // that it is actually visible against the card rather than a
            // decorative smear, and read its percentage from the stylesheet.
            const haloPercent = Number(/box-shadow:[^;]*color-mix\(in srgb, var\(--ivory-focus\) ([\d.]+)%/.exec(declarationsOnlyForOrder())?.[1] ?? 0);
            expect(haloPercent, `${theme} focus halo is declared`).to.be.greaterThan(0);
            const halo = blendOn(focus, haloPercent / 100, card);
            expect(contrastRatio(halo, card), `${theme} focus halo on a card`).to.be.greaterThan(1.2);
        }
    });

    it('keeps the selected-row ring visible in high contrast, where focusBorder is weak', () => {
        // Native HC values, read off a live page rather than derived: HC sets
        // --theia-focusBorder to #007fd4, which is only 2.32:1 on the HC
        // selection fill #094771, and --theia-foreground to #cccccc, which is
        // 6.08:1. The package maps the ring to the latter. A live probe
        // measured 2.32 before this was corrected.
        const HC_SELECTION_FILL = '#094771';
        const HC_FOREGROUND = '#cccccc';
        const HC_FOCUS_BORDER = '#007fd4';

        const semantic = withoutComments(semanticStylesheet);
        const block = semantic.slice(semantic.indexOf('body.theia-hc,'));
        const declaration = /--ivory-focus-on-soft:\s*([^;]+);/.exec(block);
        expect(declaration, 'the HC block maps the ring').to.not.equal(undefined);
        const firstRole = declaration![1].replace(/^var\(/, '').split(/[,)]/)[0];
        expect(firstRole, 'the HC ring does not come from --theia-focusBorder')
            .to.equal('--theia-foreground');

        // Both numbers are asserted so the reasoning cannot rot: the chosen
        // role clears 3:1, and the rejected one genuinely does not.
        expect(contrastRatio(HC_FOREGROUND, HC_SELECTION_FILL), 'the HC ring role clears 3:1')
            .to.be.greaterThanOrEqual(3);
        expect(contrastRatio(HC_FOCUS_BORDER, HC_SELECTION_FILL),
            'the rejected HC role is genuinely below 3:1, which is why it is rejected')
            .to.be.lessThan(3);
    });

    it('gives the high-contrast unfocused selected row a boundary, on the fill it is painted over', () => {
        // Two facts, both from a live probe, and the second one is the reason
        // this rule is subtle.
        //
        // 1. HC cannot carry this state on a fill: its selection fill is
        //    Theia's own #094771 on the #252526 sidebar, 1.57:1, and no darker
        //    fill does better without abandoning the dark background those
        //    themes exist to provide. So the state is carried by a boundary.
        // 2. The boundary is drawn with `outline-offset: -1px`, which puts it
        //    INSIDE the border box - on the selection fill, not on the panel
        //    behind the row. Measuring it against the panel reported 3.64:1
        //    while the browser painted 2.32:1.
        const HC_FILL = '#094771';
        const HC_SIDEBAR = '#252526';
        const HC_FOCUS_BORDER = '#007fd4';
        const HC_FOREGROUND = '#cccccc';

        // Fact 1: the fill genuinely cannot clear the non-text minimum.
        expect(contrastRatio(HC_FILL, HC_SIDEBAR), 'the HC fill genuinely cannot clear 3:1')
            .to.be.lessThan(3);

        // Fact 2: the colour the rule uses must clear 3:1 ON THE FILL, and the
        // native focus colour must be shown to fail there, so neither the value
        // nor the reasoning can drift.
        expect(contrastRatio(HC_FOREGROUND, HC_FILL), 'the boundary colour clears 3:1 on the fill')
            .to.be.greaterThanOrEqual(3);
        expect(contrastRatio(HC_FOCUS_BORDER, HC_FILL),
            'the native focus colour is genuinely below 3:1 on the fill, which is why it is not used')
            .to.be.lessThan(3);

        // And the rule must actually take the role, not the focus colour.
        const css = withoutComments(stylesheet);
        const rule = /body\.theia-hcLight \.theia-Tree:not\(:focus-within\) \.theia-TreeNode\.theia-mod-selected\s*\{([^}]*)\}/.exec(css);
        expect(rule, 'the HC selected row has a boundary rule').to.not.equal(undefined);
        expect(rule![1], 'the boundary is a 1px outline')
            .to.contain('outline: var(--ivory-focus-on-soft) solid 1px');
        // Without :not(:focus-within) it outranks the focused ring and drags it
        // back to focusBorder's 2.32:1.
        expect(rule![0], 'the boundary applies only to an unfocused tree')
            .to.contain('.theia-Tree:not(:focus-within)');
        // And the negative offset is what puts it on the fill: if this ever
        // becomes 0 or 1px, the backdrop changes and this whole test is void.
        expect(rule![1], 'the ring is drawn inside the row, on the fill')
            .to.contain('outline-offset: -1px');
    });

    it('declares the unfocused-selection roles on the themed body, where they win', () => {
        // These two roles only take effect on the element carrying the theme
        // class. Theia sets its own values for both on that element, so a
        // declaration on `html` is inherited and loses to it regardless of
        // source order. A live probe proved it: the rule sat in bundle.css and
        // the value still resolved to Theia's native #37373D. Assert the
        // selector, because reading the declaration alone cannot see this.
        for (const role of ['inactiveSelectionBackground', 'inactiveSelectionForeground']) {
            // All four themes, not just the two ordinary ones: a live probe found
            // the HC inactive row painting Theia's native 1.41:1 selection
            // because this rule stopped at light/dark.
            // One selector list, one declaration block: find the block that
            // declares the role, then require every theme to be in ITS selector
            // list. Checking each theme's presence anywhere in the file would
            // pass as soon as one theme mentioned the selector at all.
            // Capture the WHOLE comma-separated selector list: a rule names its
            // themes in one block, and matching only the last selector would
            // silently pass for a rule that covers one theme.
            // Build the repeated attribute match once: inlining it twice put a
            // bare apostrophe inside a template literal, which the quote rule
            // rejects even though the apostrophe is part of the CSS selector.
            const attr = 'data-ivory-gui=\'prototype\'';
            const one = `html\\[${attr}\\]\\s*body\\.theia-\\w+`;
            const decl = new RegExp(`((?:${one}\\s*,\\s*)+${one})\\s*\\{([^}]*)\\}`, 'g');
            let covering = '';
            for (const m of declarationsOnlyForOrder().matchAll(decl)) {
                if (m[2].includes(`--theia-list-${role}:`)) { covering = m[1]; break; }
            }
            expect(covering, `${role} is declared in a themed-body rule`).to.not.equal('');
            // Compare the theme names found, not substrings with punctuation
            // around them: the selector list wraps across lines, so any
            // expectation that assumes "name," or "name " is fragile.
            const covered = [...covering.matchAll(/body\.theia-(\w+)/g)].map(m => m[1]);
            for (const theme of ['light', 'dark', 'hc', 'hcLight']) {
                expect(covered, `${role} covers body.theia-${theme}`).to.include(theme);
            }
        }
    });

    it('paints the dashboard root with the canvas, and the card directly on it', () => {
        // The whole contrast model rests on this: the card is NOT nested inside
        // a surface, it is painted straight onto the dashboard root's canvas.
        // Getting this wrong shifts every card ratio by ~0.14, which is enough
        // to hide a 2.96:1 focus ring as a passing 3.10:1. Assert the chain
        // rather than citing a line number that rots on every edit.
        const dashboard = /\[data-ivory-dashboard='true'\]\s*\{([^}]*)\}/.exec(declarationsOnlyForOrder());
        expect(dashboard, 'the dashboard root rule exists').to.not.equal(undefined);
        expect(dashboard![1], 'the dashboard root paints the canvas')
            .to.contain('background: var(--ivory-canvas)');
        // The card's own rule must paint surface-raised and nothing else: if it
        // gained a `surface` layer, the card backdrop would no longer be the
        // canvas and every pill and border ratio above would be measured on the
        // wrong surface.
        const card = /\.ivory-evidence-card\s*\{([^}]*)\}/.exec(declarationsOnlyForOrder());
        expect(card, 'the evidence card rule exists').to.not.equal(undefined);
        expect(card![1], 'the card paints surface-raised on the root')
            .to.contain('background: var(--ivory-surface-raised)');
        // And the widget must not wrap the card in something that paints its
        // own background, which would insert a layer the model does not have.
        const widget = readFileSync('src/browser/ivory-dashboard-widget.tsx', 'utf-8');
        const cardTag = /<li className='ivory-evidence-card'[^>]*>/.exec(widget);
        expect(cardTag, 'the card markup exists').to.not.equal(undefined);
        expect(cardTag![0], 'the card itself paints no inline background')
            .to.not.contain('style=');
        // The card's parent is the list, which must not paint either.
        const listTag = /<ol className='ivory-evidence-list'[^>]*>/.exec(widget);
        expect(listTag, 'the list markup exists').to.not.equal(undefined);
        expect(listTag![0], 'the list paints no inline background').to.not.contain('style=');
        // Nor may the stylesheet give either of them a background.
        for (const selector of ['\\.ivory-evidence-list', '\\.ivory-card-topline']) {
            const rule = new RegExp(selector + '\\s*\\{([^}]*)\\}').exec(declarationsOnlyForOrder());
            if (rule) {
                expect(rule[1], `${selector} paints no background of its own`)
                    .to.not.contain('background');
            }
        }
    });

    it('paints exactly the statuses the widget can emit', () => {
        // A status role that is declared, measured and unreachable is a hole:
        // the contrast suite proves --ivory-danger is accessible, but no rule
        // paints a danger pill and no status emits one, so those assertions
        // were measuring a pair the browser never composites. Pin the two sets
        // to each other so neither can drift alone.
        // Read the source, not lib/: the stylesheets above are read the same
        // way, and the union is a type that compiles away.
        const model = readFileSync('src/browser/ivory-dashboard-model.ts', 'utf-8');
        const union = /export type EvidenceStatus\s*=\s*([^;]+);/.exec(model);
        expect(union, 'the EvidenceStatus union is declared').to.not.equal(undefined);
        const emitted = [...union![1].matchAll(/'([\w]+)'/g)].map(m => m[1]).sort();

        const painted = [...stylesheet.matchAll(/ivory-status-pill\[data-status='(\w+)'\]/g)]
            .map(m => m[1]);
        expect(painted, 'every painted status has an emitted counterpart')
            .to.have.members(emitted);
        // Every status role a pill rule paints is a real role, and the contrast
        // suite's pill assertions cover exactly that set: success for
        // ready/verified and warning for queued. `danger` is a declared,
        // contrast-tested role with no pill rule, so it is deliberately outside
        // this loop - which is why the pill assertions must not name it.
        const rolesPainted = [...stylesheet.matchAll(
            /ivory-status-pill\[data-status='\w+'\][\s\S]{0,200}?color: var\(--ivory-(\w+)\)/g)]
            .map(m => m[1]);
        expect([...new Set(rolesPainted)].sort(), 'the roles the pills actually paint')
            .to.have.members(['success', 'warning']);
    });

    it('marks a selected row with a 3:1 fill and readable text on it', () => {
        // A selection is the shell's primary "this row is chosen" signal, so the
        // fill owes 3:1 against every surface Theia paints it on, and the text
        // on the fill owes 4.5:1. Both halves are needed: a mid-blue that clears
        // the panel leaves body ink at 2.01:1 on it.
        for (const theme of ['light', 'dark'] as const) {
            const canvas = themeColor(theme, 'canvas');
            const panel = themeColor(theme, 'surface', canvas);
            // list/menubar selection sits on the panel; quickInput and menu
            // selection sit on the raised card, which is a lighter surface.
            const raised = themeColor(theme, 'surface-raised', canvas);
            const fill = themeColor(theme, 'accent-soft');
            const onFill = themeColor(theme, 'on-accent-soft');
            for (const [label, backdrop] of [['panel', panel], ['raised', raised], ['canvas', canvas]] as const) {
                expect(contrastRatio(fill, backdrop), `${theme} selection fill on the ${label}`)
                    .to.be.greaterThanOrEqual(3);
            }
            expect(contrastRatio(onFill, fill), `${theme} text on a selection fill`)
                .to.be.greaterThanOrEqual(4.5);
            // tree.css paints three things on one selected node: the fill, the
            // label, and a 1px --theia-focusBorder outline drawn ON the fill. The
            // general focus role is only 1.82:1 light and 1.91:1 dark against
            // that fill, so the selected state publishes its own ring.
            expect(contrastRatio(themeColor(theme, 'focus-on-soft'), fill),
                `${theme} selected-row ring on the selection fill`).to.be.greaterThanOrEqual(3);
            expect(stylesheet, 'the selected row publishes its own ring')
                .to.contain('outline-color: var(--ivory-focus-on-soft)');
            // An unfocused tree paints the same row with the INACTIVE selection
            // background, which Theia supplies and this package must override or
            // the row vanishes at 1.14:1 the moment the tree loses focus.
            expect(stylesheet, 'the unfocused selected row is overridden')
                .to.contain('--theia-list-inactiveSelectionBackground: var(--ivory-accent-soft)');
            // The selection roles must all read that pair, not body ink.
            for (const role of ['menu-selectionForeground', 'menubar-selectionForeground',
                                'quickInputList-focusForeground', 'list-activeSelectionForeground']) {
                expect(stylesheet, role).to.contain(`--theia-${role}: var(--ivory-on-accent-soft)`);
            }
        }
    });

    it('keeps the status bar boundary at 3:1 on the bar fill', () => {
        // The bar's 1px top border separates it from the panel, and the fill is
        // the opaque ink role, so the border needs its own step: --ivory-accent
        // reaches only 2.81:1 light and 2.02:1 dark there.
        for (const theme of ['light', 'dark'] as const) {
            const bar = themeColor(theme, 'ink', themeColor(theme, 'canvas'));
            expect(contrastRatio(themeColor(theme, 'border-on-ink'), bar), `${theme} status bar border`)
                .to.be.greaterThanOrEqual(3);
        }
        expect(stylesheet, 'status bar border role').to.contain('--theia-statusBar-border: var(--ivory-border-on-ink)');

        // The role resolving is NOT the same as the role being painted. Core
        // paints `border-top: solid var(--theia-statusBar-border)` at (1,0,0),
        // and this package's #theia-statusBar rule is (1,1,1), so whatever that
        // rule sets is what the browser draws. A previous version of this test
        // measured the role while the rule painted --ivory-accent, so the suite
        // went green on 4.97:1 while the page showed 2.81:1. Resolve the colour
        // the same way the cascade does: the later element rule wins.
        const barRule = /#theia-statusBar\s*\{([^}]*)\}/.exec(withoutComments(stylesheet));
        expect(barRule, 'the status bar element rule exists').to.not.equal(undefined);
        const painted = /border-top:\s*([^;]+);/.exec(barRule![1]);
        expect(painted, 'the element rule sets the border').to.not.equal(undefined);
        // The width and the style must be set here too. Core's shorthand is
        // invalid at computed-value time under high contrast - statusBar.
        // noFolderBorder -> statusBar.border -> contrastBorder, and that role is
        // undefined in HC - so a colour alone lands on a 0px border and paints
        // nothing. A live browser measured border-top-width: 0px.
        expect(painted![1].trim(), 'the painted boundary is width, style and the accessible colour')
            .to.equal('1px solid var(--ivory-border-on-ink)');
        const noFolderRole = /--theia-statusBar-noFolderBorder:\s*([^;]+);/.exec(
            withoutComments(stylesheet).slice(withoutComments(stylesheet).indexOf('body.theia-hc,')));
        expect(noFolderRole, 'HC publishes the no-folder bar boundary').to.not.equal(undefined);
        expect(noFolderRole![1].trim()).to.equal('var(--ivory-border-on-ink)');
        // No rule may restate it as a different colour: that is the shadowing.
        for (const match of withoutComments(stylesheet).matchAll(/border-top-color:\s*([^;]+);/g)) {
            expect(match[1].trim(), 'every border-top-color uses the accessible role')
                .to.equal('var(--ivory-border-on-ink)');
        }
    });

    it('resolves every high-contrast role to a real value, the way the browser does', () => {
        // The high-contrast branch used to resolve to nothing at all and every
        // structural test still passed. The cause was a same-element cycle
        // between the two stylesheets: the token file derived
        // --ivory-ink: var(--theia-foreground) while the shell file set
        // --theia-foreground: var(--ivory-ink) on the same body. A cycle makes
        // every property in it invalid at computed-value time, so the rules
        // matched, the declarations were present, and the computed values were
        // empty. Only a live browser showed it.
        //
        // The shared resolver walks var() references across both stylesheets
        // and throws on a cycle or an undefined role, which is what the browser
        // does with such a value: nothing. Assert on every role the package
        // publishes for high contrast, including the --theia-* names the
        // browser paints.
        const resolveRole = highContrastResolver();
        for (const role of ['--ivory-canvas', '--ivory-surface', '--ivory-surface-raised',
            '--ivory-ink', '--ivory-muted', '--ivory-accent', '--ivory-accent-soft',
            '--ivory-border', '--ivory-border-on-ink', '--ivory-focus', '--ivory-focus-on-soft',
            '--ivory-hover', '--ivory-on-accent', '--ivory-on-accent-soft',
            '--ivory-success', '--ivory-warning', '--ivory-danger',
            '--theia-statusBar-border', '--theia-statusBar-noFolderBorder',
            '--theia-list-hoverBackground', '--theia-list-hoverForeground']) {
            let value: string;
            try {
                value = resolveRole(role);
            } catch (error) {
                throw new Error(`${role} under high contrast: ${(error as Error).message}`);
            }
            expect(value, `${role} under high contrast is an unresolved var()`)
                .to.not.match(/^var\(/);
        }

    });

    it('resolves the status bar boundary in high contrast, where contrastBorder is empty', () => {
        // A role that RESOLVES is not the same as a role that resolves to
        // something. HC maps --theia-border-on-ink through
        // --theia-contrastBorder, and HC leaves that role empty - so the
        // var() chain produced no usable colour, the status bar computed
        // `border-top-width: 0px`, and the bar had no boundary at all. A live
        // browser found this; no amount of reading the stylesheet would.
        //
        // Guard it structurally: every role a var() chain names FIRST must be
        // one Theia actually defines in all four themes, so the fallback is
        // never what resolves.
        const hc = withoutComments(semanticStylesheet).slice(
            withoutComments(semanticStylesheet).indexOf('body.theia-hc,'));
        // No closing paren in the pattern: the value is a comma-separated
        // fallback list, so the FIRST var() has no ')' after its role and a
        // pattern demanding one silently matched nothing.
        const mapping = /--ivory-border-on-ink:\s*([^;]+);/.exec(hc);
        expect(mapping, 'HC maps the bar boundary').to.not.equal(undefined);
        expect(mapping![1], 'HC does not lead with a Theia role it cannot resolve')
            .to.equal('var(--ivory-ink, #000)');
    });

    it('makes the hover state perceptible without losing the label', () => {
        // WCAG 1.4.11 is deliberately NOT applied at 3:1 here. It governs
        // information required to IDENTIFY a component; a pointer hover is not
        // required for that, because the row is already identified by its label,
        // its position and the panel boundary, and keyboard focus - the
        // interaction that does identify a row - is asserted at 3:1 above. What
        // 1.4.11 does require is that the state is not a dead state, and what
        // 1.4.3/1.4.6 require is that the label survives it.
        //
        // The native --theia-list-hoverBackground is 1.00:1 on Theia's own light
        // sidebar (#F0F0F0 on #F3F3F3) and 1.05:1 on the Ivory panel: invisible
        // in both themes. tree.css:67-70 paints that fill and a hover foreground
        // on the same node, so both are mapped here.
        for (const theme of ['light', 'dark'] as const) {
            const canvas = themeColor(theme, 'canvas');
            const panel = themeColor(theme, 'surface', canvas);
            const hover = themeColor(theme, 'hover');
            for (const [label, backdrop] of [['panel', panel], ['canvas', canvas]] as const) {
                expect(contrastRatio(hover, backdrop), `${theme} hover is visible on the ${label}`)
                    .to.be.greaterThan(1.1);
            }
            // themeColor composites a translucent role over a backdrop, and
            // defaults to white when given none - which silently turns the dark
            // theme's white ink into white-on-white. Name the backdrop.
            expect(contrastRatio(themeColor(theme, 'ink', panel), hover), `${theme} label on a hover wash`)
                .to.be.greaterThanOrEqual(4.5);
        }
        // Both roles are mapped, not just the fill: tree.css:67-70 sets a hover
        // foreground on the same node, and leaving it native put light ink on a
        // light wash in the dark theme.
        expect(stylesheet).to.contain('--theia-list-hoverBackground: var(--ivory-hover)');
        expect(stylesheet).to.contain('--theia-list-hoverForeground: var(--ivory-ink)');
    });

    it('gives the selection border role a colour that clears 3:1 on the fill it sits on', () => {
        // --theia-menu-selectionBorder was mapped to --ivory-accent, which is
        // 1.82:1 light and 1.78:1 dark on the #0090ca fill. Only a later element
        // rule happened to save the visible menu, so the role itself was a dead
        // 3:1 claim: any other consumer of the role got the failing value.
        for (const theme of ['light', 'dark'] as const) {
            const fill = themeColor(theme, 'accent-soft');
            const border = themeColor(theme, 'focus-on-soft');
            expect(contrastRatio(border, fill), `${theme} selection border on the selection fill`)
                .to.be.greaterThanOrEqual(3);
        }
        // Both border roles are drawn ON the fill, so both must clear 3:1
        // there: core paints the menu item's border at menus.css:148-149 and
        // the menu-bar item's left/right borders at menus.css:66-69. The
        // menu-bar one was unmapped entirely, so HC's active menu-bar item had
        // no boundary at all.
        for (const role of ['menu-selectionBorder', 'menubar-selectionBorder'] as const) {
            expect(stylesheet, `the ${role} role is the accessible ring colour`)
                .to.contain(`--theia-${role}: var(--ivory-focus-on-soft)`);
        }
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
        // Derived from the ordinary blocks rather than hand-listed: a hard-coded
// alternation silently stops matching the moment a role is added, which is
// exactly how --ivory-on-accent-soft and --ivory-border-on-ink came to be
// missing from this guard. Excludes the non-colour roles below, which are
// deliberately non-colour overrides in high contrast.
const NON_COLOUR_ROLES = new Set(['radius', 'shadow', 'duration', 'easing', 'space-1', 'space-2', 'space-3', 'space-4']);
const colourRoles = [...new Set([...semanticStylesheet
    .slice(0, semanticStylesheet.indexOf('body.theia-hc,'))
    .matchAll(/^\s*(--ivory-[\w-]+):/gm)]
    .map(match => match[1])
    .filter(role => !NON_COLOUR_ROLES.has(role.slice('--ivory-'.length))))];
        expect(colourRoles, 'ordinary colour roles found').to.not.be.empty;
        for (const role of new Set(colourRoles)) {
            expect(hcBlock, `high contrast does not remap ${role}`)
                .to.match(new RegExp(`${role}:`));
        }
        // No colour value in the HC block may be a Poteto or upstream literal.
        // Non-colour overrides (radius 0, no shadow) are deliberate: high
        // contrast drops the soft elevation the ordinary themes use.
        const hcColourRoles = new Set(colourRoles.map(role => role.replace('--ivory-', '')));
        // Roles that must NOT read a Theia role. Theia writes every --theia-*
        // colour as an inline style on <html>, and a rule on <body> cannot read
        // an html inline value through var(): it resolves as undefined and falls
        // through to its fallback. Reading one here produced an empty value and
        // a status bar with border-top-width: 0px.
        const MUST_NOT_READ_THEIA = new Set(['--ivory-border-on-ink']);
        for (const [role, value] of [...hcBlock.matchAll(/--ivory-[\w-]+:\s*([^;]+);/g)].map(m => [m[0].split(':')[0], m[1]])) {
            if (!hcColourRoles.has(role.replace('--ivory-', ''))) { continue; }
            if (MUST_NOT_READ_THEIA.has(role)) {
                expect(value, `${role} under high contrast reads a Theia role it cannot resolve`)
                    .to.not.contain('var(--theia-');
                expect(value, `${role} under high contrast still resolves`).to.match(/^var\(/);
            } else {
                expect(value, `${role} under high contrast`).to.contain('var(--theia-');
            }
        }
        expect(hcBlock, 'high contrast drops the soft elevation').to.contain('--ivory-shadow: none');
    });
});

/** Flatten a translucent colour over the backdrop it is painted on. */
function opaqueOn(colour: string, backdrop: string): string {
    const rgba = /^rgba\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)[,\s/]+([\d.]+)\s*\)$/.exec(colour);
    if (!rgba) { return colour; }
    return blendOn(`#${[rgba[1], rgba[2], rgba[3]].map(n => Math.round(Number(n)).toString(16).padStart(2, '0')).join('')}`,
        Number(rgba[4]), backdrop);
}

/**
 * Resolve the high-contrast semantic roles to the colours a browser paints.
 *
 * The chain runs across two stylesheets and the element each declares on: the
 * token file derives the ivory roles from Theia's roles, and the shell file
 * pushes ivory roles back into Theia's names. Resolving a role therefore means
 * following references across both, and a name that appears twice on the same
 * element is a cycle, which the browser drops to nothing.
 */
function highContrastResolver(): (name: string) => string {
    const semantic = withoutComments(semanticStylesheet);
    const shell = withoutComments(stylesheet);
    const collect = (css: string): Map<string, string> => {
        const declarations = new Map<string, string>();
        for (const m of css.matchAll(/(--[\w-]+):\s*([^;{}]+);/g)) { declarations.set(m[1], m[2].trim()); }
        return declarations;
    };
    // Ivory roles come from the token file's HC block; Theia role overrides
    // from the shell file's HC-capable rules. A role declared on <body> wins
    // over anything Theia writes inline on <html>.
    const body = new Map<string, string>(collect(semantic));
    const root = new Map<string, string>(Object.entries(THEIA_HC_INLINES));
    // Only the rules whose selector can match a high-contrast body. The
    // light/dark rules publish the same --theia-* names with ivory values, and
    // reading those here would make every role look like a cycle.
    for (const rule of hcCapableRules(shell)) {
        for (const m of rule[2].matchAll(/(--theia-[\w-]+):\s*([^;{}]+);/g)) {
            body.set(m[1], m[2].trim());
        }
    }

    const resolve = (name: string, trail: Set<string>): string => {
        if (trail.has(name)) { throw new Error('cycle: ' + [...trail, name].join(' -> ')); }
        const value = body.get(name) ?? root.get(name);
        if (value === undefined || value === '') { throw new Error(`${name} is undefined in high contrast`); }
        const call = /^var\((.*)\)$/.exec(value);
        if (!call) { return value; }
        const args: string[] = [];
        let depth = 0; let current = '';
        for (const ch of call[1]) {
            if (ch === '(') { depth++; } else if (ch === ')') { depth--; }
            if (ch === ',' && depth === 0) { args.push(current); current = ''; } else { current += ch; }
        }
        args.push(current);
        for (const arg of args) {
            const trimmed = arg.trim();
            if (!trimmed) { continue; }
            if (!/^--[\w-]+$/.test(trimmed)) { return trimmed; }
            const inner = body.get(trimmed) ?? root.get(trimmed);
            if (inner === undefined || inner === '') { continue; }
            return resolve(trimmed, new Set([...trail, name]));
        }
        throw new Error(`${name} has no resolvable argument`);
    };

    return (name: string) => resolve(name, new Set());
}

/** The high-contrast semantic roles, resolved the way the browser resolves them. */
function resolveHighContrast(): Record<string, string> {
    const resolve = highContrastResolver();
    const resolved: Record<string, string> = {};
    for (const role of ['canvas', 'surface', 'surface-raised', 'ink', 'muted', 'accent',
        'accent-soft', 'border', 'border-on-ink', 'focus', 'focus-on-soft', 'hover',
        'on-accent', 'on-accent-soft', 'success', 'warning', 'danger']) {
        resolved[role] = resolve('--ivory-' + role);
    }
    return resolved;
}
