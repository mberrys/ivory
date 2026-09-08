#!/usr/bin/env node
import { mkdir, writeFile, rm, readdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DurableStore } from './src/durable-store.mjs';
import { recordHardware, memorySnapshot } from './src/hardware.mjs';
import { runInterruptStorm } from './src/interrupt-harness.mjs';
import { loadScaleFixture, measureMetadata, measureSearch, measureSnapshot } from './src/scale.mjs';

const ROOT = join(fileURLToPath(new URL('../..', import.meta.url)));
const SPIKE = fileURLToPath(new URL('.', import.meta.url));
const ARTIFACT = join(ROOT, 'artifacts', 'n2');

const argv = process.argv.slice(2);
const has = flag => argv.includes(flag);
const value = name => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
};

function runNodeTest() {
    return new Promise(async (resolve, reject) => {
        const files = (await readdir(join(SPIKE, 'test')))
            .filter(file => file.endsWith('.spec.mjs'))
            .map(file => join(SPIKE, 'test', file));
        const child = spawn(process.execPath, ['--test', ...files], {
            cwd: ROOT,
            stdio: 'inherit',
            env: process.env,
        });
        child.once('exit', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`test:ivory-n2 failed with exit ${code}`));
            }
        });
    });
}

const hardware = recordHardware();
const previous = await loadExistingEvidence();
const evidence = {
    spike: 'N2',
    issue: 'MB-592',
    hardware,
    engineCandidate: 'pglite',
    relaxedDurability: false,
    postgresDialectCommitment: 'dev already ships ivory-migrate + postgres-execution-store + Graphile Worker',
    sqliteComparison: 'not run unless PGlite integrity gate fails',
    tests: previous.tests ?? {},
    interruptStorm: previous.interruptStorm,
    scale: previous.scale,
    exportImport: previous.exportImport,
    durabilityEnvelope: previous.durabilityEnvelope,
    decision: previous.decision,
};

let failed = false;

try {
    if (!has('--skip-tests')) {
        await runNodeTest();
        evidence.tests = { passed: true };
    }

    if (!has('--skip-storm')) {
        const cycles = Number(value('--cycles') ?? 1000);
        const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-storm-'));
        const started = Date.now();
        try {
            const results = await runInterruptStorm({
                projectRoot,
                cycles,
                onCycle: (index, fault) => {
                    if ((index + 1) % 50 === 0 || index === 0) {
                        process.stdout.write(`interrupt ${index + 1}/${cycles} ${fault}\n`);
                    }
                },
            });
            evidence.interruptStorm = {
                cycles,
                elapsedMs: Date.now() - started,
                acknowledgedNeverLost: true,
                oneEffectPerKey: true,
                noVisibleUninstalledBlob: true,
                faults: [...new Set(results.map(row => row.fault))],
            };
        } finally {
            await rm(projectRoot, { recursive: true, force: true });
        }
    }

    if (!has('--skip-export')) {
        const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-export-'));
        const destRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-import-'));
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
        await rm(projectRoot, { recursive: true, force: true });
        await rm(destRoot, { recursive: true, force: true });
        evidence.exportImport = { preserved: true, blobCount: exported.blobCount, projectSeq: exported.projectSeq };
    }

    if (!has('--skip-scale')) {
        const projectRoot = await mkdtemp(join(tmpdir(), 'ivory-n2-scale-'));
        const store = new DurableStore();
        const openStarted = Date.now();
        await store.open(projectRoot);
        const openMs = Date.now() - openStarted;
        const afterOpen = memorySnapshot();
        const load = await loadScaleFixture(store, {
            documents: Number(value('--docs') ?? 1000),
            annotations: Number(value('--annotations') ?? 100_000),
            blobBytes: Number(value('--blob-bytes') ?? 10 * 1024 * 1024 * 1024),
        });
        const metadata = await measureMetadata(store);
        const search = await measureSearch(store);
        const snapshot = await measureSnapshot(store);
        const afterScale = memorySnapshot();
        await store.close();
        evidence.scale = {
            ...load,
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
        await rm(projectRoot, { recursive: true, force: true });
        if (!evidence.scale.metadataPass || !evidence.scale.searchPass || !evidence.scale.snapshotPass) {
            evidence.scale.performanceFailure = 'measured query/index/batching fix required before engine rewrite';
            failed = true;
        }
    }

    evidence.durabilityEnvelope =
        'Tested envelope: unclean process termination (taskkill /F or SIGKILL) of a Node process using PGlite NodeFS on NTFS, then reopen. This does not prove survival of hardware power loss, USB yank, firmware crashes, or live cloud-drive sync of an open store.';
    evidence.acknowledgement = 'A commit is acknowledged only after the SQL COMMIT of the revision/activity/receipt/blob_ref/outbox transaction plus CHECKPOINT returns. Blob install precedes that transaction; a crash before COMMIT may leave an unreferenced blob and must not create a visible reference.';
    evidence.backupProcedure = 'Acquire the exclusive writer lock, CHECKPOINT, PGlite dumpDataDir plus a copy of objects/sha256, restore into a fresh path, verify, then open.';
    evidence.migrationStrategy = 'Forward-only SQL files, one transaction per file (apply + schema_migrations row). Exclusive writer lock. Interrupted migration resumes remaining files; it does not rewrite immutable payload hashes.';
    evidence.storagePort = 'DurableStore in spikes/n2-durable-store/src/durable-store.mjs';
    if (!failed && evidence.interruptStorm?.acknowledgedNeverLost) {
        evidence.decision = {
            engine: 'pglite',
            status: evidence.scale && (!evidence.scale.metadataPass || !evidence.scale.searchPass || !evidence.scale.snapshotPass)
                ? 'integrity-pass-performance-fix'
                : 'pglite-default',
        };
    }
} catch (error) {
    failed = true;
    evidence.error = { message: error.message, stack: error.stack };
    evidence.decision = { engine: 'undecided', status: 'integrity-or-harness-failure', sqliteComparisonRequired: true };
}

await mkdir(ARTIFACT, { recursive: true });
await writeFile(join(ARTIFACT, 'evidence.json'), JSON.stringify(evidence, null, 2), 'utf8');
process.stdout.write(`${JSON.stringify({ ok: !failed, artifact: join(ARTIFACT, 'evidence.json'), decision: evidence.decision }, null, 2)}\n`);
if (failed) {
    process.exitCode = 1;
}

async function loadExistingEvidence() {
    try {
        return JSON.parse(await readFile(join(ARTIFACT, 'evidence.json'), 'utf8'));
    } catch {
        return {};
    }
}
