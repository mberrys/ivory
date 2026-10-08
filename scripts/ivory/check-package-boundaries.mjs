// Copyright (C) 2026 Michael Berry and others.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isBuiltin } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
const policyPath = 'docs/architecture/v5-package-boundaries.json';
const registerPath = 'docs/architecture/archive-carriers.json';
const codePattern = /\.(?:[cm]?[jt]sx?|py|sql)$/;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const packageName = specifier => specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
const archivedName = name => /^@ivory-tower\/|^@theia\/ivory-|^ivory-(?:n\d|tower)/.test(name);
const ivoryPath = name => /^(?:packages|examples)\/ivory(?:-|\/)/.test(name);
const archivedPath = name => /^(?:packages|examples)\/(?:ivory-tower(?:-|\/)|ivory-n\d(?:-|\/)|ivory-identity\/)|^spikes\/(?:n2-durable-store|n6-portable-reproduction)\/|^scripts\/n[57]\//.test(name);

export function validatePackages(entries, policy) {
    const seen = new Set();
    for (const { directory, manifest } of entries) {
        assert(!archivedPath(directory + '/') && !archivedName(manifest.name ?? ''), `archived package: ${directory}`);
        const own = policy.packages[manifest.name];
        if (ivoryPath(directory + '/') || manifest.name?.startsWith('@ivory/')) {
            assert(own && own.path === directory, `undeclared Ivory package: ${manifest.name} at ${directory}`);
            seen.add(manifest.name);
        }
        for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']) {
            for (const name of Object.keys(manifest[section] ?? {})) {
                assert(!archivedName(name), `archived dependency: ${manifest.name} -> ${name}`);
                if (own) {
                    const allowed = section === 'devDependencies' ? own.devDependencies : own.dependencies;
                    assert(allowed.includes(name), `dependency direction: ${manifest.name} -> ${name} in ${section}`);
                } else if (name.startsWith('@ivory/')) {
                    assert.fail(`undeclared consumer: ${manifest.name} -> ${name}`);
                }
            }
        }
    }
    for (const [name, rule] of Object.entries(policy.packages)) {
        if (rule.state === 'present') assert(seen.has(name), `missing declared package: ${name}`);
    }
}

export function importsIn(source, file) {
    const imports = [];
    function add(node) {
        if (node && ts.isStringLiteralLike(node)) imports.push(node.text);
    }
    function visit(node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
        if (ts.isExternalModuleReference(node)) add(node.expression);
        if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node.argument.literal);
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) add(node.arguments[0]);
        ts.forEachChild(node, visit);
    }
    visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true));
    return imports;
}

export function validateImport(file, specifier, policy) {
    const own = Object.values(policy.packages).find(rule => file.startsWith(rule.path + '/'));
    assert(!archivedName(packageName(specifier)), `archived import: ${file} -> ${specifier}`);
    if (specifier.startsWith('.')) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
        assert(!archivedPath(target), `archived relative import: ${file} -> ${specifier}`);
        if (own) assert(target.startsWith(own.path + '/'), `cross-package relative import: ${file} -> ${specifier}`);
        else assert(!ivoryPath(target), `undeclared relative consumer: ${file} -> ${specifier}`);
        return;
    }
    if (own) {
        assert(!path.posix.isAbsolute(specifier) && !/^[a-z]:/i.test(specifier), `absolute import: ${file} -> ${specifier}`);
        const name = packageName(specifier);
        const test = /\.(?:spec|test)\.[cm]?[jt]sx?$|\/test\//.test(file);
        const testDependencies = ['chai', 'sinon', 'temp', 'chai-spies', 'chai-string', 'eslint'];
        assert(isBuiltin(specifier) || own.dependencies.includes(name) ||
            (test && testDependencies.includes(name)), `runtime import direction: ${file} -> ${specifier}`);
    } else if (specifier.startsWith('@ivory/')) {
        assert.fail(`undeclared importing consumer: ${file} -> ${specifier}`);
    }
}

export function validateCopies(files, carriers, upstreamConfigurationDigest) {
    const sourceDigests = new Set(carriers.map(carrier => carrier.normalizedTextSha256).filter(Boolean));
    for (const { file, source } of files) {
        if (!codePattern.test(file) || !/^(?:packages|examples|dev-packages|sample-plugins)\//.test(file)) continue;
        const digest = sha256(source.replace(/\r\n/g, '\n'));
        // The same two-line ESLint configuration already ships in upstream Theia.
        if (path.posix.basename(file) === '.eslintrc.js' && digest === upstreamConfigurationDigest) continue;
        assert(!sourceDigests.has(digest), `unadmitted archive byte copy: ${file}`);
    }
}

export function validateLock(lock, policy) {
    for (const [location, entry] of Object.entries(lock.packages)) {
        assert(!archivedPath(location) && !archivedName(entry.name ?? '') &&
            !/@ivory-tower\/|@theia\/ivory-|(?:packages|examples)\/ivory-(?:tower|n\d|identity)/.test(location + ' ' + (entry.resolved ?? '')),
        `archived lockfile entry: ${location}`);
        const installedName = location.split('node_modules/').at(-1);
        const own = policy.packages[entry.name] ?? policy.packages[installedName] ??
            Object.values(policy.packages).find(rule => rule.path === location);
        if (ivoryPath(location) || installedName.startsWith('@ivory/')) {
            assert(own, `undeclared installed Ivory package: ${location}`);
            if (entry.link) assert.equal(entry.resolved, own.path, `unexpected Ivory link: ${location}`);
        }
        for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']) {
            for (const name of Object.keys(entry[section] ?? {})) {
                assert(!archivedName(name), `archived lockfile dependency: ${location} -> ${name}`);
                if (own) {
                    const allowed = section === 'devDependencies' ? own.devDependencies : own.dependencies;
                    assert(allowed.includes(name), `installed dependency direction: ${location} -> ${name}`);
                } else {
                    assert(!name.startsWith('@ivory/'), `undeclared installed consumer: ${location} -> ${name}`);
                }
            }
        }
    }
}

export function validateUpstreamChanges(changes, upstreamFiles, metadataExceptions) {
    for (const file of changes) {
        assert(!upstreamFiles.has(file) || metadataExceptions.includes(file), `upstream-owned path changed: ${file}`);
    }
}

function main() {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
    const policy = JSON.parse(readFileSync(path.join(root, policyPath)));
    const register = JSON.parse(readFileSync(path.join(root, registerPath)));
    const names = [...new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean))];
    for (const file of names) assert(!archivedPath(file), `archived runtime path: ${file}`);
    const entries = names.filter(file => /^(?:packages|dev-packages|examples)\/[^/]+\/package\.json$|^sample-plugins\/[^/]+\/[^/]+\/package\.json$|^package\.json$/.test(file))
        .map(file => ({ directory: path.posix.dirname(file), manifest: JSON.parse(readFileSync(path.join(root, file))) }));
    validatePackages(entries, policy);
    // The lock is part of the installed graph, including renamed/file-linked packages.
    const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json')));
    validateLock(lock, policy);
    const files = names.filter(file => codePattern.test(file)).map(file => ({ file, source: readFileSync(path.join(root, file), 'utf8') }));
    const upstreamConfiguration = execFileSync('git', ['show', policy.upstreamBaseline + ':dev-packages/application-package/.eslintrc.js'], { cwd: root, encoding: 'utf8' });
    validateCopies(files, register.carriers, sha256(upstreamConfiguration.replace(/\r\n/g, '\n')));
    for (const { file, source } of files) {
        if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
        if (ivoryPath(file) || /@ivory|@theia\/ivory|ivory-tower|ivory-n[57]/.test(source)) {
            for (const specifier of importsIn(source, file)) validateImport(file, specifier, policy);
        }
    }
    const base = process.argv.find(arg => arg.startsWith('--base='))?.slice('--base='.length);
    if (base) {
        const upstream = new Set(git('ls-tree', '-r', '--name-only', '-z', policy.upstreamBaseline).split('\0'));
        const changes = git('diff', '--name-only', '-z', base, '--').split('\0').filter(Boolean);
        validateUpstreamChanges(changes, upstream, policy.metadataExceptions);
    }
    const head = git('rev-parse', 'HEAD');
    const dirty = git('status', '--porcelain').length > 0;
    const record = {
        record: 'ivory-package-boundaries@1', issue: 'mberrys/ivory-issues#2', gates: ['P1-package-boundaries'],
        head: { commit: head, branch: git('branch', '--show-current'), dirty },
        command: ['node', 'scripts/ivory/check-package-boundaries.mjs', ...process.argv.slice(2)].join(' '),
        workflow: { path: '.github/workflows/ivory-boundaries.yml', definitionRef: process.env.GITHUB_WORKFLOW_REF ?? null,
            definitionCommit: process.env.GITHUB_WORKFLOW_SHA ?? null,
            run: process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null },
        environment: { platform: process.platform, osVersion: os.release(), arch: process.arch, node: process.version,
            typescript: ts.version, machine: process.env.ImageVersion ?? os.hostname(), runner: process.env.RUNNER_OS ?? 'local' },
        fixtures: Object.fromEntries([policyPath, registerPath].map(file => [file, sha256(readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'))])),
        criteria: { declaredPackageGraph: { pass: true, gated: true, packages: entries.filter(entry => entry.manifest.name?.startsWith('@ivory/')).length },
            noArchiveByteCopies: { pass: true, gated: true }, upstreamFence: { pass: Boolean(base), gated: Boolean(base), base: base ?? null } },
        outcome: dirty ? 'fail' : 'pass', failReasons: dirty ? ['dirty-tree'] : [],
        limits: ['Static declarations and literal imports only; computed worker-module paths are not resolved.',
            'The byte-copy check detects complete files after CRLF normalization, not edited or fragment copies.',
            'No runtime, durability, client parity or dependency-transitive license qualification is claimed.']
    };
    const output = process.argv.find(arg => arg.startsWith('--record='))?.slice('--record='.length);
    if (output) {
        writeFileSync(output, JSON.stringify(record, null, 2) + '\n');
        assert(!dirty, 'a passing evidence record requires a clean working tree');
    }
    console.log(`Package boundaries passed for ${record.criteria.declaredPackageGraph.packages} Ivory packages and ${files.length} source files${base ? '; upstream fence checked' : ''}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
