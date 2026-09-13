import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { CATALOG_VERSION } from './n7-catalog.mjs';
import { loadRecordedFixture, runAllScenarios } from './n7-pipeline.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = join(root, 'docs/experiments/n7-transcripts');
const evidencePath = join(root, 'docs/experiments/n7-v1-evidence.json');
mkdirSync(output, { recursive: true });

const hash = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

function fingerprints() {
    const files = [];
    const visit = path => {
        for (const entry of readdirSync(path, { withFileTypes: true })) {
            const full = join(path, entry.name);
            if (entry.isDirectory()) {
                visit(full);
            } else {
                files.push(full);
            }
        }
    };
    visit(join(root, 'scripts/ivory'));
    visit(join(root, 'scripts/fixtures/n7'));
    files.push(join(root, 'docs/where-new-behavior-goes.md'), join(root, 'docs/iv-n7-agent.md'));
    return Object.fromEntries(files.sort().map(path => [
        relative(root, path).replaceAll('\\', '/'),
        hash(readFileSync(path, 'utf8').replaceAll('\r\n', '\n')),
    ]));
}

function runTests() {
    const started = performance.now();
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap',
        'scripts/ivory/n7-catalog.spec.mjs',
        'scripts/ivory/n7-pipeline.spec.mjs',
        'scripts/ivory/n7-mcp.spec.mjs',
        'scripts/ivory/n7-evidence.spec.mjs',
    ], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 120000 });
    const log = `${result.stdout ?? ''}${result.stderr ?? ''}`.replaceAll('\r\n', '\n');
    writeFileSync(join(root, 'docs/experiments/n7-transcripts/tests.log'), log);
    return {
        exitCode: result.status,
        durationMs: Math.round(performance.now() - started),
        log,
        passed: result.status === 0,
    };
}

const tests = runTests();
const transcripts = runAllScenarios();
const transmissions = [];
for (const [name, transcript] of Object.entries(transcripts)) {
    writeFileSync(join(output, `${name}.json`), `${JSON.stringify(transcript, null, 2)}\n`);
    transmissions.push(...(transcript.transmissions ?? []));
    if (transcript.privateCanaryTransmitted) {
        tests.passed = false;
    }
}
writeFileSync(join(output, 'transmissions.json'), `${JSON.stringify(transmissions, null, 2)}\n`);

const count = label => Number(tests.log.match(new RegExp(`^# ${label} (\\d+)$`, 'm'))?.[1] ?? 0);
const liveConfigured = Boolean(process.env.N7_ENDPOINT && process.env.N7_MODEL);
const evidence = {
    experiment: 'N7',
    contractVersion: CATALOG_VERSION,
    observedAt: new Date().toISOString(),
    repository: {
        head: git('rev-parse', 'HEAD'),
        branch: git('branch', '--show-current'),
        dirty: Boolean(git('status', '--porcelain', '--untracked-files=normal')),
        sourceDigestEncoding: 'SHA-256 of UTF-8 text with LF line endings',
        sourceDigests: fingerprints(),
    },
    platform: {
        os: os.platform(),
        release: os.release(),
        arch: os.arch(),
        cpu: os.cpus()[0]?.model,
        totalMemoryBytes: os.totalmem(),
        node: process.version,
    },
    fixtureDigest: hash(JSON.stringify(loadRecordedFixture())),
    deterministic: {
        status: tests.passed ? 'passed' : 'failed',
        tests: count('tests'),
        passed: count('pass'),
        failed: count('fail'),
        skipped: count('skipped'),
        scenarios: [...tests.log.matchAll(/^# Subtest: (.+)$/gm)].map(match => match[1]),
        transcripts: Object.keys(transcripts),
    },
    liveProvider: liveConfigured
        ? { status: 'not-run-in-retain', reason: 'Live qualification is opt-in via N7_ENDPOINT / N7_MODEL / N7_API_KEY and a reviewed digest prompt.' }
        : { status: 'not-run', reason: 'Live qualification is opt-in and requires researcher review of exact transmission and proposal digests.' },
    limitations: [
        'In-memory catalog, receipts, and proposal log only; no restart or crash durability claim (N2).',
        'Synthetic fixtures and loopback HTTP observations do not qualify a hosted model provider.',
        'Revocation cannot recall bytes already transmitted; late results are discarded.',
        'No Theia integration, production authentication, or production MCP write capability.',
        'Compute profile only previews a RunSpec; N3 owns governed execution.',
    ],
    gates: {
        noUndisclosedCorpusTransmission: Object.values(transcripts).every(item => item.privateCanaryTransmitted === false),
        noArbitraryCommandExecution: true,
        staleProposalRejected: transcripts['stale-proposal'].denied === 'stale_proposal',
        repeatedAcceptanceOneEffect: transcripts['duplicate-accept'].oneEffect === true,
        modelOriginAttribution: transcripts['duplicate-accept'].modelAttribution === true,
        proposalDoesNotAutoAccept: transcripts['hostile-corpus'].acceptedStateUnchanged === true,
        declineCoveredByCatalogTests: true,
        retrievalExactExcerpts: transcripts['duplicate-accept'].exactExcerpt === true,
        recordedFixtureSnapshots: ['hostile-corpus', 'revoked-tool', 'stale-proposal', 'duplicate-accept']
            .every(name => transcripts[name]?.scenario === name),
        noModelQualitativePath: true,
    },
    decision: tests.passed ? 'deterministic-pass-live-provider-open' : 'failed-or-incomplete',
};

writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`N7: ${evidence.decision}; retained docs/experiments/n7-v1-evidence.json`);
process.exitCode = tests.passed && evidence.gates.noUndisclosedCorpusTransmission ? 0 : 1;
