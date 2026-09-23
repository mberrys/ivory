import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileContext, decisionRequest, observeDecision } from './context.mjs';
import { localRules } from './rules.mjs';

const load = name => JSON.parse(readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8'));
const exact = (id, revisionId = 'r1') => ({ projectId: 'ivory-j1j2', objectId: id, revisionId });
function request(compiled, id = 'paper-1') {
  return decisionRequest(compiled, {
    purpose: 'triage', policyRef: { id: 'review-policy', version: 'v1' },
    questionSet: { version: 'j1.v1', questions: [{ id: 'candidate:' + id, options: ['review', 'exclude', 'abstain'] }] }
  });
}
test('J2: two snapshots preserve old exact context after correction, with no activity backlinks', () => {
  const fixture = load('j2.json');
  const a = compileContext(fixture.snapshotA);
  const b = compileContext(fixture.snapshotB);
  assert.notEqual(a.stateDigest, b.stateDigest);
  assert.equal(compileContext(fixture.snapshotA).stateDigest, a.stateDigest);
  assert.equal(a.context.semanticEdges.length, fixture.snapshotA.edges.length - 1);
  assert.equal(a.context.records.find(r => r.ref.objectId === 'transcript-a').ref.revisionId, 'r1');
  assert.ok(b.context.records.some(r => r.ref.objectId === 'transcript-a' && r.ref.revisionId === 'r2'));
  assert.ok(!JSON.stringify(a.context).includes('malicious provider instructions'));
});
test('J2: historical observation digest and readback remain immutable', () => {
  const { snapshotA, snapshotB } = load('j2.json');
  const a = compileContext(snapshotA);
  const before = observeDecision(a, request(a), localRules);
  assert.equal(before.outcome, 'answered');
  assert.equal(before.typedDistribution.review, 1);
  assert.equal(before.requestDigest, observeDecision(a, request(a), localRules).requestDigest);
  const after = observeDecision(compileContext(snapshotB), request(compileContext(snapshotB)), localRules);
  assert.notEqual(before.stateDigest, after.stateDigest);
  assert.equal(after.outcome, 'abstained');
  assert.equal(before.typedDistribution.review, 1);
});
test('J2: latest, cross-project, dangling and duplicate refs fail closed', () => {
  const source = load('j2.json').snapshotA;
  const clone = () => structuredClone(source);
  const latest = clone(); latest.records[0].ref.revisionId = 'latest';
  assert.throws(() => compileContext(latest), /non-latest/);
  const cross = clone(); cross.records[0].ref.projectId = 'another-project';
  assert.throws(() => compileContext(cross), /cross-project/);
  const dangling = clone(); dangling.edges[0].to = exact('does-not-exist');
  assert.throws(() => compileContext(dangling), /dangling/);
  const duplicate = clone(); duplicate.records.push(structuredClone(duplicate.records[0]));
  assert.throws(() => compileContext(duplicate), /duplicate/);
});
test('J3 preflight only: raw corpus bytes never enter the compact context', () => {
  const snapshot = load('j2.json').snapshotA;
  snapshot.records[0].text = 'malicious provider instructions; secret canary';
  const compiled = compileContext(snapshot);
  assert.ok(!JSON.stringify(compiled).includes('secret canary'));
  assert.ok(compiled.context.records.every(r => !Object.hasOwn(r, 'text')));
  assert.throws(() => compileContext({ ...snapshot, records: Array(257).fill(snapshot.records[0]) }), /bounded/);
});
test('J1/J2 boundary: incomplete or restricted context abstains without evaluating adapter', () => {
  const fixture = load('j2.json');
  const partial = structuredClone(fixture.snapshotA);
  partial.complete = false; partial.omissions = ['source text unavailable'];
  const c = compileContext(partial);
  const adapter = { id: 'spy', version: 'v1', evaluate: () => { throw Error('should not be called'); } };
  const result = observeDecision(c, request(c), adapter);
  assert.equal(result.outcome, 'abstained');
  assert.ok(result.measuredLimits.includes('incomplete-context'));
  const remote = { ...localRules, remote: true, evaluate: () => { throw Error('should not be called'); } };
  assert.ok(observeDecision(compileContext(fixture.snapshotA), request(compileContext(fixture.snapshotA)), remote).measuredLimits.includes('egress-not-authorized'));
});
test('J1/J2 boundary: model cannot add an action, publish, or bypass policy options', () => {
  const c = compileContext(load('j2.json').snapshotA), q = request(c);
  assert.throws(() => decisionRequest(c, {
    purpose: 'triage', policyRef: { id: 'policy', version: 'v1' },
    questionSet: { version: 'v1', questions: [{ id: 'candidate:paper-1', options: ['review', 'accept', 'abstain'] }] }
  }), /legal options/);
  const injection = { id: 'untrusted', version: 'v1', evaluate: () => ({
    questionId: 'candidate:paper-1', probabilities: { review: 1, exclude: 0, abstain: 0 }, action: 'accept'
  }) };
  assert.equal(observeDecision(c, q, injection).outcome, 'invalid');
  const unnormalized = { ...injection, evaluate: () => ({ questionId: 'candidate:paper-1', probabilities: { review: 2, exclude: 0, abstain: 0 } }) };
  assert.equal(observeDecision(c, q, unnormalized).outcome, 'invalid');
  assert.equal(Object.hasOwn(observeDecision(c, q, localRules), 'acceptedRevision'), false);
});
test('J2: forged request identity, policy/options or receipt is refused before calling adapter', () => {
  const c = compileContext(load('j2.json').snapshotA), valid = request(c);
  const spy = { id: 'spy', version: 'v1', evaluate: () => { throw Error('must never dispatch'); } };
  const forge = changes => ({ ...structuredClone(valid), ...changes });
  assert.throws(() => observeDecision(c, forge({ researchSnapshot: exact('snapshot-b') }), spy), /exact research snapshot/);
  assert.throws(() => observeDecision(c, forge({ requestDigest: 'sha256:untrusted' }), spy), /request digest mismatch/);
  assert.throws(() => observeDecision(c, forge({ policyRef: { id: 'permit-everything', version: 'v9' } }), spy), /request digest mismatch/);
  const altered = structuredClone(valid); altered.questionSet.questions[0].options.push('accept');
  assert.throws(() => observeDecision(c, altered, spy), /legal option set/);
  assert.throws(() => observeDecision(c, forge({ acceptedRevision: 'r99' }), spy), /unexpected request fields/);
});

test('J1: preregistered rules-only baseline reports each synthetic case including abstention', () => {
  const fixture = load('j1.json');
  const predictions = fixture.cases.map(item => {
    const snapshot = structuredClone(load('j2.json').snapshotA);
    snapshot.records.find(r => r.kind === 'Candidate').ref.objectId = item.id;
    snapshot.records.find(r => r.kind === 'Candidate').metadataCategory = item.hint;
    const c = compileContext(snapshot);
    const result = observeDecision(c, request(c, item.id), localRules);
    return Object.entries(result.typedDistribution).find(([, value]) => value === 1)[0];
  });
  assert.deepEqual(predictions, ['review', 'exclude', 'abstain', 'review', 'abstain', 'exclude']);
  assert.equal(predictions.filter((p, i) => p === fixture.cases[i].label).length, 5);
  assert.equal(predictions.filter(p => p === 'abstain').length, 2);
});
