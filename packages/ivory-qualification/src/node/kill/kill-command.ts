// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { Sha256Digest } from '@ivory/contracts';
import {
    CommitOutcome, initProject, openProjectStore, ProjectLayout, ProjectStore, qualificationHandlerModule, StoreFailpointConfig
} from '@ivory/core/lib/node';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, mkdtempSync, promises as fs, readFileSync, rmSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Criterion, Evidence, EvidenceRecord } from '../evidence';
import { Ledger } from '../ledger';
import { ChildRegistry, HarnessError, ManagedChild, sleep } from '../managed-child';
import { SeededRandom, Workload } from '../seeded-random';
import { evaluateKillRow, KillObservation, KillRow } from './kill-row';
import { KillAck, KillChildConfig, KillPoint, Observation } from './kill-types';

export interface KillOptions {
    readonly points: readonly KillPoint[];
    readonly cycles: number;
    readonly synchronous: 'FULL' | 'OFF';
    readonly project?: string;
    readonly out: string;
    readonly seed: number;
    /** How often, in cycles, the whole log is verified and every acknowledged receipt is read back. The last cycle always does. */
    readonly fullCheckEvery: number;
    readonly allowDirty: boolean;
    /** The command line as typed, for the record. */
    readonly command: string;
}

export interface KillResult {
    readonly record: EvidenceRecord;
    readonly recordFile: string;
}

const PRINCIPAL = 'qual';
const PROJECT_ID = 'ivory-qualification';
const MARKER_POLL_MS = 25;
const MARKER_TIMEOUT_MS = 60_000;
const RANDOM_DELAY_MAX_MS = 400;
const TARGET_CYCLES: Readonly<Record<string, number>> = { win32: 1000 };
const DEFAULT_TARGET_CYCLES = 100;
const CHUNK = 200;

interface Receipt {
    readonly seq: number;
    readonly digest: string;
}

/**
 * The kill harness of IV5-6: forks a child host per cycle, kills it at a crash point, reopens the store and checks
 * that nothing acknowledged was lost. One project holds every point and every cycle, so state accumulates.
 */
export async function runKill(options: KillOptions): Promise<KillResult> {
    const harnessDir = path.resolve(__dirname, '..', '..', '..');
    const head = Evidence.head(harnessDir);
    if (head.dirty && !options.allowDirty) {
        throw new HarnessError('the working tree is dirty, so this cannot be an evidence run: commit first, or pass --allow-dirty');
    }
    const startedAt = Date.now();
    const ownsProject = options.project === undefined;
    const projectDir = path.resolve(options.project ?? mkdtempSync(path.join(os.tmpdir(), 'ivory-qual-kill-')));
    const run = new KillRun(options, projectDir);
    try {
        await run.execute();
    } finally {
        await run.dispose();
        run.ledger.close();
        if (ownsProject) {
            rmSync(projectDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
        }
    }
    const ledgerSummary = run.ledger.close();
    const record = Evidence.build({
        kind: 'kill',
        head,
        command: options.command,
        startedAt,
        finishedAt: Date.now(),
        environment: Evidence.environment(projectDir),
        config: run.config(),
        harnessLib: path.resolve(__dirname, '..', '..'),
        coreLib: path.resolve(path.dirname(require.resolve('@ivory/core/package.json')), 'lib'),
        ledger: ledgerSummary,
        criteria: run.criteria()
    });
    return { record, recordFile: Evidence.write(options.out, record, options.synchronous) };
}

class KillRun {
    readonly ledger: Ledger;

    protected readonly layout: ProjectLayout;
    protected readonly rng: SeededRandom;
    protected readonly registry = new ChildRegistry();
    protected readonly rows: KillRow[] = [];
    /** Every key that has a receipt, with the receipt the store confirmed. */
    protected readonly receipts = new Map<string, Receipt>();
    protected readonly exitedProcessIds = new Set<string>();
    protected readonly observations = new Map<string, Observation & { count: number }>();
    protected observerErrors = 0;
    protected observerSamples = 0;
    protected observer: ManagedChild | undefined;
    protected observerProcessId = '';
    protected gcResult = { deleted: 0, skipped: 0 };
    protected finalChecks: FinalChecks | undefined;
    protected observedHead: Receipt | undefined;
    protected startedAt = Date.now();

    constructor(protected readonly options: KillOptions, protected readonly projectDir: string) {
        this.layout = ProjectLayout.of(projectDir);
        this.rng = new SeededRandom(options.seed);
        this.ledger = new Ledger(path.join(options.out, Evidence.ledgerFileName('kill', process.platform, options.synchronous)));
    }

    config(): Record<string, unknown> {
        return {
            points: [...this.options.points],
            cycles: this.options.cycles,
            synchronous: this.options.synchronous,
            seed: this.options.seed,
            fullCheckEvery: this.options.fullCheckEvery
        };
    }

    async dispose(): Promise<void> {
        await this.registry.killAll();
    }

    async execute(): Promise<void> {
        this.startedAt = Date.now();
        if (!existsSync(this.layout.manifest)) {
            await initProject(this.projectDir, { projectId: PROJECT_ID });
        }
        mkdirSync(this.markerDir, { recursive: true });
        // A read-only observer cannot create the initial schema on behalf of the writer.
        const initialized = await openProjectStore(this.projectDir);
        await initialized.close();
        await this.startObserver();
        const total = this.options.points.length * this.options.cycles;
        let cycle = 0;
        for (const point of this.options.points) {
            for (let n = 0; n < this.options.cycles; n++, cycle++) {
                const row = await this.runCycle(cycle, point, cycle === total - 1);
                this.rows.push(row);
                this.ledger.append(row);
                if ((cycle + 1) % 50 === 0) {
                    process.stderr.write(`[kill] ${cycle + 1}/${total} cycles, ${Math.round((Date.now() - this.startedAt) / (cycle + 1))} ms per cycle\n`);
                }
            }
        }
        await this.finish();
    }

    protected get markerDir(): string {
        return path.join(this.layout.runs, 'qual-markers');
    }

    protected async startObserver(): Promise<void> {
        const observer = this.registry.spawn(path.join(__dirname, 'observer-child.js'), [this.projectDir]);
        observer.listen(message => {
            if (message.type === 'obs') {
                const { seq, digest, t } = message as unknown as Observation;
                const key = `${seq}:${digest}`;
                const seen = this.observations.get(key);
                if (seen) {
                    seen.count++;
                } else {
                    this.observations.set(key, { seq, digest, t, count: 1 });
                }
            } else if (message.type === 'obs-error') {
                this.observerErrors++;
            }
        });
        this.observerProcessId = (await observer.next('ready')).processId as string;
        this.observer = observer;
    }

    protected async runCycle(cycle: number, point: KillPoint, last: boolean): Promise<KillRow> {
        const cycleStartedAt = Date.now();
        const markerFile = path.join(this.markerDir, `c${cycle}.json`);
        const failpoint: StoreFailpointConfig | undefined = point === 'random' ? undefined : { name: point, afterHits: 1 + this.rng.below(4), markerFile };
        const config: KillChildConfig = { cycle, seed: this.options.seed, synchronous: this.options.synchronous, failpoint };
        const child = this.registry.spawn(path.join(__dirname, 'kill-child.js'), [this.projectDir, JSON.stringify(config)]);
        const intents: string[] = [];
        const acks: KillAck[] = [];
        let refused: unknown;
        child.listen(message => {
            if (message.type === 'intent') {
                intents.push(message.key as string);
            } else if (message.type === 'ack') {
                acks.push(message as unknown as KillAck);
            } else if (message.type === 'refused') {
                refused = message.refusal;
            }
        });
        const { processId } = await child.next('ready') as unknown as { processId: string };
        const readyAt = Date.now();

        let markerSeen = false;
        let killDelayMs: number | undefined;
        if (failpoint) {
            const deadline = Date.now() + MARKER_TIMEOUT_MS;
            while (!markerSeen && !child.hasExited && Date.now() < deadline) {
                markerSeen = existsSync(markerFile);
                if (!markerSeen) {
                    await sleep(MARKER_POLL_MS);
                }
            }
        } else {
            killDelayMs = this.rng.below(RANDOM_DELAY_MAX_MS + 1);
            await Promise.race([sleep(killDelayMs), child.exited]);
        }
        // The child may have written the marker and died between two polls.
        markerSeen ||= existsSync(markerFile);
        const childExitedEarly = !markerSeen && child.hasExited;
        await child.kill();
        await child.drain();
        this.exitedProcessIds.add(processId);
        const killedAt = Date.now();
        const marker = markerSeen ? this.readMarker(markerFile) : undefined;

        const stagingBefore = await this.stagingFiles(processId);
        const leaseBefore = existsSync(path.join(this.layout.leases, `${processId}.sqlite`));

        const store = await openProjectStore(this.projectDir, {
            hostKind: 'cli',
            handlerModules: [qualificationHandlerModule],
            qualification: { synchronous: this.options.synchronous }
        });
        const reopenedAt = Date.now();
        try {
            const observation = await this.observe(store, {
                cycle, point, failpoint, child, processId, markerSeen, marker, killDelayMs, childExitedEarly, refused, intents, acks, stagingBefore, leaseBefore,
                full: last || (cycle + 1) % this.options.fullCheckEvery === 0,
                timings: { cycleStartedAt, readyAt, killedAt, reopenedAt }
            });
            const failures = evaluateKillRow(observation);
            return { row: 'cycle', ...observation, failures, pass: failures.length === 0 };
        } finally {
            await store.close();
        }
    }

    /** Reads the store after the crash: the checks of the spec, then the retry of the in-flight key. */
    protected async observe(store: ProjectStore, input: CycleInput): Promise<KillObservation> {
        const { cycle, point, processId, acks, intents } = input;
        const checksStartedAt = Date.now();
        const recovery = store.openRecovery;
        const ackedKeys = new Set(acks.map(ack => ack.key));
        const unacked = intents.filter(key => !ackedKeys.has(key));
        const inflightKey = unacked.length === 1 ? unacked[0] : undefined;
        const committedBefore = this.receipts.size;

        // 1. Every receipt a client was ever given still exists, before any retry.
        const toCheck: [string, Receipt][] = input.full
            ? [...this.receipts.entries(), ...acks.map(ack => [ack.key, ack] as [string, Receipt])]
            : acks.map(ack => [ack.key, ack] as [string, Receipt]);
        const lostKeys: string[] = [];
        await inChunks(toCheck, async ([key, expected]) => {
            const found = await store.receiptFor(PRINCIPAL, key);
            if (found?.seq !== expected.seq || found.digest !== expected.digest) {
                lostKeys.push(key);
            }
        });
        const head = await store.head();

        // 2. The in-flight key, before the retry.
        const durable = inflightKey === undefined ? undefined : await store.receiptFor(PRINCIPAL, inflightKey) !== undefined;
        const inflightBytes = inflightKey === undefined ? undefined : Workload.bytes(this.options.seed, cycle, Workload.indexOf(cycle, inflightKey));
        const inflightDigest = inflightBytes && digestOf(inflightBytes);
        const inflightBlobOnDisk = inflightDigest === undefined ? undefined : existsSync(ProjectLayout.blobPath(this.layout, inflightDigest));

        // 3. The new blobs are on disk and hash to their names.
        const blobProblems: string[] = [];
        let blobsChecked = 0;
        const newBlobs = acks.map(ack => ack.blob as Sha256Digest);
        if (durable && inflightDigest) {
            newBlobs.push(inflightDigest);
        }
        for (const blob of newBlobs) {
            blobsChecked++;
            const problem = await this.blobProblem(blob);
            if (problem) {
                blobProblems.push(problem);
            }
        }

        // 4. The retry, with the identical request.
        let retry: KillObservation['retry'];
        let receiptsForInflight: number | undefined;
        let receiptStable: boolean | undefined;
        if (inflightKey !== undefined && inflightBytes) {
            const before = durable ? await store.receiptFor(PRINCIPAL, inflightKey) : undefined;
            const blob = await store.admitBlob(inflightBytes);
            const outcome = await store.commit({ kind: 'qual.put', input: { key: inflightKey, blob }, principal: PRINCIPAL, idempotencyKey: inflightKey });
            retry = CommitOutcome.isRefusal(outcome)
                ? { refusal: outcome.refusal }
                : { replayed: outcome.replayed, seq: outcome.receipt.seq, digest: outcome.receipt.digest };
            const after = await store.receiptFor(PRINCIPAL, inflightKey);
            receiptsForInflight = after === undefined ? 0 : 1;
            receiptStable = before === undefined || (after?.seq === before.seq && after.digest === before.digest);
            if (after) {
                this.receipts.set(inflightKey, after);
            }
            const problem = await this.blobProblem(blob);
            blobsChecked++;
            if (problem) {
                blobProblems.push(problem);
            }
        }
        for (const ack of acks) {
            this.receipts.set(ack.key, ack);
        }
        const headAfterRetry = (await store.head())?.seq ?? 0;

        // 5. The log as a whole, every so often.
        let chain: KillObservation['chain'];
        if (input.full) {
            const verified = await store.verifyChain();
            chain = { ok: verified.ok, problems: verified.problems.length, keysChecked: toCheck.length, headSeq: verified.headSeq };
        }

        const stagingAfter = (await this.stagingFiles(processId)).length;
        const swept = recovery.swept;
        const { cycleStartedAt, readyAt, killedAt, reopenedAt } = input.timings;
        return {
            cycle,
            point,
            crashPoint: KillPoint.CRASH_POINT[point],
            failpoint: input.failpoint && { name: input.failpoint.name, afterHits: input.failpoint.afterHits },
            childPid: input.child.pid,
            childProcessId: processId,
            exit: { code: input.child.exitCode, signal: input.child.exitSignal },
            markerSeen: input.markerSeen,
            markerMatches: input.marker !== undefined && input.marker.name === point && input.marker.pid === input.child.pid,
            killDelayMs: input.killDelayMs,
            childExitedEarly: input.childExitedEarly,
            refused: input.refused,
            intents: intents.length,
            acked: acks.length,
            ackedSeqs: acks.length > 0 ? { first: acks[0].seq, last: acks[acks.length - 1].seq } : undefined,
            inflightKey,
            intentAckMismatch: unacked.length > 1,
            stagingBefore: input.stagingBefore.length,
            leaseBefore: input.leaseBefore,
            openRecovery: recovery,
            sweptChild: swept.includes(processId),
            sweptUnknown: swept.filter(id => id !== processId && !this.exitedProcessIds.has(id)),
            observerSwept: swept.includes(this.observerProcessId),
            observerSkipped: recovery.skippedAlive.includes(this.observerProcessId),
            stagingAfter,
            leaseAfter: existsSync(path.join(this.layout.leases, `${processId}.sqlite`)),
            committedBefore,
            expectedHeadAtReopen: committedBefore + acks.length + (durable ? 1 : 0),
            headAtReopen: head?.seq ?? 0,
            lostAcknowledged: lostKeys.length,
            lostKeys: lostKeys.slice(0, 10),
            expectedDurable: KillPoint.EXPECTED_DURABLE[point],
            durableBeforeRetry: durable,
            inflightBlobOnDisk,
            retry,
            receiptsForInflight,
            receiptStable,
            expectedHeadAfterRetry: committedBefore + acks.length + (inflightKey === undefined ? 0 : 1),
            headAfterRetry,
            blobsChecked,
            blobProblems,
            fullCheck: input.full,
            chain,
            timingsMs: {
                total: Date.now() - cycleStartedAt,
                ready: readyAt - cycleStartedAt,
                kill: killedAt - readyAt,
                reopen: reopenedAt - killedAt,
                checks: Date.now() - checksStartedAt
            }
        };
    }

    /** The end of the run: GC, the whole log against every key, the observer's samples. */
    protected async finish(): Promise<void> {
        const store = await openProjectStore(this.projectDir, {
            hostKind: 'cli',
            handlerModules: [qualificationHandlerModule],
            qualification: { synchronous: this.options.synchronous }
        });
        try {
            this.gcResult = await store.gc({ graceMs: 0 });
            const chain = await store.verifyChain();
            const log = new Map<number, string>();
            let missing = 0;
            let mismatched = 0;
            await inChunks([...this.receipts.entries()], async ([key, expected]) => {
                const found = await store.receiptFor(PRINCIPAL, key);
                if (found === undefined) {
                    missing++;
                } else {
                    log.set(found.seq, found.digest);
                    if (found.seq !== expected.seq || found.digest !== expected.digest) {
                        mismatched++;
                    }
                }
            });
            const head = await store.head();
            this.observedHead = head;

            const referenced = new Set<string>();
            for (const key of this.receipts.keys()) {
                referenced.add(digestOf(Workload.bytes(this.options.seed, Number(/^c(\d+)-/.exec(key)?.[1]), Number(/-(\d+)$/.exec(key)?.[1]))));
            }
            const onDisk = await this.blobsOnDisk();
            const referencedProblems: string[] = [];
            for (const digest of referenced) {
                const problem = await this.blobProblem(digest as Sha256Digest);
                if (problem) {
                    referencedProblems.push(problem);
                }
            }
            this.finalChecks = {
                chainOk: chain.ok,
                chainProblems: chain.problems.length,
                headSeq: head?.seq ?? 0,
                keys: this.receipts.size,
                missing,
                mismatched,
                log,
                referenced: referenced.size,
                onDisk: onDisk.length,
                unreferencedRemaining: onDisk.filter(digest => !referenced.has(digest)).length,
                referencedProblems,
                stagingLeft: (await fs.readdir(this.layout.casStaging)).length
            };
        } finally {
            await store.close();
        }
        const observer = this.observer;
        if (observer) {
            observer.send({ type: 'stop' });
            const stopped = await observer.next('stopped') as unknown as { samples: number; errors: number };
            this.observerSamples = stopped.samples;
            await observer.waitForExit(5000);
        }
    }

    criteria(): Record<string, Criterion> {
        const { rows, options } = { rows: this.rows, options: this.options };
        const final = this.finalChecks;
        const requiredPoints = KillPoint.ALL;
        const perPoint: Record<string, { cycles: number; passed: number; lostAcknowledged: number; durable: number; notDurable: number }> = {};
        for (const point of requiredPoints) {
            const pointRows = rows.filter(row => row.point === point);
            perPoint[point] = {
                cycles: pointRows.length,
                passed: pointRows.filter(row => row.pass).length,
                lostAcknowledged: pointRows.reduce((sum, row) => sum + row.lostAcknowledged, 0),
                durable: pointRows.filter(row => row.durableBeforeRetry === true).length,
                notDurable: pointRows.filter(row => row.durableBeforeRetry === false).length
            };
        }
        const lostAcknowledged = rows.reduce((sum, row) => sum + row.lostAcknowledged, 0);
        const expectationMisses = rows.filter(row => row.point !== 'random' && row.failures.includes('durable-expectation')).length;
        const pointsComplete = requiredPoints.every(point => perPoint[point].cycles === options.cycles);
        const finalOk = final !== undefined && final.chainOk && final.missing === 0 && final.mismatched === 0 && final.unreferencedRemaining === 0
            && final.referencedProblems.length === 0 && final.log.size === final.keys && final.headSeq === final.keys && final.stagingLeft === 0;
        const kPass = rows.length > 0 && rows.every(row => row.pass) && lostAcknowledged === 0 && pointsComplete && expectationMisses === 0 && finalOk;
        const target = TARGET_CYCLES[process.platform] ?? DEFAULT_TARGET_CYCLES;
        const k = {
            pass: kPass,
            gated: options.synchronous === 'FULL',
            synchronous: options.synchronous,
            rows: rows.length,
            rowsFailed: rows.filter(row => !row.pass).length,
            failureCounts: countFailures(rows),
            lostAcknowledged,
            durableExpectationMisses: expectationMisses,
            pointsComplete,
            cyclesPerPoint: options.cycles,
            targetCyclesPerPoint: target,
            meetsTargetCycles: options.cycles >= target,
            perPoint,
            meanMsPerCycle: rows.length === 0 ? 0 : Math.round(rows.reduce((sum, row) => sum + row.timingsMs.total, 0) / rows.length),
            final: final && {
                chainOk: final.chainOk,
                headSeq: final.headSeq,
                keys: final.keys,
                missing: final.missing,
                mismatched: final.mismatched,
                gc: this.gcResult,
                referencedBlobs: final.referenced,
                blobsOnDisk: final.onDisk,
                unreferencedRemaining: final.unreferencedRemaining,
                referencedProblems: final.referencedProblems.slice(0, 10),
                stagingLeft: final.stagingLeft
            }
        };

        const observed = [...this.observations.values()];
        const phantoms = final ? observed.filter(o => final.log.get(o.seq) !== o.digest) : observed;
        const p1 = {
            pass: final !== undefined && observed.length > 0 && phantoms.length === 0 && this.observerSamples > 0,
            gated: true,
            samples: this.observerSamples,
            observerErrors: this.observerErrors,
            distinctObserved: observed.length,
            phantoms: phantoms.length,
            phantomExamples: phantoms.slice(0, 5).map(o => ({ seq: o.seq, digest: o.digest })),
            finalHeadSeq: final?.headSeq ?? 0
        };

        const sweeps = rows.reduce((sum, row) => sum + row.openRecovery.swept.length, 0);
        const sweptUnknown = rows.reduce((sum, row) => sum + row.sweptUnknown.length, 0);
        const observerSwept = rows.filter(row => row.observerSwept).length;
        const r1 = {
            pass: rows.length > 0 && sweptUnknown === 0 && observerSwept === 0,
            gated: true,
            reopens: rows.length,
            sweeps,
            sweptNotYetExited: sweptUnknown,
            observerSwept,
            observerSkippedReopens: rows.filter(row => row.observerSkipped).length
        };
        return { [options.synchronous === 'FULL' ? 'K1' : 'K0']: k, P1: p1, R1: r1 };
    }

    protected readMarker(file: string): { name: string; pid: number } | undefined {
        try {
            return JSON.parse(readFileSync(file, 'utf8')) as { name: string; pid: number };
        } catch {
            return undefined;
        }
    }

    protected async stagingFiles(processId: string): Promise<string[]> {
        return (await fs.readdir(this.layout.casStaging)).filter(name => name.startsWith(`${processId}-`));
    }

    /** Every blob file below `cas/sha256`, as its digest. */
    protected async blobsOnDisk(): Promise<string[]> {
        const digests: string[] = [];
        for (const first of await fs.readdir(this.layout.casRoot)) {
            for (const second of await fs.readdir(path.join(this.layout.casRoot, first))) {
                for (const name of await fs.readdir(path.join(this.layout.casRoot, first, second))) {
                    const digest = ProjectLayout.digestOfBlobName(name);
                    if (digest) {
                        digests.push(digest);
                    }
                }
            }
        }
        return digests;
    }

    /** A description of what is wrong with the blob, or `undefined` when it exists and hashes to its name. */
    protected async blobProblem(digest: Sha256Digest): Promise<string | undefined> {
        let bytes: Buffer;
        try {
            bytes = await fs.readFile(ProjectLayout.blobPath(this.layout, digest));
        } catch (error) {
            return (error as NodeJS.ErrnoException).code === 'ENOENT' ? `${digest} is missing` : `${digest} cannot be read: ${(error as Error).message}`;
        }
        return digestOf(bytes) === digest ? undefined : `${digest} has other bytes than its name`;
    }
}

interface CycleInput {
    readonly cycle: number;
    readonly point: KillPoint;
    readonly failpoint: StoreFailpointConfig | undefined;
    readonly child: ManagedChild;
    readonly processId: string;
    readonly markerSeen: boolean;
    readonly marker: { name: string; pid: number } | undefined;
    readonly killDelayMs: number | undefined;
    readonly childExitedEarly: boolean;
    readonly refused: unknown;
    readonly intents: readonly string[];
    readonly acks: readonly KillAck[];
    readonly stagingBefore: readonly string[];
    readonly leaseBefore: boolean;
    readonly full: boolean;
    readonly timings: { readonly cycleStartedAt: number; readonly readyAt: number; readonly killedAt: number; readonly reopenedAt: number };
}

interface FinalChecks {
    readonly chainOk: boolean;
    readonly chainProblems: number;
    readonly headSeq: number;
    readonly keys: number;
    readonly missing: number;
    readonly mismatched: number;
    readonly log: ReadonlyMap<number, string>;
    readonly referenced: number;
    readonly onDisk: number;
    readonly unreferencedRemaining: number;
    readonly referencedProblems: readonly string[];
    readonly stagingLeft: number;
}

function digestOf(bytes: Uint8Array): Sha256Digest {
    return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

async function inChunks<T>(items: readonly T[], action: (item: T) => Promise<void>): Promise<void> {
    for (let start = 0; start < items.length; start += CHUNK) {
        await Promise.all(items.slice(start, start + CHUNK).map(action));
    }
}

function countFailures(rows: readonly KillRow[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const row of rows) {
        for (const failure of row.failures) {
            counts[failure] = (counts[failure] ?? 0) + 1;
        }
    }
    return counts;
}
