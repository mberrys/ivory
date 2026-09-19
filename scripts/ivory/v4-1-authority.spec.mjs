// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareObservedHeads, evaluateGateRegistry, manifestDigest, validateManifest, validateRepositorySurfaces } from './v4-1-authority.mjs';

const MANIFEST = JSON.parse(readFileSync(new URL('../../configs/ivory-v4-1-authority.json', import.meta.url), 'utf8'));
const SCRIPT = fileURLToPath(new URL('./v4-1-authority.mjs', import.meta.url));

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function fixture(files = {}) {
    const root = mkdtempSync(join(tmpdir(), 'ivory-v41-authority-'));
    for (const [relative, content] of Object.entries(files)) {
        const target = join(root, relative);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
    return root;
}

function runCli(root, manifest, args = []) {
    const config = join(root, 'authority.json');
    writeFileSync(config, JSON.stringify(manifest, null, 2));
    return spawnSync(process.execPath, [SCRIPT, ...args], {
        encoding: 'utf8',
        env: {
            ...process.env,
            IVORY_V41_AUTHORITY_ROOT: root,
            IVORY_V41_AUTHORITY_CONFIG: config,
            IVORY_V41_AUTHORITY_SKIP_SURFACE_CHECK: '1',
        },
    });
}

test('the retained manifest is structurally complete and every V4.1 gate starts not-run', () => {
    assert.deepEqual(validateManifest(MANIFEST), []);
    const gates = evaluateGateRegistry(MANIFEST, { root: fixture() });
    assert.deepEqual(gates.map(gate => [gate.id, gate.state]), [
        ['DURABILITY', 'not-run'],
        ['REPLAY', 'not-run'],
        ['Q1', 'not-run'],
        ['Q2', 'not-run'],
        ['Q3', 'not-run'],
        ['Q4', 'not-run'],
    ]);
});

test('exact observed heads pass while a stale or substituted dev head fails', () => {
    assert.deepEqual(compareObservedHeads(MANIFEST, {
        detached: 'efec71ed83a1d0d9d513a4ead86369201cb5b401',
        pr1: 'ecc406d34a9bf49d8e2f165b994a919ca90ff718',
        dev: 'bc3cd03b5b2d870d219797925d92edc48c33c6ca',
    }), []);
    assert.deepEqual(compareObservedHeads(MANIFEST, {
        dev: '98d1a268f03bc1a6709b0fbf6842c54c2ee13ccb',
    }), ['head dev is 98d1a268f03bc1a6709b0fbf6842c54c2ee13ccb; expected bc3cd03b5b2d870d219797925d92edc48c33c6ca']);
});

test('a duplicate or forbidden canonical authority is rejected', () => {
    const duplicate = clone(MANIFEST);
    duplicate.canonicalOwners.push(clone(duplicate.canonicalOwners[0]));
    assert.match(validateManifest(duplicate).join('\n'), /duplicate canonical owner for Source/);

    const forbidden = clone(MANIFEST);
    forbidden.canonicalOwners[0].symbol = 'Paper Store';
    assert.match(validateManifest(forbidden).join('\n'), /introduces forbidden authority paper store/);
});

test('every N1-N7 lesson must resolve to exactly one structural carrier or owned gap', () => {
    const broken = clone(MANIFEST);
    delete broken.lessonCarriers[0].carrier;
    assert.match(validateManifest(broken).join('\n'), /N1 must have exactly one carrier or owned gap/);
});

test('a broken retained carrier path is rejected by the repository-surface check', () => {
    const missing = 'scripts/verify-ivory-n4-v2.mjs';
    const errors = validateRepositorySurfaces(MANIFEST, { exists: relative => relative !== missing });
    assert.deepEqual(errors, [`missing retained surface ${missing}`]);
});

test('the manifest digest is stable over the retained bytes', () => {
    const bytes = readFileSync(new URL('../../configs/ivory-v4-1-authority.json', import.meta.url));
    assert.match(manifestDigest(bytes), /^[0-9a-f]{64}$/);
});

test('machine evidence without its human receipt cannot close Q1', () => {
    const root = fixture({
        'docs/evidence/v4-1/q1-exact-context.json': { status: 'passed' },
    });
    const q1 = evaluateGateRegistry(MANIFEST, { root }).find(gate => gate.id === 'Q1');
    assert.equal(q1.state, 'blocked');
    assert.deepEqual(q1.missing, [{ kind: 'human', path: 'docs/evidence/v4-1/q1-research-review.json' }]);
});

test('human acceptance without machine evidence cannot close Q1', () => {
    const root = fixture({
        'docs/evidence/v4-1/q1-research-review.json': { decision: 'accepted' },
    });
    const q1 = evaluateGateRegistry(MANIFEST, { root }).find(gate => gate.id === 'Q1');
    assert.equal(q1.state, 'blocked');
    assert.deepEqual(q1.missing, [{ kind: 'machine', path: 'docs/evidence/v4-1/q1-exact-context.json' }]);
});

test('Q1 closes only when independent machine and human predicates both pass', () => {
    const root = fixture({
        'docs/evidence/v4-1/q1-exact-context.json': { status: 'passed' },
        'docs/evidence/v4-1/q1-research-review.json': { decision: 'accepted' },
    });
    const q1 = evaluateGateRegistry(MANIFEST, { root }).find(gate => gate.id === 'Q1');
    assert.equal(q1.state, 'passed');
    assert.deepEqual(q1.missing, []);
    assert.deepEqual(q1.failed, []);
});

test('a present but rejected human receipt makes the gate fail rather than pass', () => {
    const root = fixture({
        'docs/evidence/v4-1/q1-exact-context.json': { status: 'passed' },
        'docs/evidence/v4-1/q1-research-review.json': { decision: 'rejected' },
    });
    const q1 = evaluateGateRegistry(MANIFEST, { root }).find(gate => gate.id === 'Q1');
    assert.equal(q1.state, 'failed');
    assert.deepEqual(q1.failed, [{
        kind: 'human',
        path: 'docs/evidence/v4-1/q1-research-review.json',
        observed: 'rejected',
        expected: 'accepted',
    }]);
});

test('--require-gate refuses to round an unrun gate up to a pass', () => {
    const root = fixture();
    const result = runCli(root, MANIFEST, ['--require-gate', 'Q1']);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /GATE: required gate Q1 is not-run/);
    assert.match(result.stdout, /0\/6 V4\.1 gates passed; 6 not-run\./);
});

test('--observed-head rejects latest-head substitution at the CLI boundary', () => {
    const root = fixture();
    const result = runCli(root, MANIFEST, ['--observed-head', 'dev=98d1a268f03bc1a6709b0fbf6842c54c2ee13ccb']);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /HEAD MISMATCH: head dev is 98d1a268f03bc1a6709b0fbf6842c54c2ee13ccb/);
});

test('a fourth or latest authority head is rejected', () => {
    const manifest = clone(MANIFEST);
    manifest.heads.push({
        id: 'latest',
        ref: 'HEAD',
        sha: 'a'.repeat(40),
        treeSha: 'b'.repeat(40),
        role: 'substitution',
        classification: 'implementation-base',
        packages: [],
        surfaces: [],
        packageInventoryMode: 'exact-tree',
        schemaInspectionMode: 'exact-source-readback',
    });
    const errors = validateManifest(manifest).join('\n');
    assert.match(errors, /unexpected authority head latest/);
    assert.match(errors, /exactly three heads/);
    assert.match(errors, /latest\/HEAD substitution/);
});

test('package inventory must classify every exact head once', () => {
    const manifest = clone(MANIFEST);
    manifest.requiredPackageFacts[0].presentAt = ['pr1', 'dev'];
    manifest.requiredPackageFacts[0].absentAt = [];
    assert.match(validateManifest(manifest).join('\n'), /must classify every exact head once/);
});

test('the harness can orchestrate and replay but cannot become semantic authority', () => {
    const manifest = clone(MANIFEST);
    manifest.harnessBoundary.executionAuthority.mayAcceptInterpretation = true;
    manifest.harnessBoundary.executionAuthority.mayWriteCanonicalResearchState = true;
    const errors = validateManifest(manifest).join('\n');
    assert.match(errors, /Harness cannot accept interpretation/);
    assert.match(errors, /Harness cannot write canonical research state/);
});

test('recursive improvement cannot rewrite canonical evidence or bypass semantic evaluation', () => {
    const manifest = clone(MANIFEST);
    manifest.harnessBoundary.recursiveImprovement.canonicalEvidenceMutation = 'allowed';
    manifest.harnessBoundary.recursiveImprovement.semanticEvaluatorBypass = 'allowed';
    const errors = validateManifest(manifest).join('\n');
    assert.match(errors, /cannot mutate canonical evidence/);
    assert.match(errors, /cannot bypass semantic evaluation/);
});

test('gate closure cannot be declared by status or one aggregate pass flag', () => {
    const manifest = clone(MANIFEST);
    manifest.gates[0].status = 'passed';
    manifest.aggregatePass = true;
    const errors = validateManifest(manifest).join('\n');
    assert.match(errors, /must begin not-run/);
    assert.match(errors, /aggregate pass flags are forbidden/);
});
