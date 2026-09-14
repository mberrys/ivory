// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import { spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { implementationFingerprints } from './fingerprint.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const output = join(root, 'docs/experiments/n7-evidence');
mkdirSync(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const commands = [];
function run(name, args, extraEnv = {}) {
    const started = performance.now();
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', windowsHide: true,
        maxBuffer: 8 * 1024 * 1024, timeout: 180000, env: { ...process.env, ...extraEnv } });
    const log = ((result.stdout ?? '') + (result.stderr ?? '') + (result.error ? `\n${result.error.message}\n` : '')).replaceAll('\r\n', '\n').replace(/\n+$/, '\n');
    writeFileSync(join(output, `${name}.log`), log);
    const observation = { name, command: ['node', ...args.map(arg => arg.replaceAll(root, '<repo>/'))],
        exitCode: result.status, durationMs: Math.round(performance.now() - started),
        log: `n7-evidence/${name}.log`, logDigest: hash(log), passed: result.status === 0 };
    commands.push(observation);
    process.stdout.write(`${name}: ${observation.passed ? 'PASS' : 'FAIL'}\n`);
    return { ...observation, log };
}
const evidence = {
    experiment: 'N7', contractVersion: 'n7/1', observedAt: new Date().toISOString(),
    repository: { head: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'),
        dirty: Boolean(git('status', '--porcelain', '--untracked-files=normal')), sourceDigestEncoding: 'SHA-256 of UTF-8 text with LF line endings', sourceDigests: implementationFingerprints(root) },
    platform: { os: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model,
        totalMemoryBytes: os.totalmem(), node: process.version,
        typescript: require('typescript/package.json').version,
        mcpSdk: JSON.parse(readFileSync(join(dirname(require.resolve('@modelcontextprotocol/sdk/server/mcp.js')), '../../../package.json'), 'utf8')).version,
        zod: require('zod/package.json').version },
    commands,
    fixtureDigest: hash(readFileSync(join(root, 'packages/ivory-tower-agent-experiment/fixtures/recorded-response.json'))),
    deterministic: { status: 'not-run' }, n1Regression: { status: 'not-run' }, liveProvider: { status: 'not-run' },
    limitations: [
        'In-memory acceptance and receipts only; no restart or crash durability claim.',
        'Synthetic fixtures and local HTTP observations do not qualify a real model provider.',
        'Revocation cannot recall bytes already transmitted; late results are discarded.',
        'No Theia integration, production authentication, arbitrary code sandbox, or production shipping claim.',
        'Source fingerprints identify the tested worktree, including uncommitted changes; HEAD alone is not the implementation identity.',
    ],
    decision: 'partial',
};
let failed = false;
try {
    const build = run('build', ['scripts/n7/build.mjs']);
    if (!build.passed) throw new Error('focused_build_failed');
    writeFileSync(join(output, 'transmissions.json'), '[]\n');
    const testFiles = readdirSync(join(root, 'scripts/n7')).filter(name => name.endsWith('.test.mjs')).sort().map(name => `scripts/n7/${name}`);
    const tests = run('tests', ['--test', '--test-reporter=tap', ...testFiles], { N7_EVIDENCE_DIR: output });
    const count = label => Number(tests.log.match(new RegExp(`^# ${label} (\\d+)$`, 'm'))?.[1] ?? 0);
    evidence.deterministic = { status: tests.passed ? 'passed' : 'failed', tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped'),
        scenarios: [...tests.log.matchAll(/^# Subtest: (.+)$/gm)].map(match => match[1]) };
    if (!count('tests') || count('skipped')) evidence.deterministic.status = 'failed';
    const regression = run('n1-regression', [require.resolve('mocha/bin/mocha.js'), 'packages/ivory-tower-research-kernel/lib/node/research-kernel.spec.js']);
    evidence.n1Regression = { status: regression.passed ? 'passed' : 'failed', passed: Number(regression.log.match(/(\d+) passing/)?.[1] ?? 0) };
    failed = evidence.deterministic.status !== 'passed' || !regression.passed || !evidence.n1Regression.passed;
    if (JSON.parse(readFileSync(join(output, 'transmissions.json'), 'utf8')).length === 0) {
        failed = true;
        evidence.deterministic.status = 'failed';
    }
    if (existsSync(join(output, 'transmissions.json'))) evidence.transmissionEvidence = {
        path: 'n7-evidence/transmissions.json', digest: hash(readFileSync(join(output, 'transmissions.json'))),
    };
    // The retained live-provider run (scripts/n7/live-provider.mjs) is bound by digest like every
    // other raw artifact; a stale or failed run cannot close the live gate. `--live` still runs the
    // attended interactive review and supersedes the retained block when it passes.
    let retainedLivePassed = false;
    const liveRecordPath = 'docs/experiments/n7-live-provider/run.json';
    if (existsSync(join(root, liveRecordPath))) {
        const live = JSON.parse(readFileSync(join(root, liveRecordPath), 'utf8'));
        const baseline = live.implementation?.fingerprints ?? {};
        const current = implementationFingerprints(root);
        const staleFiles = Object.keys(current).filter(file => baseline[file] !== current[file]);
        const evidenceRoot = 'docs/experiments/n7-live-provider/';
        evidence.liveProvider = {
            status: 'run', outcome: live.outcome, observedAt: live.observedAt,
            endpoint: live.endpoint?.kind, model: live.modelIdentity?.served,
            observationSummary: Object.fromEntries((live.observations ?? []).map(observation => [observation.name, observation.passed])),
            retained: {
                record: liveRecordPath, recordDigest: hash(readFileSync(join(root, liveRecordPath))),
                outgoingBody: live.transmission?.file === undefined ? undefined : { path: `${evidenceRoot}${live.transmission.file}`, digest: live.transmission.fileDigest },
                response: live.response?.file === undefined ? undefined : { path: `${evidenceRoot}${live.response.file}`, digest: live.response.digest },
            },
            stale: staleFiles.length > 0, staleFiles,
        };
        retainedLivePassed = live.outcome === 'passed' && staleFiles.length === 0;
        if (live.outcome !== 'passed') failed = true;
        if (staleFiles.length > 0) evidence.liveProvider.note = 'The retained live run predates the current implementation fingerprints; it does not speak for this revision.';
    }
    if (process.argv.includes('--live')) {
        if (!process.env.N7_ENDPOINT || !process.env.N7_MODEL) {
            evidence.liveProvider = { status: 'blocked', reason: 'N7_ENDPOINT and N7_MODEL are required; N7_API_KEY is optional for a local endpoint.' };
            failed = true;
        } else if (failed) {
            evidence.liveProvider = { status: 'blocked', reason: 'Deterministic gates must pass before live transmission.' };
        } else {
            const { review } = await import('./review.mjs');
            evidence.liveProvider = await review({ live: true });
            failed ||= evidence.liveProvider.status !== 'passed';
        }
    } else if (evidence.liveProvider.status !== 'run') {
        evidence.liveProvider = { status: 'not-run', reason: 'Live qualification is opt-in and requires researcher review of exact transmission and proposal digests.' };
    }
    const liveQualified = evidence.liveProvider.status === 'passed' || retainedLivePassed;
    if (liveQualified) {
        evidence.limitations = evidence.limitations.map(limitation => limitation.startsWith('Synthetic fixtures and local HTTP observations')
            ? 'One bounded run against a real local llama.cpp model is retained (docs/experiments/n7-live-provider/run.json); no hosted provider or multi-run qualification is claimed.'
            : limitation);
    }
    evidence.decision = failed ? 'failed-or-incomplete' : liveQualified ? 'bounded-experiment-pass' : 'deterministic-pass-live-provider-open';
} catch (error) {
    failed = true;
    evidence.error = /^[a-z_]+$/.test(error.message) ? error.message : 'qualification_failed';
    evidence.decision = 'failed-or-incomplete';
} finally {
    writeFileSync(join(root, 'docs/experiments/n7-v1-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(`N7: ${evidence.decision}; retained docs/experiments/n7-v1-evidence.json`);
    process.exitCode = failed ? 1 : 0;
}
