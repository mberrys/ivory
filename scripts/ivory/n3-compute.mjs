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
const RUN_TIMEOUT_MS = 30_000;

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
        docker(['info'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
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
        '--pids-limit', '64',
        '--memory', '256m',
        '--cpus', '1',
        '--ulimit', 'nofile=256:256',
        '--ulimit', 'fsize=1024:1024',
        '--mount', `type=bind,src=${inputDirectory},dst=/var/tmp,readonly`,
        '--mount', `type=bind,src=${outputDirectory},dst=/tmp`,
        '--tmpfs', '/dev/shm:rw,noexec,nosuid,size=16m',
        image,
        ...command.filter(Boolean),
    ];
    const startedAt = Date.now();
    const child = spawn(dockerCommand, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let capturedBytes = 0;
    let outputLimit = false;
    let forcedStop = false;
    let inspect;
    const inspectContainer = () => {
        try {
            return JSON.parse(docker(['inspect', name]));
        } catch {
            return undefined;
        }
    };
    const stopContainer = () => {
        if (forcedStop) {
            return;
        }
        forcedStop = true;
        try {
            docker(['rm', '-f', name], { stdio: 'ignore' });
        } catch {
            // The container may have exited between the limit signal and cleanup.
        }
    };
    const removeContainer = () => {
        try {
            docker(['rm', '-f', name], { stdio: 'ignore' });
        } catch {
            // The container may already have been removed by an output-limit stop.
        }
    };
    const capture = (target, chunk) => {
        capturedBytes += chunk.byteLength;
        if (capturedBytes > OUTPUT_LIMIT_BYTES) {
            outputLimit = true;
            inspect ??= inspectContainer();
            stopContainer();
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
    const timeout = setTimeout(() => stopContainer(), RUN_TIMEOUT_MS);
    const exitCode = await new Promise(resolve => child.once('close', resolve));
    clearTimeout(timeout);
    inspect ??= inspectContainer();
    stopContainer();
    removeContainer();
    const containerExists = inspectContainer() !== undefined;
    return {
        exitCode,
        elapsedMs: Date.now() - startedAt,
        stdout,
        stderr,
        outputLimit,
        timedOut: forcedStop && !outputLimit,
        childProcessesTerminated: !containerExists,
        controls: inspect?.[0]?.HostConfig === undefined ? undefined : {
            networkMode: inspect[0].HostConfig.NetworkMode,
            readOnlyRootfs: inspect[0].HostConfig.ReadonlyRootfs,
            user: inspect[0].Config.User,
            capDrop: inspect[0].HostConfig.CapDrop,
            securityOpt: inspect[0].HostConfig.SecurityOpt,
            pidsLimit: inspect[0].HostConfig.PidsLimit,
            memoryBytes: inspect[0].HostConfig.Memory,
            nanoCpus: inspect[0].HostConfig.NanoCpus,
            tmpfs: inspect[0].HostConfig.Tmpfs,
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
    return controls?.networkMode === 'none'
        && controls.readOnlyRootfs === true
        && controls.user === '65532:65532'
        && controls.capDrop?.includes('ALL')
        && controls.securityOpt?.includes('no-new-privileges:true')
        && controls.pidsLimit === 64
        && controls.memoryBytes === 256 * 1024 * 1024
        && controls.nanoCpus === 1_000_000_000
        && inputReadOnly
        && outputWritable
        && typeof tmpfs === 'string'
        && tmpfs.includes('noexec')
        && tmpfs.includes('nosuid');
}

async function writeEvidence(evidence) {
    await fs.mkdir(ARTIFACT_ROOT, { recursive: true });
    const languageSuffix = evidence.language === undefined ? 'protocol' : evidence.language;
    await fs.writeFile(path.join(ARTIFACT_ROOT, `evidence-${languageSuffix}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
    await fs.writeFile(path.join(ARTIFACT_ROOT, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
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
    const protocolDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-protocol-'));
    const protocol = await runProtocolFaultMatrix(protocolDirectory);
    const baseEvidence = {
        protocolFaultMatrix: protocol,
        languageNeutralProtocol: 'pending-python-and-r-confirmation',
        supportedPilotTarget: 'macOS Apple Silicon with a maintained local OCI runtime; cohort confirmation required',
    };
    if (process.argv.includes('--protocol-only')) {
        await writeEvidence(baseEvidence);
        console.log(JSON.stringify(baseEvidence, null, 2));
        return;
    }
    if (!dockerAvailable()) {
        console.error('Docker daemon is unavailable; N3 OCI runtime evidence cannot run. Protocol-only evidence passed.');
        process.exitCode = 2;
        return;
    }
    const language = argumentValue('--language') ?? 'python';
    if (!['python', 'r'].includes(language)) {
        throw new Error('--language must be python or r.');
    }
    const imageOption = language === 'python' ? '--python-image' : '--r-image';
    const image = requireDigestImage(argumentValue(imageOption) ?? process.env[`IVORY_N3_${language.toUpperCase()}_IMAGE`], imageOption);
    const coldInstall = process.argv.includes('--measure') ? measureColdInstall(image) : undefined;
    const inputBytes = await fs.readFile(path.join(FIXTURE_ROOT, 'input.csv'));
    const inputDigest = sha256(inputBytes);
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
        scriptDigest: sha256(await fs.readFile(path.join(FIXTURE_ROOT, language === 'python' ? 'compute.py' : 'compute.R'))),
    };
    intent.intentDigest = canonicalIntentDigest(intent);
    const store = new N3PublicationStore(path.join(runRoot, 'publication'));
    await store.initialize();
    const firstClient = await store.createOrReplay(intent);
    const secondClient = await store.createOrReplay(intent);
    const attempt = await store.startAttempt();
    const hostileEvidence = language === 'python' ? await runContainer({
        name: `${executionId}-hostile`,
        image,
        language,
        mode: 'hostile',
        inputDirectory,
        outputDirectory: hostileOutputDirectory,
    }) : undefined;
    const runEvidence = await runContainer({
        name: `${executionId}-attempt-${attempt.currentAttempt}`,
        image,
        language,
        mode: 'valid',
        inputDirectory,
        outputDirectory,
    });
    const afterInputDigest = sha256(await fs.readFile(path.join(inputDirectory, 'input.csv')));
    const canaries = language === 'python' ? JSON.parse(await fs.readFile(path.join(hostileOutputDirectory, 'canaries.json'), 'utf8')) : [];
    if (runEvidence.exitCode !== 0) {
        throw new Error(`Valid ${language} run exited ${runEvidence.exitCode}: ${runEvidence.stderr}`);
    }
    const resultBytes = await fs.readFile(path.join(outputDirectory, 'result.json'));
    const interruptPublication = process.argv.includes('--interrupt-publication');
    let publicationInterrupted = false;
    try {
        await store.publish(attempt.currentAttempt, resultBytes, { interruptAfterArtifact: interruptPublication });
    } catch {
        publicationInterrupted = true;
    }
    if (publicationInterrupted) {
        await store.recoverPublication();
    }
    const lateStore = new N3PublicationStore(path.join(runRoot, 'late-publication'));
    await lateStore.initialize();
    await lateStore.createOrReplay(intent);
    const lateFirst = await lateStore.startAttempt();
    const nextAttemptState = await lateStore.startAttempt();
    const lateAttempt = lateFirst.currentAttempt;
    let lateFenced = false;
    try {
        await lateStore.publish(lateAttempt, Buffer.from('{"stale":true}\n'));
    } catch {
        lateFenced = true;
    }
    const finalState = await store.readState();
    const evidence = {
        ...baseEvidence,
        image,
        language,
        inputDigest,
        afterInputDigest,
        inputUnchanged: inputDigest === afterInputDigest,
        idempotency: { firstReplayed: firstClient.replayed, secondReplayed: secondClient.replayed },
        runtime: {
            exitCode: runEvidence.exitCode,
            outputLimit: runEvidence.outputLimit,
            childProcessesTerminated: runEvidence.childProcessesTerminated,
            controlsEnforced: controlsAreEnforced(runEvidence.controls),
            controls: runEvidence.controls,
            elapsedMs: runEvidence.elapsedMs,
            coldInstall,
            warmLaunchMs: runEvidence.elapsedMs,
            hostileCanaries: language === 'python' ? canaries : null,
            hostileOutputLimit: hostileEvidence?.outputLimit ?? false,
            hostileChildProcessesTerminated: hostileEvidence?.childProcessesTerminated ?? true,
            hostileControlsEnforced: hostileEvidence === undefined ? undefined : controlsAreEnforced(hostileEvidence.controls),
        },
        publication: {
            interrupted: publicationInterrupted,
            recovered: finalState.status === 'succeeded',
            terminalOutcome: finalState.terminalOutcome,
            artifactCount: (await store.artifactNames()).length,
            lateAttempt: lateAttempt,
            replacementAttempt: nextAttemptState.currentAttempt,
            lateResultFenced: lateFenced,
            latePublicationState: await lateStore.readState(),
        },
    };
    evidence.acceptance = {
        requiredCanariesDenied: language === 'python' ? canaries.filter(canary => canary.name !== 'child-process').every(canary => canary.denied === true) : null,
        inputUnchanged: evidence.inputUnchanged,
        childProcessesTerminated: language === 'python' ? hostileEvidence.childProcessesTerminated : null,
        controlsEnforced: controlsAreEnforced(runEvidence.controls) && (language !== 'python' || controlsAreEnforced(hostileEvidence.controls)),
        lateResultsFenced: evidence.publication.lateResultFenced,
        oneTerminalPublicationOutcome: ['succeeded', 'failed', 'cancelled'].includes(finalState.status) && evidence.publication.artifactCount === 1,
        validOutputNotAdmittedAsFailure: runEvidence.exitCode === 0 && finalState.status === 'succeeded',
    };
    await writeEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
}

run().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
