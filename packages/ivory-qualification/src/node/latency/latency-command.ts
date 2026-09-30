// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { initProject, openProjectStore, ProjectLayout, qualificationHandlerModule, RecoveryReport } from '@ivory/core/lib/node';
import { existsSync, mkdtempSync, promises as fs, rmSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Criterion, Evidence, EvidenceRecord } from '../evidence';
import { Ledger } from '../ledger';
import { ChildRegistry, HarnessError, ManagedChild, sleep } from '../managed-child';
import { SeededRandom } from '../seeded-random';
import {
    CommitRecord, LatencyRole, LatencyRoleConfig, LatencySchedule, ObservationRecord, OpenRecord, RoleReport
} from './latency-types';

export interface LatencyOptions {
    /** Seconds of the measured window. */
    readonly duration: number;
    /** Seconds the workbench warms up before it measures. */
    readonly warmup: number;
    /** Seconds between victims. */
    readonly victimInterval: number;
    readonly project?: string;
    readonly out: string;
    readonly seed: number;
    readonly allowDirty: boolean;
    readonly command: string;
}

export interface LatencyResult {
    readonly record: EvidenceRecord;
    readonly recordFile: string;
}

const HOLD_MS = 3000;
const P99_LIMIT_MS = 100;
const PROJECT_ID = 'ivory-qualification';
const START_DELAY_MS = 1000;
const REPORT_GRACE_MS = 60_000;
const VICTIM_LIFE_MS = { min: 1000, max: 3000 };
const VICTIM_MARGIN_MS = 4000;
const FINAL_RECOVER_ATTEMPTS = 10;

/** A short-lived host that the parent kills, and what became of its lease. */
interface Victim {
    readonly processId: string;
    readonly pid: number;
    readonly spawnedAt: number;
    readonly open: OpenRecord;
    killIssuedAt: number;
    exitedAt: number;
}

/** A recovery report from any host, with the times around the recovery. */
interface RecoverySource {
    readonly source: string;
    readonly startedAt: number;
    readonly endedAt: number;
    readonly recovery: RecoveryReport;
}

/**
 * The latency harness of IV5-6: a workbench, a CLI that holds the write lock, an MCP agent that reads and recovers, and
 * victims that die with their leases, all on one project.
 */
export async function runLatency(options: LatencyOptions): Promise<LatencyResult> {
    const harnessDir = path.resolve(__dirname, '..', '..', '..');
    const head = Evidence.head(harnessDir);
    if (head.dirty && !options.allowDirty) {
        throw new HarnessError('the working tree is dirty, so this cannot be an evidence run: commit first, or pass --allow-dirty');
    }
    const startedAt = Date.now();
    const ownsProject = options.project === undefined;
    const projectDir = path.resolve(options.project ?? mkdtempSync(path.join(os.tmpdir(), 'ivory-qual-latency-')));
    const ledger = new Ledger(path.join(options.out, Evidence.ledgerFileName('latency', process.platform, 'FULL')));
    const run = new LatencyRun(options, projectDir, ledger);
    try {
        await run.execute();
    } finally {
        await run.dispose();
        ledger.close();
        if (ownsProject) {
            rmSync(projectDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
        }
    }
    const record = Evidence.build({
        kind: 'latency',
        head,
        command: options.command,
        startedAt,
        finishedAt: Date.now(),
        environment: Evidence.environment(projectDir),
        config: run.config(),
        harnessLib: path.resolve(__dirname, '..', '..'),
        coreLib: path.resolve(path.dirname(require.resolve('@ivory/core/package.json')), 'lib'),
        ledger: ledger.close(),
        criteria: run.criteria()
    });
    return { record, recordFile: Evidence.write(options.out, record, 'FULL') };
}

class LatencyRun {
    protected readonly layout: ProjectLayout;
    protected readonly registry = new ChildRegistry();
    protected readonly rng: SeededRandom;
    protected readonly victims: Victim[] = [];
    protected readonly reports = new Map<string, RoleReport>();
    protected readonly opens: { role: string; processId: string; open: OpenRecord }[] = [];
    protected readonly recoveries: RecoverySource[] = [];
    protected finalLog: ReadonlyMap<number, string> | undefined;
    protected finalHeadSeq = 0;
    protected finalKeys = { checked: 0, missing: 0, mismatched: 0 };
    protected chainOk = false;
    protected victimLeftovers: string[] = [];

    constructor(protected readonly options: LatencyOptions, protected readonly projectDir: string, protected readonly ledger: Ledger) {
        this.layout = ProjectLayout.of(projectDir);
        this.rng = new SeededRandom(options.seed);
    }

    config(): Record<string, unknown> {
        return {
            duration: this.options.duration,
            warmup: this.options.warmup,
            victimInterval: this.options.victimInterval,
            holdMs: HOLD_MS,
            seed: this.options.seed
        };
    }

    async dispose(): Promise<void> {
        await this.registry.killAll();
    }

    async execute(): Promise<void> {
        if (!existsSync(this.layout.manifest)) {
            await initProject(this.projectDir, { projectId: PROJECT_ID });
        }
        const roleConfig: LatencyRoleConfig = { holdMs: HOLD_MS };
        const script = path.join(__dirname, 'latency-child.js');
        const roles: LatencyRole[] = ['workbench', 'cli', 'mcp'];
        const children = new Map<LatencyRole, ManagedChild>();
        for (const role of roles) {
            children.set(role, this.registry.spawn(script, [role, this.projectDir, JSON.stringify(roleConfig)]));
        }
        for (const [role, child] of children) {
            const ready = await child.next('ready', 60_000) as unknown as { processId: string; open: OpenRecord };
            this.opens.push({ role, processId: ready.processId, open: ready.open });
        }
        const t0 = Date.now() + START_DELAY_MS;
        const schedule: LatencySchedule = { t0, measureStart: t0 + this.options.warmup * 1000, endAt: t0 + (this.options.warmup + this.options.duration) * 1000 };
        for (const child of children.values()) {
            child.send({ type: 'go', ...schedule });
        }
        const victimLoop = this.runVictims(script, schedule);
        for (const [role, child] of children) {
            const report = await child.next('report', schedule.endAt - Date.now() + REPORT_GRACE_MS) as unknown as RoleReport;
            this.reports.set(role, report);
            await child.waitForExit(15_000);
        }
        await victimLoop;
        await this.finish();
    }

    /** Every `victimInterval` seconds a host opens the store, admits a blob and is killed 1 to 3 seconds later. */
    protected async runVictims(script: string, schedule: LatencySchedule): Promise<void> {
        const config: LatencyRoleConfig = { holdMs: HOLD_MS };
        for (let k = 1; ; k++) {
            const at = schedule.t0 + k * this.options.victimInterval * 1000;
            if (at + VICTIM_MARGIN_MS > schedule.endAt) {
                return;
            }
            await sleep(Math.max(0, at - Date.now()));
            const child = this.registry.spawn(script, ['victim', this.projectDir, JSON.stringify(config)]);
            const ready = await child.next('ready', 60_000) as unknown as { processId: string; open: OpenRecord };
            await sleep(VICTIM_LIFE_MS.min + this.rng.below(VICTIM_LIFE_MS.max - VICTIM_LIFE_MS.min + 1));
            await child.kill();
            this.victims.push({
                processId: ready.processId,
                pid: child.pid,
                spawnedAt: child.spawnedAt,
                open: ready.open,
                killIssuedAt: child.killIssuedAt ?? 0,
                exitedAt: child.exitedAt ?? 0
            });
        }
    }

    /** The final recovery, and the whole log read back against every receipt a client was given. */
    protected async finish(): Promise<void> {
        const openedAt = Date.now();
        const store = await openProjectStore(this.projectDir, { hostKind: 'cli', handlerModules: [qualificationHandlerModule] });
        try {
            this.recoveries.push({ source: 'final-open', startedAt: openedAt, endedAt: Date.now(), recovery: store.openRecovery });
            const pendingVictims = (): string[] => {
                const swept = new Set(this.recoveries.flatMap(source => source.recovery.swept));
                return this.victims.map(victim => victim.processId).filter(id => !swept.has(id));
            };
            for (let attempt = 0; attempt < FINAL_RECOVER_ATTEMPTS; attempt++) {
                const startedAt = Date.now();
                const recovery = await store.recover();
                this.recoveries.push({ source: 'final-recover', startedAt, endedAt: Date.now(), recovery });
                if (pendingVictims().length === 0) {
                    break;
                }
                await sleep(300);
            }
            const commits = [...this.reports.values()].flatMap(report => report.commits).filter(commit => commit.seq !== undefined);
            const log = new Map<number, string>();
            for (const commit of commits) {
                const found = await store.receiptFor(commit.principal, commit.key);
                this.finalKeys = { ...this.finalKeys, checked: this.finalKeys.checked + 1 };
                if (found === undefined) {
                    this.finalKeys = { ...this.finalKeys, missing: this.finalKeys.missing + 1 };
                } else {
                    log.set(found.seq, found.digest);
                    if (found.seq !== commit.seq || found.digest !== commit.digest) {
                        this.finalKeys = { ...this.finalKeys, mismatched: this.finalKeys.mismatched + 1 };
                    }
                }
            }
            this.finalLog = log;
            this.finalHeadSeq = (await store.head())?.seq ?? 0;
            this.chainOk = (await store.verifyChain()).ok;
        } finally {
            await store.close();
        }
        for (const victim of this.victims) {
            const leftovers = (await fs.readdir(this.layout.casStaging)).filter(name => name.startsWith(`${victim.processId}-`));
            if (existsSync(path.join(this.layout.leases, `${victim.processId}.sqlite`)) || leftovers.length > 0) {
                this.victimLeftovers.push(victim.processId);
            }
        }
        this.writeLedger();
    }

    protected allRecoveries(): RecoverySource[] {
        const sources: RecoverySource[] = [...this.recoveries];
        for (const { role, open } of this.opens) {
            sources.push({ source: `${role}-open`, startedAt: open.startedAt, endedAt: open.endedAt, recovery: open.recovery });
        }
        for (const victim of this.victims) {
            sources.push({ source: 'victim-open', startedAt: victim.open.startedAt, endedAt: victim.open.endedAt, recovery: victim.open.recovery });
        }
        for (const recovery of this.reports.get('mcp')?.recoveries ?? []) {
            sources.push({ source: 'mcp-recover', ...recovery });
        }
        return sources;
    }

    protected writeLedger(): void {
        for (const { role, processId, open } of this.opens) {
            this.ledger.append({ row: 'role', role, processId, open });
        }
        for (const [role, report] of this.reports) {
            this.ledger.append({
                row: 'role-report', role, processId: report.processId, commits: report.commits.length, observations: report.observations.length,
                observationErrors: report.observationErrors, histogram: report.histogram, commitLatency: report.commitLatency, advances: report.advances
            });
            for (const commit of report.commits) {
                this.ledger.append({ row: 'commit', role, ...commit });
            }
            for (const observation of report.observations) {
                this.ledger.append({ row: 'observation', role, ...observation });
            }
        }
        for (const victim of this.victims) {
            this.ledger.append({ row: 'victim', ...victim });
        }
        for (const source of this.allRecoveries()) {
            this.ledger.append({ row: 'recovery', ...source });
        }
    }

    criteria(): Record<string, Criterion> {
        const workbench = this.reports.get('workbench');
        const histogram = workbench?.histogram;
        const commits = workbench?.commits ?? [];
        const measuredCommits = commits.filter(commit => commit.measured);
        const l1 = {
            pass: histogram !== undefined && histogram.count > 0 && histogram.p99 < P99_LIMIT_MS,
            gated: true,
            limitMs: P99_LIMIT_MS,
            histogramMs: histogram,
            measuredSeconds: this.options.duration,
            workbenchCommits: commits.length,
            workbenchCommitted: commits.filter(commit => commit.result === 'committed').length,
            writerBusy: commits.filter(commit => commit.result === 'writer-busy').length,
            commitErrors: commits.filter(commit => commit.result === 'error').length,
            measuredCommits: measuredCommits.length,
            commitLatencyMs: workbench?.commitLatency,
            holds: (this.reports.get('cli')?.commits ?? []).filter(commit => commit.result === 'committed').length
        };

        const observed: (ObservationRecord & { role: string })[] = [];
        for (const role of ['workbench', 'mcp'] as const) {
            for (const observation of this.reports.get(role)?.observations ?? []) {
                observed.push({ role, ...observation });
            }
        }
        const log = this.finalLog;
        const phantoms = observed.filter(observation => log?.get(observation.seq) !== observation.digest);
        const observationErrors = [...this.reports.values()].reduce((sum, report) => sum + report.observationErrors, 0);
        const allCommits: CommitRecord[] = [...this.reports.values()].flatMap(report => report.commits);
        const unaccounted = allCommits.filter(commit => commit.result === 'error').length;
        const p1 = {
            pass: log !== undefined && observed.length > 0 && phantoms.length === 0 && this.finalKeys.missing === 0 && this.finalKeys.mismatched === 0
                && log.size === this.finalHeadSeq && unaccounted === 0 && this.chainOk,
            gated: true,
            distinctObserved: observed.length,
            observationSamples: observed.reduce((sum, observation) => sum + observation.count, 0),
            observationErrors,
            phantoms: phantoms.length,
            phantomExamples: phantoms.slice(0, 5).map(observation => ({ role: observation.role, seq: observation.seq, digest: observation.digest })),
            finalHeadSeq: this.finalHeadSeq,
            commitsInLog: log?.size ?? 0,
            receiptsChecked: this.finalKeys.checked,
            receiptsMissing: this.finalKeys.missing,
            receiptsMismatched: this.finalKeys.mismatched,
            commitsWithUnknownOutcome: unaccounted,
            chainOk: this.chainOk
        };

        const victimById = new Map(this.victims.map(victim => [victim.processId, victim]));
        const violations: { source: string; processId: string; reason: string }[] = [];
        const swept = new Set<string>();
        let sweeps = 0;
        for (const source of this.allRecoveries()) {
            for (const id of source.recovery.swept) {
                sweeps++;
                swept.add(id);
                const victim = victimById.get(id);
                if (victim === undefined) {
                    violations.push({ source: source.source, processId: id, reason: 'not a victim' });
                } else if (victim.killIssuedAt > source.endedAt) {
                    violations.push({ source: source.source, processId: id, reason: 'swept before its kill was issued' });
                }
            }
        }
        const unswept = this.victims.filter(victim => !swept.has(victim.processId)).map(victim => victim.processId);
        const r1 = {
            pass: violations.length === 0 && this.victims.length > 0 && unswept.length === 0 && this.victimLeftovers.length === 0,
            gated: true,
            victims: this.victims.length,
            sweeps,
            recoveryReports: this.allRecoveries().length,
            violations: violations.length,
            violationExamples: violations.slice(0, 5),
            victimsUnswept: unswept.length,
            victimLeftovers: this.victimLeftovers.length
        };
        return { L1: l1, P1: p1, R1: r1 };
    }
}
