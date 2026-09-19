// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveHumanValidation, humanLimitation } from './n1-human-record.mjs';

const passing = { seat: 'A', result: 'pass', criteria: { provenanceNotEndorsement: true, silentReanchor: false, citationSurvival: true, carryForwardSeparate: true } };
const confusing = { seat: 'D', result: 'pass', criteria: { provenanceNotEndorsement: false, silentReanchor: false, citationSurvival: true, carryForwardSeparate: true } };

function record(participantKind, seats) {
    return { schema: 'ivory-n1-human-record/1', participantKind, seats, exercisedCommit: '0c6e7de4', recorded: '2026-09-10' };
}

test('no record leaves the gate open and invents nothing', () => {
    const result = deriveHumanValidation(undefined);
    assert.equal(result.status, 'open');
    assert.equal(result.observedResults, null);
    assert.match(result.note, /does not invent/);
});

test('a persona record does not close the gate', () => {
    const result = deriveHumanValidation(record('persona', [passing, passing, passing]));
    assert.equal(result.status, 'open');
    assert.match(result.note, /no qualifying human participant record/i);
});

test('three human participants with three passes close the gate', () => {
    const result = deriveHumanValidation(record('human-qualitative-researcher', [passing, passing, passing]));
    assert.equal(result.status, 'closed');
    assert.equal(result.observedResults.observedPasses, 3);
});

test('a pass that confuses provenance with endorsement does not count', () => {
    const result = deriveHumanValidation(record('human-qualitative-researcher', [passing, passing, confusing]));
    assert.equal(result.status, 'closed');
    assert.equal(result.observedResults.observedPasses, 2);
});

test('two qualifying passes out of three is the bar; one is not', () => {
    const twoOfThree = deriveHumanValidation(record('human-qualitative-researcher', [passing, confusing, confusing]));
    assert.equal(twoOfThree.observedResults.observedPasses, 1);
    assert.equal(twoOfThree.status, 'open');
});

test('fewer than three participants cannot close the gate', () => {
    const result = deriveHumanValidation(record('human-qualitative-researcher', [passing, passing]));
    assert.equal(result.status, 'open');
});

test('the limitation text follows the gate', () => {
    assert.match(humanLimitation({ status: 'closed' }), /is closed by docs\/experiments\/n1-human-record\.json/);
    assert.match(humanLimitation({ status: 'open' }), /remains open/);
});
