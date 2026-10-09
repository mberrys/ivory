// Copyright (C) 2026 Michael Berry and others.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [baseline, output] = process.argv.slice(2);
assert(baseline && output, 'usage: node scripts/ivory/record-baseline.mjs <checkout> <record.json>');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const commit = git(baseline, 'rev-parse', 'HEAD');
const dirty = git(baseline, 'status', '--porcelain').length > 0;
const clean = commit === '8b94967c4cfa0dcf688a345d28b3ac2e0d7e298a' && !dirty;
const outcomes = { native: process.env.NATIVE_RESULT, install: process.env.INSTALL_RESULT, build: process.env.BUILD_RESULT };
const failReasons = Object.entries(outcomes).filter(([, outcome]) => outcome !== 'success').map(([name, outcome]) => `${name}:${outcome ?? 'missing'}`);
if (!clean) failReasons.push('baseline-identity-or-dirty-tree');
const lockDigest = hash(readFileSync(path.join(baseline, 'package-lock.json')));
if (lockDigest !== '3b777a78cd3e43f4defcd36886d60ce5e22af8683e90a867aac45329a6eaa6cb') failReasons.push('baseline-lockfile-identity');
const logs = ['p1-baseline-install.log', 'p1-baseline-build.log'].map(name => path.join(path.dirname(output), name)).filter(existsSync);
const workflowPath = '.github/workflows/ivory-boundaries.yml';
const record = {
    record: 'ivory-clean-baseline@1', issue: 'mberrys/ivory-issues#2', gates: ['R0-clean-Theia-baseline'],
    head: { commit, branch: 'dev (pinned upstream baseline)', dirty },
    command: 'sudo apt-get update; sudo apt-get install -y libx11-dev libxkbfile-dev libsecret-1-dev; npm ci; npm run build; git status --porcelain',
    workflow: { path: workflowPath, implementationCommit: git(process.cwd(), 'rev-parse', 'HEAD'),
        blob: git(process.cwd(), 'rev-parse', `HEAD:${workflowPath}`), job: 'clean-theia-baseline',
        definitionRef: process.env.GITHUB_WORKFLOW_REF, definitionCommit: process.env.GITHUB_WORKFLOW_SHA,
        run: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
        attempt: process.env.GITHUB_RUN_ATTEMPT },
    environment: { platform: process.platform, osVersion: os.release(), arch: process.arch, node: process.version,
        npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
        python: execFileSync('python', ['--version'], { encoding: 'utf8' }).trim(),
        machine: process.env.ImageVersion, runnerImage: process.env.ImageOS, runner: process.env.RUNNER_OS,
        filesystem: execFileSync('stat', ['-f', '-c', '%T', baseline], { encoding: 'utf8' }).trim(),
        osRelease: readFileSync('/etc/os-release', 'utf8').trim() },
    fixtures: { 'package-lock.json': lockDigest },
    criteria: { pinnedCleanCheckout: { pass: clean, gated: true },
        install: { pass: outcomes.install === 'success', gated: true },
        compileAndThreeApplicationBundles: { pass: outcomes.build === 'success', gated: true },
        nativePrerequisites: { pass: outcomes.native === 'success', gated: true } },
    outcome: failReasons.length ? 'fail' : 'pass', failReasons,
    logs: logs.map(file => ({ file: path.basename(file), sha256: hash(readFileSync(file)) })),
    limits: ['Build of the pinned upstream Theia source only, not the P1 head or the V5 product.',
        'No installed-product, durability, runtime, cross-platform or dependency-license qualification is claimed.']
};
writeFileSync(output, JSON.stringify(record, null, 2) + '\n');
assert.equal(record.outcome, 'pass', failReasons.join(', '));
console.log(`Clean baseline build passed at ${commit}.`);
