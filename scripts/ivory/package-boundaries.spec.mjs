// Copyright (C) 2026 Michael Berry and others.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { importsIn, validateCopies, validateImport, validateLock, validatePackages, validateUpstreamChanges } from './check-package-boundaries.mjs';

const policy = JSON.parse(readFileSync(new URL('../../docs/architecture/v5-package-boundaries.json', import.meta.url)));
const packages = Object.entries(policy.packages).filter(([, rule]) => rule.state === 'present').map(([name, rule]) => ({
    directory: rule.path, manifest: { name, dependencies: Object.fromEntries(rule.dependencies.map(dependency => [dependency, '1.0.0'])) }
}));
test('the declared contracts, Core and qualification graph passes', () => validatePackages(packages, policy));
test('Core cannot depend on the workbench or qualification, even as a development dependency', () => {
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
        for (const name of ['@ivory/workbench', '@ivory/qualification', '@theia/core']) {
            const changed = structuredClone(packages);
            changed.find(entry => entry.manifest.name === '@ivory/core').manifest[section] = { [name]: '1.0.0' };
            assert.throws(() => validatePackages(changed, policy), /dependency direction/);
        }
    }
});
test('a renamed archive package, an upstream consumer and an undeclared Ivory package fail', () => {
    for (const entry of [
        { directory: 'packages/ivory-tower-domain', manifest: { name: '@ivory/core' } },
        { directory: 'packages/core', manifest: { name: '@theia/core', dependencies: { '@ivory/core': '1' } } },
        { directory: 'packages/ivory-extra', manifest: { name: '@ivory/extra' } },
        { directory: 'packages/renamed', manifest: { name: 'renamed', dependencies: { '@theia/ivory-identity': '1' } } }
    ]) assert.throws(() => validatePackages([...packages, entry], policy), /archived|undeclared/);
});
test('source imports obey the same direction and cannot bypass it with a relative path', () => {
    const file = 'packages/ivory-core/src/node/main.ts';
    for (const specifier of ['@theia/core/shared/inversify', '@ivory/qualification', '@ivory-tower/domain', '../../../ivory-workbench/src/main', '../../../ivory-n5-client/src/client']) {
        assert.throws(() => validateImport(file, specifier, policy), /import|consumer/);
    }
    validateImport(file, '@ivory/contracts/lib/node', policy);
    validateImport(file, 'node:sqlite', policy);
    validateImport(file, './store/store-runtime', policy);
});
test('the parser reads import, export, require, dynamic import and import types without treating comments as imports', () => {
    assert.deepEqual(importsIn(`
        // import '@ivory/qualification';
        import { a } from '@ivory/contracts';
        export * from '@ivory/core';
        const a = require('@theia/ivory-identity');
        const b = import('@ivory-tower/domain');
        type C = import('@ivory/workbench').C;
        import D = require('@ivory/cli');
    `, 'fixture.ts'), ['@ivory/contracts', '@ivory/core', '@theia/ivory-identity', '@ivory-tower/domain', '@ivory/workbench', '@ivory/cli']);
});
test('a byte copy under a new filename fails even when its line endings change', () => {
    const source = 'export const archive = true;\n';
    const carriers = [{ normalizedTextSha256: createHash('sha256').update(source).digest('hex') }];
    assert.throws(() => validateCopies([{ file: 'packages/ivory-core/src/copied.ts', source: source.replace(/\n/g, '\r\n') }], carriers), /unadmitted archive byte copy/);
    validateCopies([{ file: 'docs/archive-evidence/source.ts', source }], carriers);
});
test('only the exact inherited ESLint configuration is exempt from the byte-copy check', () => {
    const source = 'module.exports = { extends: "../../configs/eslint" };\n';
    const digest = createHash('sha256').update(source).digest('hex');
    const carriers = [{ normalizedTextSha256: digest }];
    validateCopies([{ file: 'packages/ivory-contracts/.eslintrc.js', source }], carriers, digest);
    assert.throws(() => validateCopies([{ file: 'packages/ivory-core/src/copied.ts', source }], carriers, digest), /unadmitted archive byte copy/);
});
test('the upstream fence refuses an existing Theia edit and permits additive files and lock metadata', () => {
    const upstream = new Set(['packages/core/src/main.ts', 'package-lock.json']);
    assert.throws(() => validateUpstreamChanges(['packages/core/src/main.ts'], upstream, policy.metadataExceptions), /upstream-owned/);
    validateUpstreamChanges(['packages/ivory-core/src/main.ts', 'package-lock.json'], upstream, policy.metadataExceptions);
});
test('the installed graph rejects renamed archive links, unknown Ivory packages and indirect qualification consumers', () => {
    for (const [location, entry] of [
        ['node_modules/renamed', { name: '@ivory-tower/domain' }],
        ['node_modules/renamed', { resolved: 'file:packages/ivory-tower-domain' }],
        ['node_modules/@ivory/extra', { version: '1' }],
        ['node_modules/@ivory/core', { link: true, resolved: 'packages/renamed' }],
        ['node_modules/sdk', { dependencies: { '@ivory/qualification': '1' } }],
        ['packages/ivory-core', { dependencies: { '@ivory/workbench': '1' } }]
    ]) assert.throws(() => validateLock({ packages: { [location]: entry } }, policy), /archived|undeclared|unexpected Ivory link|direction/);
    validateLock({ packages: { 'node_modules/@ivory/core': { link: true, resolved: 'packages/ivory-core' } } }, policy);
});
