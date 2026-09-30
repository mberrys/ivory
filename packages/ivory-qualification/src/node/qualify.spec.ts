// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { createHash } from 'crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EvidenceRecord } from './evidence';
import { evaluateKillRow, KillObservation } from './kill/kill-row';
import { runCli } from './qualify';
import { deterministicBytes, Workload } from './seeded-random';

const RECORD_FIELDS = [
    'record', 'issue', 'gates', 'kind', 'head', 'command', 'startedAt', 'finishedAt', 'elapsedMs', 'environment', 'config', 'configDigest', 'fixtures',
    'ledger', 'criteria', 'outcome', 'failReasons', 'limits'
];
const ENVIRONMENT_FIELDS = [
    'platform', 'osVersion', 'release', 'arch', 'cpuModel', 'cpuCount', 'memoryBytes', 'node', 'sqlite', 'filesystem', 'projectDir'
];

describe('qualification harness', function (): void {
    // Each run forks a child host per cycle, and every cycle opens the store, so the smoke runs take a while.
    this.timeout(180000);

    const directories: string[] = [];
    afterEach(() => {
        for (const directory of directories.splice(0)) {
            rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
        }
    });

    function outDir(): string {
        const directory = mkdtempSync(path.join(os.tmpdir(), 'ivory-qual-out-'));
        directories.push(directory);
        return directory;
    }

    function readRecord(out: string, file: string): { record: EvidenceRecord; ledgerRows: Record<string, unknown>[] } {
        const record = JSON.parse(readFileSync(path.join(out, file), 'utf8')) as EvidenceRecord;
        const ledgerBytes = readFileSync(path.join(out, record.ledger.file));
        const ledgerRows = ledgerBytes.toString('utf8').trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);
        expect(record.ledger.rows, 'the record counts the ledger rows').to.equal(ledgerRows.length);
        expect(record.ledger.sha256, 'the record digests the final ledger bytes').to.equal(createHash('sha256').update(ledgerBytes).digest('hex'));
        return { record, ledgerRows };
    }

    /** An evidence run needs a clean tree. The specs run on a dirty one too, where the record must say so and fail. */
    function expectOutcome(record: EvidenceRecord, exitCode: number): void {
        for (const field of RECORD_FIELDS) {
            expect(record, field).to.have.property(field);
        }
        for (const field of ENVIRONMENT_FIELDS) {
            expect(record.environment, field).to.have.property(field);
        }
        expect(record.record).to.equal('ivory-qualification@1');
        expect(record.issue).to.equal('IV5-6');
        expect(record.gates).to.deep.equal(['N2', 'J7']);
        expect(record.head.commit).to.match(/^[0-9a-f]{40}$|^unknown$/);
        expect(record.fixtures.harnessDigest).to.match(/^[0-9a-f]{64}$/);
        expect(record.fixtures.coreDigest).to.match(/^[0-9a-f]{64}$/);
        expect(record.configDigest).to.match(/^sha256:[0-9a-f]{64}$/);
        expect(record.environment.sqlite).to.match(/^3\./);
        expect(record.limits.join(' ')).to.contain('process kill only');
        const gatedFailures = Object.values(record.criteria).filter(criterion => criterion.gated && !criterion.pass);
        expect(gatedFailures, 'no gated criterion failed').to.be.empty;
        expect(record.failReasons).to.deep.equal(record.head.dirty ? ['dirty-tree'] : []);
        expect(record.outcome).to.equal(record.head.dirty ? 'fail' : 'pass');
        expect(exitCode).to.equal(record.head.dirty ? 1 : 0);
    }

    for (const synchronous of ['FULL', 'OFF'] as const) {
        it(`kill: 2 cycles at each of the six points with synchronous=${synchronous}`, async () => {
            const out = outDir();
            const code = await runCli(['kill', '--out', out, '--cycles', '2', '--synchronous', synchronous, '--seed', '7', '--allow-dirty']);
            const { record, ledgerRows } = readRecord(out, `kill-${process.platform}-${synchronous}.json`);
            expectOutcome(record, code);
            expect(record.kind).to.equal('kill');
            expect(record.config).to.deep.include({ cycles: 2, synchronous, seed: 7 });
            const name = synchronous === 'FULL' ? 'K1' : 'K0';
            expect(Object.keys(record.criteria).sort()).to.deep.equal([name, 'P1', 'R1']);
            const k = record.criteria[name];
            expect(k.gated, 'K0 is recorded, not gated').to.equal(synchronous === 'FULL');
            expect(k).to.deep.include({ pass: true, rows: 12, rowsFailed: 0, lostAcknowledged: 0, pointsComplete: true, synchronous });
            expect(ledgerRows).to.have.length(12);
            expect(ledgerRows.every(row => row.pass === true && row.row === 'cycle')).to.be.true;
            expect(ledgerRows.filter(row => row.point === 'afterDbCommit').every(row => row.durableBeforeRetry === true)).to.be.true;
            expect(ledgerRows.filter(row => ['duringBlobStage', 'beforeBlobInstall', 'afterBlobInstall', 'beforeDbCommit'].includes(row.point as string))
                .every(row => row.durableBeforeRetry === false)).to.be.true;
            expect(record.criteria.P1.phantoms).to.equal(0);
            expect(record.criteria.R1.sweptNotYetExited).to.equal(0);
        });
    }

    it('latency: an 8 second run', async () => {
        const out = outDir();
        const code = await runCli(['latency', '--out', out, '--duration', '8', '--warmup', '1', '--victim-interval', '2', '--seed', '7', '--allow-dirty']);
        const { record, ledgerRows } = readRecord(out, `latency-${process.platform}-FULL.json`);
        expectOutcome(record, code);
        expect(record.kind).to.equal('latency');
        expect(Object.keys(record.criteria).sort()).to.deep.equal(['L1', 'P1', 'R1']);
        expect(record.criteria.L1.pass).to.be.true;
        expect(record.criteria.L1.writerBusy).to.be.a('number');
        expect(record.criteria.L1.workbenchCommits).to.be.greaterThan(0);
        expect(record.criteria.R1.victims).to.be.greaterThan(0);
        expect(ledgerRows.filter(row => row.row === 'victim').length).to.equal(record.criteria.R1.victims);
    });

    describe('exit codes', () => {

        const wrongCommandLines = async (out: string): Promise<void> => {
            expect(await runCli([])).to.equal(2);
            expect(await runCli(['bogus'])).to.equal(2);
            expect(await runCli(['kill'])).to.equal(2);
            expect(await runCli(['kill', '--out', out, '--points', 'nowhere'])).to.equal(2);
            expect(await runCli(['kill', '--out', out, '--synchronous', 'NORMAL'])).to.equal(2);
            expect(await runCli(['kill', '--out', out, '--cycles', '0'])).to.equal(2);
            expect(await runCli(['latency', '--out', out, '--whatever', '1'])).to.equal(2);
        };

        it('exits 2 for a command line that is wrong, and writes no record', async () => {
            const out = outDir();
            // The usage text would drown the report of the run.
            const write = process.stderr.write;
            process.stderr.write = (() => true) as typeof process.stderr.write;
            try {
                await wrongCommandLines(out);
            } finally {
                process.stderr.write = write;
            }
            expect(readdirSync(out)).to.be.empty;
        });
    });

    describe('workload', () => {

        it('makes the same bytes for the same seed and key, 1 to 64 KiB of them, and reuses the bytes of step i-3 every 5th step', () => {
            const bytes = deterministicBytes(1, 'c0-0');
            expect(bytes.equals(deterministicBytes(1, 'c0-0'))).to.be.true;
            expect(bytes.equals(deterministicBytes(2, 'c0-0'))).to.be.false;
            for (let i = 0; i < 40; i++) {
                const size = deterministicBytes(1, `c0-${i}`).length;
                expect(size).to.be.within(1024, 64 * 1024);
            }
            expect(Workload.bytes(1, 3, 4).equals(Workload.bytes(1, 3, 1))).to.be.true;
            expect(Workload.bytes(1, 3, 3).equals(Workload.bytes(1, 3, 0))).to.be.false;
            expect(Workload.indexOf(12, Workload.key(12, 7))).to.equal(7);
        });
    });

    describe('cycle rules', () => {

        const passing = (overrides: Partial<KillObservation> = {}): KillObservation => ({
            cycle: 0,
            point: 'beforeDbCommit',
            crashPoint: 'C3',
            childPid: 1,
            childProcessId: 'child',
            exit: { code: 1, signal: undefined },
            markerSeen: true,
            markerMatches: true,
            childExitedEarly: false,
            intents: 3,
            acked: 2,
            inflightKey: 'c0-2',
            intentAckMismatch: false,
            stagingBefore: 0,
            leaseBefore: true,
            openRecovery: { swept: ['child'], skippedAlive: [], malformed: [], deferred: [] },
            sweptChild: true,
            sweptUnknown: [],
            observerSwept: false,
            observerSkipped: true,
            stagingAfter: 0,
            leaseAfter: false,
            committedBefore: 0,
            expectedHeadAtReopen: 2,
            headAtReopen: 2,
            lostAcknowledged: 0,
            lostKeys: [],
            expectedDurable: false,
            durableBeforeRetry: false,
            inflightBlobOnDisk: false,
            retry: { replayed: false, seq: 3, digest: 'sha256:x' },
            receiptsForInflight: 1,
            receiptStable: true,
            expectedHeadAfterRetry: 3,
            headAfterRetry: 3,
            blobsChecked: 3,
            blobProblems: [],
            fullCheck: false,
            timingsMs: { total: 1, ready: 1, kill: 1, reopen: 1, checks: 1 },
            ...overrides
        });

        it('passes a cycle that behaved', () => {
            expect(evaluateKillRow(passing())).to.be.empty;
        });

        it('fails a cycle for each rule it breaks', () => {
            const failures = (overrides: Partial<KillObservation>): string[] => evaluateKillRow(passing(overrides));
            expect(failures({ lostAcknowledged: 1 })).to.include('lost-acknowledged');
            expect(failures({ durableBeforeRetry: true, retry: { replayed: true } })).to.include('durable-expectation');
            expect(failures({ retry: { replayed: true } })).to.include('retry-replay-mismatch');
            expect(failures({ retry: { refusal: { code: 'x' } } })).to.include('retry-refused');
            expect(failures({ sweptChild: false })).to.include('child-not-swept');
            expect(failures({ sweptUnknown: ['other'] })).to.include('swept-a-live-lease');
            expect(failures({ stagingAfter: 1 })).to.include('child-leftovers');
            expect(failures({ headAtReopen: 3 })).to.include('head-mismatch-at-reopen');
            expect(failures({ receiptsForInflight: 2 })).to.include('receipt-count');
            expect(failures({ markerSeen: false, markerMatches: false })).to.include('failpoint-not-reached');
            expect(failures({ fullCheck: true, chain: { ok: false, problems: 1, keysChecked: 1, headSeq: 1 } })).to.include('chain-not-ok');
            expect(failures({ point: 'beforeBlobInstall', stagingBefore: 0 })).to.include('c1-staging-missing');
            expect(failures({ point: 'duringBlobStage', stagingBefore: 1 })).to.not.include('c1-staging-missing');
            expect(failures({ point: 'afterBlobInstall', inflightBlobOnDisk: false })).to.include('c2-orphan-missing');
            expect(failures({ point: 'afterBlobInstall', inflightBlobOnDisk: true })).to.not.include('c2-orphan-missing');
            expect(failures({ point: 'random', markerSeen: false, expectedDurable: 'either', durableBeforeRetry: true, retry: { replayed: true } })).to.be.empty;
        });
    });
});
