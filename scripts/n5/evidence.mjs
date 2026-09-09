import { execFileSync, spawnSync } from 'node:child_process';
import { cpus, totalmem, release } from 'node:os';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function probe(command, args) {
    try {
        return {
            status: 'available',
            version: execFileSync(command, args, { cwd: root, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
        };
    } catch {
        return { status: 'blocked', reason: `${command} unavailable or version probe failed` };
    }
}
const clients = ['theia', 'cli', 'r', 'python'];
const blocked = reason => ({ status: 'blocked', reason });
function fingerprints(relative) {
    const absolute = path.join(root, relative);
    return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
        const name = `${relative}/${entry.name}`;
        if (entry.isDirectory()) {
            return ['node_modules', 'lib', 'plugins', 'src-gen', '__pycache__'].includes(entry.name) ? [] : fingerprints(name);
        }
        if (/tsbuildinfo$|^gen-|\.log$/.test(entry.name)) {
            return [];
        }
        return [
            {
                path: name,
                sha256: createHash('sha256')
                    .update(readFileSync(path.join(root, name)))
                    .digest('hex'),
            },
        ];
    });
}
const contractReason =
    'Qualification protocol pending: client-variety comparisons, 12 ordered edit pairs, restart, exact navigation, and language workflows are not yet executed';

// Probe the live research service (if reachable). The service publishes the
// research contracts, but the 6-step qualification protocol still requires real
// cross-client evidence, so decision stays 'blocked' regardless of availability.
async function probeService(base) {
    const timeout = () => AbortSignal.timeout(3000);
    const post = async (route, body) => {
        const response = await fetch(`${base}${route}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal: timeout(),
        });
        return { ok: response.ok, status: response.status, body: await response.json().catch(() => undefined) };
    };
    try {
        const live = await fetch(`${base}/health/live`, { signal: timeout() });
        const ready = await fetch(`${base}/health/ready`, { signal: timeout() });
        if (!live.ok || !ready.ok) {
            return {
                serviceVersion: null,
                serviceUnavailable: true,
                liveService: { available: false, reason: `service reachable but not ready (live ${live.status}, ready ${ready.status})` },
            };
        }
        const liveBody = await live.json().catch(() => ({}));
        const version = liveBody.version ?? liveBody.serviceVersion ?? liveBody.service ?? null;
        const open = await post('/v1/projects/open', { projectId: 'n5-demo' });
        const project = open.body;
        if (!open.ok || typeof project?.revision !== 'string') {
            return { serviceVersion: version, liveService: { available: false, project: open, reason: 'Project open failed' } };
        }
        const revision = project.revision;
        const citation = await post('/v1/citations/resolve', { projectId: 'n5-demo', revision, citationId: 'cite-research-py' });
        const runSpec = await post('/v1/runspecs/resolve', { projectId: 'n5-demo', revision });
        const liveService = { available: citation.ok && runSpec.ok, responses: { open, citation, runSpec } };
        if (project !== undefined) {
            liveService.project = project;
        }
        if (citation.body !== undefined) {
            liveService.citation = citation.body;
        }
        if (runSpec.body !== undefined) {
            liveService.runSpec = runSpec.body;
        }
        if (runSpec.body?.semanticResult !== undefined) {
            liveService.semanticResult = runSpec.body.semanticResult;
        }
        return { serviceVersion: version, liveService };
    } catch {
        return { serviceVersion: null, serviceUnavailable: true, liveService: { available: false, reason: 'service not reachable' } };
    }
}

const serviceProbe = await probeService(process.env.IVORY_N5_SERVICE_URL ?? 'http://127.0.0.1:4100');
const contractCommand = ['--test', 'scripts/n5/v2-contract.test.mjs', 'scripts/n5/compare.test.mjs'];
const started = performance.now();
const contractRun = spawnSync(process.execPath, contractCommand, { cwd: root, encoding: 'utf8', timeout: 60000 });
const report = {
    schemaVersion: 2,
    experimentVersion: 'n5-architecture-v2',
    command: 'node scripts/n5/evidence.mjs',
    configuration: { serviceOrigin: process.env.IVORY_N5_SERVICE_URL ?? 'http://127.0.0.1:4100' },
    machine: { osRelease: release(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem() },
    contractEvidence: {
        scope: 'Core fixture contracts only; no live client or durability qualification',
        command: ['node', ...contractCommand].join(' '),
        elapsedMs: performance.now() - started,
        status: contractRun.status === 0 ? 'passed' : 'failed',
        exitCode: contractRun.status,
        stdout: contractRun.stdout,
        stderr: contractRun.stderr,
        error: contractRun.error?.message,
    },
    capturedAt: new Date().toISOString(),
    baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    workingTree: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
    platform: `${process.platform}/${process.arch}`,
    decision: 'blocked',
    sourceFingerprints: [
        'packages/ivory-n5-client',
        'packages/ivory-n5-shell',
        'examples/ivory-n5-browser',
        'scripts/n5',
        'packages/ivory-tower-infrastructure/src',
        'packages/ivory-tower-api/src',
        'packages/ivory-tower-contracts/src',
    ].flatMap(fingerprints),
    ...serviceProbe,
    prerequisite: blocked(contractReason),
    clients: Object.fromEntries(
        clients.map(client => [
            client,
            Object.fromEntries(['project', 'citation', 'runSpec', 'semanticResult'].map(test => [test, blocked(contractReason)])),
        ]),
    ),
    orderedConflicts: clients.flatMap(first =>
        clients.filter(second => second !== first).map(second => ({ first, second, ...blocked(contractReason) })),
    ),
    restart: blocked('Requires canonical service and writer/process evidence; transport unit tests are not restart qualification'),
    exactNavigation: blocked(contractReason),
    languageWorkflows: blocked('Requires built application, activated extensions, and observed editor behaviors'),
    notebook: { status: 'conditional-not-tested', included: false, reason: 'No notebook/kernel extension included in mandatory candidate' },
    runtimes: {
        node: { status: 'available', version: process.version },
        python: probe(process.env.IVORY_N5_PYTHON || 'python', ['--version']),
        r: probe('Rscript', ['--version']),
        quarto: probe('quarto', ['--version']),
    },
    dependenciesInstalled: existsSync(path.join(root, 'node_modules/@theia/ext-scripts/bin/theia-ext.js')),
    extensions: JSON.parse(readFileSync(path.join(root, 'examples/ivory-n5-browser/extensions.lock.json'), 'utf8')),
};
const out = path.join(root, 'artifacts/n5');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`N5 decision: BLOCKED. Evidence: ${path.join(out, 'evidence.json')}`);
process.exitCode = 2;
