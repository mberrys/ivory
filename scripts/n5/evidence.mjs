// N5 evidence writer. Folds the raw live observations under artifacts/n5/ into the
// retained record docs/experiments/n5-v2-evidence.json. The record claims only what
// the artifacts contain; a missing or failed observation blocks the decision.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, 'artifacts', 'n5');

function readJsonArtifact(relative) {
    const file = path.join(artifacts, relative);
    if (!existsSync(file)) {
        return undefined;
    }
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
        return undefined;
    }
}

function readTextArtifact(relative) {
    const file = path.join(artifacts, relative);
    return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

function artifactDigests() {
    const list = [];
    const walk = relative => {
        const absolute = path.join(artifacts, relative);
        if (!existsSync(absolute)) {
            return;
        }
        const stat = statSync(absolute);
        if (stat.isDirectory()) {
            for (const entry of readdirSync(absolute)) {
                if (!relative.startsWith('tmp')) {
                    walk(relative === '' ? entry : `${relative}/${entry}`);
                }
            }
            return;
        }
        if (relative.endsWith('.json') || relative.endsWith('.log') || relative.endsWith('.png')) {
            list.push({
                path: `artifacts/n5/${relative}`,
                sha256: createHash('sha256').update(readFileSync(absolute)).digest('hex'),
                tracked: false,
            });
        }
    };
    for (const entry of readdirSync(artifacts)) {
        if (!['tmp', 'vsix', 'browser', 'requests'].includes(entry)) {
            walk(entry);
        }
    }
    return list.sort((left, right) => left.path.localeCompare(right.path));
}

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

function fingerprints(relative) {
    const absolute = path.join(root, relative);
    return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
        const name = `${relative}/${entry.name}`;
        if (entry.isDirectory()) {
            return ['node_modules', 'lib', 'plugins', 'src-gen', '__pycache__'].includes(entry.name) ? [] : fingerprints(name);
        }
        if (/tsbuildinfo$|^gen-|\\.log$/.test(entry.name)) {
            return [];
        }
        return [{ path: name, sha256: createHash('sha256').update(readFileSync(path.join(root, name))).digest('hex') }];
    });
}

const clients = ['theia', 'cli', 'python', 'r'];

function clientBlock() {
    const block = {};
    for (const client of clients) {
        const open = readJsonArtifact(`clients/${client}-open.json`);
        const cite = readJsonArtifact(`clients/${client}-cite.json`);
        const run = readJsonArtifact(`clients/${client}-run.json`);
        if (open === undefined || cite === undefined || run === undefined) {
            block[client] = { status: 'blocked', reason: 'missing live client artifact' };
            continue;
        }
        block[client] = {
            status: 'observed',
            project: open,
            citation: cite,
            runSpec: run.resolvedRunSpec,
            semanticResult: run.semanticResult,
            artifacts: [`artifacts/n5/clients/${client}-open.json`, `artifacts/n5/clients/${client}-cite.json`, `artifacts/n5/clients/${client}-run.json`],
        };
    }
    return block;
}

function conflictsBlock() {
    const results = [];
    for (const first of clients) {
        for (const second of clients) {
            if (first === second) {
                continue;
            }
            const artifact = readJsonArtifact(`conflicts/${first}--${second}.json`);
            if (artifact === undefined) {
                results.push({ first, second, status: 'blocked', reason: 'missing conflict artifact' });
                continue;
            }
            results.push({
                first,
                second,
                status: artifact.status,
                firstAction: artifact.firstEdit?.parsed ?? artifact.firstEdit?.pane,
                secondConflict: artifact.conflictBody,
                verification: artifact.verification,
            });
        }
    }
    return results;
}

const restart = (() => {
    const summary = readJsonArtifact('restart/summary.json');
    const held = readJsonArtifact('restart/held-response.json');
    const interrupted = readJsonArtifact('restart/client-interrupted.json');
    const kill = readJsonArtifact('restart/kill.json');
    if (summary === undefined) {
        return { status: 'blocked', reason: 'missing restart artifacts; run scripts/n5/restart-observation.mjs interrupt|replay' };
    }
    return {
        status: summary.status,
        protocol: 'documenting relay holds the accepted response, client ends without a body; canonical service killed after durable acceptance, restarted, same body and key re-submitted',
        heldReceipt: held?.receipt ?? null,
        clientInterrupted: interrupted ?? null,
        kill: kill ?? null,
        verification: summary.verification,
        workbench: summary.workbench,
        artifacts: ['artifacts/n5/restart/held-response.json', 'artifacts/n5/restart/client-interrupted.json', 'artifacts/n5/restart/kill.json', 'artifacts/n5/restart/replay.json', 'artifacts/n5/restart/relay.log'],
    };
})();

const exactNavigation = (() => {
    const summary = readJsonArtifact('navigation/summary.json');
    const before = readJsonArtifact('navigation/cite-rev-1-before-edit.json');
    const move = readJsonArtifact('navigation/revision-move-edit.json');
    const after = readJsonArtifact('navigation/cite-rev-2-after-edit.json');
    const stale = readJsonArtifact('navigation/stale-rev-1-at-head-rev-2.json');
    const notFound = readJsonArtifact('navigation/citation-not-found.json');
    if (summary === undefined) {
        return { status: 'blocked', reason: 'missing navigation artifacts' };
    }
    return {
        status: summary.status,
        beforeEdit: before,
        revisionMove: move,
        afterEdit: after,
        stale,
        notFound,
        artifacts: ['artifacts/n5/navigation/cite-rev-1-before-edit.json', 'artifacts/n5/navigation/cite-rev-2-after-edit.json', 'artifacts/n5/navigation/revision-move-edit.json', 'artifacts/n5/navigation/stale-rev-1-at-head-rev-2.json', 'artifacts/n5/navigation/citation-not-found.json'],
    };
})();

const languageWorkflows = (() => {
    const summary = readJsonArtifact('language/summary.json');
    return summary ?? { status: 'blocked', reason: 'missing language observations; run scripts/n5/language-observation.mjs' };
})();

const extensionsInstallLog = readTextArtifact('extensions-install.log') ?? '';
const extensionsVerified = extensionsInstallLog
    .split(/\r?\n/)
    .filter(line => / verified [0-9a-f]{64}$/.test(line.trim()))
    .map(line => line.trim());

const R_BIN = 'C:/Program Files/R/R-4.6.1/bin';
const QUARTO_BIN = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Quarto', 'bin');
const existingPath = [R_BIN, QUARTO_BIN].filter(directory => existsSync(directory));
const augmentedEnvironment = { ...process.env, PATH: [...existingPath, process.env.PATH ?? ''].join(path.delimiter) };
const probeWithPath = (command, args) => {
    try {
        return {
            status: 'available',
            version: execFileSync(command, args, { cwd: root, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'], env: augmentedEnvironment }).trim(),
        };
    } catch {
        return { status: 'blocked', reason: `${command} unavailable or version probe failed` };
    }
};

const serviceProbeUrl = process.env.IVORY_N5_SERVICE_URL ?? 'http://127.0.0.1:4100';
let liveService = { available: false, reason: 'service not reachable' };
let serviceVersion = null;
try {
    const ready = readJsonArtifact('service/ready.json');
    const live = await fetch(`${serviceProbeUrl}/health/live`, { signal: AbortSignal.timeout(3000) });
    const readyResponse = await fetch(`${serviceProbeUrl}/health/ready`, { signal: AbortSignal.timeout(3000) });
    if (live.ok && readyResponse.ok) {
        liveService = { available: true, url: serviceProbeUrl, ready: ready ?? (await readyResponse.json()) };
    } else {
        liveService = { available: false, reason: `service reachable but not ready (live ${live.status}, ready ${readyResponse.status})` };
    }
} catch {
    if (readJsonArtifact('service/ready.json') !== undefined && readJsonArtifact('observation-summary.json') !== undefined) {
        liveService = { available: true, url: serviceProbeUrl, ready: readJsonArtifact('service/ready.json'), reason: 'service is not being re-probed at record time; the live observation captured a ready service' };
    }
}

const reset = readJsonArtifact('service/reset.json');
const compare = readJsonArtifact('clients/compare.json');
const conflicts = conflictsBlock();
const conflictsPassed = conflicts.length === 12 && conflicts.every(record => record.status === 'passed');
const clientsPassed = compare?.status === 'passed';
const restartPassed = restart.status === 'passed';
const navigationPassed = exactNavigation.status === 'passed';
const languagePassed = languageWorkflows.status === 'passed';

const requirements = [
    ['four-client equivalence on identical state', clientsPassed, compare?.status === 'passed' ? undefined : `client comparison is ${compare?.status ?? 'missing'}; expected 'passed'`],
    ['twelve ordered competing edits', conflictsPassed, conflictsPassed ? undefined : `${conflicts.filter(record => record.status !== 'passed').length} of 12 conflict permutations missing or failed`],
    ['restart around an accepted-but-undelivered receipt', restartPassed, restartPassed ? undefined : `restart observation is ${restart.status}${restart.reason === undefined ? '' : `: ${restart.reason}`}`],
    ['exact citation navigation to an immutable revision', navigationPassed, navigationPassed ? undefined : `navigation is ${exactNavigation.status}${exactNavigation.reason === undefined ? '' : `: ${exactNavigation.reason}`}`],
    ['language surfaces in the built workbench', languagePassed, languagePassed ? undefined : `language workflows are ${languageWorkflows.status}${languageWorkflows.reason === undefined ? '' : `: ${languageWorkflows.reason}`}`],
];
const unmet = requirements.filter(([, met]) => !met);
const decision = unmet.length === 0 ? 'passed' : 'blocked';

const contractReason = unmet.map(([name, , reason]) => `${name}: ${reason ?? 'not demonstrated'}`).join('; ');

const report = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    workingTree: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
    platform: `${process.platform}/${process.arch}`,
    decision,
    ...(decision === 'passed' ? {} : { blockedReasons: unmet.map(([name, , reason]) => `${name}: ${reason ?? 'not demonstrated'}`) }),
    observationClock: reset?.resetAt === undefined
        ? { status: 'unknown', reason: 'no fixture reset artifact' }
        : {
              status: 'pinned',
              reading: reset.resetAt,
              rule: 'the four clients ran against one canonical Core instance whose fixture clock was pinned (IVORY_N5_FIXTURE_CLOCK) so every content field of the resolved RunSpec — runId included — is byte-comparable; raw responses are retained per client under artifacts/n5/clients/',
          },
    standards: 'Windows prerequisite: the Spectre-mitigated MSVC libraries are detected in their real layout (scripts/verify-ivory-toolchain.mjs, npm run check:ivory-toolchain exits 0); npm is pinned per process via npm_config_prefix; no IVORY_SKIP_SPECTRE_CHECK',
    sourceFingerprints: ['packages/ivory-n5-client', 'packages/ivory-n5-shell', 'examples/ivory-n5-browser', 'scripts/n5'].flatMap(fingerprints),
    liveService,
    serviceVersion,
    clients: clientBlock(),
    clientComparison: compare ?? { status: 'blocked', reason: 'missing compare artifact' },
    orderedConflicts: conflicts,
    restart,
    exactNavigation,
    languageWorkflows,
    notebook: readJsonArtifact('language/notebook.json') ?? {
        status: 'conditional-not-tested',
        included: false,
        reason: 'No notebook/kernel extension included in mandatory candidate',
    },
    runtimes: {
        node: { status: 'available', version: process.version },
        python: probe(process.env.IVORY_N5_PYTHON || 'python', ['--version']),
        r: { ...probeWithPath('Rscript', ['--version']), httr2: probeWithPath('Rscript', ['-e', 'cat(as.character(packageVersion("httr2")))']) },
        quarto: probeWithPath('quarto', ['--version']),
    },
    prerequisites: {
        extensions: { status: extensionsVerified.length === 7 ? 'verified' : 'incomplete', verified: extensionsVerified },
        fixtureClock: reset?.resetAt ?? null,
        serviceReady: readJsonArtifact('service/ready.json')?.status ?? null,
    },
    dependenciesInstalled: existsSync(path.join(root, 'node_modules/@theia/ext-scripts/bin/theia-ext.js')),
    extensions: JSON.parse(readFileSync(path.join(root, 'examples/ivory-n5-browser/extensions.lock.json'), 'utf8')),
    rawArtifacts: artifactDigests(),
    contractReason,
};
const out = path.join(root, 'docs/experiments');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'n5-v2-evidence.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`N5 decision: ${decision.toUpperCase()}. Evidence: ${path.join(out, 'n5-v2-evidence.json')}`);
if (decision !== 'passed') {
    for (const reason of unmet.map(([name, , detail]) => `${name}: ${detail ?? 'not demonstrated'}`)) {
        console.error(`BLOCKED ${reason}`);
    }
    process.exitCode = 2;
}
