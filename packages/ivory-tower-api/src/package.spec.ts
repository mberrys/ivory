// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { ExecutionService } from '@ivory-tower/application';
import { CONTRACT_VERSION } from '@ivory-tower/contracts';
import {
    ContentRightsAdmissionPolicy,
    InMemoryExecutionStore,
    InMemoryResearchService,
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

    describe('@ivory-tower/api research service routes', () => {
        const fixturesDir = require('node:path').resolve(__dirname, '../../../examples/ivory-n5-browser/fixtures');

        it('serves project-open, citation resolution, RunSpec resolution, and revision edits from the fixture service', async () => {
            const store = new InMemoryExecutionStore();
            const research = new InMemoryResearchService({ fixturesDir });
            const server = createApiServer({
                executionService: new ExecutionService(store, store, new SystemExecutionIdAdapter(), new SystemClockAdapter()),
                executionStore: store,
                research,
            });
            await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
            try {
                const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
                const reset = await fetch(`${base}/v1/fixtures/reset`, {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ projectId: 'n5-demo' }),
                });
                expect(reset.status).to.equal(200);
                const resetBody = (await reset.json()) as { revision: string; entryPaths: string[]; sourceHashes: Record<string, string> };
                expect(resetBody.revision).to.equal('rev-1');
                expect(resetBody.entryPaths).to.include('research.py');
                expect(Object.keys(resetBody.sourceHashes).length).to.be.greaterThan(0);

                const open = await fetch(`${base}/v1/projects/open`, {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ projectId: 'n5-demo' }),
                });
                expect(open.status).to.equal(200);
                expect((await open.json()) as { revision: string }).to.deep.include({ revision: 'rev-1' });

                const cite = await fetch(`${base}/v1/citations/resolve`, {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ projectId: 'n5-demo', revision: 'rev-1', citationId: 'cite-research-py' }),
                });
                expect(cite.status).to.equal(200);
                const citation = (await cite.json()) as { anchor: { sourcePath: string; passage: string; startOffset: number; endOffset: number; contentHash: string } };
                expect(citation.anchor.sourcePath).to.equal('research.py');
                expect(citation.anchor.passage).to.equal(citation.anchor.passage.slice(0, citation.anchor.passage.length));
                expect(citation.anchor.contentHash).to.match(/^[a-f0-9]{64}$/);

                const stale = await fetch(`${base}/v1/citations/resolve`, {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ projectId: 'n5-demo', revision: 'rev-999', citationId: 'cite-research-py' }),
                });
                expect(stale.status).to.equal(409);

                const spec = await fetch(`${base}/v1/runspecs/resolve`, {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ projectId: 'n5-demo', revision: 'rev-1', protocolVersionId: 'proto-1' }),
                });
                expect(spec.status).to.equal(200);
                const run = (await spec.json()) as { resolvedRunSpec: { protocolVersionRef?: unknown; commands: string[] } };
                expect(run.resolvedRunSpec.protocolVersionRef).to.be.an('object');
                expect(run.resolvedRunSpec.commands.length).to.be.greaterThan(0);

                const edit = await fetch(`${base}/v1/projects/edits`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', 'idempotency-key': 'edit-1' },
                    body: JSON.stringify({
                        projectId: 'n5-demo', baseRevision: 'rev-1', sourcePath: 'research.py',
                        edit: { kind: 'replace', startOffset: 0, endOffset: 4, text: '# edited\n' },
                    }),
                });
                expect(edit.status).to.equal(200);
                const edited = (await edit.json()) as { newRevision: string };
                expect(edited.newRevision).to.equal('rev-2');

                const conflict = await fetch(`${base}/v1/projects/edits`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', 'idempotency-key': 'edit-2' },
                    body: JSON.stringify({
                        projectId: 'n5-demo', baseRevision: 'rev-1', sourcePath: 'research.py',
                        edit: { kind: 'replace', startOffset: 0, endOffset: 4, text: '# other\n' },
                    }),
                });
                expect(conflict.status).to.equal(409);
                const conflictBody = (await conflict.json()) as { code: string; headRevision: string; rejectedRequest: unknown };
                expect(conflictBody.code).to.equal('revision_conflict');
                expect(conflictBody.headRevision).to.equal('rev-2');
                expect(conflictBody.rejectedRequest).to.be.an('object');

                const replay = await fetch(`${base}/v1/projects/edits`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', 'idempotency-key': 'edit-1' },
                    body: JSON.stringify({
                        projectId: 'n5-demo', baseRevision: 'rev-1', sourcePath: 'research.py',
                        edit: { kind: 'replace', startOffset: 0, endOffset: 4, text: '# edited\n' },
                    }),
                });
                expect(replay.status).to.equal(202);
                expect((await replay.json()) as { newRevision: string }).to.deep.include({ newRevision: 'rev-2' });
            } finally {
                await new Promise<void>(resolve => server.close(() => resolve()));
            }
        });

        it('returns 503 research_service_unavailable without the fixture service', async () => {
            const store = new InMemoryExecutionStore();
            const server = createApiServer({
                executionService: new ExecutionService(store, store, new SystemExecutionIdAdapter(), new SystemClockAdapter()),
                executionStore: store,
            });
            await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
            try {
                const response = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/v1/projects/open`, {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ projectId: 'n5-demo' }),
                });
                expect(response.status).to.equal(503);
            } finally {
                await new Promise<void>(resolve => server.close(() => resolve()));
            }
        });
    });
});
