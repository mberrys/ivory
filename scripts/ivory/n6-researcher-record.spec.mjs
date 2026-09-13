// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveN6HumanQualification, n6HumanLimitation } from './n6-researcher-record.mjs';

const passing = { seat: 'R1', completedNoCode: true, explainedSupportingLink: true, explainedChallengingLink: true, distinguishedOldFromCurrent: true, notes: '' };
const confusedOldFromCurrent = { ...passing, seat: 'R5', distinguishedOldFromCurrent: false, notes: 'could not distinguish the retained original from the current evidence' };

function record(participantKind, participants) {
    return { schema: 'ivory-n6-researcher-record/1', studyKit: 'docs/experiments/n6-researcher-study-kit.md', participantKind, participants, recorded: '2026-09-13' };
}

test('no record leaves the human gate pending and invents nothing', () => {
    const result = deriveN6HumanQualification(undefined);
    assert.equal(result.status, 'technical-pass-human-pending');
    assert.equal(result.humanQualification, 'pending');
    assert.equal(result.observedPasses, null);
    assert.match(result.note, /does not invent/);
});

test('an empty cohort leaves the human gate pending', () => {
    const result = deriveN6HumanQualification(record('human-researcher', []));
    assert.equal(result.status, 'technical-pass-human-pending');
    assert.equal(result.humanQualification, 'pending');
    assert.equal(result.observedPasses, 0);
});

test('four qualifying passes out of five participants qualify the gate', () => {
    const result = deriveN6HumanQualification(record('human-researcher', [passing, passing, passing, passing, confusedOldFromCurrent]));
    assert.equal(result.participants.length, 5);
    assert.equal(result.observedPasses, 4);
    assert.equal(result.status, 'human-qualified');
    assert.equal(result.humanQualification, 'qualified');
});

test('a participant who cannot distinguish old from current evidence does not count', () => {
    const twoConfused = deriveN6HumanQualification(record('human-researcher', [passing, passing, passing, confusedOldFromCurrent, confusedOldFromCurrent]));
    assert.equal(twoConfused.observedPasses, 3);
    assert.equal(twoConfused.status, 'technical-pass-human-pending');
    assert.equal(twoConfused.humanQualification, 'pending');
});

test('fewer than five participants cannot qualify the gate even with all passes', () => {
    const result = deriveN6HumanQualification(record('human-researcher', [passing, passing, passing, passing]));
    assert.equal(result.observedPasses, 4);
    assert.equal(result.status, 'technical-pass-human-pending');
    assert.equal(result.humanQualification, 'pending');
});

test('a non-human participant kind cannot qualify the gate', () => {
    const result = deriveN6HumanQualification(record('persona', [passing, passing, passing, passing, passing]));
    assert.equal(result.status, 'technical-pass-human-pending');
    assert.equal(result.observedPasses, null);
    assert.match(result.note, /no qualifying human participant record/i);
});

test('the limitation text follows the gate', () => {
    assert.match(n6HumanLimitation({ status: 'human-qualified' }), /qualified by docs\/experiments\/n6-researcher-record\.json/);
    assert.match(n6HumanLimitation({ status: 'technical-pass-human-pending' }), /remain pending/);
});
