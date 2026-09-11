import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    canaryOutcome,
    completeN3Verification,
    minimalMountSurface,
    noPrivilegedEscalation,
    parseN3Result,
    readN3Result,
    requiredAcceptanceFailures,
    terminationObserved,
} from './n3-compute.mjs';

const computeModule = fileURLToPath(new URL('./n3-compute.mjs', import.meta.url));

function failedAcceptanceEvidence() {
    return {
        language: 'python',
        inputUnchanged: false,
        acceptance: {
            requiredCanariesDenied: false,
            inputUnchanged: false,
            childProcessesTerminated: true,
            controlsEnforced: false,
            lateResultsFenced: true,
            oneTerminalPublicationOutcome: true,
            validOutputNotAdmittedAsFailure: true,
        },
    };
}

function honestAcceptanceEvidence() {
    return {
        language: 'python',
        acceptance: {
            requiredCanariesDenied: true,
            inputUnchanged: true,
            childProcessesTerminated: true,
            controlsEnforced: true,
            lateResultsFenced: true,
            oneTerminalPublicationOutcome: true,
            validOutputNotAdmittedAsFailure: true,
        },
    };
}

async function spawnCompute(args) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [computeModule, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
    });
}

test('required acceptance failures ignore null not-applicable checks', () => {
    assert.deepEqual(requiredAcceptanceFailures({
        requiredCanariesDenied: null,
        inputUnchanged: true,
        childProcessesTerminated: null,
        controlsEnforced: true,
    }), []);
    assert.deepEqual(requiredAcceptanceFailures({
        requiredCanariesDenied: false,
        inputUnchanged: false,
        controlsEnforced: true,
    }), ['requiredCanariesDenied', 'inputUnchanged']);
});

test('N3 rejects malformed, oversized, and contract-breaking result bytes', () => {
    assert.throws(() => parseN3Result(Buffer.from('not json')), /valid JSON/);
    assert.throws(() => parseN3Result(Buffer.alloc(64 * 1024 + 1, 'x')), /result-size limit/);
    assert.throws(() => parseN3Result(Buffer.from('{"rowCount": 1, "sum": 2, "mean": 2, "extra": true}')), /declared result contract/);
    assert.throws(() => parseN3Result(Buffer.from('{"rowCount": 1.5, "sum": 2, "mean": 2}')), /invalid numeric value/);
    assert.deepEqual(parseN3Result(Buffer.from('{"rowCount": 3, "sum": 60, "mean": 20}\n')), {
        rowCount: 3,
        sum: 60,
        mean: 20,
    });
});

test('N3 refuses a symlink in place of the container result', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-result-link-'));
    try {
        const target = path.join(root, 'target.json');
        await fs.writeFile(target, '{"rowCount": 3, "sum": 60, "mean": 20}\n');
        await fs.symlink(target, path.join(root, 'result.json'));
        await assert.rejects(() => readN3Result(root), /regular file/);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('failed acceptance checks fail verification without dropping the evidence bundle', async () => {
    const artifactRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-accept-fail-'));
    try {
        const evidence = failedAcceptanceEvidence();
        const result = await completeN3Verification(evidence, {
            artifactRoot,
            log() {},
            error() {},
        });
        assert.equal(result.exitCode, 1);
        assert.deepEqual(result.failures, ['requiredCanariesDenied', 'inputUnchanged', 'controlsEnforced']);
        const bundle = JSON.parse(await fs.readFile(path.join(artifactRoot, 'evidence.json'), 'utf8'));
        assert.deepEqual(bundle.acceptance, evidence.acceptance);
        const languageBundle = JSON.parse(await fs.readFile(path.join(artifactRoot, 'evidence-python.json'), 'utf8'));
        assert.equal(languageBundle.acceptance.requiredCanariesDenied, false);
    } finally {
        await fs.rm(artifactRoot, { recursive: true, force: true });
    }
});

test('honest acceptance checks keep verification green', async () => {
    const artifactRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-accept-pass-'));
    try {
        const result = await completeN3Verification(honestAcceptanceEvidence(), {
            artifactRoot,
            log() {},
            error() {},
        });
        assert.equal(result.exitCode, 0);
        assert.deepEqual(result.failures, []);
        const bundle = JSON.parse(await fs.readFile(path.join(artifactRoot, 'evidence.json'), 'utf8'));
        assert.equal(bundle.acceptance.inputUnchanged, true);
    } finally {
        await fs.rm(artifactRoot, { recursive: true, force: true });
    }
});

test('verify:ivory-n3 exits non-zero for failed acceptance while keeping evidence', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-verify-fail-'));
    try {
        const evidencePath = path.join(root, 'acceptance.json');
        const artifactRoot = path.join(root, 'artifacts');
        await fs.writeFile(evidencePath, `${JSON.stringify(failedAcceptanceEvidence(), null, 2)}\n`);
        const child = await spawnCompute([
            '--check-acceptance-json', evidencePath,
            '--artifact-root', artifactRoot,
        ]);
        assert.equal(child.code, 1);
        assert.match(child.stderr, /requiredCanariesDenied/);
        const bundle = JSON.parse(await fs.readFile(path.join(artifactRoot, 'evidence.json'), 'utf8'));
        assert.equal(bundle.acceptance.requiredCanariesDenied, false);
        assert.equal(bundle.acceptance.inputUnchanged, false);
        assert.equal(bundle.acceptance.controlsEnforced, false);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('verify:ivory-n3 protocol-only stays green for honest protocol evidence', async () => {
    const artifactRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-verify-protocol-'));
    try {
        const child = await spawnCompute([
            '--protocol-only',
            '--artifact-root', artifactRoot,
        ]);
        assert.equal(child.code, 0, child.stderr);
        const bundle = JSON.parse(await fs.readFile(path.join(artifactRoot, 'evidence.json'), 'utf8'));
        assert.equal(bundle.schema, 'ivory-tower.n3-evidence');
        assert.equal(bundle.experimentVersion, '2.0');
        assert.match(bundle.gitCommit, /^[0-9a-f]{40}$/);
        assert.deepEqual(bundle.configuration.resultContract.keys, ['mean', 'rowCount', 'sum']);
        assert.equal(bundle.acceptanceCriteria.protocolLifecycleReopened.pass, true);
        assert.equal(bundle.rawArtifacts[0].sha256.length, 64);
        const afterArtifact = bundle.protocolFaultMatrix.find(result => result.boundary === 'after-artifact');
        const beforeStart = bundle.protocolFaultMatrix.find(result => result.boundary === 'before-start');
        const afterStart = bundle.protocolFaultMatrix.find(result => result.boundary === 'after-start');
        assert.equal(afterArtifact?.status, 'succeeded');
        assert.equal(beforeStart?.status, 'queued');
        assert.equal(afterStart?.status, 'running');
        assert.equal(afterArtifact?.isolated, true);
    } finally {
        await fs.rm(artifactRoot, { recursive: true, force: true });
    }
});

test('N3 requires exactly the declared mount surface and no privileged escalation', () => {
    const declared = {
        networkMode: 'none',
        readOnlyRootfs: true,
        user: '65532:65532',
        capDrop: ['ALL'],
        securityOpt: ['no-new-privileges:true'],
        privileged: false,
        mounts: [
            { Destination: '/var/tmp', Source: 'C:/Temp/ivory-n3-run-x/input', RW: false, ReadOnly: true },
            { Destination: '/tmp', Source: 'C:/Temp/ivory-n3-run-x/output', RW: true },
        ],
    };
    assert.equal(minimalMountSurface(declared), true);
    assert.equal(noPrivilegedEscalation(declared), true);

    // A third mount is an escape surface even if every declared control still reads correctly.
    assert.equal(minimalMountSurface({
        ...declared,
        mounts: [...declared.mounts, { Destination: '/host-home', Source: 'C:/Users/micha', RW: true }],
    }), false);

    // The docker socket mounted anywhere inside the container is an escape surface.
    assert.equal(minimalMountSurface({
        ...declared,
        mounts: [{ ...declared.mounts[0] }, { Destination: '/var/run/docker.sock', RW: true }],
    }), false);
    assert.equal(noPrivilegedEscalation({
        ...declared,
        mounts: [...declared.mounts, { Destination: '/var/run/docker.sock', RW: true }],
    }), false);

    // Privileged mode and a writable input bind both fail closed.
    assert.equal(noPrivilegedEscalation({ ...declared, privileged: true }), false);
    assert.equal(minimalMountSurface({
        ...declared,
        mounts: [{ Destination: '/var/tmp', RW: true }, declared.mounts[1]],
    }), false);

    // Missing inspect data is never treated as a pass.
    assert.equal(minimalMountSurface(undefined), false);
    assert.equal(noPrivilegedEscalation(undefined), false);
});

test('N3 termination observation requires an actual stopped container state', () => {
    // Honest hostile case: the supervisor killed a running container whose child was alive.
    assert.equal(terminationObserved({
        beforeStop: { State: { Running: true, Pid: 4711, ExitCode: 137 } },
        afterStop: { State: { Running: false, Pid: 0, ExitCode: 137 } },
    }), true);

    // Honest normal-exit case: the process finished on its own.
    assert.equal(terminationObserved({
        beforeStop: { State: { Running: true, Pid: 4712, ExitCode: 0 } },
        afterStop: { State: { Running: false, Pid: 0, ExitCode: 0 } },
    }), true);

    // A container that was removed before it could be observed is not evidence.
    assert.equal(terminationObserved({
        beforeStop: { State: { Running: true, Pid: 4713 } },
        afterStop: undefined,
    }), false);

    // A container still running after the supervisor's kill is a failure.
    assert.equal(terminationObserved({
        beforeStop: { State: { Running: true, Pid: 4714 } },
        afterStop: { State: { Running: true, Pid: 4714 } },
    }), false);

    // No inspect snapshot at all is never a pass.
    assert.equal(terminationObserved(undefined), false);
});

test('N3 accepts only enforcement-basis denials for the required canaries', () => {
    const enforced = [
        { name: 'canonical-file-write', denied: true, basis: 'read-only-filesystem', errno: 30 },
        { name: 'path-symlink-escape', denied: true, basis: 'read-only-filesystem', errno: 30 },
        { name: 'network-egress', denied: true, basis: 'network-unreachable', errno: 101 },
        { name: 'host-home-read', denied: true, basis: 'absence', errno: 2 },
        { name: 'process-escape', denied: true, basis: 'absence', errno: 2 },
        { name: 'child-process', denied: null, basis: 'supervisor-observed', childPid: 12 },
    ];
    const outcome = canaryOutcome(enforced);
    assert.equal(outcome.requiredEnforced, true);
    assert.equal(outcome.absenceProbesRecorded, true);
    assert.deepEqual(outcome.missing, []);

    // An "absence" denial for a required canary is not enforcement evidence.
    assert.equal(canaryOutcome(enforced.map(canary => canary.name === 'network-egress'
        ? { ...canary, basis: 'absence', errno: 2 }
        : canary)).requiredEnforced, false);

    // A missing required canary fails closed.
    assert.deepEqual(canaryOutcome(enforced.filter(canary => canary.name !== 'path-symlink-escape')).missing,
        ['path-symlink-escape']);

    // A canary that was not denied at all fails.
    assert.equal(canaryOutcome(enforced.map(canary => canary.name === 'canonical-file-write'
        ? { ...canary, denied: false, basis: 'not-denied' }
        : canary)).requiredEnforced, false);

    assert.equal(canaryOutcome(undefined).requiredEnforced, false);
});
