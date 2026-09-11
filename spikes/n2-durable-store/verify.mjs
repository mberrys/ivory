#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DurableStore } from './src/durable-store.mjs';
import { recordHardware, memorySnapshot } from './src/hardware.mjs';
import { runInterruptStorm } from './src/interrupt-harness.mjs';
import { ledgerDigest, openLedger } from './src/storm-ledger.mjs';
import { loadScaleFixture, measureMetadata, measureSearch, measureSnapshot } from './src/scale.mjs';
import { runCasAdmissionExercise } from './src/cas-scale.mjs';
import { collectFixtureFiles, digestManifest } from './src/fixture-digest.mjs';

const ROOT = join(fileURLToPath(new URL('../..', import.meta.url)));
const SPIKE = fileURLToPath(new URL('.', import.meta.url));
const ARTIFACT = join(ROOT, 'artifacts', 'n2');
const STORM_LEDGER = join(ARTIFACT, 'storm-cycles.jsonl');
const CAS_WORK_ROOT = join(ARTIFACT, 'cas');
const DEFAULT_CAS_BYTES = 10 * 1024 * 1024 * 1024;

const argv = process.argv.slice(2);
const has = flag => argv.includes(flag);
const value = name => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
};

const skippedSections = [];
const sections = {};

function runNodeTest() {
    return new Promise(async (resolve, reject) => {
        const files = (await readdir(join(SPIKE, 'test')))
            .filter(file => file.endsWith('.spec.mjs'))
            .map(file => join(SPIKE, 'test', file));
        const child = spawn(process.execPath, ['--test', ...files], { cwd: ROOT, stdio: 'inherit', env: process.env });
        child.once('exit', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`test:ivory-n2 failed with exit ${code}`));
            }
        });
    });
}

const startedAt = new Date().toISOString();
const fixtureFiles = await collectFixtureFiles(join(ROOT, 'spikes', 'n2-durable-store'));
await mkdir(ARTIFACT, { recursive: true });

const evidence = {
    spike: 'N2',
    issue: 'MB-592',
    hardware: recordHardware(),
    repositoryCommit: git('rev-parse', 'HEAD'),
    repositoryBranch: git('branch', '--show-current'),
    fixtureDigest: digestManifest(fixtureFiles),
    engineCandidate: 'pglite',
    relaxedDurability: false,
    postgresDialectCommitment: 'dev already ships ivory-migrate + postgres-execution-store + Graphile Worker',
    sqliteComparison: 'not run unless PGlite integrity gate fails',
    sections,
    skippedSections,
    tests: {},
    startedAt,
};

let failed = false;
const failures = [];

try {
    if (!has('--skip-tests')) {
        await runNodeTest();
        sections.tests = 'ran';
        evidence.tests = { passed: true };
    } else {
        sections.tests = 'skipped';
        skippedSections.push('tests');
    }

    if (!has('--skip-storm')) {
        const cycles = Number(value('--cycles') ?? 1000);
        const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-storm-'));
        const started = Date.now();
        try {
            await openLedger(STORM_LEDGER);
            const { summary } = await runInterruptStorm({
                projectRoot,
                cycles,
                ledgerPath: STORM_LEDGER,
                onCycle: (index, fault, row) => {
                    if ((index + 1) % 50 === 0 || index === 0) {
                        process.stdout.write(`interrupt ${index + 1}/${cycles} ${fault} pass=${row.pass}\n`);
                    }
                },
            });
            const ledgerText = await readFile(STORM_LEDGER, 'utf8');
            sections.storm = 'ran';
            evidence.interruptStorm = {
                cycles,
                elapsedMs: Date.now() - started,
                measuredFromResults: summary.measuredFromResults,
                resultCount: summary.resultCount,
                failedResultCount: summary.failedResultCount,
                firstFailureIndex: summary.firstFailureIndex,
                acknowledgedCount: summary.acknowledgedCount,
                unacknowledgedCount: summary.unacknowledgedCount,
                childrenExitedBeforeReopen: summary.childrenExitedBeforeReopen,
                acknowledgedNeverLost: summary.acknowledgedNeverLost,
                oneEffectPerKey: summary.oneEffectPerKey,
                noVisibleUninstalledBlob: summary.noVisibleUninstalledBlob,
                faults: summary.faults,
                ledgerPath: 'artifacts/n2/storm-cycles.jsonl',
                ledgerSha256: ledgerDigest(ledgerText),
            };
            if (!summary.acknowledgedNeverLost || !summary.oneEffectPerKey || !summary.noVisibleUninstalledBlob) {
                failed = true;
                failures.push('interruption storm derived a failed integrity boolean');
            }
            if (summary.failedResultCount > 0) {
                failed = true;
                failures.push(`${summary.failedResultCount} storm cycles failed`);
            }
            if (summary.resultCount < cycles) {
                failed = true;
                failures.push(`storm retained ${summary.resultCount} of ${cycles} cycle rows`);
            }
        } finally {
            await rm(projectRoot, { recursive: true, force: true });
        }
    } else {
        sections.storm = 'skipped';
        skippedSections.push('storm');
    }

    if (!has('--skip-export')) {
        const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-export-'));
        const destRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-import-'));
        try {
            const store = new DurableStore();
            await store.open(projectRoot);
            await store.commit({
                idempotencyKey: 'verify-export',
                expectedHeads: [{ objectId: 'doc-export' }],
                revisions: [{ objectId: 'doc-export', objectType: 'document', payload: { title: 'Export', text: 'round-trip' } }],
                blobs: [{ bytes: Buffer.from('round-trip-bytes') }],
            });
            const exported = await store.exportSemantic();
            await store.close();
            const dest = new DurableStore();
            await dest.importSemantic(exported.exportDir, destRoot);
            await dest.open(destRoot);
            const visible = await dest.getVisible('doc-export');
            if (visible.payload.text !== 'round-trip') {
                throw new Error('export/import lost payload text');
            }
            await dest.close();
            sections.export = 'ran';
            evidence.exportImport = { preserved: true, blobCount: exported.blobCount, projectSeq: exported.projectSeq };
        } finally {
            await rm(projectRoot, { recursive: true, force: true });
            await rm(destRoot, { recursive: true, force: true });
        }
    } else {
        sections.export = 'skipped';
        skippedSections.push('export');
    }

    if (!has('--skip-scale')) {
        const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-scale-'));
        try {
            const store = new DurableStore();
            const openStarted = Date.now();
            await store.open(projectRoot);
            const openMs = Date.now() - openStarted;
            const afterOpen = memorySnapshot();
            const sparse = has('--sparse-blob');
            const load = await loadScaleFixture(store, {
                documents: Number(value('--docs') ?? 1000),
                annotations: Number(value('--annotations') ?? 100_000),
                sparseBlobBytes: sparse ? Number(value('--cas-bytes') ?? DEFAULT_CAS_BYTES) : undefined,
            });
            const metadata = await measureMetadata(store);
            const search = await measureSearch(store);
            const snapshot = await measureSnapshot(store);
            // The CAS exercise runs after the measurements so the perf numbers stay
            // comparable with the previous record; it does not touch the measured indexes.
            const cas = sparse
                ? {}
                : await runCasAdmissionExercise(store, {
                    bytes: Number(value('--cas-bytes') ?? DEFAULT_CAS_BYTES),
                    workRoot: CAS_WORK_ROOT,
                    bindObjectId: 'cas-scale-source',
                });
            const afterScale = memorySnapshot();
            await store.close();
            sections.scale = 'ran';
            evidence.scale = {
                ...load,
                ...cas,
                openMs,
                memoryAfterOpen: afterOpen,
                memoryAfterScale: afterScale,
                metadataP95Ms: metadata.p95,
                metadataP50Ms: metadata.p50,
                searchMs: search.ms,
                searchHits: search.hitCount,
                snapshotMs: snapshot.ms,
                metadataBudgetMs: 200,
                searchBudgetMs: 1000,
                snapshotBudgetMs: 2000,
                metadataPass: metadata.p95 < 200,
                searchPass: search.ms < 1000,
                snapshotPass: snapshot.ms < 2000,
            };
            if (!evidence.scale.metadataPass || !evidence.scale.searchPass || !evidence.scale.snapshotPass) {
                evidence.scale.performanceFailure = 'measured query/index/batching fix required before engine rewrite';
                failed = true;
                failures.push('a scale budget was missed');
            }
            if (evidence.scale.casAdmissionPath !== true) {
                evidence.scale.casFailure = 'physical CAS admission was not exercised';
                failed = true;
                failures.push('physical CAS admission was not exercised');
            }
        } finally {
            await rm(projectRoot, { recursive: true, force: true });
            await rm(CAS_WORK_ROOT, { recursive: true, force: true });
        }
    } else {
        sections.scale = 'skipped';
        skippedSections.push('scale');
    }

    evidence.durabilityEnvelope =
        'Tested envelope: unclean process termination (taskkill /F or SIGKILL) of a Node process using PGlite NodeFS on NTFS, then reopen. This does not prove survival of hardware power loss, USB yank, firmware crashes, or live cloud-drive sync of an open store.';
    evidence.acknowledgement =
        'A commit is acknowledged only after the SQL COMMIT of the revision/activity/receipt/blob_ref/outbox transaction plus CHECKPOINT returns. Blob install precedes that transaction; a crash before COMMIT may leave an unreferenced blob and must not create a visible reference.';
    evidence.backupProcedure =
        'Acquire the exclusive writer lock, CHECKPOINT, PGlite dumpDataDir plus a copy of objects/sha256, restore into a fresh path, verify, then open.';
    evidence.migrationStrategy =
        'Forward-only SQL files, one transaction per file (apply + schema_migrations row). Exclusive writer lock. Interrupted migration resumes remaining files; it does not rewrite immutable payload hashes.';
    evidence.storagePort = 'DurableStore in spikes/n2-durable-store/src/durable-store.mjs';
    evidence.decision = failed
        ? { engine: 'pglite', status: 'integrity-or-harness-failure', sqliteComparisonRequired: true, failures }
        : { engine: 'pglite', status: 'pglite-default' };
} catch (error) {
    failed = true;
    evidence.error = { message: error.message, stack: error.stack };
    evidence.decision = { engine: 'undecided', status: 'integrity-or-harness-failure', sqliteComparisonRequired: true };
}

evidence.finishedAt = new Date().toISOString();
await mkdir(ARTIFACT, { recursive: true });
await writeFile(join(ARTIFACT, 'evidence.json'), JSON.stringify(evidence, null, 2), 'utf8');
process.stdout.write(`${JSON.stringify({
    ok: !failed,
    artifact: join(ARTIFACT, 'evidence.json'),
    sections,
    skippedSections,
    decision: evidence.decision,
}, null, 2)}\n`);
if (failed) {
    process.exitCode = 1;
}

function git(...args) {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
