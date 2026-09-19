// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCanonicalBundle, validateCanonicalModel } from './iv41-010-model.mjs';

const initial = loadCanonicalBundle();
const clone = () => structuredClone(initial);
const errors = candidate => validateCanonicalModel(
    candidate.model, candidate.owners, candidate.packageOwnership, candidate.heads, { verifyCarriers: false },
).join('\n');

test('IV41-010A-E committed canonical model satisfies all structural invariants', () => {
    assert.deepEqual(validateCanonicalModel(...Object.values(clone())), []);
});
test('IV41-010A cannot grant a second research writer or client acceptance', () => {
    const candidate = clone();
    candidate.model.authority.semanticWriter = '@ivory-tower/application';
    candidate.model.authority.clientAcceptance = true;
    assert.match(errors(candidate), /semanticWriter must remain Core-only/);
    assert.match(errors(candidate), /no client or harness acceptance/);
});
test('IV41-010A cannot omit or duplicate a canonical object', () => {
    const candidate = clone();
    candidate.model.concepts = candidate.model.concepts.filter(item => item.concept !== 'Source');
    assert.match(errors(candidate), /concepts must be complete and unique/);
});
test('IV41-010A must distinguish research and execution receipt authority', () => {
    const candidate = clone();
    candidate.model.receiptVariants.find(item => item.name === 'execution').owner = '@ivory-tower/research-kernel';
    candidate.model.receiptVariants.find(item => item.name === 'execution').semanticAcceptance = 'Core-only';
    assert.match(errors(candidate), /execution receipt owner drift/);
    assert.match(errors(candidate), /execution receipt may not accept research meaning/);
});
test('IV41-010B rejects destructive migration or guessed backfill', () => {
    const candidate = clone();
    candidate.model.migration.mode = 'rollback';
    candidate.model.migration.forbidden = ['apply', 'report', 'replay'];
    assert.match(errors(candidate), /only additive forward migrations/);
    assert.match(errors(candidate), /destructive rollback must be forbidden/);
    assert.match(errors(candidate), /guessed backfills must be forbidden/);
});
test('IV41-010B rejects migration without exact digest readback', () => {
    const candidate = clone();
    candidate.model.migration.after = ['count rows', 'declare complete', 'continue'];
    assert.match(errors(candidate), /migration requires semantic\/digest readback/);
});
test('IV41-010C rejects latest-head reference substitutions', () => {
    const candidate = clone();
    candidate.model.referencePolicy.latestForbidden = false;
    candidate.model.concepts[0].identity = 'projectId/objectId/latest';
    assert.match(errors(candidate), /stale\/cross-project\/wrong-type references must fail closed/);
    assert.match(errors(candidate), /identity cannot silently use latest/);
});
test('IV41-010C forbids implied link carry-forward and activity-as-semantic-dependency', () => {
    const candidate = clone();
    candidate.model.referencePolicy.carryForward = 'automatic-to-latest';
    candidate.model.referencePolicy.activityBackLinksAreSemanticDependencies = true;
    assert.match(errors(candidate), /carry-forward must be a new EvidenceLink/);
    assert.match(errors(candidate), /provenance back-links cannot change semantic closure/);
});
test('IV41-010C detects changed revision digest inputs and missing snapshot members', () => {
    const candidate = clone();
    candidate.model.dependencyDigest.revisionFields = ['payload'];
    candidate.model.dependencyDigest.snapshotMembers = ['ref'];
    assert.match(errors(candidate), /revision hash input fields drifted/);
    assert.match(errors(candidate), /dependency member digests must remain explicit/);
});
test('IV41-010D rejects shadow stores under planning synonyms', () => {
    const candidate = clone();
    candidate.model.aliases.find(item => item.term === 'Paper Store').mode = 'new-writable-store';
    assert.match(errors(candidate), /planning synonyms cannot create writable stores/);
});
test('IV41-010D forbids silently accepting absent legacy Fragment context', () => {
    const candidate = clone();
    candidate.model.aliases.find(item => item.term === 'legacy Fragment context').mode = 'assume-not-applicable';
    assert.match(errors(candidate), /legacy context must fail closed/);
});
test('IV41-010E rejects untracked owner-map gaps rather than recording session notes', () => {
    const candidate = clone();
    const gap = candidate.packageOwnership.gapPolicy.discoveredGaps[0];
    gap.issue = 'untracked-session-note';
    assert.match(errors(candidate), /untracked architecture gap/);
});
test('IV41-010E rejects manufactured Q1 closure from schema design', () => {
    const candidate = clone();
    candidate.model.gates.Q1 = 'passed';
    assert.match(errors(candidate), /cannot manufacture qualification gate closure/);
});
test('IV41-010E requires the exact base and PR context', () => {
    const candidate = clone();
    candidate.model.evidenceContext.selectedDev = '0'.repeat(40);
    candidate.model.evidenceContext.headBeforeIssue = 'latest';
    assert.match(errors(candidate), /selected dev SHA must match pinned historical basis/);
    assert.match(errors(candidate), /exact pre-issue PR commit SHA is required/);
});
test('IV41-010E fails closed when carrier symbol is absent on disk', () => {
    const candidate = clone();
    candidate.model.concepts[0].carrier = 'packages/ivory-tower-research-kernel/src/node/types.ts#ImaginaryCanonicalWriter';
    const actual = validateCanonicalModel(
        candidate.model, candidate.owners, candidate.packageOwnership, candidate.heads,
    ).join('\n');
    assert.match(actual, /structural carrier symbol absent/);
});

test('IV41-010A cannot replace the canonical record with a writable sidecar', () => {
    const candidate = clone();
    candidate.model.concepts.find(item => item.concept === 'Adjudication').persistence = 'new-writable-store';
    assert.match(errors(candidate), /persistence must reuse a declared canonical contract mode/);
});
