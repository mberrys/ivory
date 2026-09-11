#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    N3PublicationStore,
    canonicalIntentDigest,
    runProtocolFaultMatrix,
    sha256,
} from './n3-protocol.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURE_ROOT = path.join(ROOT, 'scripts', 'fixtures', 'n3');
const ARTIFACT_ROOT = path.join(ROOT, 'artifacts', 'n3');
const dockerCommand = process.platform === 'win32' ? 'docker.exe' : 'docker';
const OUTPUT_LIMIT_BYTES = 64 * 1024;
const RESULT_LIMIT_BYTES = 64 * 1024;
const RUN_TIMEOUT_MS = 30_000;
export const N3_EXPERIMENT_VERSION = '2.0';
export const N3_RESULT_CONTRACT_VERSION = 'n3-result-v1';
const N3_RESULT_KEYS = ['mean', 'rowCount', 'sum'];
const N3_CONTAINER_CONFIGURATION = Object.freeze({
    networkMode: 'none',
    readOnlyRootfs: true,
    user: '65532:65532',
    capDrop: ['ALL'],
    securityOpt: ['no-new-privileges:true'],
    pidsLimit: 64,
    memoryBytes: 256 * 1024 * 1024,
    nanoCpus: 1_000_000_000,
    nofile: 256,
    fsize: 1024,
    inputMount: '/var/tmp',
    outputMount: '/tmp',
    tmpfs: '/dev/shm:rw,noexec,nosuid,size=16m',
});

function argumentValue(name) {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

function requireDigestImage(image, option) {
    if (image === undefined || !/@sha256:[a-f0-9]{64}$/u.test(image)) {
        throw new Error(`${option} must name an immutable OCI image with an @sha256 digest.`);
    }
    return image;
}

function docker(args, options = {}) {
    return execFileSync(dockerCommand, args, { cwd: ROOT, encoding: 'utf8', stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'] });
}

function dockerAvailable() {
    try {
        const serverVersion = docker(['info', '--format', '{{.ServerVersion}}']).trim();
        return /^\d+(?:\.\d+){1,2}(?:[-+].*)?$/u.test(serverVersion);
    } catch {
        return false;
    }
}

function currentGitCommit() {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return undefined;
    }
}

function dockerVersion() {
    try {
        const version = JSON.parse(docker(['version', '--format', '{{json .}}']));
        return {
            client: version.Client === undefined || version.Client === null ? undefined : {
                version: version.Client.Version,
                apiVersion: version.Client.ApiVersion,
                os: version.Client.Os,
                arch: version.Client.Arch,
            },
            server: version.Server === undefined || version.Server === null ? undefined : {
                version: version.Server.Version,
                apiVersion: version.Server.ApiVersion,
                os: version.Server.Os,
                arch: version.Server.Arch,
            },
        };
    } catch {
        return undefined;
    }
}

function platformEvidence() {
    const cpus = os.cpus();
    return {
        platform: process.platform,
        arch: process.arch,
        release: os.release(),
        version: os.version(),
        cpuModel: cpus[0]?.model,
        cpuCount: cpus.length,
        totalMemoryBytes: os.totalmem(),
        nodeVersion: process.version,
    };
}

function invocationEvidence() {
    return {
        executable: process.execPath,
        script: path.relative(ROOT, process.argv[1] ?? fileURLToPath(import.meta.url)).replaceAll(path.sep, '/'),
        arguments: process.argv.slice(2),
    };
}

function relativeArtifactPath(artifactRoot, target) {
    return path.relative(artifactRoot, target).replaceAll(path.sep, '/');
}

async function writeRawArtifact(artifactRoot, name, content) {
    const target = path.join(artifactRoot, name);
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
    return {
        path: relativeArtifactPath(artifactRoot, target),
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
    };
}

async function runContainer({ name, image, language, mode, inputDirectory, outputDirectory }) {
    const scriptName = language === 'python' ? 'compute.py' : 'compute.R';
    const command = language === 'python' ? ['python', `/var/tmp/${scriptName}`, mode === 'hostile' ? '--hostile' : ''] : ['Rscript', `/var/tmp/${scriptName}`];
    const args = [
        'run',
        '--name', name,
        '--network', 'none',
        '--read-only',
        '--cap-drop', 'ALL',
        '--security-opt', 'no-new-privileges:true',
        '--user', '65532:65532',
        '--pids-limit', String(N3_CONTAINER_CONFIGURATION.pidsLimit),
        '--memory', '256m',
        '--cpus', '1',
        '--ulimit', `nofile=${N3_CONTAINER_CONFIGURATION.nofile}:${N3_CONTAINER_CONFIGURATION.nofile}`,
        '--ulimit', `fsize=${N3_CONTAINER_CONFIGURATION.fsize}:${N3_CONTAINER_CONFIGURATION.fsize}`,
        '--mount', `type=bind,src=${inputDirectory},dst=/var/tmp,readonly`,
        '--mount', `type=bind,src=${outputDirectory},dst=/tmp`,
        '--tmpfs', N3_CONTAINER_CONFIGURATION.tmpfs,
        image,
        ...command.filter(Boolean),
    ];
    const startedAt = Date.now();
    const child = spawn(dockerCommand, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let capturedBytes = 0;
    let outputLimit = false;
    let stopRequested = false;
    let stopReason;
    let inspect;
    const inspectContainer = () => {
        try {
            return JSON.parse(docker(['inspect', name]));
        } catch {
            return undefined;
        }
    };
    let afterStopInspect;
    const stopContainer = reason => {
        if (stopRequested) {
            return;
        }
        stopRequested = true;
        stopReason = reason;
        try {
            docker(['kill', name], { stdio: 'ignore' });
        } catch {
            // The container may already have exited; the inspection below is the observation.
        }
        afterStopInspect ??= inspectContainer();
    };
    const removeContainer = () => {
        try {
            docker(['rm', '-f', name], { stdio: 'ignore' });
        } catch {
            // The container may already have been removed by a previous cleanup attempt.
        }
    };
    const capture = (target, chunk) => {
        capturedBytes += chunk.byteLength;
        if (capturedBytes > OUTPUT_LIMIT_BYTES) {
            outputLimit = true;
            inspect ??= inspectContainer();
            stopContainer('output-limit');
            return;
        }
        if (target === 'stdout') {
            stdout += chunk.toString();
        } else {
            stderr += chunk.toString();
        }
    };
    child.stdout.on('data', chunk => capture('stdout', chunk));
    child.stderr.on('data', chunk => capture('stderr', chunk));
    const timeout = setTimeout(() => stopContainer('timeout'), RUN_TIMEOUT_MS);
    const exitCode = await new Promise(resolve => child.once('close', resolve));
    clearTimeout(timeout);
    inspect ??= inspectContainer();
    stopContainer('normal-exit');
    afterStopInspect ??= inspectContainer();
    removeContainer();
    const hostConfig = inspect?.[0]?.HostConfig;
    return {
        exitCode,
        elapsedMs: Date.now() - startedAt,
        stdout,
        stderr,
        outputLimit,
        stopReason,
        timedOut: stopReason === 'timeout',
        childProcessesTerminated: terminationObserved({ beforeStop: inspect?.[0], afterStop: afterStopInspect?.[0] }),
        termination: {
            stopReason,
            beforeStop: inspect?.[0]?.State,
            afterStop: afterStopInspect?.[0]?.State,
        },
        controls: hostConfig === undefined ? undefined : {
            networkMode: hostConfig.NetworkMode,
            readOnlyRootfs: hostConfig.ReadonlyRootfs,
            privileged: hostConfig.Privileged,
            user: inspect[0].Config.User,
            capDrop: hostConfig.CapDrop,
            securityOpt: hostConfig.SecurityOpt,
            pidsLimit: hostConfig.PidsLimit,
            memoryBytes: hostConfig.Memory,
            nanoCpus: hostConfig.NanoCpus,
            ulimits: hostConfig.Ulimits,
            tmpfs: hostConfig.Tmpfs,
            mounts: inspect[0].Mounts,
        },
    };
}

function controlsAreEnforced(controls) {
    const inputMount = controls?.mounts?.find(mount => mount.Destination === '/var/tmp');
    const outputMount = controls?.mounts?.find(mount => mount.Destination === '/tmp');
    const inputReadOnly = inputMount?.RW === false || inputMount?.ReadOnly === true;
    const outputWritable = outputMount?.RW === true && outputMount?.ReadOnly !== true;
    const tmpfs = controls?.tmpfs?.['/dev/shm'];
    const nofile = controls?.ulimits?.find(limit => limit.Name === 'nofile');
    const fsize = controls?.ulimits?.find(limit => limit.Name === 'fsize');
    return controls?.networkMode === 'none'
        && controls.readOnlyRootfs === true
        && controls.user === '65532:65532'
        && controls.capDrop?.includes('ALL')
        && controls.securityOpt?.includes('no-new-privileges:true')
        && controls.pidsLimit === 64
        && controls.memoryBytes === 256 * 1024 * 1024
        && controls.nanoCpus === 1_000_000_000
        && nofile?.Soft === 256
        && nofile?.Hard === 256
        && fsize?.Soft === 1024
        && fsize?.Hard === 1024
        && inputReadOnly
        && outputWritable
        && typeof tmpfs === 'string'
        && tmpfs.includes('noexec')
        && tmpfs.includes('nosuid');
}

export function minimalMountSurface(controls) {
    const mounts = controls?.mounts;
    if (!Array.isArray(mounts) || mounts.length !== 2) {
        return false;
    }
    const byDestination = new Map(mounts.map(mount => [mount.Destination, mount]));
    if (byDestination.size !== mounts.length) {
        return false;
    }
    const readOnly = mount => mount?.RW === false || mount?.ReadOnly === true;
    const writable = mount => mount?.RW === true && mount?.ReadOnly !== true;
    return byDestination.has(N3_CONTAINER_CONFIGURATION.inputMount)
        && byDestination.has(N3_CONTAINER_CONFIGURATION.outputMount)
        && readOnly(byDestination.get(N3_CONTAINER_CONFIGURATION.inputMount))
        && writable(byDestination.get(N3_CONTAINER_CONFIGURATION.outputMount));
}

export function noPrivilegedEscalation(controls) {
    if (controls === undefined || controls === null) {
        return false;
    }
    const socketDestinations = new Set(['/var/run/docker.sock', '/run/docker.sock', '/var/run/docker.sock.raw']);
    const mountsSocket = (controls.mounts ?? []).some(mount => socketDestinations.has(mount.Destination));
    return controls.privileged === false
        && controls.capDrop?.includes('ALL') === true
        && controls.securityOpt?.includes('no-new-privileges:true') === true
        && controls.user === N3_CONTAINER_CONFIGURATION.user
        && mountsSocket === false;
}

export function terminationObserved(snapshots) {
    const afterStop = snapshots?.afterStop;
    if (afterStop === undefined || afterStop === null) {
        return false;
    }
    return afterStop.State?.Running === false && afterStop.State?.Pid === 0;
}

const REQUIRED_CANARY_BASES = Object.freeze({
    'canonical-file-write': ['read-only-filesystem', 'permission-denied', 'operation-not-permitted'],
    'path-symlink-escape': ['read-only-filesystem', 'permission-denied', 'operation-not-permitted'],
    'network-egress': ['network-unreachable', 'network-down', 'host-unreachable'],
});
// Escape probes are recorded, not scored for enforcement: whether they are
// refused by a control or simply unreachable is an observation, and both must
// appear with an explicit basis rather than a bare "denied".
const ESCAPE_PROBES = Object.freeze(['host-home-read', 'process-escape']);
const EXPLICIT_CANARY_BASES = new Set([
    ...Object.values(REQUIRED_CANARY_BASES).flat(),
    'absence',
]);

export function canaryOutcome(canaries) {
    const byName = new Map((canaries ?? []).map(canary => [canary.name, canary]));
    const missing = Object.keys(REQUIRED_CANARY_BASES).filter(name => !byName.has(name));
    const observed = Object.entries(REQUIRED_CANARY_BASES).map(([name, bases]) => {
        const canary = byName.get(name);
        return {
            name,
            denied: canary?.denied === true,
            basis: canary?.basis,
            enforced: canary?.denied === true && bases.includes(canary.basis) === true,
        };
    });
    const escapeProbesRecorded = ESCAPE_PROBES.every(name => {
        const canary = byName.get(name);
        return canary?.denied === true && EXPLICIT_CANARY_BASES.has(canary.basis);
    });
    return {
        requiredEnforced: missing.length === 0 && observed.every(entry => entry.enforced),
        escapeProbesRecorded,
        missing,
        observed,
    };
}

export function parseN3Result(bytes) {
    if (bytes.byteLength === 0 || bytes.byteLength > RESULT_LIMIT_BYTES) {
        throw new Error('N3 result is empty or exceeds the result-size limit.');
    }
    let result;
    try {
        result = JSON.parse(bytes.toString('utf8'));
    } catch {
        throw new Error('N3 result is not valid JSON.');
    }
    if (result === null || typeof result !== 'object' || Array.isArray(result)) {
        throw new Error('N3 result must be a JSON object.');
    }
    if (Object.keys(result).sort().join(',') !== N3_RESULT_KEYS.join(',')) {
        throw new Error('N3 result does not match the declared result contract.');
    }
    if (!Number.isInteger(result.rowCount) || result.rowCount < 0
        || !Number.isFinite(result.sum) || !Number.isFinite(result.mean)) {
        throw new Error('N3 result contains an invalid numeric value.');
    }
    return result;
}

export async function readN3Result(outputDirectory) {
    const resultPath = path.join(outputDirectory, 'result.json');
    const metadata = await fs.lstat(resultPath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
        throw new Error('N3 result must be a single regular file, not a link or special file.');
    }
    if (metadata.size > RESULT_LIMIT_BYTES) {
        throw new Error('N3 result exceeds the result-size limit.');
    }
    const bytes = await fs.readFile(resultPath);
    return { bytes, result: parseN3Result(bytes) };
}

export function requiredAcceptanceFailures(acceptance) {
    return Object.entries(acceptance ?? {})
        .filter(([, value]) => value === false)
        .map(([name]) => name);
}

export async function writeEvidence(evidence, artifactRoot = ARTIFACT_ROOT) {
    await fs.mkdir(artifactRoot, { recursive: true });
    const languageSuffix = evidence.language === undefined ? 'protocol' : evidence.language;
    await fs.writeFile(path.join(artifactRoot, `evidence-${languageSuffix}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
    await fs.writeFile(path.join(artifactRoot, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
}

function protocolAcceptance(protocol) {
    const lifecycle = protocol.filter(result => result.boundary !== 'cancellation-publication-race');
    const afterArtifact = protocol.find(result => result.boundary === 'after-artifact');
    const cancellation = protocol.find(result => result.boundary === 'cancellation-publication-race');
    return {
        protocolLifecycleReopened: lifecycle.length > 0 && lifecycle.every(result =>
            result.isolated === true
            && result.reopened === true
            && result.workerExited === true
            && (result.boundary === 'before-create' || result.workerAbruptExit === true)),
        publicationRecoveryAfterRestart: afterArtifact?.status === 'succeeded' && afterArtifact.artifactCount === 1,
        cancellationPublicationFenced: cancellation?.status === 'cancelled'
            && cancellation.latePublicationRejected === true
            && cancellation.terminalOutcome === 'cancelled',
    };
}

function acceptanceCriteria(acceptance) {
    return Object.fromEntries(Object.entries(acceptance ?? {}).map(([id, observed]) => [id, {
        required: observed !== null,
        observed,
        pass: observed === null ? null : observed === true,
    }]));
}

async function fixtureEvidence() {
    const files = {
        input: 'input.csv',
        python: 'compute.py',
        r: 'compute.R',
    };
    const entries = {};
    for (const [name, file] of Object.entries(files)) {
        const bytes = await fs.readFile(path.join(FIXTURE_ROOT, file));
        entries[name] = {
            path: path.relative(ROOT, path.join(FIXTURE_ROOT, file)).replaceAll(path.sep, '/'),
            bytes: bytes.byteLength,
            sha256: sha256(bytes),
        };
    }
    return entries;
}

function protocolDecision() {
    return {
        status: 'semantic-protocol-pass-runtime-open',
        decision: 'Retain the semantic execution protocol and keep isolation behind a replaceable runtime adapter.',
        limitations: [
            'Protocol evidence does not select a supported operating system or production isolation profile.',
            'OCI runtime qualification requires real hostile canaries, runtime inspection, and language repeats.',
        ],
    };
}

export async function completeN3Verification(evidence, {
    artifactRoot = ARTIFACT_ROOT,
    log = console.log,
    error = console.error,
} = {}) {
    await writeEvidence(evidence, artifactRoot);
    log(JSON.stringify(evidence, null, 2));
    const failures = requiredAcceptanceFailures(evidence.acceptance);
    if (failures.length > 0) {
        error(`N3 verification failed required acceptance checks: ${failures.join(', ')}`);
        return { exitCode: 1, failures };
    }
    return { exitCode: 0, failures };
}

function measureColdInstall(image) {
    let cached = true;
    try {
        docker(['image', 'inspect', image], { stdio: 'ignore' });
    } catch {
        cached = false;
    }
    const startedAt = Date.now();
    docker(['pull', image], { stdio: 'inherit' });
    return { elapsedMs: Date.now() - startedAt, imageWasCachedBeforePull: cached };
}

async function run() {
    const artifactRoot = argumentValue('--artifact-root') ?? ARTIFACT_ROOT;
    const acceptanceJson = argumentValue('--check-acceptance-json');
    if (acceptanceJson !== undefined) {
        const evidence = JSON.parse(await fs.readFile(acceptanceJson, 'utf8'));
        const { exitCode } = await completeN3Verification(evidence, { artifactRoot });
        process.exitCode = exitCode;
        return;
    }
    const fixtures = await fixtureEvidence();
    const protocolDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-protocol-'));
    const protocol = await runProtocolFaultMatrix(protocolDirectory);
    const protocolAcceptanceResult = protocolAcceptance(protocol);
    const baseEvidence = {
        schema: 'ivory-tower.n3-evidence',
        experiment: 'N3',
        experimentVersion: N3_EXPERIMENT_VERSION,
        contractVersion: 'n3-semantic-execution-v2',
        gitCommit: currentGitCommit(),
        command: invocationEvidence(),
        platform: platformEvidence(),
        runtimeVersions: { node: process.version },
        fixtureDigests: fixtures,
        configuration: {
            outputLimitBytes: OUTPUT_LIMIT_BYTES,
            resultLimitBytes: RESULT_LIMIT_BYTES,
            runTimeoutMs: RUN_TIMEOUT_MS,
            resultContract: {
                version: N3_RESULT_CONTRACT_VERSION,
                keys: N3_RESULT_KEYS,
            },
            container: N3_CONTAINER_CONFIGURATION,
            publicationInterruptionRequested: process.argv.includes('--interrupt-publication'),
        },
        protocolFaultMatrix: protocol,
        languageNeutralProtocol: 'pending-python-and-r-confirmation',
        observations: {
            protocol: {
                boundaryCount: protocol.filter(result => result.boundary !== 'cancellation-publication-race').length,
                restartRecoveryMs: protocol.find(result => result.boundary === 'after-artifact')?.recoveryElapsedMs,
                cancellationLatencyMs: protocol.find(result => result.boundary === 'cancellation-publication-race')?.cancellationLatencyMs,
            },
        },
        architectureDecision: protocolDecision(),
        limitations: protocolDecision().limitations,
        acceptance: protocolAcceptanceResult,
    };
    baseEvidence.acceptanceCriteria = acceptanceCriteria(baseEvidence.acceptance);
    baseEvidence.rawArtifacts = [await writeRawArtifact(
        artifactRoot,
        'logs/protocol-matrix.json',
        `${JSON.stringify(protocol, null, 2)}\n`,
    )];
    if (process.argv.includes('--protocol-only')) {
        const { exitCode } = await completeN3Verification(baseEvidence, { artifactRoot });
        process.exitCode = exitCode;
        return;
    }
    if (!dockerAvailable()) {
        baseEvidence.runtime = { status: 'unavailable' };
        baseEvidence.runtimeVersions.docker = undefined;
        baseEvidence.limitations = [
            ...baseEvidence.limitations,
            'Docker daemon was unavailable for this invocation; OCI evidence was not collected.',
        ];
        baseEvidence.acceptance.runtimeAvailable = null;
        baseEvidence.acceptanceCriteria = acceptanceCriteria(baseEvidence.acceptance);
        await completeN3Verification(baseEvidence, { artifactRoot });
        console.error('Docker daemon is unavailable; N3 OCI runtime evidence cannot run. Protocol-only evidence passed.');
        process.exitCode = 2;
        return;
    }
    const language = argumentValue('--language') ?? 'python';
    if (!['python', 'r'].includes(language)) {
        throw new Error('--language must be python or r.');
    }
    const imageOption = language === 'python' ? '--python-image' : '--r-image';
    let image;
    try {
        image = requireDigestImage(argumentValue(imageOption) ?? process.env[`IVORY_N3_${language.toUpperCase()}_IMAGE`], imageOption);
    } catch (error) {
        baseEvidence.runtime = {
            status: 'invalid-configuration',
            error: error instanceof Error ? error.message : String(error),
        };
        baseEvidence.acceptance.runtimeAvailable = true;
        baseEvidence.acceptance.imageDigestValid = false;
        baseEvidence.acceptanceCriteria = acceptanceCriteria(baseEvidence.acceptance);
        await completeN3Verification(baseEvidence, { artifactRoot });
        process.exitCode = 1;
        return;
    }
    const coldInstall = process.argv.includes('--measure') ? measureColdInstall(image) : undefined;
    const inputBytes = await fs.readFile(path.join(FIXTURE_ROOT, 'input.csv'));
    const inputDigest = sha256(inputBytes);
    const scriptPath = path.join(FIXTURE_ROOT, language === 'python' ? 'compute.py' : 'compute.R');
    const scriptBytes = await fs.readFile(scriptPath);
    const runRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-run-'));
    const inputDirectory = path.join(runRoot, 'input');
    const hostileOutputDirectory = path.join(runRoot, 'hostile-output');
    const outputDirectory = path.join(runRoot, 'output');
    await fs.mkdir(inputDirectory);
    await fs.mkdir(hostileOutputDirectory);
    await fs.mkdir(outputDirectory);
    await fs.writeFile(path.join(inputDirectory, 'input.csv'), inputBytes);
    const scriptName = language === 'python' ? 'compute.py' : 'compute.R';
    await fs.copyFile(path.join(FIXTURE_ROOT, scriptName), path.join(inputDirectory, scriptName));
    await fs.chmod(inputDirectory, 0o555);
    await fs.chmod(path.join(inputDirectory, 'input.csv'), 0o444);
    await fs.chmod(hostileOutputDirectory, 0o777);
    await fs.chmod(outputDirectory, 0o777);
    const executionId = `n3-${Date.now().toString(36)}`;
    const intent = {
        executionId,
        inputDigest,
        language,
        image,
        scriptDigest: sha256(scriptBytes),
    };
    intent.intentDigest = canonicalIntentDigest(intent);
    const store = new N3PublicationStore(path.join(runRoot, 'publication'));
    await store.initialize();
    const firstClient = await store.createOrReplay(intent);
    const secondClient = await store.createOrReplay(intent);
    const attempt = await store.startAttempt();
    let hostileEvidence;
    let runEvidence;
    let afterInputDigest;
    let canaries = [];
    let resultBytes;
    let result;
    let runtimeError;
    const interruptPublication = process.argv.includes('--interrupt-publication');
    let publicationInterrupted = false;
    let publicationError;
    let recoveryState;
    let lateStore;
    let lateFirst;
    let nextAttemptState;
    let lateAttempt;
    let lateFenced = false;
    let finalState;
    try {
        hostileEvidence = language === 'python' ? await runContainer({
            name: `${executionId}-hostile`,
            image,
            language,
            mode: 'hostile',
            inputDirectory,
            outputDirectory: hostileOutputDirectory,
        }) : undefined;
        runEvidence = await runContainer({
            name: `${executionId}-attempt-${attempt.currentAttempt}`,
            image,
            language,
            mode: 'valid',
            inputDirectory,
            outputDirectory,
        });
        afterInputDigest = sha256(await fs.readFile(path.join(inputDirectory, 'input.csv')));
        if (language === 'python') {
            canaries = JSON.parse(await fs.readFile(path.join(hostileOutputDirectory, 'canaries.json'), 'utf8'));
        }
        if (runEvidence.exitCode !== 0) {
            throw new Error(`Valid ${language} run exited ${runEvidence.exitCode}: ${runEvidence.stderr}`);
        }
        ({ bytes: resultBytes, result } = await readN3Result(outputDirectory));
        try {
            await store.publish(attempt.currentAttempt, resultBytes, { interruptAfterArtifact: interruptPublication });
        } catch (error) {
            if (!interruptPublication) {
                throw error;
            }
            publicationInterrupted = true;
            publicationError = error instanceof Error ? error.message : String(error);
        }
        if (publicationInterrupted) {
            recoveryState = await store.recoverPublication();
        }
        lateStore = new N3PublicationStore(path.join(runRoot, 'late-publication'));
        await lateStore.initialize();
        await lateStore.createOrReplay(intent);
        lateFirst = await lateStore.startAttempt();
        nextAttemptState = await lateStore.startAttempt();
        lateAttempt = lateFirst.currentAttempt;
        try {
            await lateStore.publish(lateAttempt, Buffer.from('{"stale":true}\n'));
        } catch {
            lateFenced = true;
        }
        finalState = await store.readState();
    } catch (error) {
        runtimeError = error instanceof Error ? error.message : String(error);
        afterInputDigest ??= await fs.readFile(path.join(inputDirectory, 'input.csv'))
            .then(bytes => sha256(bytes))
            .catch(() => undefined);
    }
    const rawArtifacts = [...baseEvidence.rawArtifacts];
    if (hostileEvidence !== undefined) {
        rawArtifacts.push(await writeRawArtifact(artifactRoot, `logs/${language}-hostile.stdout.log`, hostileEvidence.stdout));
        rawArtifacts.push(await writeRawArtifact(artifactRoot, `logs/${language}-hostile.stderr.log`, hostileEvidence.stderr));
    }
    if (runEvidence !== undefined) {
        rawArtifacts.push(await writeRawArtifact(artifactRoot, `logs/${language}-run.stdout.log`, runEvidence.stdout));
        rawArtifacts.push(await writeRawArtifact(artifactRoot, `logs/${language}-run.stderr.log`, runEvidence.stderr));
    }
    const inputUnchanged = afterInputDigest !== undefined && inputDigest === afterInputDigest;
    const controlsEnforced = runEvidence === undefined ? false : controlsAreEnforced(runEvidence.controls)
        && (language !== 'python' || controlsAreEnforced(hostileEvidence?.controls));
    const evidence = {
        ...baseEvidence,
        image,
        language,
        inputDigest,
        afterInputDigest,
        inputUnchanged,
        scriptDigest: intent.scriptDigest,
        idempotency: { firstReplayed: firstClient.replayed, secondReplayed: secondClient.replayed },
        runtimeVersions: { ...baseEvidence.runtimeVersions, docker: dockerVersion() },
        rawArtifacts,
        runtime: {
            status: runtimeError === undefined ? 'observed' : 'failed',
            error: runtimeError,
            exitCode: runEvidence?.exitCode,
            outputLimit: runEvidence?.outputLimit,
            stopReason: runEvidence?.stopReason,
            timedOut: runEvidence?.timedOut,
            childProcessesTerminated: runEvidence?.childProcessesTerminated,
            termination: runEvidence?.termination,
            controlsEnforced,
            controls: runEvidence?.controls,
            elapsedMs: runEvidence?.elapsedMs,
            coldInstall,
            warmLaunchMs: runEvidence?.elapsedMs,
            resultContractVersion: N3_RESULT_CONTRACT_VERSION,
            result,
            resultDigest: resultBytes === undefined ? undefined : sha256(resultBytes),
            resultBytes: resultBytes?.byteLength,
            hostileCanaries: language === 'python' ? canaries : null,
            hostileCanaryOutcome: language === 'python' ? canaryOutcome(canaries) : null,
            hostileOutputLimit: hostileEvidence?.outputLimit ?? false,
            hostileStopReason: hostileEvidence?.stopReason,
            hostileChildProcessesTerminated: hostileEvidence?.childProcessesTerminated,
            hostileTermination: hostileEvidence?.termination,
            hostileControlsEnforced: hostileEvidence === undefined ? null : controlsAreEnforced(hostileEvidence.controls),
        },
        publication: {
            interrupted: publicationInterrupted,
            interruptionError: publicationError,
            recovered: recoveryState?.status === 'succeeded' || finalState?.status === 'succeeded',
            recoveryState,
            terminalOutcome: finalState?.terminalOutcome,
            artifactCount: await store.artifactNames(),
            lateAttempt,
            replacementAttempt: nextAttemptState?.currentAttempt,
            lateResultFenced: lateFenced,
            latePublicationState: lateStore === undefined ? undefined : await lateStore.readState(),
        },
    };
    evidence.publication.artifactCount = evidence.publication.artifactCount.length;
    evidence.observations.runtime = {
        elapsedMs: runEvidence?.elapsedMs,
        warmLaunchMs: runEvidence?.elapsedMs,
        outputBytesCaptured: (runEvidence?.stdout?.length ?? 0) + (runEvidence?.stderr?.length ?? 0),
        resultBytes: resultBytes?.byteLength,
    };
    const finalStatus = finalState?.status;
    evidence.acceptance = {
        ...baseEvidence.acceptance,
        runtimeAvailable: true,
        requiredCanariesDenied: language === 'python' ? canaryOutcome(canaries).requiredEnforced : null,
        escapeProbesRecorded: language === 'python' ? canaryOutcome(canaries).escapeProbesRecorded : null,
        inputUnchanged: evidence.inputUnchanged,
        childProcessesTerminated: language === 'python' ? hostileEvidence?.childProcessesTerminated === true : null,
        controlsEnforced,
        mountSurfaceMinimal: minimalMountSurface(runEvidence?.controls),
        noPrivilegedEscalation: noPrivilegedEscalation(runEvidence?.controls),
        lateResultsFenced: evidence.publication.lateResultFenced,
        oneTerminalPublicationOutcome: ['succeeded', 'failed', 'cancelled'].includes(finalStatus) && evidence.publication.artifactCount === 1,
        publicationRecoveredAfterInterrupt: interruptPublication ? evidence.publication.recovered === true && evidence.publication.artifactCount === 1 : null,
        resultOutputValidated: result !== undefined,
        validOutputNotAdmittedAsFailure: runEvidence?.exitCode === 0 && finalStatus === 'succeeded',
    };
    evidence.acceptanceCriteria = acceptanceCriteria(evidence.acceptance);
    evidence.architectureDecision = {
        status: runtimeError === undefined ? 'runtime-observed-language-qualified-open' : 'runtime-qualification-failed',
        decision: 'Retain the semantic execution protocol and keep isolation behind a replaceable runtime adapter.',
        limitations: [
            'This invocation does not select a supported operating system or production isolation profile.',
            language === 'python' ? 'An independent R repeat is still required before declaring language-neutral protocol semantics.' : 'A corresponding Python run must be retained with the R evidence for language-neutral protocol semantics.',
            ...(interruptPublication ? [] : ['Publication interruption recovery was not requested in this invocation.']),
            'Required canaries that report a non-enforcement basis corroborate the mount-surface check; they are not independent proof of enforcement.',
            'Container termination is observed via docker inspect before removal; a container removed before inspection fails the check.',
        ],
    };
    evidence.limitations = evidence.architectureDecision.limitations;
    const { exitCode } = await completeN3Verification(evidence, { artifactRoot });
    process.exitCode = exitCode;
}

function isDirectRun() {
    const entry = process.argv[1];
    return entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
    run().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
