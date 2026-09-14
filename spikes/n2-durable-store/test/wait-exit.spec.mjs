import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { waitForChildExit } from '../src/child-exit.mjs';

function fakeChild(pid = 4242) {
    const child = new EventEmitter();
    child.pid = pid;
    child.exitCode = null;
    child.signalCode = null;
    child.complete = (exitCode = 0, signalCode = null) => {
        child.exitCode = exitCode;
        child.signalCode = signalCode;
        child.emit('exit', exitCode, signalCode);
    };
    return child;
}

test('waitForChildExit resolves when the child has already exited', async () => {
    const child = fakeChild();
    child.exitCode = 1;
    const seen = await waitForChildExit(child, 50);
    assert.deepEqual(seen, { exitCode: 1, signalCode: null });
});

test('waitForChildExit resolves on the exit event', async () => {
    const child = fakeChild();
    const pending = waitForChildExit(child, 200);
    child.complete(null, 'SIGKILL');
    const seen = await pending;
    assert.deepEqual(seen, { exitCode: null, signalCode: 'SIGKILL' });
});

test('waitForChildExit refuses to proceed while the child is still alive', async () => {
    const child = fakeChild(99);
    await assert.rejects(
        () => waitForChildExit(child, 40),
        /still alive|timed out/i,
    );
});
