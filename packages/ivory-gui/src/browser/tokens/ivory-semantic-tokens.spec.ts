// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { existsSync, readFileSync } from 'fs';
import { expect } from 'chai';

const semanticPath = 'src/browser/tokens/ivory-semantic-tokens.css';
const snapshotPath = 'src/browser/tokens/liquidify.generated.css';
const sourcePath = 'src/browser/tokens/liquidify.source.json';

const semantic = readFileSync(semanticPath, 'utf8');
const snapshot = readFileSync(snapshotPath, 'utf8');
const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as {
    revision: string;
    sourcePaths: string[];
    sourceFiles: Array<{ path: string; sha256: string; lines: string }>;
    aliasSources?: { light: Record<string, string>; dark: Record<string, string> };
};

/** Expand an inclusive "from-to" line range. */
function expandRange(from: number, to: number): number[] {
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    private: boolean;
    publishConfig?: unknown;
};

describe('Ivory semantic token snapshot', () => {
    it('pins the reviewed LiqUIdify source', () => {
        expect(source.revision).to.equal('bc462c6e0bcc502938013b02c6434ac06c8350a0');
        expect(source.sourcePaths).to.deep.equal([
            'styled-system/styles.css',
            'panda.config.ts',
            'libs/components/src/styles/panda.css',
            'libs/components/src/styles/new-design-system.css',
            'LICENSE'
        ]);
    });

    it('defines every required semantic role', () => {
        for (const token of [
            'ivory-canvas', 'ivory-surface', 'ivory-surface-raised', 'ivory-ink', 'ivory-muted',
            'ivory-accent', 'ivory-border', 'ivory-focus', 'ivory-success', 'ivory-warning', 'ivory-danger'
        ]) {
            expect(semantic).to.contain(`--${token}:`);
        }
    });

    it('maps semantic roles to checked-in upstream tokens with accessible fallbacks', () => {
        const lightAndDark = semantic.split('body.theia-hc,')[0];
        const roles = [
            'canvas', 'surface', 'surface-raised', 'ink', 'muted', 'accent', 'accent-soft', 'border',
            'focus', 'success', 'warning', 'danger', 'radius', 'space-1', 'space-2', 'space-3',
            'space-4', 'duration', 'easing', 'shadow'
        ];
        // Upstream ships no light step that clears WCAG AA for these two roles,
        // so the light theme keeps the accessible Poteto value directly. The
        // aliases are still vendored and consumed by the dark theme.
        const lightFallbackOnly = new Set(['success', 'warning']);
        for (const role of roles) {
            const declarations = [...lightAndDark.matchAll(new RegExp(`--ivory-${role}:\\s*([^;]+);`, 'g'))];
            expect(declarations, role).to.have.length.greaterThan(0);
            for (const declaration of declarations) {
                const isAliased = new RegExp(`^var\\(--verified-upstream-${role},`).test(declaration[1]);
                if (lightFallbackOnly.has(role) && !isAliased) {
                    expect(declaration[1], role).to.match(/^#[0-9a-f]{6}$/i);
                } else {
                    expect(declaration[1], role).to.match(new RegExp(`^var\\(--verified-upstream-${role},`));
                }
            }
            expect(snapshot, role).to.contain(`--verified-upstream-${role}:`);
        }
    });

    it('keeps the light-theme roles upstream could not carry accessibly out of the light block', () => {
        const lightBlock = semantic.split('body.theia-dark {')[0];
        for (const role of ['success', 'warning']) {
            // The bridge must not alias these in the light block, and the dark
            // block must consume the alias the generated sheet declares.
            expect(lightBlock, role).not.to.match(new RegExp(`--verified-upstream-${role}:`));
            expect(lightBlock, role).not.to.match(new RegExp(`--ivory-${role}:\\s*var\\(--verified-upstream-`));
            expect(semantic.split('body.theia-dark {')[1], role).to.match(
                new RegExp(`--ivory-${role}:\\s*var\\(--verified-upstream-${role},`)
            );
        }
        // The rejected upstream values stay vendored, with the reason recorded.
        expect(snapshot).to.contain('--verified-upstream-success: #248A3D');
        expect(snapshot).to.contain('--verified-upstream-warning: #C93400');
        expect(snapshot).to.contain('WCAG AA');
    });

    it('keeps vendored token declarations inside the reversible activation boundary', () => {
        for (const stylesheet of [semantic, snapshot]) {
            expect(stylesheet).to.contain("html[data-ivory-gui='prototype'] {");
            expect(stylesheet).not.to.contain(':root');
        }
    });

    it('records the complete upstream inventory and keeps the private package documented', () => {
        expect(source.sourceFiles.map(file => file.path)).to.deep.equal([
            'styled-system/styles.css',
            'panda.config.ts',
            'libs/components/src/styles/panda.css',
            'libs/components/src/styles/new-design-system.css',
            'LICENSE'
        ]);
        for (const file of source.sourceFiles) {
            expect(file.sha256).to.match(/^[0-9a-f]{64}$/);
            expect(file.lines).to.match(/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/);
        }
        expect(packageJson.private).to.equal(true);
        expect(packageJson.publishConfig).to.equal(undefined);
        expect(existsSync('README.md')).to.equal(true);
        expect(existsSync('THIRD_PARTY_NOTICE.md')).to.equal(true);
    });

    it('vendors a shadow declaration from the pinned upstream source', () => {
        expect(snapshot).to.contain('0 8px 24px rgba(0, 0, 0, 0.12)');
        expect(snapshot).to.contain('bc462c6e0bcc502938013b02c6434ac06c8350a0');
        expect(snapshot).not.to.contain('http://');
        expect(snapshot).not.to.contain('https://');
    });

    it('records an upstream source line for every vendored alias', () => {
        // Each alias must name the exact upstream declaration it was copied
        // from, so a value can never be vendored without a traceable origin.
        expect(source.aliasSources, 'aliasSources').to.exist;
        const aliasSources = source.aliasSources!;
        if (!aliasSources) {
            throw new Error('liquidify.source.json does not record aliasSources.');
        }

        const [lightBlock, darkBlock] = snapshot.split('body.theia-dark {');
        expect(lightBlock, 'light block').to.be.a('string');
        expect(darkBlock, 'dark block').to.be.a('string');
        const declared = {
            light: [...lightBlock!.matchAll(/^\s*(--verified-upstream-[\w-]+):\s*(.+?);/gm)]
                .map(match => [match[1].replace('--verified-upstream-', ''), match[2].trim()]),
            dark: [...darkBlock!.matchAll(/^\s*(--verified-upstream-[\w-]+):\s*(.+?);/gm)]
                .map(match => [match[1].replace('--verified-upstream-', ''), match[2].trim()])
        };

        for (const theme of ['light', 'dark'] as const) {
            expect(declared[theme], `${theme} aliases`).to.not.be.empty;
            for (const [role, value] of declared[theme]) {
                const record = aliasSources[theme][role];
                expect(record, `${theme} ${role} has no recorded upstream source`).to.be.a('string');
                if (!record) {
                    throw new Error(`No recorded upstream source for ${theme} ${role}.`);
                }
                // "<path>:<line> --<upstream variable>"
                const cited = /^([\w/.-]+):(\d+) (--[\w-]+)$/.exec(record);
                expect(cited, `${theme} ${role} source "${record}" is not "<path>:<line> <variable>"`).to.exist;
                if (!cited) {
                    throw new Error(`Malformed upstream source for ${theme} ${role}: ${record}`);
                }
                const [, path, line, upstreamVariable] = cited;
                const file = source.sourceFiles.find(candidate => candidate.path === path);
                expect(file, `${theme} ${role} cites unknown file ${path}`).to.exist;
                const citedLines = file!.lines.split(',').flatMap(part => {
                    const [from, to] = part.split('-').map(Number);
                    return to ? expandRange(from, to) : [from];
                });
                expect(citedLines, `${theme} ${role} cites line ${line} outside the recorded range for ${path}`)
                    .to.include(Number(line));
                expect(upstreamVariable.startsWith('--'), `${theme} ${role} variable`).to.equal(true);
                expect(value, `${theme} ${role} value`).to.be.a('string').and.not.equal('');
            }
        }
    });
});
