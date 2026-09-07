import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const N3_TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

const LOCK_RETRY_MS = 10;
export const LOCK_TIMEOUT_MS = 5_000;
export const LOCK_STALE_MS = 5_000;
const PROTOCOL_MODULE = fileURLToPath(import.meta.url);

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

export function sha256(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

export function canonicalIntentDigest(intent) {
    return sha256(Buffer.from(JSON.stringify({
        inputDigest: intent.inputDigest,
        language: intent.language,
        image: intent.image,
        scriptDigest: intent.scriptDigest,
    })));
}

function argumentValue(name, argv = process.argv) {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
}

function processIsAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

export function fixtureIntent(executionId) {
    const value = {
        executionId,
        inputDigest: sha256(Buffer.from('id,value\n1,2\n')),
        language: 'python',
        image: 'fixture@sha256:' + 'a'.repeat(64),
        scriptDigest: sha256(Buffer.from('fixture')),
    };
    return { ...value, intentDigest: canonicalIntentDigest(value) };
}

export class N3PublicationStore {
    constructor(root) {
        this.root = root;
        this.statePath = path.join(root, 'execution.json');
        this.artifactDirectory = path.join(root, 'artifacts');
        this.lockPath = path.join(root, '.lock');
        this.lockOwnerPath = path.join(this.lockPath, 'owner.json');
    }

    async initialize() {
        await fs.mkdir(this.artifactDirectory, { recursive: true });
    }

    async createOrReplay(intent) {
        return this.withLock(async () => {
            const existing = await this.readState();
            if (existing !== undefined) {
                if (existing.intentDigest !== intent.intentDigest || existing.inputDigest !== intent.inputDigest) {
                    throw new Error('Intent digest collision or input mismatch.');
                }
                return { state: existing, replayed: true };
            }
            const now = new Date().toISOString();
            const state = {
                version: 1,
                executionId: intent.executionId,
                intentDigest: intent.intentDigest,
                inputDigest: intent.inputDigest,
                language: intent.language,
                image: intent.image,
                status: 'queued',
                currentAttempt: 0,
                terminalOutcome: undefined,
                artifactKey: undefined,
                artifactDigest: undefined,
                expectedArtifactDigest: undefined,
                createdAt: now,
                updatedAt: now,
            };
            await this.writeState(state);
            return { state, replayed: false };
        });
    }

    async startAttempt() {
        return this.withLock(async () => {
            const state = await this.requireState();
            if (N3_TERMINAL_STATUSES.has(state.status)) {
                return clone(state);
            }
            const next = {
                ...state,
                status: 'running',
                currentAttempt: state.currentAttempt + 1,
                terminalOutcome: undefined,
                expectedArtifactDigest: undefined,
                updatedAt: new Date().toISOString(),
            };
            await this.writeState(next);
            return next;
        });
    }

    async requestCancellation() {
        return this.withLock(async () => {
            const state = await this.requireState();
            if (N3_TERMINAL_STATUSES.has(state.status)) {
                return clone(state);
            }
            const next = { ...state, status: 'cancelled', terminalOutcome: 'cancelled', expectedArtifactDigest: undefined, updatedAt: new Date().toISOString() };
            await this.removeArtifact(state.currentAttempt);
            await this.writeState(next);
            return next;
        });
    }

    async fail(code, message) {
        return this.withLock(async () => {
            const state = await this.requireState();
            if (N3_TERMINAL_STATUSES.has(state.status)) {
                return clone(state);
            }
            const next = {
                ...state,
                status: 'failed',
                terminalOutcome: { kind: 'failed', code, message },
                expectedArtifactDigest: undefined,
                updatedAt: new Date().toISOString(),
            };
            await this.removeArtifact(state.currentAttempt);
            await this.writeState(next);
            return next;
        });
    }

    async beginPublication(attempt) {
        return this.withLock(async () => {
            const state = await this.requireState();
            this.assertCurrentAttempt(state, attempt);
            if (state.status !== 'running') {
                return false;
            }
            await this.writeState({
                ...state,
                status: 'publishing',
                publishingAttempt: attempt,
                expectedArtifactDigest: undefined,
                updatedAt: new Date().toISOString(),
            });
            return true;
        });
    }

    async writeArtifact(attempt, bytes) {
        return this.withLock(async () => {
            const state = await this.requireState();
            this.assertCurrentAttempt(state, attempt);
            if (state.status !== 'publishing') {
                return false;
            }
            const artifactName = this.artifactName(attempt);
            const artifactKey = path.posix.join('artifacts', artifactName);
            const artifactDigest = sha256(bytes);
            await this.writeState({
                ...state,
                expectedArtifactDigest: artifactDigest,
                pendingArtifactKey: artifactKey,
                updatedAt: new Date().toISOString(),
            });
            const temporary = path.join(this.artifactDirectory, `${artifactName}.tmp`);
            const finalPath = path.join(this.artifactDirectory, artifactName);
            const handle = await fs.open(temporary, 'w', 0o600);
            try {
                await handle.writeFile(bytes);
                await handle.sync();
            } finally {
                await handle.close();
            }
            await fs.rename(temporary, finalPath);
            return { artifactKey, artifactDigest };
        });
    }

    async commitPublication(attempt, artifact) {
        return this.withLock(async () => {
            const state = await this.requireState();
            if (state.currentAttempt !== attempt || state.status !== 'publishing' || state.publishingAttempt !== attempt) {
                return false;
            }
            const expectedDigest = state.expectedArtifactDigest ?? artifact.artifactDigest;
            if (expectedDigest !== artifact.artifactDigest) {
                throw new Error('Publication artifact digest does not match the expected digest.');
            }
            const finalPath = path.join(this.artifactDirectory, this.artifactName(attempt));
            const bytes = await fs.readFile(finalPath);
            if (sha256(bytes) !== expectedDigest) {
                throw new Error('Publication artifact digest changed before commit.');
            }
            await this.writeState({
                ...state,
                status: 'succeeded',
                terminalOutcome: 'succeeded',
                artifactKey: artifact.artifactKey,
                artifactDigest: expectedDigest,
                expectedArtifactDigest: undefined,
                pendingArtifactKey: undefined,
                publishingAttempt: undefined,
                updatedAt: new Date().toISOString(),
            });
            return true;
        });
    }

    async publish(attempt, bytes, { interruptAfterArtifact = false } = {}) {
        if (!(await this.beginPublication(attempt))) {
            return false;
        }
        const artifact = await this.writeArtifact(attempt, bytes);
        if (interruptAfterArtifact) {
            throw new Error('Injected supervisor interruption after artifact write.');
        }
        return this.commitPublication(attempt, artifact);
    }

    async recoverPublication() {
        return this.withLock(async () => {
            const state = await this.requireState();
            if (state.status !== 'publishing' || state.publishingAttempt !== state.currentAttempt) {
                return clone(state);
            }
            const finalPath = path.join(this.artifactDirectory, this.artifactName(state.currentAttempt));
            try {
                const bytes = await fs.readFile(finalPath);
                const digest = sha256(bytes);
                if (state.expectedArtifactDigest === undefined || digest !== state.expectedArtifactDigest) {
                    await this.removeArtifact(state.currentAttempt);
                    await this.writeState({
                        ...state,
                        status: 'failed',
                        terminalOutcome: {
                            kind: 'failed',
                            code: 'artifact-digest-mismatch',
                            message: 'Recovered artifact digest did not match the expected publication digest.',
                        },
                        artifactKey: undefined,
                        artifactDigest: undefined,
                        expectedArtifactDigest: undefined,
                        pendingArtifactKey: undefined,
                        publishingAttempt: undefined,
                        updatedAt: new Date().toISOString(),
                    });
                } else {
                    await this.writeState({
                        ...state,
                        status: 'succeeded',
                        terminalOutcome: 'succeeded',
                        artifactKey: state.pendingArtifactKey ?? path.posix.join('artifacts', this.artifactName(state.currentAttempt)),
                        artifactDigest: state.expectedArtifactDigest,
                        expectedArtifactDigest: undefined,
                        pendingArtifactKey: undefined,
                        publishingAttempt: undefined,
                        updatedAt: new Date().toISOString(),
                    });
                }
            } catch (error) {
                if (error?.code !== 'ENOENT') {
                    throw error;
                }
                await this.writeState({
                    ...state,
                    status: 'queued',
                    expectedArtifactDigest: undefined,
                    pendingArtifactKey: undefined,
                    publishingAttempt: undefined,
                    updatedAt: new Date().toISOString(),
                });
            }
            return this.requireState();
        });
    }

    async readState() {
        try {
            const state = JSON.parse(await fs.readFile(this.statePath, 'utf8'));
            this.executionId = state.executionId;
            return state;
        } catch (error) {
            if (error?.code === 'ENOENT') {
                return undefined;
            }
            throw error;
        }
    }

    async readArtifact(attempt = undefined) {
        const state = await this.requireState();
        const selectedAttempt = attempt ?? state.currentAttempt;
        return fs.readFile(path.join(this.artifactDirectory, this.artifactName(selectedAttempt)));
    }

    async artifactNames() {
        return (await fs.readdir(this.artifactDirectory)).filter(name => name.endsWith('.json')).sort();
    }

    artifactName(attempt) {
        return `${this.requireExecutionId()}-attempt-${attempt}.json`;
    }

    async requireState() {
        const state = await this.readState();
        if (state === undefined) {
            throw new Error('N3 execution state has not been created.');
        }
        return state;
    }

    requireExecutionId() {
        if (this.executionId === undefined) {
            throw new Error('N3 execution id is not initialized.');
        }
        return this.executionId;
    }

    async writeState(state) {
        this.executionId = state.executionId;
        const temporary = `${this.statePath}.tmp`;
        const handle = await fs.open(temporary, 'w', 0o600);
        try {
            await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`);
            await handle.sync();
        } finally {
            await handle.close();
        }
        await fs.rename(temporary, this.statePath);
    }

    async removeArtifact(attempt) {
        if (attempt <= 0 || this.executionId === undefined) {
            return;
        }
        await fs.rm(path.join(this.artifactDirectory, this.artifactName(attempt)), { force: true });
        await fs.rm(path.join(this.artifactDirectory, `${this.artifactName(attempt)}.tmp`), { force: true });
    }

    assertCurrentAttempt(state, attempt) {
        if (state.currentAttempt !== attempt || N3_TERMINAL_STATUSES.has(state.status)) {
            throw new Error(`Stale N3 attempt ${attempt} is fenced by current attempt ${state.currentAttempt}.`);
        }
    }

    async writeLockOwner() {
        await fs.writeFile(this.lockOwnerPath, `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`);
    }

    async lockHolderIsAlive() {
        try {
            const owner = JSON.parse(await fs.readFile(this.lockOwnerPath, 'utf8'));
            return processIsAlive(owner.pid);
        } catch (error) {
            if (error?.code !== 'ENOENT') {
                throw error;
            }
            try {
                const lock = await fs.stat(this.lockPath);
                return Date.now() - lock.mtimeMs < LOCK_STALE_MS;
            } catch (statError) {
                if (statError?.code === 'ENOENT') {
                    return false;
                }
                throw statError;
            }
        }
    }

    async withLock(operation) {
        await fs.mkdir(this.root, { recursive: true });
        const deadline = Date.now() + LOCK_TIMEOUT_MS;
        while (true) {
            try {
                await fs.mkdir(this.lockPath);
                await this.writeLockOwner();
                break;
            } catch (error) {
                if (error?.code !== 'EEXIST' || Date.now() >= deadline) {
                    throw error;
                }
                try {
                    if (!(await this.lockHolderIsAlive())) {
                        await fs.rm(this.lockPath, { recursive: true, force: true });
                    }
                } catch (statError) {
                    if (statError?.code !== 'ENOENT') {
                        throw statError;
                    }
                }
                await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_MS));
            }
        }
        try {
            return await operation();
        } finally {
            await fs.rm(this.lockPath, { recursive: true, force: true });
        }
    }
}

export async function createN3Store(root, intent) {
    const store = new N3PublicationStore(root);
    await store.initialize();
    await store.createOrReplay(intent);
    return store;
}

export async function runBoundaryWorker({ root, boundary, executionId }) {
    const intent = fixtureIntent(executionId);
    const store = new N3PublicationStore(root);
    await store.initialize();
    if (boundary === 'before-create') {
        return;
    }
    await store.createOrReplay(intent);
    if (boundary === 'after-create' || boundary === 'before-start') {
        return;
    }
    const attempt = await store.startAttempt();
    if (boundary === 'after-start' || boundary === 'before-publish') {
        return;
    }
    if (boundary === 'after-artifact') {
        await store.publish(attempt.currentAttempt, Buffer.from('{"ok":true}\n'), { interruptAfterArtifact: true });
        return;
    }
    await store.publish(attempt.currentAttempt, Buffer.from('{"ok":true}\n'));
}

function spawnBoundaryWorker(root, boundary, executionId) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [
            PROTOCOL_MODULE,
            '--boundary-worker',
            '--root', root,
            '--boundary', boundary,
            '--execution-id', executionId,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        let stdout = '';
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.on('error', reject);
        child.on('close', (code, signal) => {
            resolve({ pid: child.pid, code, signal, stderr, stdout });
        });
    });
}

export async function runProtocolFaultMatrix(tempRoot) {
    const results = [];
    const boundaries = [
        ['core', 'before-create'],
        ['core', 'after-create'],
        ['supervisor', 'before-start'],
        ['supervisor', 'after-start'],
        ['supervisor', 'before-publish'],
        ['supervisor', 'after-artifact'],
        ['core', 'after-publish'],
    ];
    for (const [owner, boundary] of boundaries) {
        const root = path.join(tempRoot, `${owner}-${boundary}`);
        const executionId = `${owner}-${boundary}`;
        const worker = await spawnBoundaryWorker(root, boundary, executionId);
        const expectedCrash = boundary === 'after-artifact';
        if (!expectedCrash && worker.code !== 0) {
            throw new Error(`N3 boundary worker failed at ${boundary}: ${worker.stderr || worker.code}`);
        }
        const store = new N3PublicationStore(root);
        await store.initialize();
        if (boundary === 'after-artifact') {
            const recovered = await store.recoverPublication();
            results.push({
                owner,
                boundary,
                status: recovered.status,
                artifactCount: (await store.artifactNames()).length,
                isolated: true,
                reopened: true,
                workerPid: worker.pid,
                workerExited: worker.code !== null || worker.signal !== null,
            });
            continue;
        }
        const state = await store.readState();
        results.push({
            owner,
            boundary,
            status: state?.status ?? 'not-created',
            isolated: true,
            reopened: true,
            workerPid: worker.pid,
            workerExited: worker.code !== null || worker.signal !== null,
        });
    }
    const cancellationRoot = path.join(tempRoot, 'cancellation-race');
    const cancellationStore = new N3PublicationStore(cancellationRoot);
    await cancellationStore.initialize();
    await cancellationStore.createOrReplay({
        executionId: 'cancellation-race',
        inputDigest: sha256(Buffer.from('id,value\n1,2\n')),
        language: 'python',
        image: 'fixture@sha256:' + 'a'.repeat(64),
        scriptDigest: sha256(Buffer.from('fixture')),
        intentDigest: 'cancellation-race-intent',
    });
    const cancellationAttempt = await cancellationStore.startAttempt();
    const cancelled = await cancellationStore.requestCancellation();
    let latePublicationRejected = false;
    try {
        await cancellationStore.publish(cancellationAttempt.currentAttempt, Buffer.from('{"late":true}\n'));
    } catch {
        latePublicationRejected = true;
    }
    results.push({
        owner: 'protocol',
        boundary: 'cancellation-publication-race',
        status: cancelled.status,
        latePublicationRejected,
        terminalOutcome: (await cancellationStore.readState()).terminalOutcome,
    });
    return results;
}

function isDirectRun() {
    const entry = process.argv[1];
    return entry !== undefined && path.resolve(entry) === PROTOCOL_MODULE;
}

if (isDirectRun() && process.argv.includes('--boundary-worker')) {
    runBoundaryWorker({
        root: argumentValue('--root'),
        boundary: argumentValue('--boundary'),
        executionId: argumentValue('--execution-id'),
    }).catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
