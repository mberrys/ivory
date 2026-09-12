#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFixtureFiles, digestManifest } from '../spikes/n2-durable-store/src/fixture-digest.mjs';
import { buildCriteria } from './n2-v2-criteria.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VERIFY = join(ROOT, 'spikes', 'n2-durable-store', 'verify.mjs');
const RAW_ARTIFACT = join(ROOT, 'artifacts', 'n2', 'evidence.json');
const RAW_LEDGER = join(ROOT, 'artifacts', 'n2', 'storm-cycles.jsonl');
const EVIDENCE = join(ROOT, 'docs', 'experiments', 'n2-v2-evidence.json');
const RETAINED_LEDGER = join(ROOT, 'docs', 'experiments', 'n2-v2-storm-cycles.json');
const FIXTURE_ROOT = join(ROOT, 'spikes', 'n2-durable-store');

const argv = process.argv.slice(2);
const recordOnly = argv.includes('--record-only');
const verifierArgs = argv.filter(argument => argument !== '--record-only');
let verifierExitCode = null;

if (!recordOnly) {
    verifierExitCode = await runVerifier(verifierArgs);
}

const rawText = await readFile(RAW_ARTIFACT, 'utf8').catch(() => undefined);
if (rawText === undefined) {
    process.stderr.write(`${relative(ROOT, RAW_ARTIFACT)} does not exist. Run the qualification first.\n`);
    process.exit(1);
}
const raw = JSON.parse(rawText);

const ledgerText = await readFile(RAW_LEDGER, 'utf8').catch(() => '');
const ledgerRows = ledgerText
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line));
const rawLedgerSha256 = createHash('sha256').update(ledgerText).digest('hex');
const ledgerDigestMatches = ledgerRows.length > 0 && raw.interruptStorm?.ledgerSha256 === rawLedgerSha256;

const fixtureFiles = await collectFixtureFiles(FIXTURE_ROOT);
const fixtureDigest = digestManifest(fixtureFiles);
const head = git('rev-parse', 'HEAD');
const branch = git('branch', '--show-current');

const { criteria, automatedPass, failedCriteria, summary } = buildCriteria({
    recordOnly,
    verifierExitCode,
    raw,
    ledgerRows,
    ledgerDigestMatches,
    head,
    fixtureDigest,
});

let retainedLedger = null;
if (ledgerRows.length > 0) {
    await writeFile(
        RETAINED_LEDGER,
        `${JSON.stringify({ ledgerVersion: 'n2-v2-storm-cycles/1', cycles: ledgerRows.length, rows: ledgerRows }, null, 2)}\n`,
        'utf8',
    );
    const retainedBytes = await readFile(RETAINED_LEDGER);
    retainedLedger = {
        path: relative(ROOT, RETAINED_LEDGER).replaceAll('\\', '/'),
        sha256: createHash('sha256').update(retainedBytes).digest('hex'),
        rowCount: ledgerRows.length,
        rawLedgerSha256,
    };
} else {
    await rm(RETAINED_LEDGER, { force: true });
}

const evidence = {
    evidenceVersion: 'n2-v2-evidence/2',
    experiment: 'N2 durable store, blob admission and recovery',
    issue: raw.issue ?? 'MB-592',
    contract: 'durable-admission-semantic-commit/1',
    repositoryCommit: head,
    repositoryBranch: branch,
    sourceDocuments: ['docs/iv-n2-durable-store.md', 'Ivory Tower V1 High-Level Architecture and Implementation Plan.pdf'],
    exactQualificationCommand: 'npm.cmd run verify:ivory-n2-v2 -- --cycles 1000',
    invocation: argv,
    qualification: {
        status: automatedPass ? 'passed' : 'not-qualified',
        recordOnly,
        verifierExitCode,
        verifierStartedFromCommit: raw.repositoryCommit ?? null,
        failedCriteria,
    },
    configuration: {
        cycles: raw.interruptStorm?.cycles,
        documents: raw.scale?.documents,
        annotations: raw.scale?.annotations,
        externallyStoredBytes: raw.scale?.blobBytes,
        relaxedDurability: raw.relaxedDurability,
        metadataBudgetMs: raw.scale?.metadataBudgetMs,
        sourceSearchBudgetMs: raw.scale?.searchBudgetMs,
        unchangedSnapshotBudgetMs: raw.scale?.snapshotBudgetMs,
    },
    platform: raw.hardware,
    fixture: { root: 'spikes/n2-durable-store', digest: fixtureDigest, files: fixtureFiles },
    rawArtifact: {
        path: relative(ROOT, RAW_ARTIFACT).replaceAll('\\', '/'),
        sha256: createHash('sha256').update(rawText).digest('hex'),
        tracked: false,
    },
    stormCycleLedger: retainedLedger,
    observations: {
        tests: raw.tests,
        interruptionStorm: raw.interruptStorm,
        stormSummaryDerived: summary,
        exportImport: raw.exportImport,
        scale: raw.scale,
        engineCandidate: raw.engineCandidate,
    },
    criteria,
    automatedPass,
    decision: automatedPass
        ? {
            architectureStatus: 'protocol-pass-engine-decision-provisional',
            engine: raw.decision?.engine ?? 'undecided',
            engineEvidenceStatus: 'pglite-default-on-recorded-reference-machine',
            engineDecisionUnlocked: true,
            productionDependency: 'Final production persistence implementation waits for selected-engine sign-off.',
            sqliteComparison: raw.sqliteComparison,
        }
        : {
            architectureStatus: 'qualification-failed',
            engine: raw.decision?.engine ?? 'undecided',
            engineEvidenceStatus: 'not-qualified',
            engineDecisionUnlocked: false,
            failedCriteria,
            sqliteComparison: raw.sqliteComparison,
        },
    limitations: [
        raw.durabilityEnvelope,
        'The externally stored fixture is admitted physically through CasBlobAdmission.admitFile at the configured size; the run reports physicalBytesCopied, casVerifiedBytes and free-space delta for the actual reference machine.',
        'The result is one Windows NTFS reference-machine observation; it is not a cross-platform or hardware-power-loss qualification.',
        'The raw verifier artifact and the raw JSONL ledger are ignored by git; the retained per-cycle ledger is committed and bound to the raw artifact by sha256.',
        'A record-only invocation rebuilds the retained record from an existing artifact and can never produce a passing qualification.',
    ],
    generatedAt: new Date().toISOString(),
};

await mkdir(join(ROOT, 'docs', 'experiments'), { recursive: true });
await writeFile(EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
    ok: automatedPass,
    evidence: relative(ROOT, EVIDENCE).replaceAll('\\', '/'),
    repositoryCommit: head,
    qualification: evidence.qualification,
    failedCriteria,
    automatedPass,
}, null, 2)}\n`);
if (!automatedPass) {
    process.exitCode = 1;
}

function git(...args) {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function runVerifier(args) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [VERIFY, ...args], { cwd: ROOT, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve(code ?? (signal === null ? 1 : 1)));
    });
}
