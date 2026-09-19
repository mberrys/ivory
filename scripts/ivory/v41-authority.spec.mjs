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
