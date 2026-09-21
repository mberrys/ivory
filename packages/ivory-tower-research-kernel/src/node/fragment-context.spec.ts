// *****************************************************************************
// Copyright (C) 2026 Berry Studio and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { ResearchKernel, ResearchKernelError } from './kernel';
import { EvidenceLinkPayload, FragmentPayload, MechanicalCitationReceipt } from './types';

describe('V41-P02 fragment context and exact evidence', () => {
    it('binds Fragment identity to an exact representation, converter profile, ordered span, and structural context', () => {
        const kernel = new ResearchKernel();
        const retained = 'Results\nThe effect was 12%.\nFootnote: subgroup only.';
        const source = kernel.admitSource({ name: 'study', bytes: retained, actor: 'Maya' });
        const artifact = kernel.admitArtifact({
            key: 'converted-study',
            sourceRefs: [source],
            output: retained,
            actor: 'Maya',
            transformation: 'fixture.converter',
        });
        const quote = 'The effect was 12%.';
        const heading = 'Results';
        const limitation = 'Footnote: subgroup only.';
        const fragment = kernel.createFragment({
            sourceRef: source,
            artifactRef: artifact,
            representation: 'artifact',
            profile: {
                converter: 'fixture.converter',
                converterRevision: '2.0.0',
                selectorProfileRevision: 'text-offset-v2',
            },
            selector: {
                kind: 'text',
                start: retained.indexOf(quote),
                end: retained.indexOf(quote) + quote.length,
                quote,
            },
            context: {
                state: 'applicable',
                references: [
                    {
                        kind: 'heading',
                        representation: 'artifact',
                        selector: {
                            kind: 'text',
                            start: retained.indexOf(heading),
                            end: retained.indexOf(heading) + heading.length,
                            quote: heading,
                        },
                    },
                    {
                        kind: 'limitation',
                        representation: 'artifact',
                        selector: {
                            kind: 'text',
                            start: retained.indexOf(limitation),
                            end: retained.indexOf(limitation) + limitation.length,
                            quote: limitation,
                        },
                    },
                ],
            },
            actor: 'Maya',
            fragmentKey: 'effect',
        });

        const payload = kernel.getRevision(fragment).payload as FragmentPayload;
        const artifactPayload = kernel.getRevision(artifact).payload as { outputDigest: string };
        expect(payload.anchor.brand).to.equal('ivory.fragment-anchor/1');
        expect(payload.anchor.representation).to.equal('artifact');
        expect(payload.anchor.representationRef).to.deep.equal(artifact);
        expect(payload.anchor.representationDigest).to.equal(artifactPayload.outputDigest);
        expect(payload.anchor.selectorKind).to.equal('text');
        expect(payload.anchor.converter).to.equal('fixture.converter');
        expect(payload.anchor.converterRevision).to.equal('2.0.0');
        expect(payload.anchor.selectorProfileRevision).to.equal('text-offset-v2');
        expect(payload.anchor.orderedSpanIdentity).to.match(/^spn_/);
        expect(payload.context.state).to.equal('applicable');
        if (payload.context.state === 'applicable') {
            expect(payload.context.references.map(reference => reference.kind)).to.deep.equal(['heading', 'limitation']);
            expect(
                payload.context.references.every(reference => reference.orderedSpanIdentity !== payload.anchor.orderedSpanIdentity),
            ).to.equal(true);
        }

        const receipt = kernel.verifyCitation(fragment);
        expect(receipt.status).to.equal('EXACT');
        expect(receipt.checks).to.deep.equal({
            representationDigest: true,
            selectorBytes: true,
            context: 'exact',
        });
        expect(receipt.semanticSupport).to.equal('not-assessed');
    });

    it('keeps context states explicit and rejects hidden or synthetic context', () => {
        const kernel = new ResearchKernel();
        const text = 'Header\nQuoted sentence.';
        const source = kernel.admitSource({ name: 'study', bytes: text, actor: 'Maya' });
        const artifact = kernel.admitArtifact({ key: 'converted', sourceRefs: [source], output: text, actor: 'Maya' });
        const quote = 'Quoted sentence.';
        const selector = {
            kind: 'text' as const,
            start: text.indexOf(quote),
            end: text.indexOf(quote) + quote.length,
            quote,
        };

        expect(() =>
            kernel.createFragment({
                sourceRef: source,
                artifactRef: artifact,
                representation: 'artifact',
                selector: { ...selector, prefix: 'wrong-prefix' },
                context: { state: 'not-applicable', basis: 'no-material-structure', reason: 'selector profile probe' },
                actor: 'Maya',
                fragmentKey: 'wrong-prefix',
            }),
        ).to.throw('retained artifact representation selected for the Fragment');

        expect(() =>
            kernel.createFragment({
                sourceRef: source,
                artifactRef: artifact,
                representation: 'artifact',
                selector,
                context: { state: 'applicable', references: [] },
                actor: 'Maya',
                fragmentKey: 'missing-context',
            }),
        ).to.throw('bounded references');

        expect(() =>
            kernel.createFragment({
                sourceRef: source,
                artifactRef: artifact,
                representation: 'artifact',
                selector,
                context: { state: 'not-applicable', basis: 'no-material-structure', reason: '   ' },
                actor: 'Maya',
                fragmentKey: 'fake-na',
            }),
        ).to.throw('no-material-structure');

        expect(() =>
            kernel.createFragment({
                sourceRef: source,
                artifactRef: artifact,
                representation: 'artifact',
                selector,
                context: {
                    state: 'applicable',
                    references: [{ kind: 'other', representation: 'artifact', selector }],
                },
                actor: 'Maya',
                fragmentKey: 'same-boundary',
            }),
        ).to.throw('separate exact references');

        const legacy = kernel.createFragment({
            sourceRef: source,
            artifactRef: artifact,
            selector,
            actor: 'Maya',
            fragmentKey: 'legacy-no-context',
        });
        expect(kernel.verifyCitation(legacy).status).to.equal('BLOCKED');
        expect(kernel.verifyCitation(legacy).checks.context).to.equal('unavailable');
    });

    it('stores cited and context Fragment roles on EvidenceLink without moving selector identity out of Fragment', () => {
        const kernel = new ResearchKernel();
        const text = 'Header\nQuoted sentence.\nLimitation.';
        const source = kernel.admitSource({ name: 'study', bytes: text, actor: 'Maya' });
        const artifact = kernel.admitArtifact({ key: 'converted', sourceRefs: [source], output: text, actor: 'Maya' });
        const create = (key: string, quote: string) =>
            kernel.createFragment({
                sourceRef: source,
                artifactRef: artifact,
                representation: 'artifact',
                selector: {
                    kind: 'text',
                    start: text.indexOf(quote),
                    end: text.indexOf(quote) + quote.length,
                    quote,
                },
                context: { state: 'unavailable', reason: 'the EvidenceLink role fixture has not inspected source structure' },
                actor: 'Maya',
                fragmentKey: key,
            });
        const cited = create('cited', 'Quoted sentence.');
        const context = create('context', 'Limitation.');
        const claim = kernel.createClaim({ key: 'claim', text: 'A bounded claim.', author: 'Maya' });
        const link = kernel.createEvidenceLink({
            key: 'link',
            claimRef: claim,
            targets: [cited, context],
            fragmentTargets: [
                { ref: cited, role: 'cited' },
                { ref: context, role: 'context' },
            ],
            role: 'qualifies',
            rationale: 'The limitation qualifies the exact cited statement.',
            linkAuthor: 'Maya',
        });
        const payload = kernel.getRevision(link).payload as EvidenceLinkPayload;
        expect(payload.fragmentTargets).to.deep.equal([
            { ref: cited, role: 'cited' },
            { ref: context, role: 'context' },
        ]);

        expect(() =>
            kernel.createEvidenceLink({
                key: 'missing-role',
                claimRef: claim,
                targets: [cited, context],
                fragmentTargets: [{ ref: cited, role: 'cited' }],
                role: 'supports',
                rationale: 'invalid',
                linkAuthor: 'Maya',
            }),
        ).to.throw('every Fragment target');
    });

    it('emits EXACT, AMBIGUOUS, and UNRESOLVED remap results without guessing or rewriting history', () => {
        const kernel = new ResearchKernel();
        const source = kernel.admitSource({ name: 'study', bytes: 'retained source bytes', actor: 'Maya' });
        const originalText = 'Header\nTarget statement.\nLimitation: pilot only.';
        const originalArtifact = kernel.admitArtifact({
            key: 'converter-v1',
            sourceRefs: [source],
            output: originalText,
            actor: 'Maya',
        });
        const target = 'Target statement.';
        const limitation = 'Limitation: pilot only.';
        const fragment = kernel.createFragment({
            sourceRef: source,
            artifactRef: originalArtifact,
            representation: 'artifact',
            profile: {
                converter: 'fixture.converter',
                converterRevision: '1',
                selectorProfileRevision: 'text-offset-v1',
            },
            selector: {
                kind: 'text',
                start: originalText.indexOf(target),
                end: originalText.indexOf(target) + target.length,
                quote: target,
            },
            context: {
                state: 'applicable',
                references: [
                    {
                        kind: 'limitation',
                        representation: 'artifact',
                        selector: {
                            kind: 'text',
                            start: originalText.indexOf(limitation),
                            end: originalText.indexOf(limitation) + limitation.length,
                            quote: limitation,
                        },
                    },
                ],
            },
            actor: 'Maya',
            fragmentKey: 'target',
        });
        const originalPayload = kernel.getRevision(fragment).payload as FragmentPayload;

        const exactText = 'Changed header\nTarget statement.\nLimitation: pilot only.';
        const exactArtifact = kernel.admitArtifact({
            key: 'converter-v2-exact',
            sourceRefs: [source],
            output: exactText,
            actor: 'Maya',
        });
        const exact = kernel.remapFragment({
            fragmentRef: fragment,
            expectedHead: fragment.revisionId,
            artifactRef: exactArtifact,
            representation: 'artifact',
            profile: {
                converter: 'fixture.converter',
                converterRevision: '2',
                selectorProfileRevision: 'text-offset-v2',
            },
            actor: 'Maya',
        });
        expect(exact.status).to.equal('EXACT');
        expect(exact.to).to.not.equal(undefined);
        expect(exact.to?.objectId).to.equal(fragment.objectId);
        expect(exact.to?.revisionId).to.not.equal(fragment.revisionId);
        expect(kernel.getRevision(fragment).payload).to.deep.equal(originalPayload);
        expect(kernel.getHead(fragment.objectId)).to.equal(exact.to?.revisionId);

        const ambiguousArtifact = kernel.admitArtifact({
            key: 'converter-v3-ambiguous',
            sourceRefs: [source],
            output: 'Target statement.\nnoise\nTarget statement.\nLimitation: pilot only.',
            actor: 'Maya',
        });
        const ambiguous = kernel.remapFragment({
            fragmentRef: exact.to!,
            expectedHead: exact.to!.revisionId,
            artifactRef: ambiguousArtifact,
            representation: 'artifact',
            profile: {
                converter: 'fixture.converter',
                converterRevision: '3',
                selectorProfileRevision: 'text-offset-v3',
            },
            actor: 'Maya',
        });
        expect(ambiguous.status).to.equal('AMBIGUOUS');
        expect(ambiguous.candidateSelectors).to.have.length(2);
        expect(kernel.getHead(fragment.objectId)).to.equal(exact.to?.revisionId);

        const unresolvedArtifact = kernel.admitArtifact({
            key: 'converter-v4-unresolved',
            sourceRefs: [source],
            output: 'Different statement.\nLimitation: pilot only.',
            actor: 'Maya',
        });
        const unresolved = kernel.remapFragment({
            fragmentRef: exact.to!,
            expectedHead: exact.to!.revisionId,
            artifactRef: unresolvedArtifact,
            representation: 'artifact',
            profile: {
                converter: 'fixture.converter',
                converterRevision: '4',
                selectorProfileRevision: 'text-offset-v4',
            },
            actor: 'Maya',
        });
        expect(unresolved.status).to.equal('UNRESOLVED');
        expect(unresolved.candidateSelectors).to.deep.equal([]);
        expect(kernel.getHead(fragment.objectId)).to.equal(exact.to?.revisionId);
    });

    it('rejects converter/profile drift through createFragment and yields deterministic mechanical receipts from exact reconstruction', () => {
        const build = (): { kernel: ResearchKernel; receipt: MechanicalCitationReceipt } => {
            const kernel = new ResearchKernel();
            const text = 'Quoted statement.';
            const source = kernel.admitSource({ name: 'study', bytes: text, actor: 'Maya' });
            const artifact = kernel.admitArtifact({ key: 'converted', sourceRefs: [source], output: text, actor: 'Maya' });
            const fragment = kernel.createFragment({
                sourceRef: source,
                artifactRef: artifact,
                representation: 'artifact',
                profile: {
                    converter: 'fixture.converter',
                    converterRevision: '1',
                    selectorProfileRevision: 'text-offset-v1',
                },
                selector: { kind: 'text', start: 0, end: text.length, quote: text },
                context: { state: 'not-applicable', basis: 'no-material-structure', reason: 'single sentence fixture' },
                actor: 'Maya',
                fragmentKey: 'quote',
            });
            expect(() =>
                kernel.createFragment({
                    sourceRef: source,
                    artifactRef: artifact,
                    representation: 'artifact',
                    profile: {
                        converter: 'fixture.converter',
                        converterRevision: '2',
                        selectorProfileRevision: 'text-offset-v2',
                    },
                    selector: { kind: 'text', start: 0, end: text.length, quote: text },
                    context: { state: 'not-applicable', basis: 'no-material-structure', reason: 'single sentence fixture' },
                    actor: 'Maya',
                    fragmentKey: 'quote',
                }),
            ).to.throw(ResearchKernelError);
            return { kernel, receipt: kernel.verifyCitation(fragment) };
        };

        const first = build();
        const reconstructed = build();
        expect(first.receipt.status).to.equal('EXACT');
        expect(reconstructed.receipt.status).to.equal('EXACT');
        expect(first.receipt.receiptDigest).to.equal(reconstructed.receipt.receiptDigest);
    });

    it('rejects not-applicable when structural context could be concealed, without writing a Fragment', () => {
        const quote = 'The effect was 12%.';
        for (const heading of [
            'Table header: treatment',
            'Units: percent',
            'Denominator: 50',
            'Legend: red is control',
            'Footnote: subgroup only',
            'Methods: pilot study',
            'Limitations: pilot only',
            'Figure 1',
        ]) {
            const kernel = new ResearchKernel();
            const text = `${heading}\n${quote}`;
            const source = kernel.admitSource({ name: heading, bytes: text, actor: 'Maya' });
            const artifact = kernel.admitArtifact({ key: heading, sourceRefs: [source], output: text, actor: 'Maya' });
            const before = kernel.sequence;
            expect(() =>
                kernel.createFragment({
                    sourceRef: source,
                    artifactRef: artifact,
                    representation: 'artifact',
                    selector: {
                        kind: 'text',
                        start: text.indexOf(quote),
                        end: text.indexOf(quote) + quote.length,
                        quote,
                    },
                    context: { state: 'not-applicable', basis: 'no-material-structure', reason: 'context does not matter' },
                    actor: 'Maya',
                    fragmentKey: heading,
                }),
            ).to.throw('not-applicable Fragment context is unproven');
            expect(kernel.sequence).to.equal(before);
        }
    });

    it('accepts only a bounded standalone no-structure witness and rejects inconsistent source/artifact lineage', () => {
        const kernel = new ResearchKernel();
        const quote = 'The effect was 12%.';
        const source = kernel.admitSource({ name: 'standalone', bytes: quote, actor: 'Maya' });
        const artifact = kernel.admitArtifact({ key: 'standalone', sourceRefs: [source], output: quote, actor: 'Maya' });
        const fragment = kernel.createFragment({
            sourceRef: source,
            artifactRef: artifact,
            representation: 'artifact',
            selector: { kind: 'text', start: 0, end: quote.length, quote },
            context: { state: 'not-applicable', basis: 'no-material-structure', reason: 'entire single-line retained representation' },
            actor: 'Maya',
            fragmentKey: 'standalone',
        });
        expect(kernel.verifyCitation(fragment).checks.context).to.equal('not-applicable');

        const otherSource = kernel.admitSource({ name: 'other study', bytes: quote, actor: 'Maya' });
        const before = kernel.sequence;
        expect(() =>
            kernel.createFragment({
                sourceRef: otherSource,
                artifactRef: artifact,
                representation: 'artifact',
                selector: { kind: 'text', start: 0, end: quote.length, quote },
                context: { state: 'not-applicable', basis: 'no-material-structure', reason: 'unrelated source' },
                actor: 'Maya',
                fragmentKey: 'cross-source',
            }),
        ).to.throw('exact selected source revision');
        expect(kernel.sequence).to.equal(before);

        const tableKernel = new ResearchKernel();
        const tableSource = tableKernel.admitSource({ name: 'table', bytes: '12%', actor: 'Maya' });
        const tableArtifact = tableKernel.admitArtifact({
            key: 'table',
            sourceRefs: [tableSource],
            output: '12%',
            actor: 'Maya',
        });
        expect(() =>
            tableKernel.createFragment({
                sourceRef: tableSource,
                artifactRef: tableArtifact,
                selector: { kind: 'table', sheet: 'Table 1', row: 1, column: 'effect', value: '12%' },
                context: { state: 'not-applicable', basis: 'no-material-structure', reason: 'table cannot waive structure' },
                actor: 'Maya',
                fragmentKey: 'table',
            }),
        ).to.throw('not-applicable Fragment context is unproven');
    });

    it('does not infer absent structure from an excerpt or a material qualifier inside one line', () => {
        const kernel = new ResearchKernel();
        const source = kernel.admitSource({
            name: 'study',
            bytes: 'Table header: treatment\\nThe effect was 12%.',
            actor: 'Maya',
        });
        const artifact = kernel.admitArtifact({
            key: 'excerpt',
            sourceRefs: [source],
            output: 'The effect was 12%.',
            actor: 'Maya',
        });
        expect(() =>
            kernel.createFragment({
                sourceRef: source,
                artifactRef: artifact,
                representation: 'artifact',
                selector: { kind: 'text', start: 0, end: 19, quote: 'The effect was 12%.' },
                context: { state: 'not-applicable', basis: 'no-material-structure', reason: 'excerpt only' },
                actor: 'Maya',
            }),
        ).to.throw('not-applicable Fragment context is unproven');

        const material = 'Methods: pilot sample only.';
        const materialSource = kernel.admitSource({ name: 'methods', bytes: material, actor: 'Maya' });
        const materialArtifact = kernel.admitArtifact({
            key: 'methods',
            sourceRefs: [materialSource],
            output: material,
            actor: 'Maya',
        });
        expect(() =>
            kernel.createFragment({
                sourceRef: materialSource,
                artifactRef: materialArtifact,
                selector: { kind: 'text', start: 0, end: material.length, quote: material },
                context: { state: 'not-applicable', basis: 'no-material-structure', reason: 'has structured method' },
                actor: 'Maya',
            }),
        ).to.throw('not-applicable Fragment context is unproven');
    });
});
