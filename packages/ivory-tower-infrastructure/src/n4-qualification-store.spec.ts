// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { InMemoryN4QualificationStore } from './in-memory-n4-qualification-store';

const now = '2026-09-08T00:00:00.000Z';
const hash = 'a'.repeat(64);
const project = (id: string) => ({ id, name: id, createdAt: now });
const representation = {
    id: 'rep-baseline', sourceVersionId: 'sv_1', artifactId: 'art_1', contentHash: hash,
    objectKey: `conversions/${hash}/v1.md`, contentType: 'text/markdown', converterRef: 'docling-v1', text: 'An inspectable fixture passage.', createdAt: now,
};
const storedAnchor = {
    id: 'anchor-1', projectId: 'n4-a', representationId: representation.id, sourceVersionId: 'sv_1', artifactId: 'art_1',
    spans: [{ start: 3, end: 14 }], quote: { prefixDigest: 'a', exactDigest: 'b', suffixDigest: 'c', normalizationVersion: 'nfc-ws-v1' },
    confidence: 'exact' as const, createdAt: now,
};

describe('N4 qualification persistence', () => {
    it('reopens immutable representations and anchors without retaining source text in the anchor', async () => {
        const store = new InMemoryN4QualificationStore();
        await store.ensureProject(project('n4-a'));
        await store.addSourceToProject('n4-a', hash);
        await store.persistRepresentation(representation);
        await store.saveAnchor(storedAnchor);
        expect(await store.getRepresentation(representation.id)).to.deep.equal(representation);
        expect(await store.listAnchors('n4-a')).to.deep.equal([storedAnchor]);
        let error: unknown;
        try {
            await store.persistRepresentation({ ...representation, text: 'rewritten' });
        } catch (caught) {
            error = caught;
        }
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.contain('immutable');
    });

    it('copies only permitted project membership and records denied transfers without mutation', async () => {
        const store = new InMemoryN4QualificationStore();
        await store.ensureProject(project('n4-a'));
        await store.ensureProject(project('n4-b'));
        await store.addSourceToProject('n4-a', hash);
        await store.persistRepresentation(representation);
        await store.saveAnchor(storedAnchor);
        await store.recordTransfer({ sourceProjectId: 'n4-a', targetProjectId: 'n4-b', contentHash: hash, allowed: false, reason: 'rights denied', occurredAt: now });
        expect(await store.listProjectSourceHashes('n4-b')).to.deep.equal([]);
        expect(await store.listAnchors('n4-b')).to.deep.equal([]);
        await store.recordTransfer({ sourceProjectId: 'n4-a', targetProjectId: 'n4-b', contentHash: hash, allowed: true, reason: 'open licence', occurredAt: now });
        expect(await store.listProjectSourceHashes('n4-b')).to.deep.equal([hash]);
        expect(await store.listAnchors('n4-b')).to.deep.equal([storedAnchor]);
        expect(store.transfers).to.have.length(2);
    });
});
