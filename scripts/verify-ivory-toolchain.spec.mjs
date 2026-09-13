// @ts-check
'use strict';

// Windows backend bundling (`theia rebuild:browser` -> node-gyp/MSBuild) requires
// the Spectre-mitigated MSVC libraries. The probe must find them where installed
// toolsets actually keep them: VC/Tools/MSVC/<version>/lib/spectre/<arch> and
// VC/Tools/MSVC/<version>/atlmfc/lib/spectre/<arch>. The stale `lib/<arch>/spectre`
// pattern matched no real toolset and reported a false "missing" for an installed
// component. These fixtures are temporary directories, never live machine state.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { evaluateSpectreComponent } from './verify-ivory-toolchain.mjs';

const TOOLSET = 'VC/Tools/MSVC/14.44.35207';

function withFixture(build, assertions) {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ivory-spectre-probe-'));
    try {
        build(root);
        assertions(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function spectreLibraries(root, relative, libraries) {
    const directory = path.join(root, ...relative.split('/'));
    mkdirSync(directory, { recursive: true });
    for (const library of libraries) {
        writeFileSync(path.join(directory, library), '');
    }
}

function relativeDirectories(root, directories) {
    return directories
        .map(directory => path.relative(root, directory).split(path.sep).join('/'))
        .sort();
}

test('finds the Spectre libraries in the real installed layout', () => {
    withFixture(
        root => {
            spectreLibraries(root, `${TOOLSET}/lib/spectre/x64`, ['aligned_new.lib']);
            spectreLibraries(root, `${TOOLSET}/lib/spectre/x86`, ['aligned_new.lib']);
            spectreLibraries(root, `${TOOLSET}/atlmfc/lib/spectre/x64`, ['atls.lib']);
            // The stale `lib/<arch>/spectre` shape must be neither required nor counted.
            mkdirSync(path.join(root, ...`${TOOLSET}/lib/x64/spectre`.split('/')), { recursive: true });
        },
        root => {
            const result = evaluateSpectreComponent([root]);
            assert.equal(result.status, 'installed');
            assert.deepEqual(relativeDirectories(root, result.directories), [
                `${TOOLSET}/atlmfc/lib/spectre/x64`,
                `${TOOLSET}/lib/spectre/x64`,
                `${TOOLSET}/lib/spectre/x86`,
            ]);
        },
    );
});

test('reports a genuinely absent component as missing', () => {
    withFixture(
        root => {
            mkdirSync(path.join(root, ...`${TOOLSET}/lib/x64`.split('/')), { recursive: true });
        },
        root => {
            const result = evaluateSpectreComponent([root]);
            assert.equal(result.status, 'missing');
            assert.deepEqual(result.directories, []);
        },
    );
});

test('does not accept empty placeholder directories as installed libraries', () => {
    withFixture(
        root => {
            mkdirSync(path.join(root, ...`${TOOLSET}/lib/spectre/x64`.split('/')), { recursive: true });
        },
        root => {
            assert.equal(evaluateSpectreComponent([root]).status, 'missing');
        },
    );
});

test('aggregates every probed installation root', () => {
    withFixture(
        root => {
            const installed = path.join(root, 'installed');
            const absent = path.join(root, 'absent');
            spectreLibraries(installed, `${TOOLSET}/lib/spectre/x64`, ['aligned_new.lib']);
            mkdirSync(path.join(absent, ...'VC/Tools/MSVC/14.44.35207/lib/x64'.split('/')), { recursive: true });
            const result = evaluateSpectreComponent([absent, installed]);
            assert.equal(result.status, 'installed');
            assert.equal(result.directories.length, 1);
        },
        () => {},
    );
});
