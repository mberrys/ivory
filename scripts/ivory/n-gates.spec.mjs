// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

function runVerifier(args) {
    return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

test('--require-closed rejects a gate id that is not in the manifest', () => {
    const result = runVerifier(['--require-closed', 'N9']);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /UNKNOWN GATE: N9/);
});

test('a required gate that exists but is still open fails as open, not as unknown', () => {
    const result = runVerifier(['--require-closed', 'N1']);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /REQUIRED: gate N1 is not closed/);
    assert.doesNotMatch(result.stderr, /UNKNOWN GATE/);
});

test('the verifier without flags still prints the table and succeeds', () => {
    const result = runVerifier([]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\| N7 \|/);
    assert.match(result.stdout, /\d+\/7 N-gates closed\./);
});
