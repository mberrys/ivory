#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VERIFY = join(ROOT, 'spikes', 'n2-durable-store', 'verify.mjs');
const RAW_ARTIFACT = join(ROOT, 'artifacts', 'n2', 'evidence.json');
const EVIDENCE = join(ROOT, 'docs', 'experiments', 'n2-v2-evidence.json');
const FIXTURE_ROOT = join(ROOT, 'spikes', 'n2-durable-store');

const argv = process.argv.slice(2);
const recordOnly = argv.includes('--record-only');
const verifierArgs = argv.filter(argument => argument !== '--record-only');
let verifierExitCode = 0;

if (!recordOnly) {
    verifierExitCode = await runVerifier(verifierArgs);
}

const raw = JSON.parse(await readFile(RAW_ARTIFACT, 'utf8'));
const fixtureFiles = await collectFixtureFiles(FIXTURE_ROOT);
const fixtureDigest = digestManifest(fixtureFiles);
const rawArtifactBytes = await readFile(RAW_ARTIFACT);
const rawArtifactDigest = createHash('sha256').update(rawArtifactBytes).digest('hex');
const scale = raw.scale ?? {};
const storm = raw.interruptStorm ?? {};
const criteria = {
    verifierCompleted: { observed: verifierExitCode, required: 0, pass: verifierExitCode === 0 },
    interruptionCycles: { observed: storm.cycles ?? 0, required: 1000, pass: storm.cycles >= 1000 },
    acknowledgedCommitsNeverLost: {
        observed: storm.acknowledgedNeverLost === true,
        required: true,
        pass: storm.acknowledgedNeverLost === true,
    },
    oneSemanticEffectPerIdempotencyKey: {
        observed: storm.oneEffectPerKey === true,
        required: true,
        pass: storm.oneEffectPerKey === true,
    },
    noVisibleReferenceToUninstalledBlob: {
        observed: storm.noVisibleUninstalledBlob === true,
        required: true,
        pass: storm.noVisibleUninstalledBlob === true,
    },
    semanticExportImport: {
        observed: raw.exportImport?.preserved === true,
        required: true,
        pass: raw.exportImport?.preserved === true,
    },
    metadataP95: {
        observedMs: scale.metadataP95Ms,
        budgetMs: scale.metadataBudgetMs ?? 200,
        pass: scale.metadataPass === true,
    },
    sourceSearch: {
        observedMs: scale.searchMs,
        budgetMs: scale.searchBudgetMs ?? 1000,
        pass: scale.searchPass === true,
    },
    unchangedSnapshot: {
        observedMs: scale.snapshotMs,
        budgetMs: scale.snapshotBudgetMs ?? 2000,
        pass: scale.snapshotPass === true,
    },
    startupAndMemoryRecorded: {
        observed: {
            startupMs: scale.openMs,
            memoryAfterOpen: scale.memoryAfterOpen,
            memoryAfterScale: scale.memoryAfterScale,
        },
        pass: Number.isFinite(scale.openMs) && scale.memoryAfterOpen !== undefined && scale.memoryAfterScale !== undefined,
    },
};
const automatedPass = Object.values(criteria).every(result => result.pass);

const evidence = {
    evidenceVersion: 'n2-v2-evidence/1',
    experiment: 'N2 durable store, blob admission and recovery',
    issue: raw.issue ?? 'MB-592',
    contract: 'durable-admission-semantic-commit/1',
    repositoryCommit: git('rev-parse', 'HEAD'),
    repositoryBranch: git('branch', '--show-current'),
    sourceDocuments: ['docs/iv-n2-durable-store.md', 'Ivory Tower V1 High-Level Architecture and Implementation Plan.pdf'],
    exactQualificationCommand: 'npm.cmd run verify:ivory-n2-v2 -- --cycles 1000',
    invocation: argv,
    configuration: {
        cycles: storm.cycles,
        documents: scale.documents,
        annotations: scale.annotations,
        externallyStoredBytes: scale.blobBytes,
        relaxedDurability: raw.relaxedDurability,
        metadataBudgetMs: scale.metadataBudgetMs,
        sourceSearchBudgetMs: scale.searchBudgetMs,
        unchangedSnapshotBudgetMs: scale.snapshotBudgetMs,
    },
    platform: raw.hardware,
    fixture: {
        root: 'spikes/n2-durable-store',
        digest: fixtureDigest,
        files: fixtureFiles,
    },
    rawArtifact: {
        path: relative(ROOT, RAW_ARTIFACT).replaceAll('\\', '/'),
        sha256: rawArtifactDigest,
        tracked: false,
    },
    observations: {
        tests: raw.tests,
        interruptionStorm: storm,
        exportImport: raw.exportImport,
        scale,
        engineCandidate: raw.engineCandidate,
    },
    criteria,
    automatedPass,
    decision: {
        architectureStatus: automatedPass ? 'protocol-pass-engine-decision-provisional' : 'qualification-failed',
        engine: raw.decision?.engine ?? 'undecided',
        engineEvidenceStatus: automatedPass ? 'pglite-default-on-recorded-reference-machine' : 'not-qualified',
        productionDependency: 'Final production persistence implementation waits for selected-engine sign-off.',
        sqliteComparison: raw.sqliteComparison,
    },
    limitations: [
        raw.durabilityEnvelope,
        'The scale fixture uses a sparse 10 GB content-addressed file; it measures metadata/search/snapshot behavior without copying 10 GB of physical bytes.',
        'The result is one Windows NTFS reference-machine observation; it is not a cross-platform or hardware-power-loss qualification.',
        'The raw verifier artifact is ignored and is retained here by digest; rerun the exact command to regenerate it.',
    ],
    generatedAt: new Date().toISOString(),
};

await mkdir(join(ROOT, 'docs', 'experiments'), { recursive: true });
await writeFile(EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
process.stdout.write(
    `${JSON.stringify(
        {
            ok: automatedPass,
            evidence: relative(ROOT, EVIDENCE).replaceAll('\\', '/'),
            repositoryCommit: evidence.repositoryCommit,
            snapshotMs: scale.snapshotMs,
            automatedPass,
        },
        null,
        2,
    )}\n`,
);
if (!automatedPass) {
    process.exitCode = 1;
}

function git(...args) {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

async function runVerifier(args) {
    return await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [VERIFY, ...args], { cwd: ROOT, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve(code ?? (signal === null ? 1 : 1)));
    });
}

async function collectFixtureFiles(directory, prefix = '') {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
    const files = [];
    for (const entry of entries) {
        if (entry.name === 'node_modules') {
            continue;
        }
        const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
        const absolutePath = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectFixtureFiles(absolutePath, relativePath)));
        } else if (entry.isFile()) {
            const digest = createHash('sha256')
                .update(await readFile(absolutePath))
                .digest('hex');
            files.push({ path: `spikes/n2-durable-store/${relativePath}`, sha256: digest });
        }
    }
    return files;
}

function digestManifest(files) {
    return createHash('sha256')
        .update(files.map(file => `${file.path}\0${file.sha256}\n`).join(''))
        .digest('hex');
}
