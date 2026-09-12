#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KERNEL_MODULE = path.join(ROOT, 'packages', 'ivory-tower-research-kernel', 'lib', 'node', 'index.js');
const EVIDENCE_PATH = path.join(ROOT, 'docs', 'experiments', 'n1-v2-evidence.json');
const startedAt = performance.now();

const { ResearchKernel, buildAdvisingAgencyFixture, createResearchClients, digestCanonical } = await import(
    pathToFileURL(KERNEL_MODULE).href
).catch(error => {
    throw new Error(
        `N1 verifier requires compiled kernel output at ${path.relative(ROOT, KERNEL_MODULE)}. ` +
            'Compile ivory-identity and ivory-tower-research-kernel first.',
        { cause: error },
    );
});

const criteria = {};
const failures = [];
const timingsMs = {};

function timed(name, operation) {
    const started = performance.now();
    const result = operation();
    timingsMs[name] = roundMilliseconds(performance.now() - started);
    return result;
}

function check(name, operation) {
    try {
        const result = operation();
        criteria[name] = result === true;
        if (!criteria[name]) {
            failures.push(`${name}: returned false`);
        }
    } catch (error) {
        criteria[name] = false;
        failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

const fixture = timed('goldenTrace', () => buildAdvisingAgencyFixture());

check('cliStudioParity', () => {
    const cliFixture = timed('cliTrace', () => buildAdvisingAgencyFixture(createResearchClients(new ResearchKernel()).cli));
    const studioFixture = timed('studioTrace', () => buildAdvisingAgencyFixture(createResearchClients(new ResearchKernel()).studio));
    return (
        cliFixture.snapshot1.snapshotId === studioFixture.snapshot1.snapshotId &&
        cliFixture.snapshot1.digest === studioFixture.snapshot1.digest &&
        JSON.stringify(cliFixture.snapshot1.manifest) === JSON.stringify(studioFixture.snapshot1.manifest) &&
        cliFixture.snapshot2.snapshotId === studioFixture.snapshot2.snapshotId &&
        cliFixture.snapshot2.digest === studioFixture.snapshot2.digest
    );
});

check('citationSurvivesSourceCorrection', () => {
    const citation = fixture.kernel.resolveCitation(fixture.fragment, fixture.snapshot1.snapshotId);
    return citation.quote === 'Maya said advising made the next step visible.' && citation.ref.revisionId === fixture.fragment.revisionId;
});

check('oldSnapshotRemainsUnchanged', () => {
    const stored = fixture.kernel.getSnapshot(fixture.snapshot1.snapshotId);
    return JSON.stringify(stored) === JSON.stringify(fixture.snapshot1) && stored.digest === fixture.snapshot1.digest;
});

check('semanticClosureExcludesActivityBackLinks', () => {
    const members = fixture.snapshot1.manifest.members;
    return (
        members.every(member => member.ref.objectId !== fixture.unrelatedNote.objectId) &&
        members.every(member => member.ref.revisionId !== fixture.codebook2.revisionId) &&
        members.some(member => member.ref.objectId === fixture.t1.objectId && member.role === 'selected')
    );
});

check('carryForwardIsExplicit', () => {
    const preview = fixture.kernel.previewCarryForward(fixture.claimA1, fixture.claimA2);
    const carried = fixture.kernel.getRevision(fixture.carriedLinks[0]);
    const original = fixture.kernel.getRevision(fixture.challengeA1);
    const carriedPayload = carried.payload;
    const originalPayload = original.payload;
    return (
        preview.links.some(link => link.objectId === fixture.challengeA1.objectId) &&
        originalPayload.claimRef.revisionId === fixture.claimA1.revisionId &&
        carriedPayload.claimRef.revisionId === fixture.claimA2.revisionId &&
        carriedPayload.linkAuthor === originalPayload.linkAuthor &&
        fixture.kernel.getActivity(carried.activityId).actor === 'Maya'
    );
});

check('attributionIsSeparateFromEndorsement', () => {
    const explanation = fixture.kernel.explainClaim(fixture.snapshot1.snapshotId, fixture.claimA1);
    return (
        explanation.text.includes('link author Jordan differs from claim author Maya') &&
        explanation.text.includes('This is attribution, not endorsement.')
    );
});

check('acceptedEvidenceCannotBeMutatedThroughReads', () => {
    const returnedRevision = fixture.kernel.getRevision(fixture.fragment);
    try {
        returnedRevision.payload.selector.quote = 'tampered';
    } catch {
        // A structural freeze is also acceptable; the stored record must remain unchanged either way.
    }
    const returnedSnapshot = fixture.kernel.getSnapshot(fixture.snapshot1.snapshotId);
    try {
        returnedSnapshot.manifest.members.pop();
    } catch {
        // See the note above.
    }
    return (
        fixture.kernel.resolveCitation(fixture.fragment, fixture.snapshot1.snapshotId).quote ===
            'Maya said advising made the next step visible.' &&
        fixture.kernel.getSnapshot(fixture.snapshot1.snapshotId).manifest.members.length === fixture.snapshot1.manifest.members.length
    );
});

check('illegalReferencesAreRejected', () => {
    const sequence = fixture.kernel.sequence;
    let rejectedLatest = false;
    let rejectedDangling = false;
    try {
        fixture.kernel.createEvidenceLink({
            key: 'verifier-latest',
            claimRef: { ...fixture.claimA1, revisionId: 'latest' },
            targets: [fixture.fragment],
            role: 'supports',
            rationale: 'invalid navigation pointer',
            linkAuthor: 'Maya',
        });
    } catch {
        rejectedLatest = true;
    }
    try {
        fixture.kernel.annotate({
            key: 'verifier-dangling',
            fragmentRef: { projectId: fixture.kernel.projectId, objectId: 'frg_missing', revisionId: 'rev_missing' },
            codebookRef: fixture.codebook1,
            codeId: 'agency',
            actor: 'Maya',
        });
    } catch {
        rejectedDangling = true;
    }
    return rejectedLatest && rejectedDangling && fixture.kernel.sequence === sequence;
});

check('typeCrossingRevisionsAreRejected', () => {
    const sequence = fixture.kernel.sequence;
    let rejected = false;
    try {
        fixture.kernel.reviseClaim({
            claimRef: fixture.t1Replacement,
            expectedHead: fixture.t1Replacement.revisionId,
            text: 'a claim revision must not land on a source history',
            actor: 'Maya',
        });
    } catch {
        rejected = true;
    }
    return rejected && fixture.kernel.sequence === sequence;
});

check('selectorsRequireRetainedMaterial', () => {
    const sequence = fixture.kernel.sequence;
    let rejected = false;
    try {
        fixture.kernel.createFragment({
            sourceRef: fixture.t1,
            artifactRef: fixture.artifact,
            selector: { kind: 'text', start: 0, end: 5, quote: 'not in retained material' },
            actor: 'Maya',
            fragmentKey: 'verifier-missing-anchor',
        });
    } catch {
        rejected = true;
    }
    return rejected && fixture.kernel.sequence === sequence;
});

const automatedPass = Object.values(criteria).every(Boolean);
const fixtureDigest = digestCanonical({
    projectId: fixture.kernel.projectId,
    snapshot1: fixture.snapshot1,
    snapshot2: fixture.snapshot2,
    references: {
        t1: fixture.t1,
        t1Replacement: fixture.t1Replacement,
        fragment: fixture.fragment,
        codebook1: fixture.codebook1,
        codebook2: fixture.codebook2,
        claimA1: fixture.claimA1,
        claimA2: fixture.claimA2,
        challengeA1: fixture.challengeA1,
        carriedLinks: fixture.carriedLinks,
    },
});

const evidence = {
    evidenceVersion: 'n1-v2-evidence/1',
    experiment: 'N1 - research identity, snapshot closure and interpretation semantics',
    contractVersion: 'n1-revision/1',
    repositoryCommit: git('rev-parse', 'HEAD'),
    repositoryBranch: git('branch', '--show-current'),
    sourceDocuments: [
        'Ivory Tower V1 High-Level Architecture and Implementation Plan.pdf: V2.1-V2.11 and N1',
        'docs/n1-research-identity.md',
        'packages/ivory-tower-research-kernel/src/node/fixtures/advising-agency-protocol.md',
    ],
    platform: {
        os: os.platform(),
        release: os.release(),
        arch: os.arch(),
        logicalCpuCount: os.cpus().length,
        cpuModel: os.cpus()[0]?.model ?? 'unknown',
        totalMemoryGiB: round(os.totalmem() / 1024 ** 3),
    },
    runtime: {
        node: process.version,
        v8: process.versions.v8,
    },
    fixture: {
        name: 'advising-agency-golden-trace',
        digest: fixtureDigest,
        projectId: fixture.kernel.projectId,
        finalProjectSequence: fixture.kernel.sequence,
        snapshotMemberCounts: {
            S1: fixture.snapshot1.manifest.members.length,
            S2: fixture.snapshot2.manifest.members.length,
        },
    },
    qualification: {
        command: 'npm run verify:ivory-n1',
        configuration: {
            clientModes: ['cli', 'studio'],
            humanResearchersRequired: 3,
            humanPassesRequired: 2,
        },
    },
    observations: {
        criteria,
        timingsMs: {
            ...timingsMs,
            total: roundMilliseconds(performance.now() - startedAt),
        },
        failures,
    },
    automatedPass,
    humanValidation: {
        status: 'open',
        requiredResearchers: 3,
        requiredPasses: 2,
        observedResults: null,
        note: 'The automated verifier does not invent researcher observations; run the supplied reader protocol separately.',
    },
    decision: {
        status: automatedPass ? 'provisional-architecture-pass' : 'failed',
        unlocked: automatedPass
            ? [
                  'exact-reference schema',
                  'immutable revision semantics',
                  'semantic snapshot closure and context roles',
                  'explicit EvidenceLink carry-forward contract',
              ]
            : [],
        productionStatus: 'reference-kernel-only',
    },
    limitations: [
        'The kernel is an in-memory reference model; persistence and durable round-trip belong to N2.',
        'The verifier proves the automated trace only; the three-researcher interpretation gate remains open.',
        'The experiment does not qualify representation remapping, PDF/OCR anchors, or production schema persistence.',
    ],
};

mkdirSync(path.dirname(EVIDENCE_PATH), { recursive: true });
writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
process.stdout.write(
    `${JSON.stringify({ ok: automatedPass, evidence: path.relative(ROOT, EVIDENCE_PATH), repositoryCommit: evidence.repositoryCommit }, null, 2)}\n`,
);
if (!automatedPass) {
    process.exitCode = 1;
}

function git(...args) {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function round(value) {
    return Math.round(value * 100) / 100;
}

function roundMilliseconds(value) {
    return Math.round(value * 100) / 100;
}
