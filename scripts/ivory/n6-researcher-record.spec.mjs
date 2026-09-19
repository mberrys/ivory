// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveN6HumanQualification, n6HumanLimitation } from './n6-researcher-record.mjs';

const passing = { seat: 'R1', completedNoCode: true, explainedSupportingLink: true, explainedChallengingLink: true, distinguishedOldFromCurrent: true, notes: '' };
const confusedOldFromCurrent = { ...passing, seat: 'R5', distinguishedOldFromCurrent: false, notes: 'could not distinguish the retained original from the current evidence' };

function record(participantKind, participants) {
    return { schema: 'ivory-n6-researcher-record/1', studyKit: 'docs/experiments/n6-researcher-study-kit.md', participantKind, participants, recorded: '2026-09-13' };
}

test('no record reports the technical status and leaves the cohort observation pending, inventing nothing', () => {
    const result = deriveN6HumanQualification(undefined);
    assert.equal(result.status, 'technical-pass');
    assert.equal(result.humanQualification, 'pending');
    assert.equal(result.observedPasses, null);
    assert.match(result.note, /does not invent/);
    assert.match(result.note, /never gates/);
});

test('a pending or empty cohort cannot keep the record open', () => {
    const empty = deriveN6HumanQualification(record('human-researcher', []));
    assert.equal(empty.status, 'technical-pass');
    assert.equal(empty.humanQualification, 'pending');
    assert.equal(empty.observedPasses, 0);
    const belowBar = deriveN6HumanQualification(record('human-researcher', [passing, passing, passing, confusedOldFromCurrent, confusedOldFromCurrent]));
    assert.equal(belowBar.status, 'technical-pass');
    assert.equal(belowBar.humanQualification, 'pending');
    assert.equal(belowBar.observedPasses, 3);
});

test('four qualifying passes out of five are reported as a qualified observation without touching the gate status', () => {
    const result = deriveN6HumanQualification(record('human-researcher', [passing, passing, passing, passing, confusedOldFromCurrent]));
    assert.equal(result.participants.length, 5);
    assert.equal(result.observedPasses, 4);
    assert.equal(result.humanQualification, 'qualified');
    assert.equal(result.status, 'technical-pass');
});

test('a participant who cannot distinguish old from current evidence does not count', () => {
    const twoConfused = deriveN6HumanQualification(record('human-researcher', [passing, passing, passing, confusedOldFromCurrent, confusedOldFromCurrent]));
    assert.equal(twoConfused.observedPasses, 3);
    assert.equal(twoConfused.humanQualification, 'pending');
    assert.equal(twoConfused.status, 'technical-pass');
});

test('fewer than five participants cannot qualify the study even with all passes', () => {
    const result = deriveN6HumanQualification(record('human-researcher', [passing, passing, passing, passing]));
    assert.equal(result.observedPasses, 4);
    assert.equal(result.humanQualification, 'pending');
    assert.equal(result.status, 'technical-pass');
});

test('a non-human participant kind cannot qualify the observation', () => {
    const result = deriveN6HumanQualification(record('persona', [passing, passing, passing, passing, passing]));
    assert.equal(result.status, 'technical-pass');
    assert.equal(result.observedPasses, null);
    assert.match(result.note, /no qualifying human participant record/i);
});

test('the limitation states the study is an optional measurement, not an exit criterion', () => {
    const limitation = n6HumanLimitation();
    assert.match(limitation, /optional measurement, not an exit criterion/);
    assert.match(limitation, /owner decision 2026-09-13/);
    assert.match(limitation, /n6-researcher-record\.json/);
});
