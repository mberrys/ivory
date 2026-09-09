import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
    LIVE_VERIFIER_REQUIRED,
    buildCriteria,
    buildV2Evidence,
} from '../../../scripts/n2-v2-evidence.mjs';
import { SPARSE_ZERO_PLACEHOLDER } from '../src/scale.mjs';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const WRAPPER = join(ROOT, 'scripts', 'verify-ivory-n2-v2.mjs');

function passingStormResults(count = 1000) {
    return Array.from({ length: count }, (_, index) => ({
        index,
        fault: index % 2 === 0 ? 'afterDbCommit' : 'beforeDbCommit',
        acknowledgedBeforeRetry: index % 2 === 0,
        acknowledgedReceiptId: index % 2 === 0 ? `r-${index}` : undefined,
        receiptId: `r-${index}`,
        replayed: index % 2 === 0,
        revisionCount: index % 2 === 0 ? 0 : 1,
        danglingVisibleBlobCount: 0,
        childExitedBeforeReopen: true,
    }));
}

function liveRaw(overrides = {}) {
    return {
        issue: 'MB-592',
        engineCandidate: 'pglite',
        relaxedDurability: false,
        sqliteComparison: 'not run',
        hardware: { platform: 'test' },
        tests: { passed: true, measuredThisRun: true },
        interruptStorm: {
            measuredThisRun: true,
            skipped: false,
            results: passingStormResults(1000),
        },
        exportImport: { preserved: true, measuredThisRun: true, blobCount: 1, projectSeq: 1 },
        scale: {
            measuredThisRun: true,
            documents: 1000,
            annotations: 100000,
            blobBytes: 10737418240,
            largeDigest: '732377e7f4a2abdc13ddfa1eb4c9c497fd2a2b294674d056cf51581b47dd586d',
            openMs: 10,
            memoryAfterOpen: { rss: 1 },
            memoryAfterScale: { rss: 2 },
            metadataP95Ms: 1,
            searchMs: 2,
            snapshotMs: 3,
            metadataBudgetMs: 200,
            searchBudgetMs: 1000,
            snapshotBudgetMs: 2000,
            metadataPass: true,
            searchPass: true,
            snapshotPass: true,
            largeBlob: {
                kind: SPARSE_ZERO_PLACEHOLDER,
                logicalByteSize: 10737418240,
                physicalBytesCopied: 0,
                casAdmissionPath: false,
                contentAddressedScaleProof: false,
                digestSource: 'sha256-of-zeros-in-memory',
            },
        },
        durabilityEnvelope: 'test envelope',
        ...overrides,
    };
}

function requiredValues(criteria) {
    return Object.values(criteria).map(row => row.required);
}

test('--record-only refuses verifierCompleted.pass and automatedPass', () => {
    const evidence = buildV2Evidence({
        recordOnly: true,
        verifierExitCode: 0,
        argv: ['--record-only'],
        raw: liveRaw(),
        fixtureDigest: 'abc',
        rawArtifactDigest: 'def',
        repositoryCommit: 'deadbeef',
        repositoryBranch: 'v2-n2-experiment',
        generatedAt: '2026-09-09T00:00:00.000Z',
    });
    assert.equal(evidence.criteria.verifierCompleted.pass, false);
    assert.equal(evidence.criteria.verifierCompleted.skipped, true);
    assert.equal(evidence.criteria.verifierCompleted.observed, 'not-run');
    assert.equal(evidence.criteria.verifierCompleted.required, LIVE_VERIFIER_REQUIRED);
    assert.notEqual(evidence.criteria.verifierCompleted.required, 0);
    assert.equal(evidence.automatedPass, false);
    assert.equal(evidence.qualificationCommandExecuted, false);
    assert.equal(evidence.decision.architectureStatus, 'incomplete-verifier-skipped');
    assert.notEqual(evidence.decision.architectureStatus, 'protocol-pass-engine-decision-provisional');
    assert.equal(evidence.recordOnly, true);
});

test('--record-only with a live-looking raw artifact still exits the qualification claim as incomplete', () => {
    const criteria = buildCriteria({ recordOnly: true, verifierExitCode: 0, raw: liveRaw() });
    assert.equal(criteria.verifierCompleted.pass, false);
    const evidence = buildV2Evidence({
        recordOnly: true,
        raw: liveRaw(),
        argv: ['--record-only'],
        generatedAt: '2026-09-09T00:00:00.000Z',
    });
    assert.equal(evidence.automatedPass, false);
    assert.ok(evidence.limitations.some(line => line.includes('--record-only')));
});

test('never writes required: 0 as a verifier gate', () => {
    const live = buildCriteria({ recordOnly: false, verifierExitCode: 0, raw: liveRaw() });
    const skipped = buildCriteria({ recordOnly: true, raw: liveRaw() });
    for (const criteria of [live, skipped]) {
        assert.ok(!requiredValues(criteria).includes(0));
        assert.ok(!JSON.stringify(criteria).includes('"required": 0'));
        assert.equal(criteria.verifierCompleted.required, LIVE_VERIFIER_REQUIRED);
    }
});

test('live verifier exit 0 still cannot automatedPass on the sparse 10GB placeholder', () => {
    const evidence = buildV2Evidence({
        recordOnly: false,
        verifierExitCode: 0,
        argv: ['--cycles', '1000'],
        raw: liveRaw(),
        generatedAt: '2026-09-09T00:00:00.000Z',
    });
    assert.equal(evidence.criteria.verifierCompleted.pass, true);
    assert.equal(evidence.criteria.interruptionCycles.pass, true);
    assert.equal(evidence.criteria.acknowledgedCommitsNeverLost.pass, true);
    assert.equal(evidence.criteria.contentAddressedScaleProof.pass, false);
    assert.equal(evidence.criteria.contentAddressedScaleProof.observed.kind, SPARSE_ZERO_PLACEHOLDER);
    assert.equal(evidence.criteria.contentAddressedScaleProof.observed.contentAddressedScaleProof, false);
    assert.equal(evidence.automatedPass, false);
    assert.equal(evidence.decision.architectureStatus, 'qualification-incomplete');
});

test('hardcoded storm booleans without results cannot pass storm criteria', () => {
    const raw = liveRaw({
        interruptStorm: {
            cycles: 1000,
            acknowledgedNeverLost: true,
            oneEffectPerKey: true,
            noVisibleUninstalledBlob: true,
            measuredThisRun: true,
        },
    });
    const criteria = buildCriteria({ recordOnly: false, verifierExitCode: 0, raw });
    assert.equal(criteria.interruptionCycles.observed, 0);
    assert.equal(criteria.interruptionCycles.pass, false);
    assert.equal(criteria.acknowledgedCommitsNeverLost.pass, false);
    assert.equal(criteria.oneSemanticEffectPerIdempotencyKey.pass, false);
    assert.equal(criteria.noVisibleReferenceToUninstalledBlob.pass, false);
    assert.equal(criteria.interruptChildExitedBeforeReopen.pass, false);
    assert.equal(criteria.acknowledgedCommitsNeverLost.measuredFromResults, false);
});

test('skipped or prior-artifact storm sections are not treated as freshly measured', () => {
    const raw = liveRaw({
        interruptStorm: { skipped: true, measuredThisRun: false, results: [] },
    });
    const criteria = buildCriteria({ recordOnly: false, verifierExitCode: 0, raw });
    assert.equal(criteria.acknowledgedCommitsNeverLost.pass, false);
    assert.equal(criteria.interruptionCycles.pass, false);
});

test('historical scale blobBytes without CAS admission fails contentAddressedScaleProof in criteria', () => {
    const raw = liveRaw({
        scale: {
            measuredThisRun: true,
            documents: 1000,
            annotations: 100000,
            blobBytes: 10737418240,
            largeDigest: '732377e7f4a2abdc13ddfa1eb4c9c497fd2a2b294674d056cf51581b47dd586d',
            openMs: 10,
            memoryAfterOpen: { rss: 1 },
            memoryAfterScale: { rss: 2 },
            metadataP95Ms: 1,
            searchMs: 2,
            snapshotMs: 3,
            metadataPass: true,
            searchPass: true,
            snapshotPass: true,
        },
    });
    const criteria = buildCriteria({ recordOnly: false, verifierExitCode: 0, raw });
    assert.equal(criteria.contentAddressedScaleProof.pass, false);
    assert.equal(criteria.contentAddressedScaleProof.observed.kind, SPARSE_ZERO_PLACEHOLDER);
    assert.equal(criteria.contentAddressedScaleProof.observed.casAdmissionPath, false);
    assert.equal(criteria.contentAddressedScaleProof.observed.inferred, true);
    assert.ok(!JSON.stringify(criteria.contentAddressedScaleProof).includes('completed 10 GB content-addressed'));
});

test('CLI --record-only writes skipped verifier, automatedPass false, non-zero exit, no required: 0', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ivory-n2-record-only-'));
    const rawPath = join(dir, 'raw.json');
    const evidencePath = join(dir, 'evidence.json');
    await writeFile(rawPath, JSON.stringify(liveRaw()), 'utf8');
    const child = spawn(process.execPath, [WRAPPER, '--record-only'], {
        cwd: ROOT,
        env: {
            ...process.env,
            N2_V2_RAW_ARTIFACT: rawPath,
            N2_V2_EVIDENCE: evidencePath,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
        stdout += chunk;
    });
    child.stderr.on('data', chunk => {
        stderr += chunk;
    });
    const exitCode = await new Promise(resolve => child.once('exit', resolve));
    assert.notEqual(exitCode, 0, stderr);
    const summary = JSON.parse(stdout);
    assert.equal(summary.ok, false);
    assert.equal(summary.automatedPass, false);
    assert.equal(summary.recordOnly, true);
    assert.equal(summary.verifierCompleted.pass, false);
    assert.equal(summary.verifierCompleted.skipped, true);
    assert.equal(summary.contentAddressedScaleProof, false);
    assert.equal(summary.architectureStatus, 'incomplete-verifier-skipped');
    const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
    assert.equal(evidence.automatedPass, false);
    assert.equal(evidence.criteria.verifierCompleted.pass, false);
    assert.equal(evidence.criteria.contentAddressedScaleProof.pass, false);
    assert.ok(!JSON.stringify(evidence.criteria).includes('"required": 0'));
    assert.notEqual(evidence.decision.architectureStatus, 'protocol-pass-engine-decision-provisional');
});

test('unmeasured export/scale copied from a prior artifact cannot pass', () => {
    const raw = liveRaw({
        exportImport: { preserved: true },
        scale: {
            documents: 1000,
            metadataPass: true,
            searchPass: true,
            snapshotPass: true,
            metadataP95Ms: 1,
            searchMs: 1,
            snapshotMs: 1,
            openMs: 1,
            memoryAfterOpen: {},
            memoryAfterScale: {},
        },
    });
    const criteria = buildCriteria({ recordOnly: false, verifierExitCode: 0, raw });
    assert.equal(criteria.semanticExportImport.pass, false);
    assert.equal(criteria.metadataP95.pass, false);
    assert.equal(criteria.sourceSearch.pass, false);
    assert.equal(criteria.unchangedSnapshot.pass, false);
    assert.equal(criteria.startupAndMemoryRecorded.pass, false);
});

test('observations do not keep hardcoded storm booleans when results are missing', () => {
    const evidence = buildV2Evidence({
        recordOnly: true,
        raw: liveRaw({
            interruptStorm: {
                cycles: 1000,
                acknowledgedNeverLost: true,
                oneEffectPerKey: true,
                noVisibleUninstalledBlob: true,
            },
        }),
        generatedAt: '2026-09-09T00:00:00.000Z',
    });
    const storm = evidence.observations.interruptionStorm;
    assert.equal(storm.acknowledgedNeverLost, false);
    assert.equal(storm.oneEffectPerKey, false);
    assert.equal(storm.noVisibleUninstalledBlob, false);
    assert.equal(storm.measuredFromResults, false);
    assert.equal(storm.claimedBooleansIgnoredWithoutResults, true);
    assert.equal(evidence.configuration.cycles, 0);
});
