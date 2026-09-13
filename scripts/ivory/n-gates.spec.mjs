// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateGates, formatGateTable, unknownGateIds } from './n-gates.mjs';

function fixture(files) {
    const root = mkdtempSync(join(tmpdir(), 'n-gates-'));
    for (const [relative, content] of Object.entries(files)) {
        const target = join(root, relative);
        mkdirSync(join(target, '..'), { recursive: true });
        writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
    return root;
}

const config = {
    schema: 'ivory-n-gates/1',
    gates: [
        {
            id: 'NX',
            title: 'Example gate',
            evidence: 'evidence.json',
            document: 'doc.md',
            documentStatusPrefix: '**Status:**',
            documentOpenPattern: 'open',
            documentClosedPattern: 'closed',
            observations: { human: 'humanValidation.status' },
            closedWhen: [{ path: 'humanValidation.status', equals: 'closed' }],
        },
    ],
};

test('a missing evidence record is open, not an error', () => {
    const root = fixture({ 'doc.md': '**Status:** open\n' });
    const [gate] = evaluateGates(config, { root });
    assert.equal(gate.closed, false);
    assert.deepEqual(gate.missing, ['evidence.json']);
});

test('a closed record with a closed document is closed', () => {
    const root = fixture({
        'evidence.json': { humanValidation: { status: 'closed' } },
        'doc.md': '**Status:** closed by the retained human record\n',
    });
    const [gate] = evaluateGates(config, { root });
    assert.equal(gate.closed, true);
    assert.deepEqual(gate.mismatches, []);
});

test('a closed record with a document still claiming open is a mismatch', () => {
    const root = fixture({
        'evidence.json': { humanValidation: { status: 'closed' } },
        'doc.md': '**Status:** provisional architecture pass; human validation remains open\n',
    });
    const [gate] = evaluateGates(config, { root });
    assert.equal(gate.closed, true);
    assert.equal(gate.mismatches.length, 1);
    assert.match(gate.mismatches[0], /still says open/);
});

test('a closed record with a document that never says closed is a mismatch', () => {
    const root = fixture({
        'evidence.json': { humanValidation: { status: 'closed' } },
        'doc.md': '**Status:** provisional architecture pass\n',
    });
    const [gate] = evaluateGates(config, { root });
    assert.equal(gate.mismatches.length, 1);
    assert.match(gate.mismatches[0], /must say closed/);
});

test('a document without the declared status line is a mismatch', () => {
    const root = fixture({
        'evidence.json': { humanValidation: { status: 'closed' } },
        'doc.md': '# No status line here\n',
    });
    const [gate] = evaluateGates(config, { root });
    assert.equal(gate.mismatches.length, 1);
    assert.match(gate.mismatches[0], /no \*\*Status:\*\* line/);
});

test('the table renders one row per gate', () => {
    const root = fixture({ 'doc.md': '**Status:** open\n' });
    const table = formatGateTable(evaluateGates(config, { root }));
    assert.match(table, /\| NX \|/);
    assert.match(table, /open/);
});

const MANIFEST = JSON.parse(readFileSync(new URL('../../configs/ivory-n-gates.json', import.meta.url), 'utf8'));

function manifestGate(id, overrides = {}) {
    const gate = MANIFEST.gates.find(candidate => candidate.id === id);
    assert.ok(gate, `the manifest declares gate ${id}`);
    return { ...gate, ...overrides };
}

test('a closed record is not passed by a document that still says open', () => {
    const anchored = { gates: [manifestGate('N4', { evidence: 'evidence.json', document: 'doc.md' })] };
    const root = fixture({
        'evidence.json': { status: 'qualified' },
        'doc.md': '**Status:** open — awaiting a qualified run.\n',
    });
    const [gate] = evaluateGates(anchored, { root });
    assert.equal(gate.closed, true);
    assert.equal(gate.mismatches.length, 1);
    assert.match(gate.mismatches[0], /still says open/);
});

test('the status text alone decides closedness once the prefix is stripped', () => {
    const anchored = { gates: [manifestGate('N4', { evidence: 'evidence.json', document: 'doc.md' })] };
    const root = fixture({
        'evidence.json': { status: 'qualified' },
        'doc.md': '**Status:** qualified — 22/22 fixtures converted with exact anchors.\n',
    });
    const [gate] = evaluateGates(anchored, { root });
    assert.equal(gate.closed, true);
    assert.deepEqual(gate.mismatches, []);
});

test('every manifest gate anchors its closed pattern at the start of the status text', () => {
    for (const gate of MANIFEST.gates) {
        assert.match(gate.documentClosedPattern, /^\^/, `${gate.id} must anchor its closed pattern`);
    }
});

test('unknown gate ids are reported instead of silently ignored', () => {
    const root = fixture({ 'doc.md': '**Status:** open\n' });
    const gates = evaluateGates(config, { root });
    assert.deepEqual(unknownGateIds(gates, ['NX']), []);
    assert.deepEqual(unknownGateIds(gates, []), []);
    assert.deepEqual(unknownGateIds(gates, ['NX', 'N9']), ['N9']);
    assert.deepEqual(unknownGateIds(gates, ['N9', 'N8', 'N9']), ['N9', 'N8']);
});

const SCRIPT = fileURLToPath(new URL('./n-gates.mjs', import.meta.url));
const REPO_ROOT = join(dirname(SCRIPT), '..', '..');

function runVerifier(args, env) {
    return spawnSync(process.execPath, [SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, ...env },
    });
}

/**
 * A manifest outside the repository whose gate evidence and document are
 * addressed by a relative traversal back into the temporary directory. These
 * gates are therefore decided only by the fixture, never by which real gates
 * happen to be closed in the checked-out state.
 */
function tempManifest(gates) {
    const dir = mkdtempSync(join(tmpdir(), 'n-gates-manifest-'));
    const manifest = join(dir, 'ivory-n-gates.json');
    const relocated = name => relative(REPO_ROOT, join(dir, name));
    writeFileSync(
        manifest,
        JSON.stringify(
            {
                schema: 'ivory-n-gates/1',
                gates: gates.map(gate => ({
                    ...gate,
                    ...(gate.evidence === undefined ? {} : { evidence: relocated(gate.evidence) }),
                    ...(gate.document === undefined ? {} : { document: relocated(gate.document) }),
                })),
            },
            null,
            2,
        ),
    );
    return { dir, manifest };
}

test('--require-closed rejects a gate id that is not in the manifest', () => {
    const result = runVerifier(['--require-closed', 'N9']);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /UNKNOWN GATE: N9/);
});

test('a required gate that exists but is still open fails as open, not as unknown', () => {
    const { manifest } = tempManifest([
        {
            id: 'NX',
            title: 'Hermetic gate whose evidence is never written',
            evidence: 'nx-evidence.json',
            closedWhen: [{ path: 'status', equals: 'closed' }],
        },
    ]);
    const result = runVerifier(['--require-closed', 'NX'], { IVORY_N_GATES_CONFIG: manifest });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /REQUIRED: gate NX is not closed/);
    assert.doesNotMatch(result.stderr, /UNKNOWN GATE/);
    assert.match(result.stdout, /\| NX \| open \|/);
});

test('a required gate whose evidence is present and closed passes', () => {
    const { dir, manifest } = tempManifest([
        {
            id: 'NX',
            title: 'Hermetic gate whose evidence is written as closed',
            evidence: 'nx-evidence.json',
            observations: { status: 'status' },
            closedWhen: [{ path: 'status', equals: 'closed' }],
        },
    ]);
    writeFileSync(join(dir, 'nx-evidence.json'), JSON.stringify({ status: 'closed' }));
    const result = runVerifier(['--require-closed', 'NX'], { IVORY_N_GATES_CONFIG: manifest });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\| NX \| closed \|/);
    assert.match(result.stdout, /1\/1 N-gates closed\./);
});

test('the N3 gate closes on runtime qualification and the support-matrix decision, with no onboarding cohort recorded', () => {
    const { dir, manifest } = tempManifest([
        manifestGate('N3', { evidence: 'n3-evidence.json', document: 'n3-doc.md' }),
    ]);
    writeFileSync(
        join(dir, 'n3-evidence.json'),
        JSON.stringify({
            status: 'runtime-qualified',
            decision: { supportMatrix: 'pilot-decided' },
            onboarding: { observed: false },
        }),
    );
    writeFileSync(join(dir, 'n3-doc.md'), '**Status:** decided — pilot platform and support matrix recorded.\n');
    const result = runVerifier(['--require-closed', 'N3'], { IVORY_N_GATES_CONFIG: manifest });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\| N3 \| closed \|/);
    assert.match(result.stdout, /onboardingObserved=false/);
    assert.doesNotMatch(result.stdout, /onboarding\.observed/);
    assert.match(result.stdout, /1\/1 N-gates closed\./);
});

test('the verifier without flags still prints the table and succeeds', () => {
    const result = runVerifier([]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\| N7 \|/);
    assert.match(result.stdout, /\d+\/7 N-gates closed\./);
});
