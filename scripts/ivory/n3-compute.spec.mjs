import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    completeN3Verification,
    requiredAcceptanceFailures,
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
