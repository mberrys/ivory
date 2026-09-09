// *****************************************************************************
// Copyright (C) 2026 Berry Studio and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ResearchKernel } from './kernel';
import {
    AdmitArtifactInput,
    AdmitSourceInput,
    AnnotateInput,
    CreateClaimInput,
    CreateCodebookInput,
    CreateEvidenceLinkInput,
    CreateFragmentInput,
    ExactRef,
    FreezeSnapshotInput,
    CarryForwardPreview,
    CitationResolution,
    ClaimExplanation,
    ReviseClaimInput,
    ReviseCodebookInput,
    SnapshotRecord,
} from './types';

/** A deliberately thin client: all mutable state remains in the shared kernel. */
export class ResearchClient {
    constructor(
        readonly kernel: ResearchKernel,
        readonly name: 'cli' | 'studio',
    ) {}

    admitSource(input: AdmitSourceInput): ExactRef {
        return this.kernel.admitSource(input);
    }
    replaceSource(input: AdmitSourceInput & { sourceId: string; expectedHead: string }): ExactRef {
        return this.kernel.replaceSource(input);
    }
    createFragment(input: CreateFragmentInput): ExactRef {
        return this.kernel.createFragment(input);
    }
    createCodebook(input: CreateCodebookInput): ExactRef {
        return this.kernel.createCodebook(input);
    }
    reviseCodebook(input: ReviseCodebookInput): ExactRef {
        return this.kernel.reviseCodebook(input);
    }
    annotate(input: AnnotateInput): ExactRef {
        return this.kernel.annotate(input);
    }
    createClaim(input: CreateClaimInput): ExactRef {
        return this.kernel.createClaim(input);
    }
    reviseClaim(input: ReviseClaimInput): ExactRef {
        return this.kernel.reviseClaim(input);
    }
    createEvidenceLink(input: CreateEvidenceLinkInput): ExactRef {
        return this.kernel.createEvidenceLink(input);
    }
    admitArtifact(input: AdmitArtifactInput): ExactRef {
        return this.kernel.admitArtifact(input);
    }
    freezeSnapshot(input: FreezeSnapshotInput): SnapshotRecord {
        return this.kernel.freezeSnapshot(input);
    }
    previewCarryForward(from: ExactRef, to: ExactRef): CarryForwardPreview {
        return this.kernel.previewCarryForward(from, to);
    }
    carryForwardLinks(from: ExactRef, to: ExactRef, actor: string): ExactRef[] {
        return this.kernel.carryForwardLinks(from, to, actor);
    }
    resolveCitation(ref: ExactRef, snapshotId?: string): CitationResolution {
        return this.kernel.resolveCitation(ref, snapshotId);
    }
    explainClaim(snapshotId: string, claimRef: ExactRef): ClaimExplanation {
        return this.kernel.explainClaim(snapshotId, claimRef);
    }
}

export function createResearchClients(kernel: ResearchKernel): { cli: ResearchClient; studio: ResearchClient } {
    return {
        cli: new ResearchClient(kernel, 'cli'),
        studio: new ResearchClient(kernel, 'studio'),
    };
}
