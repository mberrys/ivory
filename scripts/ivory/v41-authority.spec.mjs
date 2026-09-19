// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBundle, validateBundle } from './v41-authority.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function clone(value) {
    return structuredClone(value);
}

function bundle() {
    return clone(loadBundle(ROOT));
}

function rawGitBlobSha(bytes) {
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    return createHash('sha1').update(Buffer.from(`blob ${buffer.length}\0`, 'utf8')).update(buffer).digest('hex');
}

function errorText(candidate, options = { verifyPackages: false }) {
    return validateBundle(candidate, options).join('\n');
}

test('the committed four-leaf authority contract is structurally valid', () => {
    assert.deepEqual(validateBundle(bundle(), { verifyPackages: false }), []);
});

test('a stale or alternate authority head cannot replace selected dev', () => {
    const candidate = bundle();
    candidate.heads.selectedAuthorityRole = 'foundationPr';
    assert.match(errorText(candidate), /selected authority must be selectedDev/);
});

test('latest-head substitution is rejected', () => {
    const candidate = bundle();
    candidate.heads.heads.find(head => head.role === 'selectedDev').identity = 'latest dev';
    assert.match(errorText(candidate), /must not use latest\/current substitution/);
});

test('an inferred package inventory is rejected', () => {
    const candidate = bundle();
    candidate.heads.packageInventorySource.mode = 'inferred';
    assert.match(errorText(candidate), /package inventory must be exact-tree/);
});

test('package manifest drift blocks the exact-head contract', () => {
    const candidate = bundle();
    const root = mkdtempSync(join(tmpdir(), 'v41-authority-'));
    const relative = 'packages/example/package.json';
    const full = join(root, relative);
    mkdirSync(dirname(full), { recursive: true });
    const original = Buffer.from('{"name":"@ivory-tower/example"}\n');
    writeFileSync(full, original);
    candidate.heads.packages = [{ name: '@ivory-tower/example', path: relative, packageJsonGitBlob: rawGitBlobSha(original) }];
    writeFileSync(full, '{"name":"@ivory-tower/example","changed":true}\n');
    const errors = validateBundle(candidate, {
        root,
        verifyPackages: true,
        resolvePackageBlobSha: (_root, path) => rawGitBlobSha(Buffer.from(requireRead(join(root, path)))),
    });
    assert.match(errors.join('\n'), /package manifest drift/);
});

function requireRead(path) {
    return globalThis.process.getBuiltinModule('fs').readFileSync(path);
}

test('the harness cannot become a semantic acceptance authority', () => {
    const candidate = bundle();
    candidate.owners.authorityBoundaries.harness.semanticAuthority = true;
    assert.match(errorText(candidate), /harness cannot become a semantic authority/);
});

test('recursive improvement cannot mutate protected Core authority', () => {
    const candidate = bundle();
    candidate.owners.authorityBoundaries.recursiveImprovement.mayMutateCore = true;
    assert.match(errorText(candidate), /recursive improvement cannot mutate protected Core authority/);
});

test('every N1-N7 lesson needs exactly one carrier or owned gap', () => {
    const candidate = bundle();
    const n4 = candidate.carriers.lessons.find(lesson => lesson.id === 'N4');
    delete n4.carrier;
    assert.match(errorText(candidate), /N4 must have exactly one structural carrier or owned gap/);
});

test('prose-only gate closure cannot replace machine and human evidence boundaries', () => {
    const candidate = bundle();
    const q1 = candidate.gates.gates.find(gate => gate.id === 'Q1');
    q1.machineEvidence = [];
    q1.humanOutcomeInferredFromMachine = true;
    const errors = errorText(candidate);
    assert.match(errors, /Q1 is missing machine evidence requirements/);
    assert.match(errors, /Q1 must forbid inferring human outcome from machine evidence/);
});

test('the registry rejects aggregate pass flags and pre-closed gates', () => {
    const candidate = bundle();
    candidate.gates.aggregatePass = true;
    candidate.gates.gates.find(gate => gate.id === 'Q4').state = 'passed';
    const errors = errorText(candidate);
    assert.match(errors, /aggregate pass flags are forbidden/);
    assert.match(errors, /Q4 must remain not-run/);
});
