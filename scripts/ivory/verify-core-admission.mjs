// Copyright (C) 2026 Michael Berry and others.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const core = path.join(root, 'packages/ivory-core');
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--output') {
    throw new Error('usage: node scripts/ivory/verify-core-admission.mjs --output NEW_FILE.json');
}
const output = path.resolve(args[1]);
const log = output.replace(/\.json$/, '') + '.mocha.json';
const stderrLog = output.replace(/\.json$/, '') + '.stderr.log';
const ledgerFile = output.replace(/\.json$/, '') + '.ledger.jsonl';
for (const file of [output, log, stderrLog, ledgerFile]) {
    if (existsSync(file)) {
        throw new Error('evidence outputs must be new files');
    }
}
const git = (...arguments_) => execFileSync('git', arguments_, { cwd: root });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const head = {
    commit: git('rev-parse', 'HEAD').toString().trim(),
    branch: git('branch', '--show-current').toString().trim(),
    dirty: !!git('status', '--porcelain', '--untracked-files=normal').toString().trim()
};
if (head.dirty) {
    throw new Error('commit the implementation first; qualification requires a clean checkout');
}

const fixturePaths = {
    ownershipAndCli: 'packages/ivory-core/src/node/core-service.spec.ts',
    casFaults: 'packages/ivory-core/src/node/store/cas.spec.ts',
    crashPoints: 'packages/ivory-core/src/node/store/qualification/failpoint.spec.ts'
};
const fixtures = Object.fromEntries(Object.entries(fixturePaths).map(([name, file]) => [name, {
    path: file, sha256: sha256(git('show', 'HEAD:' + file))
}]));
const sourcePaths = git('ls-files', '--', 'packages/ivory-core/src', 'packages/ivory-qualification/src').toString().trim().split('\n');
const sourceDigest = sha256(Buffer.concat(sourcePaths.map(file => Buffer.concat([
    Buffer.from(file + '\0'), git('show', 'HEAD:' + file), Buffer.from('\0')
]))));

function compiledDigest(directory) {
    const files = [];
    function walk(current) {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(absolute);
            } else if (entry.name.endsWith('.js')) {
                files.push(absolute);
            }
        }
    }
    walk(directory);
    return sha256(Buffer.concat(files.sort().flatMap(file => [
        Buffer.from(path.relative(directory, file).split(path.sep).join('/') + '\0'), readFileSync(file), Buffer.from('\0')
    ])));
}

function filesystem() {
    try {
        if (process.platform === 'win32') {
            const drive = /^[A-Za-z]:/.exec(os.tmpdir())?.[0][0];
            if (!drive) {
                return 'unknown';
            }
            return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "(Get-Volume -DriveLetter '" + drive + "').FileSystem"],
                { encoding: 'utf8' }).trim();
        }
        return execFileSync('stat', ['-f', '-c', '%T', os.tmpdir()], { encoding: 'utf8' }).trim();
    } catch {
        return 'unknown';
    }
}

const require = createRequire(import.meta.url);
const testArgs = [require.resolve('mocha/bin/mocha.js'), '--config', '../../configs/mocharc.yml', '--reporter', 'json', './lib/**/*.*spec.js'];
const startedAt = new Date().toISOString();
const run = spawnSync(process.execPath, testArgs, { cwd: core, encoding: 'utf8', timeout: 600_000, maxBuffer: 64 * 1024 * 1024 });
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(log, run.stdout ?? '', { flag: 'wx' });
writeFileSync(stderrLog, run.stderr ?? '', { flag: 'wx' });
let report;
try {
    report = JSON.parse(run.stdout);
} catch {
    report = { tests: [], failures: [], stats: { failures: 1, tests: 0, pending: 0 } };
}
const tests = Array.isArray(report.tests) ? report.tests : [];
const passed = test => test.pending !== true && Object.keys(test.err ?? {}).length === 0;
const groups = {
    writerOwnership: ['holds one OS writer lock', 'refuses a second service', 'racing starters attach'],
    durableAdmission: ['admits before semantic visibility', 'rejects expected digest mismatch', 'never resolves the same digest'],
    corruptedInstallation: ['detects corrupted staging', 'detects a corrupted installation', 'cannot replace a different blob'],
    interruptedAdmission: ['kills the host at duringBlobStage', 'kills the host at beforeBlobInstall', 'kills the host at afterBlobInstall'],
    reconnectAfterHostClose: ['CLI reconnects to the same daemon'],
    authenticatedEpoch: ['authenticates and fences every request']
};
const criteria = Object.fromEntries(Object.entries(groups).map(([name, titles]) => {
    const observed = titles.map(title => tests.filter(test => test.title.startsWith(title)));
    return [name, { gated: true, pass: observed.every(matches => matches.length === 1 && passed(matches[0])),
        expected: titles.length, observed: observed.flat().length, tests: observed.flat().map(test => test.fullTitle) }];
}));
criteria.regressionSuite = { gated: true, pass: run.status === 0 && tests.length > 0 && report.stats?.failures === 0 && report.stats?.pending === 0,
    tests: report.stats?.tests ?? 0, passed: report.stats?.passes ?? 0, failures: report.stats?.failures ?? 1, pending: report.stats?.pending ?? 0 };
const rows = tests.map(test => ({ title: test.fullTitle, pass: passed(test), durationMs: test.duration ?? 0, error: test.err ?? {} }));
const ledgerBytes = Buffer.from(rows.map(row => JSON.stringify(row)).join('\n') + '\n');
writeFileSync(ledgerFile, ledgerBytes, { flag: 'wx' });
const failReasons = Object.entries(criteria).filter(([, criterion]) => !criterion.pass).map(([name]) => 'criterion:' + name);
if (run.error) {
    failReasons.push('runner:' + run.error.message);
}
if (head.commit !== git('rev-parse', 'HEAD').toString().trim() || git('status', '--porcelain', '--untracked-files=normal').toString().trim()) {
    failReasons.push('checkout-changed-during-run');
}
const record = {
    record: 'ivory-p3a-qualification@1', issue: 'mberrys/ivory-issues#4',
    gates: ['P3a-writer', 'P3a-CAS', 'P3a-reconnect'], head,
    command: ['node', 'scripts/ivory/verify-core-admission.mjs', ...args],
    testCommand: [process.execPath, ...testArgs], testWorkingDirectory: core, startedAt, finishedAt: new Date().toISOString(),
    environment: { platform: process.platform, osVersion: os.version(), release: os.release(), arch: process.arch,
        node: process.version, sqlite: process.versions.sqlite ?? 'unknown', filesystem: filesystem(), projectDir: os.tmpdir(),
        machine: process.env.ImageOS ?? process.env.RUNNER_OS ?? os.hostname() },
    fixtures, sources: { sha256: sourceDigest, files: sourcePaths.length,
        archive: JSON.parse(readFileSync(path.join(root, 'docs/ivory/qualification/p3a/source-manifest.json'), 'utf8')) },
    compiledCoreSha256: compiledDigest(path.join(core, 'lib')), criteria,
    outcome: failReasons.length ? 'fail' : 'pass', failReasons,
    ledger: { file: path.basename(ledgerFile), rows: rows.length, sha256: sha256(ledgerBytes) },
    logs: { mocha: { file: path.basename(log), sha256: sha256(Buffer.from(run.stdout ?? '')) },
        stderr: { file: path.basename(stderrLog), sha256: sha256(Buffer.from(run.stderr ?? '')) } },
    limits: [
        'Local filesystem, process kill only; no hardware power-loss, OS-crash, cloud-sync, removable-drive or hosted-storage claim.',
        'The workbench host is a real Node client process standing in for Theia; Theia UI and bundling are not qualified.',
        'The 8 MiB bootstrap transport is a same-user local capability; domain sessions, authorization and streaming remain in P4/P5.',
        'No research revision, accepted-head, migration, outbox or release gate is qualified by this P3a record.',
        'Pinned N2 files are historical reference material, not imported runtime or transferred durability evidence.',
        'Legacy IV5-6 evidence predates the single-owner topology and remains historical.'
    ]
};
writeFileSync(output, JSON.stringify(record, undefined, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ output, outcome: record.outcome, tests: criteria.regressionSuite.tests, failReasons }) + '\n');
process.exitCode = failReasons.length ? 1 : 0;
