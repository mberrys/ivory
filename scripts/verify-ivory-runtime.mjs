// @ts-check
'use strict';

import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = path.join(root, 'infra', 'docker-compose.yml');
const compose = ['compose', '-f', composeFile];
const dockerCommand = process.platform === 'win32' ? 'docker.exe' : 'docker';
const clean = process.argv.includes('--clean');
const recovery = process.argv.includes('--recovery');
const runtimeEnv = {
    ...process.env,
    IVORY_TOWER_ENV: 'local',
    IVORY_DEPLOYMENT_TOPOLOGY: 'vendorHosted',
    DATABASE_URL: 'postgres://ivory:ivory@127.0.0.1:5432/ivory_tower',
    IVORY_S3_BUCKET: 'ivory-tower',
    IVORY_S3_ENDPOINT: 'http://127.0.0.1:9000',
    IVORY_S3_REGION: 'us-east-1',
    IVORY_S3_ACCESS_KEY_ID: 'ivory',
    IVORY_S3_SECRET_ACCESS_KEY: 'ivory-development-only',
    DOCLING_ENDPOINT: 'http://127.0.0.1:5001',
    DOCLING_IMAGE: 'quay.io/docling-project/docling-serve:v1.21.0@sha256:32b3de41f325f93c1dd35907cd9147fa35df9f7c5abc86eb2788b6bda7ce6d10',
    PORT: '4100',
};

function quoteCommandArgument(value) {
    return /[\s"]/u.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
}

function npmInvocation(args) {
    if (process.platform !== 'win32') {
        return { command: 'npm', args };
    }
    return {
        command: process.env.ComSpec ?? 'cmd.exe',
        args: ['/d', '/s', '/c', `npm.cmd ${args.map(quoteCommandArgument).join(' ')}`],
    };
}

function runDocker(args) {
    execFileSync(dockerCommand, args, { cwd: root, stdio: 'inherit' });
}

function runNpm(args) {
    const invocation = npmInvocation(args);
    execFileSync(invocation.command, invocation.args, { cwd: root, env: runtimeEnv, stdio: 'inherit' });
}

function startNpm(args) {
    const invocation = npmInvocation(args);
    return spawn(invocation.command, invocation.args, { cwd: root, env: runtimeEnv, stdio: 'inherit' });
}

function stopProcess(child) {
    if (child.pid === undefined || child.exitCode !== null) {
        return;
    }
    if (process.platform === 'win32') {
        execFileSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
        return;
    }
    child.kill();
}

async function waitFor(label, check, timeoutMs = 180_000) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        try {
            if (await check()) {
                return;
            }
        } catch (error) {
            lastError = error;
        }
        await new Promise(resolve => setTimeout(resolve, 1_000));
    }
    throw new Error(`${label} did not become ready.${lastError instanceof Error ? ` Last error: ${lastError.message}` : ''}`);
}

async function getExecution(baseUrl, id) {
    const response = await fetch(`${baseUrl}/v1/executions/${id}`);
    if (!response.ok) {
        throw new Error(`Execution status returned HTTP ${response.status}.`);
    }
    return response.json();
}

async function waitForTerminal(baseUrl, id) {
    let latest;
    await waitFor(
        `execution ${id}`,
        async () => {
            latest = await getExecution(baseUrl, id);
            return ['succeeded', 'failed', 'cancelled'].includes(latest.status);
        },
        300_000,
    );
    return latest;
}

async function main() {
    try {
        execFileSync(dockerCommand, ['info'], { cwd: root, stdio: 'ignore' });
    } catch {
        console.error('Docker daemon is unavailable; IV-14 real runtime proof cannot run in this environment.');
        process.exitCode = 2;
        return;
    }

    if (clean) {
        runDocker([...compose, 'down']);
    }
    runDocker([...compose, 'up', '-d', 'postgres', 'object-store', 'object-store-init', 'docling']);
    runNpm(['run', 'migrate:ivory']);
    runNpm(['run', 'compile:ivory-services']);

    const api = startNpm(['run', 'start:ivory-api']);
    const worker = startNpm(['run', 'start:ivory-worker']);
    const stopProcesses = () => {
        stopProcess(api);
        stopProcess(worker);
    };
    process.once('SIGINT', stopProcesses);
    process.once('SIGTERM', stopProcesses);

    try {
        const baseUrl = 'http://127.0.0.1:4100';
        await waitFor('API readiness', async () => (await fetch(`${baseUrl}/health/ready`)).ok);
        const readyBody = await fetch(`${baseUrl}/health/ready`).then(response => response.json());
        const requiredChecks = ['postgres', 'schema', 'queue', 'objectStore'];
        for (const name of requiredChecks) {
            const check = Array.isArray(readyBody.checks) ? readyBody.checks.find(entry => entry.name === name) : undefined;
            if (check?.status !== 'ok') {
                throw new Error(`Ready check ${name} was ${check?.status ?? 'missing'}: ${JSON.stringify(readyBody)}`);
            }
        }
        if (readyBody.status !== 'ready' && readyBody.status !== 'degraded') {
            throw new Error(`API readiness status was ${JSON.stringify(readyBody.status)}.`);
        }
        const content = Buffer.from('# Ivory Tower runtime proof\n\nA public, reusable test source.');
        const upload = await fetch(`${baseUrl}/v1/sources`, {
            method: 'POST',
            headers: {
                'content-type': 'application/octet-stream',
                'x-source-filename': 'runtime-proof.md',
                'x-source-content-type': 'text/markdown',
                'x-source-license': 'CC-BY-4.0',
                'x-source-authorization-evidence': 'fixture-public-reuse',
                'x-source-content-class': 'openLicensed',
                'x-source-acquisition-route': 'openRepository',
            },
            body: content,
        });
        if (upload.status !== 201) {
            throw new Error(`Source admission returned HTTP ${upload.status}: ${await upload.text()}`);
        }
        const source = await upload.json();
        const command = await fetch(`${baseUrl}/v1/executions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'idempotency-key': 'runtime-proof-1' },
            body: JSON.stringify({
                kind: 'convert',
                input: {
                    contentHash: source.contentHash,
                    filename: 'runtime-proof.md',
                    contentType: 'text/markdown',
                    parserVersion: 'docling-serve-v1.21.0',
                },
            }),
        });
        if (command.status !== 202) {
            throw new Error(`Conversion command returned HTTP ${command.status}: ${await command.text()}`);
        }
        const execution = await command.json();
        const completed = await waitForTerminal(baseUrl, execution.id);
        if (completed.status !== 'succeeded') {
            throw new Error(`Happy-path conversion ended ${completed.status}: ${JSON.stringify(completed.failure)}`);
        }
        const events = await fetch(`${baseUrl}/v1/executions/${execution.id}/events`).then(response => response.text());
        if (!events.includes('event: complete')) {
            throw new Error('SSE replay did not contain the persisted complete event.');
        }
        console.log(`IV-14 happy path passed: source ${source.contentHash}, execution ${execution.id}.`);

        if (recovery) {
            const interrupted = await fetch(`${baseUrl}/v1/executions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'idempotency-key': 'runtime-proof-interrupt' },
                body: JSON.stringify({
                    kind: 'convert',
                    input: { contentHash: source.contentHash, filename: 'runtime-proof.md', contentType: 'text/markdown' },
                }),
            }).then(response => response.json());
            await waitFor(
                `execution ${interrupted.id} running`,
                async () => (await getExecution(baseUrl, interrupted.id)).status === 'running',
                60_000,
            );
            runDocker([...compose, 'stop', 'docling']);
            const interruptedState = await waitForTerminal(baseUrl, interrupted.id);
            runDocker([...compose, 'start', 'docling']);
            console.log(
                `IV-14 interruption observed: execution ${interrupted.id} ended ${interruptedState.status}; Docling restarted for recovery.`,
            );

            const cancelled = await fetch(`${baseUrl}/v1/executions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'idempotency-key': 'runtime-proof-cancel' },
                body: JSON.stringify({
                    kind: 'convert',
                    input: { contentHash: source.contentHash, filename: 'runtime-proof.md', contentType: 'text/markdown' },
                }),
            }).then(response => response.json());
            await fetch(`${baseUrl}/v1/executions/${cancelled.id}`, { method: 'DELETE' });
            const cancelledState = await waitForTerminal(baseUrl, cancelled.id);
            if (cancelledState.status !== 'cancelled') {
                throw new Error(`Cancellation proof ended ${cancelledState.status}.`);
            }
            console.log(`IV-14 cancellation passed: execution ${cancelled.id}.`);
        }
    } finally {
        stopProcesses();
        if (!process.argv.includes('--keep')) {
            runDocker([...compose, 'down']);
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
