// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { ExactRef } from './exact-ref';
import { DependencyEdge, semanticClosure } from './semantic-closure';
import { refusalCode } from './test/refusal-code';

describe('semanticClosure', () => {

    const project = 'p1';
    const ref = (objectId: string, revisionId: string): ExactRef => ({ projectId: project, objectId, revisionId });
    const semantic = (from: ExactRef, to: ExactRef): DependencyEdge => ({ kind: 'semantic', from, to });
    const activity = (from: ExactRef, to: ExactRef): DependencyEdge => ({ kind: 'activity', from, to });

    // A claim revised once, citing a fragment of a source that was later corrected.
    const claimV1 = ref('claim', 'v1');
    const claimV2 = ref('claim', 'v2');
    const fragment = ref('fragment', 'v1');
    const sourceV1 = ref('source', 'v1');
    const sourceV2 = ref('source', 'v2');
    const codebook = ref('codebook', 'v1');
    const run = ref('run', 'v1');
    const retained = [claimV1, claimV2, fragment, sourceV1, sourceV2, codebook, run];
    const edges = [
        semantic(claimV1, fragment),
        semantic(claimV2, fragment),
        semantic(fragment, sourceV1),
        activity(claimV2, run),
        activity(run, codebook)
    ];

    it('follows semantic edges transitively', () => {
        expect(semanticClosure(project, [claimV2], edges, retained)).to.deep.equal([claimV2, fragment, sourceV1]);
    });

    it('never follows activity edges', () => {
        expect(semanticClosure(project, [claimV2], edges, retained)).to.not.deep.include(run);
    });

    it('does not pull in other revisions of a reached object', () => {
        const closure = semanticClosure(project, [claimV2], edges, retained);
        expect(closure).to.not.deep.include(claimV1);
        expect(closure).to.not.deep.include(sourceV2);
    });

    it('returns each revision once, in a stable order', () => {
        expect(semanticClosure(project, [sourceV1, claimV2, fragment, claimV2], edges, retained)).to.deep.equal([claimV2, fragment, sourceV1]);
    });

    it('terminates on a semantic cycle', () => {
        const cyclic = [semantic(claimV2, fragment), semantic(fragment, claimV2)];
        expect(semanticClosure(project, [fragment], cyclic, retained)).to.deep.equal([claimV2, fragment]);
    });

    it('lets an activity edge point at a revision the store does not hold', () => {
        const external = [...edges, activity(claimV2, ref('run', 'gone'))];
        expect(refusalCode(() => semanticClosure(project, [claimV2], external, retained))).to.be.undefined;
    });

    describe('fails closed', () => {

        it('on a selected revision the store does not hold', () => {
            expect(refusalCode(() => semanticClosure(project, [ref('claim', 'v3')], edges, retained))).to.equal('dangling-ref');
        });

        it('on a dangling semantic edge, even one the traversal never reaches', () => {
            const dangling = [...edges, semantic(codebook, ref('codebook', 'v0'))];
            expect(refusalCode(() => semanticClosure(project, [claimV2], dangling, retained))).to.equal('dangling-ref');
        });

        it('on a ref into another project', () => {
            const foreign = { projectId: 'p2', objectId: 'source', revisionId: 'v1' };
            expect(refusalCode(() => semanticClosure(project, [claimV2], [...edges, semantic(fragment, foreign)], retained))).to.equal('cross-project-ref');
        });

        it('on an unknown edge kind', () => {
            const unknown = { kind: 'predecessor', from: claimV2, to: claimV1 } as unknown as DependencyEdge;
            expect(refusalCode(() => semanticClosure(project, [claimV2], [unknown], retained))).to.equal('invalid-edge');
        });

        it('on an edge with extra fields', () => {
            const extra = { ...semantic(claimV2, fragment), weight: 1 };
            expect(refusalCode(() => semanticClosure(project, [claimV2], [extra], retained))).to.equal('invalid-edge');
        });

        it('on a latest selector', () => {
            expect(refusalCode(() => semanticClosure(project, [ref('claim', ExactRef.LATEST)], edges, retained))).to.equal('invalid-exact-ref');
        });
    });
});
