import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    LOCK_STALE_MS,
    N3PublicationStore,
    fixtureIntent,
    runProtocolFaultMatrix,
    sha256,
} from './n3-protocol.mjs';

function intent(executionId = 'test-execution') {
    return fixtureIntent(executionId);
}

async function spawnNode(args, { cwd } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
    });
}

test('N3 protocol matrix recovers publication and exercises cancellation', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-test-'));
    try {
        const results = await runProtocolFaultMatrix(root);
        const beforeStart = results.find(result => result.boundary === 'before-start');
        const afterStart = results.find(result => result.boundary === 'after-start');
        const afterArtifact = results.find(result => result.boundary === 'after-artifact');
        assert.equal(beforeStart?.status, 'queued');
        assert.equal(afterStart?.status, 'running');
        assert.notEqual(beforeStart?.status, afterStart?.status);
        assert.equal(afterArtifact?.status, 'succeeded');
        assert.equal(afterArtifact?.artifactCount, 1);
        assert.equal(afterArtifact?.isolated, true);
        assert.equal(afterArtifact?.reopened, true);
        assert.equal(afterArtifact?.workerExited, true);
        assert.equal(afterArtifact?.workerAbruptExit, true);
        assert.equal(typeof afterArtifact?.recoveryElapsedMs, 'number');
        assert.notEqual(afterArtifact?.workerPid, process.pid);
        for (const result of results.filter(entry => entry.boundary !== 'cancellation-publication-race')) {
            assert.equal(result.isolated, true);
            assert.equal(result.reopened, true);
            assert.equal(result.workerExited, true);
            assert.equal(result.workerAbruptExit, result.boundary !== 'before-create');
            assert.notEqual(result.workerPid, process.pid);
        }
        const cancellation = results.find(result => result.boundary === 'cancellation-publication-race');
        assert.deepEqual({
            owner: cancellation?.owner,
            boundary: cancellation?.boundary,
            status: cancellation?.status,
            latePublicationRejected: cancellation?.latePublicationRejected,
            terminalOutcome: cancellation?.terminalOutcome,
        }, {
            owner: 'protocol',
            boundary: 'cancellation-publication-race',
            status: 'cancelled',
            latePublicationRejected: true,
            terminalOutcome: 'cancelled',
        });
        assert.equal(typeof cancellation?.cancellationLatencyMs, 'number');
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('N3 idempotency and attempt fencing are durable across store instances', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-test-'));
    try {
        const first = new N3PublicationStore(root);
        await first.initialize();
        const request = intent();
        assert.equal((await first.createOrReplay(request)).replayed, false);
        const second = new N3PublicationStore(root);
        await second.initialize();
        assert.equal((await second.createOrReplay(request)).replayed, true);
        const attemptOne = await second.startAttempt();
        const attemptTwo = await second.startAttempt();
        assert.equal(attemptTwo.currentAttempt, attemptOne.currentAttempt + 1);
        await assert.rejects(
            () => second.publish(attemptOne.currentAttempt, Buffer.from('{"stale":true}\n')),
            /fenced/,
        );
        assert.equal((await second.readState()).status, 'running');
        assert.deepEqual(await second.artifactNames(), []);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('N3 clears a stale supervisor lock left by a crashed process', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-test-'));
    try {
        const store = new N3PublicationStore(root);
        await store.initialize();
        await store.createOrReplay(intent('crashed-supervisor'));
        await fs.mkdir(path.join(root, '.lock'));
        const stale = new Date(Date.now() - 10_000);
        await fs.utimes(path.join(root, '.lock'), stale, stale);
        assert.equal((await store.startAttempt()).status, 'running');
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('N3 recovery rejects a corrupted artifact instead of publishing its digest', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-digest-'));
    try {
        const store = new N3PublicationStore(root);
        await store.initialize();
        await store.createOrReplay(intent('digest-recovery'));
        const attempt = await store.startAttempt();
        const honestBytes = Buffer.from('{"ok":true}\n');
        try {
            await store.publish(attempt.currentAttempt, honestBytes, { interruptAfterArtifact: true });
        } catch {
            // Supervisor interruption after the artifact is on disk.
        }
        const names = await store.artifactNames();
        assert.equal(names.length, 1);
        const artifactPath = path.join(root, 'artifacts', names[0]);
        const corruptBytes = Buffer.from('{"ok":false,"corrupted":true}\n');
        await fs.writeFile(artifactPath, corruptBytes);
        const recovered = await store.recoverPublication();
        assert.notEqual(recovered.status, 'succeeded');
        assert.notEqual(recovered.terminalOutcome, 'succeeded');
        assert.notEqual(recovered.artifactDigest, sha256(corruptBytes));
        assert.equal(recovered.status, 'failed');
        assert.equal(recovered.terminalOutcome?.code, 'artifact-digest-mismatch');
        assert.equal(recovered.artifactDigest, undefined);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('N3 recovery verifies the expected digest after a process reopen', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-reopen-digest-'));
    const protocolModule = fileURLToPath(new URL('./n3-protocol.mjs', import.meta.url));
    try {
        const worker = await spawnNode([
            protocolModule,
            '--boundary-worker',
            '--root', root,
            '--boundary', 'after-artifact',
            '--execution-id', 'reopen-digest',
        ]);
        assert.notEqual(worker.code, 0);
        const names = (await fs.readdir(path.join(root, 'artifacts'))).filter(name => name.endsWith('.json'));
        assert.equal(names.length, 1);
        const artifactPath = path.join(root, 'artifacts', names[0]);
        const expected = JSON.parse(await fs.readFile(path.join(root, 'execution.json'), 'utf8')).expectedArtifactDigest;
        assert.equal(typeof expected, 'string');
        assert.equal(expected.length, 64);
        const corruptBytes = Buffer.from('{"ok":false,"corrupted":true}\n');
        await fs.writeFile(artifactPath, corruptBytes);
        const reopened = new N3PublicationStore(root);
        await reopened.initialize();
        const recovered = await reopened.recoverPublication();
        assert.notEqual(recovered.status, 'succeeded');
        assert.notEqual(recovered.artifactDigest, sha256(corruptBytes));
        assert.notEqual(recovered.artifactDigest, expected);
        assert.equal(recovered.status, 'failed');
        assert.equal(recovered.terminalOutcome?.code, 'artifact-digest-mismatch');
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('N3 clears a lock whose recorded owner is already dead', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-dead-lock-'));
    try {
        const store = new N3PublicationStore(root);
        await store.initialize();
        await store.createOrReplay(intent('dead-supervisor'));
        const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
        await fs.mkdir(path.join(root, '.lock'));
        await fs.writeFile(path.join(root, '.lock', 'owner.json'), `${JSON.stringify({ pid: child.pid, createdAt: new Date().toISOString() })}\n`);
        child.kill('SIGKILL');
        await new Promise(resolve => child.once('close', resolve));
        assert.equal((await store.startAttempt()).status, 'running');
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('N3 does not steal a lock from a live writer after the stale ttl', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-lock-'));
    try {
        const first = new N3PublicationStore(root);
        const second = new N3PublicationStore(root);
        await first.initialize();
        await first.createOrReplay(intent('live-lock'));
        let concurrent = 0;
        let maxConcurrent = 0;
        let secondEntered = false;
        const hold = first.withLock(async () => {
            concurrent += 1;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            await new Promise(resolve => setTimeout(resolve, LOCK_STALE_MS + 500));
            concurrent -= 1;
            return 'first';
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        const steal = second.withLock(async () => {
            secondEntered = true;
            concurrent += 1;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            concurrent -= 1;
            return 'second';
        });
        const [held, stolen] = await Promise.allSettled([hold, steal]);
        assert.equal(held.status, 'fulfilled');
        assert.equal(maxConcurrent, 1);
        assert.equal(secondEntered, false);
        assert.equal(stolen.status, 'rejected');
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});
