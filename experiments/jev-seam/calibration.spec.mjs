import test from 'node:test';
import assert from 'node:assert/strict';
import { qualifyCases } from './calibration.mjs';

const OPTIONS = ['supported', 'partial', 'unsupported', 'contradicted', 'abstain'];
const dist = label => Object.fromEntries(OPTIONS.map(x => [x, Number(x === label)]));
function row(id, label, choice, opts = {}) {
  const status = opts.status ?? 'resolved';
  return {
    id, groupId: opts.groupId ?? id, split: opts.split ?? 'heldout',
    reference: { status, label: status === 'resolved' ? label : null, reviewers: 2 },
    observation: {
      mode: opts.mode ?? 'rules', adapterId: opts.adapterId ?? 'offline-stub',
      adapterVersion: 'fixture-1', outcome: opts.outcome ?? (choice === 'abstain' ? 'abstained' : 'answered'),
      choice, distribution: opts.distribution ?? dist(choice ?? 'abstain'),
    },
  };
}
test('J4 metric harness: disaggregate class, abstention and unsupported-support flags', () => {
  const dataset = [
    row('a', 'supported', 'supported'),
    row('b', 'unsupported', 'supported'),
    row('c', 'partial', 'abstain'),
    row('d', null, 'abstain', { status: 'contested' }),
    row('e', null, 'abstain', { status: 'inaccessible' }),
  ];
  const result = qualifyCases(dataset)['rules|offline-stub|fixture-1'];
  assert.equal(result.heldout, 5);
  assert.equal(result.independentlyResolved, 3);
  assert.equal(result.contested, 1);
  assert.equal(result.inaccessible, 1);
  assert.equal(result.coverageOfResolved, 2 / 3);
  assert.equal(result.accuracyOnResolvedAnswered, 0.5);
  assert.equal(result.falseSupportFlags, 1);
  assert.equal(result.falseSupportFlagRate, 1);
  assert.equal(result.byClass.supported.precision, 0.5);
  assert.equal(result.brierOnLiveAnsweredResolvedOnly, null);
});
test('J4 calibration arithmetic is only computed for declared live resolved answers', () => {
  // These are injected numbers to test arithmetic, NOT actual Jev model results.
  const rows = [
    row('a', 'supported', 'supported', { mode: 'live', adapterId: 'injected-only' }),
    row('b', 'unsupported', 'unsupported', { mode: 'live', adapterId: 'injected-only' }),
    row('c', null, 'abstain', { mode: 'live', adapterId: 'injected-only', status: 'contested' }),
  ];
  const result = qualifyCases(rows)['live|injected-only|fixture-1'];
  assert.equal(result.brierOnLiveAnsweredResolvedOnly, 0);
  assert.equal(result.liveCalibratableCases, 2);
  assert.equal(result.contested, 1);
});
test('J4 group leakage across train/heldout is refused', () => {
  const train = row('version1', 'supported', 'supported', { groupId: 'same-study', split: 'train' });
  const heldout = row('version2', 'supported', 'supported', { groupId: 'same-study' });
  assert.throws(() => qualifyCases([train, heldout]), /leak across splits/);
});
test('J4 disputed and inaccessible labels cannot silently be scored as truth', () => {
  const contested = row('a', 'supported', 'supported', { status: 'contested' });
  contested.reference.label = 'supported';
  assert.throws(() => qualifyCases([contested]), /no forced accuracy label/);
  const singleReviewer = row('b', 'supported', 'supported');
  singleReviewer.reference.reviewers = 1;
  assert.throws(() => qualifyCases([singleReviewer]), /independently reviewed/);
});
test('J4 malformed distributions or duplicate observations fail closed', () => {
  const invalid = row('a', 'supported', 'supported');
  invalid.observation.distribution.supported = Number.NaN;
  assert.throws(() => qualifyCases([invalid]), /finite probability/);
  const good = row('b', 'supported', 'supported');
  assert.throws(() => qualifyCases([good, structuredClone(good)]), /duplicate case observation/);
  const invalidFailure = row('c', 'supported', 'supported');
  invalidFailure.observation.outcome = 'unavailable';
  assert.throws(() => qualifyCases([invalidFailure]), /failed provider cannot be scored/);
});
