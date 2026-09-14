// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { createFragmentAnchor, remapFragmentAnchor, TextRepresentation } from './fragment-anchor';
import { BASELINE_INPUTS, mutate, revisedDocumentBytes, runPipeline } from './test/identity-fixtures';

const identities = runPipeline(BASELINE_INPUTS);
const revisedSourceVersionId = runPipeline(mutate({ bytes: revisedDocumentBytes() })).sourceVersionId;

function representation(
    text: string,
    artifactId = identities.extractionArtifactId,
    sourceVersionId = identities.sourceVersionId,
): TextRepresentation {
    return {
        sourceVersionId,
        artifactId,
        text,
        coordinates: [{ page: 2, x: 10, y: 20, width: 100, height: 12, unit: 'pt' }],
    };
}

describe('fragment anchors', () => {
    it('keeps exact position, inspectable quote, and page coordinates on reopen', () => {
        const current = representation('A stable evidence fragment.');
        const anchor = createFragmentAnchor(current, [{ start: 2, end: 26 }]);
        const reopened = remapFragmentAnchor(anchor, current, current);

        expect(reopened.outcome).to.equal('exact');
        expect(reopened.anchor?.confidence).to.equal('exact');
        expect(reopened.candidates[0].inspectable.exact).to.equal('stable evidence fragment');
        expect(reopened.candidates[0].inspectable.coordinates[0].page).to.equal(2);
    });

    it('recovers a unique quote after representation changes without upgrading it to exact position', () => {
        const previous = representation('prefix target quote suffix', 'art_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
        const next = representation('prefix\n target   quote suffix', 'art_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
        const anchor = createFragmentAnchor(previous, [{ start: 7, end: 19 }]);
        const remapped = remapFragmentAnchor(anchor, previous, next);

        expect(remapped.outcome).to.equal('exact');
        expect(remapped.anchor?.confidence).to.equal('approximate');
        expect(remapped.anchor?.artifactId).to.equal(next.artifactId);
        expect(remapped.candidates[0].spans).to.deep.equal([{ start: 8, end: 22 }]);
        expect(remapped.candidates[0].inspectable.exact).to.equal('target   quote');
    });

    it('preserves character offsets when a quotation is a substring of a token', () => {
        const previous = representation('foobar', 'art_14141414141414141414141414141414');
        const next = representation('foobar', 'art_15151515151515151515151515151515');
        const anchor = createFragmentAnchor(previous, [{ start: 1, end: 4 }]);
        const remapped = remapFragmentAnchor(anchor, previous, next);

        expect(remapped.outcome).to.equal('exact');
        expect(remapped.anchor?.confidence).to.equal('approximate');
        expect(remapped.candidates[0].spans).to.deep.equal([{ start: 1, end: 4 }]);
        expect(remapped.candidates[0].inspectable.exact).to.equal('oob');
        expect(remapped.anchor?.spans).to.deep.equal([{ start: 1, end: 4 }]);
    });

    it('treats overlapping quotations as ambiguous rather than a single exact hit', () => {
        const previous = representation('aaa', 'art_16161616161616161616161616161616');
        const next = representation('aaaa', 'art_17171717171717171717171717171717');
        const anchor = createFragmentAnchor(previous, [{ start: 0, end: 3 }]);
        const remapped = remapFragmentAnchor(anchor, previous, next);

        expect(remapped.outcome).to.equal('ambiguous');
        expect(remapped.anchor).to.equal(undefined);
        expect(remapped.candidates).to.have.length(2);
        expect(remapped.candidates[0].spans).to.deep.equal([{ start: 0, end: 3 }]);
        expect(remapped.candidates[1].spans).to.deep.equal([{ start: 1, end: 4 }]);
        expect(remapped.candidates.map(candidate => candidate.inspectable.exact)).to.deep.equal(['aaa', 'aaa']);
    });

    it('reports repeated quotations as ambiguous rather than guessing', () => {
        const previous = representation('target', 'art_cccccccccccccccccccccccccccccccc');
        const next = representation('target target', 'art_dddddddddddddddddddddddddddddddd');
        const anchor = createFragmentAnchor(previous, [{ start: 0, end: 6 }]);

        const remapped = remapFragmentAnchor(anchor, previous, next);

        expect(remapped.outcome).to.equal('ambiguous');
        expect(remapped.anchor).to.equal(undefined);
        expect(remapped.candidates).to.have.length(2);
    });

    it('reports changed evidence as unresolved', () => {
        const previous = representation('target', 'art_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
        const next = representation('corrected evidence', 'art_ffffffffffffffffffffffffffffffff');
        const anchor = createFragmentAnchor(previous, [{ start: 0, end: 6 }]);

        expect(remapFragmentAnchor(anchor, previous, next).outcome).to.equal('unresolved');
    });

    it('allows a source correction to produce a new approximate anchor without rewriting the old one', () => {
        const previous = representation('target', 'art_12121212121212121212121212121212');
        const corrected = representation('target', 'art_13131313131313131313131313131313', revisedSourceVersionId);
        const anchor = createFragmentAnchor(previous, [{ start: 0, end: 6 }]);

        const remapped = remapFragmentAnchor(anchor, previous, corrected);
        expect(remapped.outcome).to.equal('exact');
        expect(remapped.anchor?.sourceVersionId).to.equal(revisedSourceVersionId);
        expect(remapped.anchor?.confidence).to.equal('approximate');
        expect(anchor.sourceVersionId).to.equal(identities.sourceVersionId);
    });

    it('never silently remaps a multi-span anchor', () => {
        const previous = representation('first section\nignored\nlast section', 'art_11111111111111111111111111111111');
        const next = representation('first section\nlast section', 'art_22222222222222222222222222222222');
        const anchor = createFragmentAnchor(previous, [
            { start: 0, end: 5 },
            { start: 22, end: 34 },
        ]);

        const remapped = remapFragmentAnchor(anchor, previous, next);
        expect(remapped.outcome).to.equal('unresolved');
        expect(remapped.reason).to.contain('multi-span');
    });
});
