import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const N3_TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

const LOCK_RETRY_MS = 10;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 5_000;

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

export class N3PublicationStore {
    constructor(root) {
        this.root = root;
        this.statePath = path.join(root, 'execution.json');
        this.artifactDirectory = path.join(root, 'artifacts');
        this.lockPath = path.join(root, '.lock');
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
            const next = { ...state, status: 'cancelled', terminalOutcome: 'cancelled', updatedAt: new Date().toISOString() };
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
            await this.writeState({ ...state, status: 'publishing', publishingAttempt: attempt, updatedAt: new Date().toISOString() });
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
            return { artifactKey: path.posix.join('artifacts', artifactName), artifactDigest: sha256(bytes) };
        });
    }

    async commitPublication(attempt, artifact) {
        return this.withLock(async () => {
            const state = await this.requireState();
            if (state.currentAttempt !== attempt || state.status !== 'publishing' || state.publishingAttempt !== attempt) {
                return false;
            }
            const finalPath = path.join(this.artifactDirectory, this.artifactName(attempt));
            const bytes = await fs.readFile(finalPath);
            if (sha256(bytes) !== artifact.artifactDigest) {
                throw new Error('Publication artifact digest changed before commit.');
            }
            await this.writeState({
                ...state,
                status: 'succeeded',
                terminalOutcome: 'succeeded',
                artifactKey: artifact.artifactKey,
                artifactDigest: artifact.artifactDigest,
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
                const artifact = {
                    artifactKey: path.posix.join('artifacts', this.artifactName(state.currentAttempt)),
                    artifactDigest: sha256(bytes),
                };
                await this.writeState({
                    ...state,
                    status: 'succeeded',
                    terminalOutcome: 'succeeded',
                    artifactKey: artifact.artifactKey,
                    artifactDigest: artifact.artifactDigest,
                    publishingAttempt: undefined,
                    updatedAt: new Date().toISOString(),
                });
            } catch (error) {
                if (error?.code !== 'ENOENT') {
                    throw error;
                }
                await this.writeState({ ...state, status: 'queued', publishingAttempt: undefined, updatedAt: new Date().toISOString() });
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

    async withLock(operation) {
        await fs.mkdir(this.root, { recursive: true });
        const deadline = Date.now() + LOCK_TIMEOUT_MS;
        while (true) {
            try {
                await fs.mkdir(this.lockPath);
                break;
            } catch (error) {
                if (error?.code !== 'EEXIST' || Date.now() >= deadline) {
                    throw error;
                }
                try {
                    const lock = await fs.stat(this.lockPath);
                    if (Date.now() - lock.mtimeMs >= LOCK_STALE_MS) {
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
        const intent = {
            executionId: `${owner}-${boundary}`,
            inputDigest: sha256(Buffer.from('id,value\n1,2\n')),
            language: 'python',
            image: 'fixture@sha256:' + 'a'.repeat(64),
            scriptDigest: sha256(Buffer.from('fixture')),
        };
        const store = new N3PublicationStore(root);
        await store.initialize();
        if (boundary !== 'before-create') {
            await store.createOrReplay({ ...intent, intentDigest: canonicalIntentDigest(intent) });
        }
        if (boundary === 'after-create') {
            results.push({ owner, boundary, status: (await store.readState()).status });
            continue;
        }
        if (boundary === 'before-create') {
            results.push({ owner, boundary, status: 'not-created' });
            continue;
        }
        const attempt = await store.startAttempt();
        if (boundary === 'before-start' || boundary === 'after-start') {
            results.push({ owner, boundary, status: attempt.status });
            continue;
        }
        if (boundary === 'before-publish') {
            results.push({ owner, boundary, status: (await store.readState()).status });
            continue;
        }
        if (boundary === 'after-artifact') {
            try {
                await store.publish(attempt.currentAttempt, Buffer.from('{"ok":true}\n'), { interruptAfterArtifact: true });
            } catch {
                // Simulated supervisor crash. Recovery below is the assertion.
            }
            const recovered = await store.recoverPublication();
            results.push({ owner, boundary, status: recovered.status, artifactCount: (await store.artifactNames()).length });
            continue;
        }
        await store.publish(attempt.currentAttempt, Buffer.from('{"ok":true}\n'));
        results.push({ owner, boundary, status: (await store.readState()).status });
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
