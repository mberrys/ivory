// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateGates, formatGateTable } from './n-gates.mjs';

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
