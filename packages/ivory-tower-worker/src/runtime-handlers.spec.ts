// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ExecutionJob, ObjectStorePort } from '@ivory-tower/adapters';
import { expect } from 'chai';
import { createRuntimeExecutionHandlers } from './runtime-handlers';

class MemoryObjects implements ObjectStorePort {
    readonly objects = new Map<string, Uint8Array>();

    async putImmutable(key: string, content: Uint8Array): Promise<{ readonly key: string; readonly etag: string }> {
        if (this.objects.has(key)) {
            throw new Error(`Immutable object already exists: ${key}`);
        }
        this.objects.set(key, content.slice());
        return { key, etag: `etag:${key}` };
    }

    async get(key: string): Promise<Uint8Array> {
        const content = this.objects.get(key);
        if (content === undefined) {
            throw new Error(`Missing object: ${key}`);
        }
        return content.slice();
    }
}

describe('runtime execution handlers', () => {
    it('loads an admitted immutable source, calls Docling, and stores an immutable conversion artifact', async () => {
        const objects = new MemoryObjects();
        const contentHash = 'a'.repeat(64);
        await objects.putImmutable(`sources/${contentHash}`, new TextEncoder().encode('source bytes'));
        const progress: unknown[] = [];
        const handlers = createRuntimeExecutionHandlers(objects, {
            convert: async request => ({
                artifactKey: `conversions/${request.contentHash}/docling.md`,
                parserVersion: request.parserVersion,
                artifact: new TextEncoder().encode('# Converted'),
                artifactContentType: 'text/markdown',
                normalizedPassages: [{ text: '# Converted' }],
            }),
        });
        const job: ExecutionJob = {
            executionId: 'execution-1',
            kind: 'convert',
            contractVersion: 1,
            attempt: 0,
            jobKey: 'execution:1',
            input: { contentHash, filename: 'paper.pdf', contentType: 'application/pdf' },
        };
        const result = await handlers.get('convert')!(job, {
            signal: new AbortController().signal,
            reportProgress: async (value, payload) => {
                progress.push({ value, payload });
            },
        });
        expect(result).to.deep.include({ artifactKey: `conversions/${contentHash}/docling.md` });
        expect(objects.objects.has(`conversions/${contentHash}/docling.md`)).to.equal(true);
        expect(progress).to.have.length(3);
    });
});
