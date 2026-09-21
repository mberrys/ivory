// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCanonicalBundle, validateCanonicalModel } from './iv41-010-model.mjs';

const initial = loadCanonicalBundle();
const clone = () => structuredClone(initial);
const errors = (candidate, options = { verifyCarriers: false }) => validateCanonicalModel(
    candidate.model, candidate.owners, candidate.packageOwnership, candidate.heads, candidate.carriers, candidate.adrLineage, options,
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
    const actual = errors(candidate, {});
    assert.match(actual, /structural carrier symbol absent/);
});

test('IV41-010A rejects a CAS row that contradicts the owner map and the carrier matrix', () => {
    const ownerDrift = clone();
    const cas = ownerDrift.model.concepts.find(item => item.concept === 'CAS');
    cas.owner = '@ivory-tower/adapters';
    cas.carrier = 'packages/ivory-tower-adapters/src/execution-ports.ts#ObjectStorePort';
    const ownerErrors = errors(ownerDrift);
    assert.match(ownerErrors, /owner @ivory-tower\/adapters contradicts the owner map owner @ivory-tower\/contracts for CAS/);
    assert.match(ownerErrors, /is neither the owner-map primary carrier nor a carrier-matrix unit/);

    const outsidePackage = clone();
    outsidePackage.model.concepts.find(item => item.concept === 'CAS').carrier =
        'packages/ivory-tower-adapters/src/execution-ports.ts#ObjectStorePort';
    const outsideErrors = errors(outsidePackage);
    assert.match(outsideErrors, /carrier .*execution-ports\.ts#ObjectStorePort is not inside the package owned by @ivory-tower\/contracts/);
    assert.match(outsideErrors, /is neither the owner-map primary carrier nor a carrier-matrix unit/);

    const matrixDrift = clone();
    matrixDrift.carriers.lessons.find(lesson => lesson.id === 'N2').carrier.units[0].owner = '@ivory-tower/research-kernel';
    assert.match(
        errors(matrixDrift),
        /carrier .*durable-store-port\.ts#DurableStorePort is owned by @ivory-tower\/research-kernel in the carrier matrix, not @ivory-tower\/contracts/,
    );
});
test('IV41-010A requires an owner that exists in the exact-head package inventory', () => {
    const candidate = clone();
    candidate.model.concepts.find(item => item.concept === 'Snapshot').owner = '@ivory-tower/not-a-package';
    const actual = errors(candidate);
    assert.match(actual, /owner @ivory-tower\/not-a-package is not a package in the exact-head inventory/);
    assert.match(actual, /contradicts the owner map owner @ivory-tower\/research-kernel for Snapshot/);
});
test('IV41-010A rejects an authority package outside the exact-head inventory', () => {
    const candidate = clone();
    candidate.model.authority.durableImplementation = '@ivory-tower/not-a-package';
    const actual = errors(candidate);
    assert.match(actual, /durableImplementation @ivory-tower\/not-a-package is not a package in the exact-head inventory/);
    assert.match(actual, /storage authority must agree with package ownership/);
});
test('IV41-010 rejects a missing, unbound, incomplete or drifted exact-head readback', () => {
    const dropped = clone();
    delete dropped.model.readback;
    assert.match(errors(dropped), /the model must retain its exact-head readback/);

    const unbound = clone();
    unbound.model.readback.auditedHead = { ref: 'latest', sha: 'not-a-sha', mode: 'inferred' };
    const unboundErrors = errors(unbound);
    assert.match(unboundErrors, /readback must record the exact 40-character head SHA it audited/);
    assert.match(unboundErrors, /readback head ref must be an exact non-latest ref/);
    assert.match(unboundErrors, /readback must be an exact working-tree audit/);

    const incomplete = clone();
    incomplete.model.readback.files = incomplete.model.readback.files.filter(file => file.id !== 'durableStorePort');
    assert.match(errors(incomplete), /readback must hash exactly the contract and carrier files the model cites/);

    const wrongConvention = clone();
    wrongConvention.model.readback.encoding = 'raw-bytes';
    wrongConvention.model.readback.lineEndingPolicy = 'preserve-bytes';
    const conventionErrors = errors(wrongConvention);
    assert.match(conventionErrors, /readback encoding must be UTF-8 text/);
    assert.match(conventionErrors, /readback line endings must be normalized to LF/);

    const digestDrift = clone();
    digestDrift.model.readback.files[0].sha256 = '0'.repeat(64);
    assert.match(errors(digestDrift), /readback files\[0\] SHA-256 does not match the retained readback/);

    const byteDrift = clone();
    byteDrift.model.readback.files[1].bytes = 1;
    assert.match(errors(byteDrift), /readback files\[1\] byte count does not match the retained readback/);

    const unhashed = clone();
    unhashed.model.readback.files[0].sha256 = 'not-a-digest';
    assert.match(errors(unhashed), /readback files\[0\]\.sha256 must be an exact SHA-256/);
});
test('IV41-010 rejects ADR-lineage authority that does not resolve to a real decision or ADR', () => {
    const undeclared = clone();
    undeclared.model.concepts.find(item => item.concept === 'Statement/Claim').adrDecision = 'invented-decision';
    assert.match(errors(undeclared), /references ADR lineage decision invented-decision, which the model does not declare/);

    const missingDecision = clone();
    missingDecision.model.authorityRecords.decisions[0].decision = 'invented-decision';
    const missingErrors = errors(missingDecision);
    assert.match(missingErrors, /invented-decision: referenced ADR lineage decision does not exist/);
    assert.match(missingErrors, /references ADR lineage decision one-core-authority, which the model does not declare/);
    assert.match(missingErrors, /declared ADR lineage decision invented-decision is not referenced by any model row/);

    const uncitedAdr = clone();
    uncitedAdr.model.authorityRecords.adrs = uncitedAdr.model.authorityRecords.adrs.filter(adr => adr.id !== 'ADR-008');
    assert.match(errors(uncitedAdr), /the ADR that carries the lineage decision \(ADR-008\) must be cited by path/);

    const pathDrift = clone();
    pathDrift.model.authorityRecords.adrs[0].path = 'docs/adr-999-missing.md';
    const pathErrors = errors(pathDrift);
    assert.match(pathErrors, /cited path docs\/adr-999-missing\.md contradicts the ADR lineage path docs\/adr-007-v41-authority-harness-boundary\.md/);
    assert.match(pathErrors, /readback must hash exactly the contract and carrier files the model cites/);
});
