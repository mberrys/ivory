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
// A rationale comment may quote a role and the value it rejected. Strip
// comments so that prose is never read as a declaration.
const declarationsOnly = semantic.replace(/\/\*[\s\S]*?\*\//g, '');
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
        const lightAndDark = declarationsOnly.split('body.theia-hc,')[0];
        const roles = [
            'canvas', 'surface', 'surface-raised', 'ink', 'muted', 'accent', 'accent-soft', 'border',
            'focus', 'success', 'warning', 'danger', 'radius', 'space-1', 'space-2', 'space-3',
            'space-4', 'duration', 'easing', 'shadow'
        ];
        // A role may resolve through its upstream alias or, where no upstream
        // step clears WCAG AA as the small text it is painted in, through the
        // accessible Poteto literal. Both are acceptable; a half-alias, or an
        // alias to a value that fails AA, is not. The measured justification
        // for each exception lives in the stylesheet comment beside it.
        const fallbackOnly = new Set(['success', 'warning', 'danger', 'accent']);
        for (const role of roles) {
            const declarations = [...lightAndDark.matchAll(new RegExp(`--ivory-${role}:\\s*([^;]+);`, 'g'))];
            expect(declarations, role).to.have.length.greaterThan(0);
            for (const declaration of declarations) {
                const isAliased = new RegExp(`^var\\(--verified-upstream-${role},`).test(declaration[1]);
                if (isAliased) {
                    continue;
                }
                expect(fallbackOnly.has(role), `${role} is not aliased but is not a documented exception`).to.equal(true);
                expect(declaration[1], role).to.match(/^#[0-9a-f]{6}$/i);
            }
            expect(snapshot, role).to.contain(`--verified-upstream-${role}:`);
        }
    });

    it('keeps the roles upstream could not carry accessibly out of both theme blocks', () => {
        const lightBlock = declarationsOnly.split('body.theia-dark {')[0];
        const darkBlock = declarationsOnly.split('body.theia-dark {')[1];
        // A role is declined per theme, and only where the upstream step fails
        // WCAG AA as the text the prototype actually paints it in. Upstream's
        // light green, orange and red all fail as 10px pill labels on the tint
        // the pill paints; the light accent and danger-era roles that remain
        // clear. On the dark card the 500 steps and the blue accent all fail,
        // so dark declines all four.
        const declined = {
            light: ['success', 'warning', 'danger'],
            dark: ['success', 'warning', 'danger', 'accent']
        };
        for (const [theme, block] of [['light', lightBlock], ['dark', darkBlock]] as const) {
            for (const role of ['success', 'warning', 'danger', 'accent']) {
                const aliased = new RegExp(`--ivory-${role}:\\s*var\\(--verified-upstream-`).test(block);
                expect(aliased, `${theme} ${role}`).to.equal(!declined[theme].includes(role));
            }
        }
        // Each rejection is justified inline, and the upstream value stays
        // vendored as the record of what was pinned.
        expect(semantic).to.contain('WCAG AA');
        for (const alias of ['--verified-upstream-success: #248A3D', '--verified-upstream-warning: #C93400',
            '--verified-upstream-danger: #FF2D92', '--verified-upstream-accent: #007AFF']) {
            expect(snapshot, alias).to.contain(alias);
        }
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
