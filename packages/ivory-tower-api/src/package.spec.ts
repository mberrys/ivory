// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { ExecutionService } from '@ivory-tower/application';
import { CONTRACT_VERSION } from '@ivory-tower/contracts';
import {
    ContentRightsAdmissionPolicy,
    InMemoryExecutionStore,
    InMemorySourceRecordStore,
    SystemClockAdapter,
    SystemExecutionIdAdapter,
} from '@ivory-tower/infrastructure';
import { createApiServer } from './api-server';

describe('@ivory-tower/api package', () => {
    it('serves versioned idempotent execution commands and replayable events', async () => {
        const store = new InMemoryExecutionStore();
        const server = createApiServer({
            executionService: new ExecutionService(store, store, new SystemExecutionIdAdapter(), new SystemClockAdapter()),
            executionStore: store,
        });
        expect(server).to.be.an('object');
        expect(CONTRACT_VERSION).to.equal(1);
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
        const address = server.address();
        if (!(address instanceof Object) || typeof address === 'string') {
            throw new Error('Test server did not expose a TCP address.');
        }
        const baseUrl = `http://127.0.0.1:${address.port}`;
        const create = await fetch(`${baseUrl}/v1/executions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'idempotency-key': 'api-test-1' },
            body: JSON.stringify({ kind: 'convert', input: { sourceId: 'source-1' } }),
        });
        expect(create.status).to.equal(202);
        const execution = (await create.json()) as { id: string };
        const replay = await fetch(`${baseUrl}/v1/executions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'idempotency-key': 'api-test-1' },
            body: JSON.stringify({ kind: 'convert', input: { sourceId: 'source-1' } }),
        });
        expect(replay.status).to.equal(200);
        const invalid = await fetch(`${baseUrl}/v1/executions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'idempotency-key': 'api-test-2' },
            body: JSON.stringify({ kind: 'unknown', input: {} }),
        });
        expect(invalid.status).to.equal(400);
        const cancelled = await fetch(`${baseUrl}/v1/executions/${execution.id}`, { method: 'DELETE' });
        expect(cancelled.status).to.equal(202);
        const events = await fetch(`${baseUrl}/v1/executions/${execution.id}/events`).then(response => response.text());
        expect(events).to.contain('event: status');
        await new Promise<void>(resolve => server.close(() => resolve()));
    });

    it('returns the canonical source record when persistence deduplicates content', async () => {
        const store = new InMemoryExecutionStore();
        const sourceRecords = new InMemorySourceRecordStore();
        const admittedAt = '2026-08-02T12:00:00.000Z';
        const server = createApiServer({
            executionService: new ExecutionService(store, store, new SystemExecutionIdAdapter(), new SystemClockAdapter()),
            executionStore: store,
            objectStore: {
                putImmutable: async key => ({ key, etag: 'etag' }),
                get: async () => new Uint8Array(),
            },
            sourceRecords,
            admission: new ContentRightsAdmissionPolicy('vendorHosted'),
            ids: { next: () => 'requested-source' },
            clock: { now: () => new Date(admittedAt) },
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
        const address = server.address();
        if (!(address instanceof Object) || typeof address === 'string') {
            throw new Error('Test server did not expose a TCP address.');
        }

        try {
            const response = await fetch(`http://127.0.0.1:${address.port}/v1/sources`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/octet-stream',
                    'x-source-filename': 'paper.pdf',
                    'x-source-content-type': 'application/pdf',
                    'x-source-license': 'CC-BY-4.0',
                    'x-source-authorization-evidence': 'open license',
                    'x-source-content-class': 'openLicensed',
                    'x-source-acquisition-route': 'openRepository',
                },
                body: 'source bytes',
            });
            expect(response.status).to.equal(201);
            expect(await response.json()).to.deep.equal({
                sourceId: 'requested-source',
                contentHash: '4d4823794cbed3c4ee0bbc684c8f66e1dfd5afa6f078d494ce254ec5a4671753',
                objectKey: 'sources/4d4823794cbed3c4ee0bbc684c8f66e1dfd5afa6f078d494ce254ec5a4671753',
                admittedAt,
            });
            const persisted = await sourceRecords.getByContentHash('4d4823794cbed3c4ee0bbc684c8f66e1dfd5afa6f078d494ce254ec5a4671753');
            expect(persisted?.ingestPermitted).to.equal(true);
            expect(persisted?.transferPermitted).to.equal(true);
        } finally {
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    });

    it('rejects upload when ingest is refused and does not persist the source', async () => {
        const store = new InMemoryExecutionStore();
        const sourceRecords = new InMemorySourceRecordStore();
        let stored = false;
        const server = createApiServer({
            executionService: new ExecutionService(store, store, new SystemExecutionIdAdapter(), new SystemClockAdapter()),
            executionStore: store,
            objectStore: {
                putImmutable: async key => {
                    stored = true;
                    return { key, etag: 'etag' };
                },
                get: async () => new Uint8Array(),
            },
            sourceRecords,
            admission: new ContentRightsAdmissionPolicy('vendorHosted'),
            ids: { next: () => 'requested-source' },
            clock: { now: () => new Date('2026-08-02T12:00:00.000Z') },
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
        const address = server.address();
        if (!(address instanceof Object) || typeof address === 'string') {
            throw new Error('Test server did not expose a TCP address.');
        }

        try {
            const response = await fetch(`http://127.0.0.1:${address.port}/v1/sources`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/octet-stream',
                    'x-source-filename': 'shadow.pdf',
                    'x-source-content-type': 'application/pdf',
                    'x-source-license': 'unknown',
                    'x-source-authorization-evidence': 'none',
                    'x-source-content-class': 'shadowLibrary',
                },
                body: 'source bytes',
            });
            expect(response.status).to.equal(422);
            expect(stored).to.equal(false);
            const persisted = await sourceRecords.getByContentHash('4d4823794cbed3c4ee0bbc684c8f66e1dfd5afa6f078d494ce254ec5a4671753');
            expect(persisted).to.equal(undefined);
        } finally {
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    });

    it('returns structured readiness checks', async () => {
        const store = new InMemoryExecutionStore();
        const server = createApiServer({
            executionService: new ExecutionService(store, store, new SystemExecutionIdAdapter(), new SystemClockAdapter()),
            executionStore: store,
            readiness: async () => ({
                status: 'ready',
                checks: [
                    { name: 'postgres', status: 'ok' },
                    { name: 'schema', status: 'ok' },
                    { name: 'queue', status: 'ok' },
                    { name: 'objectStore', status: 'ok' },
                    { name: 'docling', status: 'skipped' },
                ],
            }),
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
        const address = server.address();
        if (!(address instanceof Object) || typeof address === 'string') {
            throw new Error('Test server did not expose a TCP address.');
        }
        try {
            const response = await fetch(`http://127.0.0.1:${address.port}/health/ready`);
            expect(response.status).to.equal(200);
            expect(await response.json()).to.deep.equal({
                status: 'ready',
                checks: [
                    { name: 'postgres', status: 'ok' },
                    { name: 'schema', status: 'ok' },
                    { name: 'queue', status: 'ok' },
                    { name: 'objectStore', status: 'ok' },
                    { name: 'docling', status: 'skipped' },
                ],
            });
        } finally {
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    });

    it('returns HTTP 503 when a required readiness check fails', async () => {
        const store = new InMemoryExecutionStore();
        const server = createApiServer({
            executionService: new ExecutionService(store, store, new SystemExecutionIdAdapter(), new SystemClockAdapter()),
            executionStore: store,
            readiness: async () => ({
                status: 'unavailable',
                checks: [
                    { name: 'postgres', status: 'ok' },
                    { name: 'schema', status: 'unavailable' },
                    { name: 'queue', status: 'ok' },
                    { name: 'objectStore', status: 'ok' },
                    { name: 'docling', status: 'skipped' },
                ],
            }),
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
        const address = server.address();
        if (!(address instanceof Object) || typeof address === 'string') {
            throw new Error('Test server did not expose a TCP address.');
        }
        try {
            const response = await fetch(`http://127.0.0.1:${address.port}/health/ready`);
            expect(response.status).to.equal(503);
            expect(response.ok).to.equal(false);
            const body = (await response.json()) as { status: string };
            expect(body.status).to.equal('unavailable');
        } finally {
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    });

    it('does not leak secrets in HTTP 500 bodies', async () => {
        const store = new InMemoryExecutionStore();
        const server = createApiServer({
            executionService: {
                create: async () => {
                    throw new Error('connect postgres://ivory:ivory-development-only@db/ivory');
                },
                get: async () => undefined,
                cancel: async () => undefined,
            } as unknown as ExecutionService,
            executionStore: store,
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
        const address = server.address();
        if (!(address instanceof Object) || typeof address === 'string') {
            throw new Error('Test server did not expose a TCP address.');
        }
        try {
            const response = await fetch(`http://127.0.0.1:${address.port}/v1/executions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'idempotency-key': 'secret-test' },
                body: JSON.stringify({ kind: 'convert', input: { sourceId: 'source-1' } }),
            });
            expect(response.status).to.equal(500);
            const body = await response.text();
            expect(body).not.to.contain('ivory-development-only');
            expect(body).not.to.contain('postgres://ivory:');
            expect(JSON.parse(body)).to.deep.equal({
                error: { code: 'internal_error', message: 'The request could not be completed.' },
            });
        } finally {
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    });
});
