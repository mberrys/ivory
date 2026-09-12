// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFragmentAnchor, remapFragmentAnchor } from '@theia/ivory-identity/lib/node/fragment-anchor';
import { BASELINE_INPUTS, runPipeline } from '@theia/ivory-identity/lib/node/test/identity-fixtures';
import { expect } from 'chai';
import { InMemoryN4QualificationStore } from './in-memory-n4-qualification-store';

interface Fixture { path: string; kind: string; sha256: string; }
interface Manifest { schemaVersion: number; fixtures: Fixture[]; }
const root = resolve(__dirname, '../../..');
const corpusRoot = resolve(root, 'fixtures/n4');
const manifest = JSON.parse(readFileSync(resolve(corpusRoot, 'manifest.json'), 'utf8')) as Manifest;

describe('N4 corpus qualification contract', () => {
    it('pins 20 real fixtures with the required media coverage', () => {
        expect(manifest.schemaVersion).to.equal(1);
        expect(manifest.fixtures).to.have.length(20);
        expect(manifest.fixtures.filter(fixture => fixture.path.endsWith('.pdf'))).to.have.length(18);
        expect(manifest.fixtures.filter(fixture => fixture.path.endsWith('.csv'))).to.have.length(2);
        expect(manifest.fixtures.filter(fixture => fixture.kind === 'scanned')).to.have.length(2);
        for (const fixture of manifest.fixtures) {
            const bytes = readFileSync(resolve(corpusRoot, fixture.path));
            expect(createHash('sha256').update(bytes).digest('hex')).to.equal(fixture.sha256);
        }
    });

    it('persists 100 anchors across a changed converter representation with zero false exact matches', async () => {
        const store = new InMemoryN4QualificationStore();
        const now = '2026-09-08T00:00:00.000Z';
        await store.ensureProject({ id: 'n4-baseline', name: 'N4 baseline', createdAt: now });
        let count = 0;
        for (const fixture of manifest.fixtures) {
            const contentHash = fixture.sha256;
            const bytes = readFileSync(resolve(corpusRoot, fixture.path));
            const baselineIdentity = runPipeline({ ...BASELINE_INPUTS, bytes, parserVersion: 'docling-serve-v1.21.0' });
            const upgradedIdentity = runPipeline({ ...BASELINE_INPUTS, bytes, parserVersion: 'docling-serve-v1.22.0' });
            const baselineText = Array.from({ length: 5 }, (_, index) => `Fixture ${fixture.path} anchor ${index + 1}.`).join('\n');
            const baselineId = `rep-${contentHash.slice(0, 12)}-v121`;
            const upgradedId = `rep-${contentHash.slice(0, 12)}-v122`;
            await store.addSourceToProject('n4-baseline', contentHash);
            await store.persistRepresentation({ id: baselineId, sourceVersionId: baselineIdentity.sourceVersionId, artifactId: baselineIdentity.extractionArtifactId, contentHash, objectKey: `conversions/${contentHash}/v121.md`, contentType: 'text/markdown', converterRef: 'docling-serve:v1.21.0', text: baselineText, createdAt: now });
            await store.persistRepresentation({ id: upgradedId, sourceVersionId: upgradedIdentity.sourceVersionId, artifactId: upgradedIdentity.extractionArtifactId, contentHash, objectKey: `conversions/${contentHash}/v122.md`, contentType: 'text/markdown', converterRef: 'docling-serve:v1.22.0', text: baselineText, createdAt: now });
            for (let index = 0; index < 5; index += 1) {
                const exact = `Fixture ${fixture.path} anchor ${index + 1}.`;
                const start = baselineText.indexOf(exact);
                const previous = { sourceVersionId: baselineIdentity.sourceVersionId, artifactId: baselineIdentity.extractionArtifactId, text: baselineText };
                const next = { sourceVersionId: upgradedIdentity.sourceVersionId, artifactId: upgradedIdentity.extractionArtifactId, text: baselineText };
                const anchor = createFragmentAnchor(previous, [{ start, end: start + exact.length }]);
                const result = remapFragmentAnchor(anchor, previous, next);
                expect(result.outcome).to.equal('exact');
                expect(result.anchor?.confidence).to.equal('approximate');
                expect(result.candidates).to.have.length(1);
                expect(result.candidates[0].inspectable.exact).to.equal(exact);
                await store.saveAnchor({ id: `${baselineId}-${index}`, projectId: 'n4-baseline', representationId: baselineId, sourceVersionId: anchor.sourceVersionId, artifactId: anchor.artifactId, spans: anchor.spans, quote: anchor.quote, confidence: anchor.confidence, createdAt: now });
                count += 1;
            }
        }
        expect(count).to.equal(100);
        expect(await store.listAnchors('n4-baseline')).to.have.length(100);
    });
});
