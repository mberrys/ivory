import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    N3PublicationStore,
    canonicalIntentDigest,
    runProtocolFaultMatrix,
    sha256,
} from './n3-protocol.mjs';

function intent(executionId = 'test-execution') {
    const value = {
        executionId,
        inputDigest: sha256(Buffer.from('id,value\n1,2\n')),
        language: 'python',
        image: 'fixture@sha256:' + 'a'.repeat(64),
        scriptDigest: sha256(Buffer.from('fixture')),
    };
    return { ...value, intentDigest: canonicalIntentDigest(value) };
}

test('N3 protocol matrix recovers publication and exercises cancellation', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-test-'));
    try {
        const results = await runProtocolFaultMatrix(root);
        assert.equal(results.find(result => result.boundary === 'after-artifact')?.status, 'succeeded');
        assert.equal(results.find(result => result.boundary === 'after-artifact')?.artifactCount, 1);
        const cancellation = results.find(result => result.boundary === 'cancellation-publication-race');
        assert.deepEqual(cancellation, {
            owner: 'protocol',
            boundary: 'cancellation-publication-race',
            status: 'cancelled',
            latePublicationRejected: true,
            terminalOutcome: 'cancelled',
        });
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
