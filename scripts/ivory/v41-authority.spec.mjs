// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBundle, validateBundle } from './v41-authority.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function clone(value) {
    return structuredClone(value);
}

function bundle() {
    return clone(loadBundle(ROOT));
}

function rawGitBlobSha(bytes) {
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    return createHash('sha1').update(Buffer.from(`blob ${buffer.length}\0`, 'utf8')).update(buffer).digest('hex');
}

function retainedFile(relative) {
    const bytes = readFileSync(join(ROOT, relative));
    return {
        path: relative,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.length,
    };
}

function qualifiedCandidate() {
    const candidate = bundle();
    const selectedSha = candidate.heads.heads.find(head => head.role === 'selectedDev').sha;
    const verifier = retainedFile('scripts/ivory/v41-authority.mjs');
    const fixture = retainedFile('package.json');
    const evidence = retainedFile('configs/ivory-v41-gates.json');
    candidate.qualification.runContext = {
        repository: {
            remote: 'mberrys/ivory',
            ref: 'refs/heads/dev',
            branch: 'dev',
            headSha: selectedSha,
            treeSha: '1111111111111111111111111111111111111111',
            dirty: false,
            authorityBasis: {
                manifest: 'configs/ivory-v41-authority-heads.json',
                role: 'selectedDev',
                sha: selectedSha,
                relation: 'equal',
            },
        },
        environment: {
            os: { platform: 'win32', release: '10.0', arch: 'x64' },
            runtime: { node: 'v24.0.0', npm: '11.0.0' },
            configuration: {
                profile: 'local',
                secretValuesOmitted: true,
                lockfileSha256: '2222222222222222222222222222222222222222222222222222222222222222',
            },
            recordedAt: '2026-09-18T00:00:00.000Z',
        },
        verifier: {
            module: verifier.path,
            moduleSha256: verifier.sha256,
            command: 'npm run verify:ivory-v41-authority',
            startedAt: '2026-09-18T00:00:00.000Z',
            finishedAt: '2026-09-18T00:01:00.000Z',
            exitCode: 0,
        },
    };
    candidate.qualification.gates.find(gate => gate.id === 'Q1').record = {
        schema: 'ivory-v41-qualification-record/1',
        gate: 'Q1',
        fixtures: [{ id: 'package-fixture', ...fixture }],
        evidence: [{ id: 'gate-registry', tracked: true, ...evidence }],
        observations: {
            machine: { status: 'passed' },
            human: { status: 'accepted' },
        },
        decision: {
            status: 'qualified',
            authority: 'human',
            qualificationLevel: 'bounded',
            scope: {
                fixtures: ['package-fixture'],
                platforms: ['win32/x64'],
                components: ['authority'],
            },
            rationale: 'Retained evidence supports the bounded Q1 claim.',
        },
        limitations: [{
            id: 'scope',
            kind: 'scope',
            effect: 'narrows-claim',
            statement: 'The retained fixture does not establish cross-platform behavior.',
        }],
        architecturalGaps: [],
    };
    return candidate;
}

function errorText(candidate, options = { verifyPackages: false }) {
    return validateBundle(candidate, options).join('\n');
}

test('the committed authority and package-ownership contracts are structurally valid', () => {
    assert.deepEqual(validateBundle(bundle(), { verifyPackages: false }), []);
});

test('a stale or alternate authority head cannot replace selected dev', () => {
    const candidate = bundle();
    candidate.heads.selectedAuthorityRole = 'foundationPr';
    assert.match(errorText(candidate), /selected authority must be selectedDev/);
});

test('latest-head substitution is rejected', () => {
    const candidate = bundle();
    candidate.heads.heads.find(head => head.role === 'selectedDev').identity = 'latest dev';
    assert.match(errorText(candidate), /must not use latest\/current substitution/);
});

test('an inferred package inventory is rejected', () => {
    const candidate = bundle();
    candidate.heads.packageInventorySource.mode = 'inferred';
    assert.match(errorText(candidate), /package inventory must be exact-tree/);
});

test('the selected-dev Ivory package inventory must be exhaustive', () => {
    const candidate = bundle();
    candidate.heads.packages = candidate.heads.packages.slice(0, -1);
    assert.match(errorText(candidate), /package inventory must exactly match the selected-dev Ivory package tree/);
});

test('package manifest drift blocks the exact-head contract', () => {
    const candidate = bundle();
    const root = mkdtempSync(join(tmpdir(), 'v41-authority-'));
    const relative = 'packages/example/package.json';
    const full = join(root, relative);
    mkdirSync(dirname(full), { recursive: true });
    const original = Buffer.from('{"name":"@ivory-tower/example"}\n');
    writeFileSync(full, original);
    candidate.heads.packages = [{ name: '@ivory-tower/example', path: relative, packageJsonGitBlob: rawGitBlobSha(original) }];
    writeFileSync(full, '{"name":"@ivory-tower/example","changed":true}\n');
    const errors = validateBundle(candidate, {
        root,
        verifyPackages: true,
        resolvePackageBlobSha: (_root, path) => rawGitBlobSha(Buffer.from(requireRead(join(root, path)))),
    });
    assert.match(errors.join('\n'), /package manifest drift/);
});

function requireRead(path) {
    return globalThis.process.getBuiltinModule('fs').readFileSync(path);
}

test('the harness cannot become a semantic acceptance authority', () => {
    const candidate = bundle();
    candidate.owners.authorityBoundaries.harness.semanticAuthority = true;
    assert.match(errorText(candidate), /harness cannot become a semantic authority/);
});

test('recursive improvement cannot mutate protected Core authority', () => {
    const candidate = bundle();
    candidate.owners.authorityBoundaries.recursiveImprovement.mayMutateCore = true;
    assert.match(errorText(candidate), /recursive improvement cannot mutate protected Core authority/);
});

test('every N1-N7 lesson needs exactly one carrier or owned gap', () => {
    const candidate = bundle();
    const n4 = candidate.carriers.lessons.find(lesson => lesson.id === 'N4');
    delete n4.carrier;
    assert.match(errorText(candidate), /N4 must have exactly one structural carrier or owned gap/);
});

test('IV41-002 keeps every N1-N7 lesson resolved to a retained fixture and a real carrier', () => {
    const candidate = bundle();
    assert.deepEqual(validateBundle(candidate, { verifyPackages: false }), []);
    const lessons = candidate.carriers.lessons;
    assert.equal(lessons.length, 7);
    for (const lesson of lessons) {
        assert.match(lesson.fixtureDigest, /^[a-f0-9]{64}$/);
        assert.ok(Number.isInteger(lesson.fixtureBytes) && lesson.fixtureBytes > 0);
    }
    assert.ok(lessons.find(lesson => lesson.id === 'N2').carrier);
    assert.ok(lessons.find(lesson => lesson.id === 'N6').carrier);
});

test('IV41-002 fails closed when a lesson fixture is missing', () => {
    const candidate = bundle();
    candidate.carriers.lessons.find(lesson => lesson.id === 'N1').fixture = 'docs/experiments/n1-fixture-that-does-not-exist.json';
    assert.match(errorText(candidate), /N1 fixture does not exist on disk/);
});

test('IV41-002 fails closed on a wrong fixture digest, byte count, or readback convention', () => {
    const digestCandidate = bundle();
    digestCandidate.carriers.lessons.find(lesson => lesson.id === 'N4').fixtureDigest = '0'.repeat(64);
    assert.match(errorText(digestCandidate), /N4 fixture SHA-256 does not match the retained readback/);

    const bytesCandidate = bundle();
    const n4 = bytesCandidate.carriers.lessons.find(lesson => lesson.id === 'N4');
    n4.fixtureBytes += 1;
    assert.match(errorText(bytesCandidate), /N4 fixture byte count does not match the retained readback/);

    const conventionCandidate = bundle();
    conventionCandidate.carriers.fixtureReadback.algorithm = 'sha1';
    assert.match(errorText(conventionCandidate), /fixture readback algorithm must be SHA-256/);
});

test('IV41-002 rejects a lesson with two structural carriers or none', () => {
    const both = bundle();
    const withBoth = both.carriers.lessons.find(lesson => lesson.id === 'N2');
    withBoth.ownedGap = { issue: 'V41-I07' };
    assert.match(errorText(both), /N2 must have exactly one structural carrier or owned gap/);

    const neither = bundle();
    const bare = neither.carriers.lessons.find(lesson => lesson.id === 'N2');
    delete bare.carrier;
    delete bare.residualGap;
    assert.match(errorText(neither), /N2 must have exactly one structural carrier or owned gap/);
});

test('IV41-002 refuses a prose-only lesson', () => {
    const candidate = bundle();
    const n3 = candidate.carriers.lessons.find(lesson => lesson.id === 'N3');
    delete n3.carrier;
    delete n3.fixture;
    delete n3.fixtureDigest;
    delete n3.fixtureBytes;
    const errors = errorText(candidate);
    assert.match(errors, /N3 must have exactly one structural carrier or owned gap/);
    assert.match(errors, /N3 is missing a fixture pointer/);
    assert.match(errors, /N3 fixtureDigest must be an exact SHA-256/);
    assert.match(errors, /N3 fixtureBytes must be a non-negative integer/);
});

test('IV41-002 resolves every carrier unit to a real file and symbol', () => {
    const missingFile = bundle();
    const fileUnit = missingFile.carriers.lessons.find(lesson => lesson.id === 'N7').carrier.units[0];
    fileUnit.path = 'packages/ivory-tower-research-kernel/src/node/missing-carrier.ts#AcceptAgentProposalInput';
    assert.match(errorText(missingFile), /N7 carrier\.units\[0\] names a carrier file that is missing/);

    const missingSymbol = bundle();
    const symbolUnit = missingSymbol.carriers.lessons.find(lesson => lesson.id === 'N7').carrier.units[0];
    symbolUnit.path = `${symbolUnit.path.split('#')[0]}#zz-not-a-declared-symbol-zz`;
    assert.match(errorText(missingSymbol), /N7 carrier\.units\[0\] names symbol zz-not-a-declared-symbol-zz/);

    const malformed = bundle();
    const malformedUnit = malformed.carriers.lessons.find(lesson => lesson.id === 'N7').carrier.units[0];
    malformedUnit.path = malformedUnit.path.split('#')[0];
    assert.match(errorText(malformed), /must be <repository-relative path>#<symbol>/);

    const escaping = bundle();
    const escapingUnit = escaping.carriers.lessons.find(lesson => lesson.id === 'N7').carrier.units[0];
    escapingUnit.path = '../outside.ts#AcceptAgentProposalInput';
    assert.match(errorText(escaping), /must be a repository-relative POSIX path/);

    const unclassified = bundle();
    unclassified.carriers.lessons.find(lesson => lesson.id === 'N6').carrier.ownerClass = 'community-fork';
    assert.match(errorText(unclassified), /carrier ownerClass must be production-package or closed-experiment/);
});

test('IV41-002 keeps a residual gap tracked without substituting for the carrier', () => {
    const untracked = bundle();
    untracked.carriers.lessons.find(lesson => lesson.id === 'N6').residualGap.issue = 'session-note-12';
    assert.match(errorText(untracked), /N6 residualGap\.issue must point to a tracked V41-I\* issue/);

    const badStatus = bundle();
    badStatus.carriers.lessons.find(lesson => lesson.id === 'N6').residualGap.status = 'in-progress';
    assert.match(errorText(badStatus), /N6 residualGap\.status is invalid/);

    const substituted = bundle();
    delete substituted.carriers.lessons.find(lesson => lesson.id === 'N2').carrier;
    assert.match(errorText(substituted), /N2 must have exactly one structural carrier or owned gap/);
});

test('IV41-002 requires the seven lesson ids exactly once', () => {
    const duplicate = bundle();
    duplicate.carriers.lessons.push(clone(duplicate.carriers.lessons.find(lesson => lesson.id === 'N5')));
    const errors = errorText(duplicate);
    assert.match(errors, /carrier matrix must cover N1-N7 exactly once/);
    assert.match(errors, /duplicate lesson ids: N5/);
});

test('prose-only gate closure cannot replace machine and human evidence boundaries', () => {
    const candidate = bundle();
    const q1 = candidate.gates.gates.find(gate => gate.id === 'Q1');
    q1.machineEvidence = [];
    q1.humanOutcomeInferredFromMachine = true;
    const errors = errorText(candidate);
    assert.match(errors, /Q1 is missing machine evidence requirements/);
    assert.match(errors, /Q1 must forbid inferring human outcome from machine evidence/);
});

test('the registry rejects aggregate pass flags and pre-closed gates', () => {
    const candidate = bundle();
    candidate.gates.aggregatePass = true;
    candidate.gates.gates.find(gate => gate.id === 'Q4').state = 'passed';
    const errors = errorText(candidate);
    assert.match(errors, /aggregate pass flags are forbidden/);
    assert.match(errors, /Q4 must remain not-run/);
});

test('the qualification manifest is valid while every gate remains not-run', () => {
    const candidate = bundle();
    assert.equal(candidate.qualification.runContext, null);
    assert.deepEqual(validateBundle(candidate, { verifyPackages: false }), []);
});

test('terminal qualification records require exact run context', () => {
    const candidate = qualifiedCandidate();
    candidate.qualification.runContext = null;
    assert.match(errorText(candidate), /terminal records require runContext/);
});

test('qualification records must use the selected authority head', () => {
    const candidate = qualifiedCandidate();
    candidate.qualification.runContext.repository.headSha = '0000000000000000000000000000000000000000';
    assert.match(errorText(candidate), /headSha must match selected authority/);
});

test('qualified records require a clean worktree', () => {
    const candidate = qualifiedCandidate();
    candidate.qualification.runContext.repository.dirty = true;
    assert.match(errorText(candidate), /qualified records require a clean worktree/);
});

test('qualified decisions cannot be machine-only', () => {
    const candidate = qualifiedCandidate();
    candidate.qualification.gates.find(gate => gate.id === 'Q1').record.decision.authority = 'machine';
    assert.match(errorText(candidate), /human or joint authority/);
});

test('changed fixture or evidence digests block qualification', () => {
    const fixtureCandidate = qualifiedCandidate();
    fixtureCandidate.qualification.gates.find(gate => gate.id === 'Q1').record.fixtures[0].sha256 = '0'.repeat(64);
    assert.match(errorText(fixtureCandidate), /fixtures\[0\].*SHA-256 does not match/);

    const evidenceCandidate = qualifiedCandidate();
    evidenceCandidate.qualification.gates.find(gate => gate.id === 'Q1').record.evidence[0].sha256 = '0'.repeat(64);
    assert.match(errorText(evidenceCandidate), /evidence\[0\].*SHA-256 does not match/);
});

test('every qualification record must retain a limitation', () => {
    const candidate = qualifiedCandidate();
    candidate.qualification.gates.find(gate => gate.id === 'Q1').record.limitations = [];
    assert.match(errorText(candidate), /at least one limitation is required/);
});

test('architectural gaps must point to tracked IV41 issues', () => {
    const candidate = qualifiedCandidate();
    candidate.qualification.gates.find(gate => gate.id === 'Q1').record.architecturalGaps = [{
        issue: 'session-note-7',
        summary: 'A gap was found during qualification.',
        status: 'open',
    }];
    assert.match(errorText(candidate), /must point to a tracked IV41 issue/);
});

test('qualification records reject duplicate gates and aggregate outcomes', () => {
    const duplicateCandidate = bundle();
    duplicateCandidate.qualification.gates.push(clone(duplicateCandidate.qualification.gates[0]));
    assert.match(errorText(duplicateCandidate), /duplicate qualification gates/);

    const aggregateCandidate = bundle();
    aggregateCandidate.qualification.aggregatePass = true;
    assert.match(errorText(aggregateCandidate), /aggregate outcome field aggregatePass is forbidden/);
});

test('qualification evidence paths cannot escape the repository', () => {
    const candidate = qualifiedCandidate();
    candidate.qualification.gates.find(gate => gate.id === 'Q1').record.fixtures[0].path = '../package.json';
    assert.match(errorText(candidate), /must be a repository-relative POSIX path/);
});


test('IV41-003 rejects a second research acceptance owner', () => {
    const candidate = bundle();
    const application = candidate.packageOwnership.packages.find(item => item.name === '@ivory-tower/application');
    application.authority.researchAcceptance = true;
    assert.match(errorText(candidate), /research acceptance must have exactly one owner/);
});

test('IV41-003 rejects a second canonical research-state writer', () => {
    const candidate = bundle();
    const infrastructure = candidate.packageOwnership.packages.find(item => item.name === '@ivory-tower/infrastructure');
    infrastructure.authority.researchStateWrite = true;
    assert.match(errorText(candidate), /canonical research-state writes must have exactly one owner/);
});

test('IV41-003 rejects duplicate or missing responsibility ownership', () => {
    const candidate = bundle();
    const api = candidate.packageOwnership.packages.find(item => item.name === '@ivory-tower/api');
    api.responsibilityIds.push('evidence');
    assert.match(errorText(candidate), /every V4\.1 package responsibility must have exactly one canonical owner|duplicate canonical responsibility owners/);
});

test('IV41-003 binds evidence to the exact selected-dev repository context', () => {
    const candidate = bundle();
    candidate.packageOwnership.evidenceContext.authorityBasis.sha = '0000000000000000000000000000000000000000';
    assert.match(errorText(candidate), /evidence authority SHA must match the exact selected-dev SHA/);
});

test('IV41-003 refuses architectural gaps that are not tracked as issues', () => {
    const candidate = bundle();
    candidate.packageOwnership.gapPolicy.discoveredGaps[0].issue = 'session-note-7';
    assert.match(errorText(candidate), /must point to a tracked IV41 issue/);
});

test('IV41-004 registers every ADR on this line and covers each lineage disposition', () => {
    const candidate = bundle();
    assert.equal(candidate.adrLineage.issue, 'IV41-004');
    assert.deepEqual(
        candidate.adrLineage.registry.map(record => record.id),
        ['V3-ORX', 'ADR-001', 'ADR-002', 'ADR-003', 'ADR-004', 'ADR-005', 'ADR-006', 'ADR-007', 'ADR-008'],
    );
    assert.equal(candidate.adrLineage.registry.find(record => record.id === 'ADR-004').retainedIntact, true);
    assert.deepEqual(
        [...new Set(candidate.adrLineage.decisions.map(decision => decision.disposition))].sort(),
        ['amended', 'deferred', 'inherited', 'superseded'],
    );
    const roles = candidate.heads.heads.map(head => head.role);
    for (const decision of candidate.adrLineage.decisions) {
        assert.ok(decision.evidenceHeads.every(head => roles.includes(head)));
    }
    assert.deepEqual(validateBundle(candidate, { verifyPackages: false }), []);
});

test('IV41-004 rejects duplicate ADR ids, repeated paths, and non-increasing numbering', () => {
    const candidate = bundle();
    candidate.adrLineage.registry.push(clone(candidate.adrLineage.registry.find(record => record.id === 'ADR-007')));
    const errors = errorText(candidate);
    assert.match(errors, /duplicate ADR lineage registry id ADR-007/);
    assert.match(errors, /duplicate ADR lineage path docs\/adr-007-v41-authority-harness-boundary\.md/);
    assert.match(errors, /ADR numbering must be strictly increasing in registry order/);
});

test('IV41-004 requires every ADR file on this line to be registered', () => {
    const candidate = bundle();
    candidate.adrLineage.registry = candidate.adrLineage.registry.filter(record => record.id !== 'ADR-004');
    assert.match(errorText(candidate), /docs\/adr-004-n1-exact-reference-contract\.md must be registered in the ADR lineage registry/);
});

test('IV41-004 fails closed on dangling, self-referential, and cyclic supersession', () => {
    const dangling = bundle();
    dangling.adrLineage.decisions.find(decision => decision.disposition === 'superseded').supersededBy = 'ADR-999';
    assert.match(errorText(dangling), /superseded disposition must name an existing supersededBy ADR/);

    const selfReference = bundle();
    selfReference.adrLineage.registry.find(record => record.id === 'ADR-007').supersededBy = 'ADR-007';
    assert.match(errorText(selfReference), /ADR-007 cannot supersede itself/);

    const cycle = bundle();
    cycle.adrLineage.registry.find(record => record.id === 'ADR-007').supersededBy = 'ADR-008';
    cycle.adrLineage.registry.find(record => record.id === 'ADR-008').supersededBy = 'ADR-007';
    assert.match(errorText(cycle), /supersession chain must not form a cycle/);
});

test('IV41-004 keeps historical ADR records retained intact', () => {
    const candidate = bundle();
    candidate.adrLineage.registry.find(record => record.id === 'ADR-004').retainedIntact = false;
    assert.match(errorText(candidate), /ADR-004 must be retained intact/);

    const policyDrift = bundle();
    policyDrift.adrLineage.policy.untrackedArchitecturalGaps = 'allowed';
    assert.match(errorText(policyDrift), /untracked architectural gaps must be forbidden/);
});

test('IV41-004 keeps deferred architectural gaps tracked rather than in session notes', () => {
    const stripped = bundle();
    const assessment = stripped.adrLineage.decisions.find(decision => decision.id === 'semantic-assessment-carrier');
    delete assessment.trackingUrl;
    assert.match(errorText(stripped), /tracked architectural gap must retain its issue URL/);

    const untracked = bundle();
    untracked.adrLineage.decisions.find(decision => decision.id === 'research-capsule-qualification').trackedBy = 'session-notes';
    assert.match(errorText(untracked), /trackedBy must be a registered gate or a tracked issue/);

    const bare = bundle();
    delete bare.adrLineage.decisions.find(decision => decision.id === 'research-capsule-qualification').trackedBy;
    assert.match(errorText(bare), /deferred disposition must name its tracked gate or issue/);
});

test('IV41-004 refuses lineage entries that claim research acceptance or canonical writes', () => {
    const decision = bundle();
    decision.adrLineage.decisions.find(entry => entry.id === 'one-core-authority').authority = { researchAcceptance: true };
    assert.match(errorText(decision), /cannot declare authority\.researchAcceptance/);

    const record = bundle();
    record.adrLineage.registry.find(entry => entry.id === 'ADR-007').researchStateWrite = true;
    assert.match(errorText(record), /cannot declare researchStateWrite/);
});

test('IV41-004 keeps decisions unique, referenced, and bound to dev head roles', () => {
    const duplicate = bundle();
    duplicate.adrLineage.decisions.push(clone(duplicate.adrLineage.decisions[0]));
    assert.match(errorText(duplicate), /duplicate ADR lineage decision one-core-authority/);

    const staleHead = bundle();
    staleHead.adrLineage.decisions[0].evidenceHeads = ['pr1'];
    assert.match(errorText(staleHead), /references unknown evidence head pr1/);

    const unknownCarrier = bundle();
    unknownCarrier.adrLineage.decisions[0].carriedBy = 'ADR-999';
    assert.match(errorText(unknownCarrier), /carrier ADR-999 is not in the lineage registry/);

    const missingDisposition = bundle();
    missingDisposition.adrLineage.decisions = missingDisposition.adrLineage.decisions.filter(decision => decision.disposition !== 'superseded');
    assert.match(errorText(missingDisposition), /missing superseded decision coverage/);
});
