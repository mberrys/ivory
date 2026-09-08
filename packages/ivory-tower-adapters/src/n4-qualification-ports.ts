// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { N4AnchorRecord, N4RepresentationRecord } from '@ivory-tower/contracts';

export interface N4ProjectRecord {
    readonly id: string;
    readonly name: string;
    readonly createdAt: string;
}

export interface N4QualificationStore {
    ensureProject(project: N4ProjectRecord): Promise<N4ProjectRecord>;
    addSourceToProject(projectId: string, contentHash: string): Promise<void>;
    listProjectSourceHashes(projectId: string): Promise<readonly string[]>;
    persistRepresentation(representation: N4RepresentationRecord): Promise<N4RepresentationRecord>;
    getRepresentation(representationId: string): Promise<N4RepresentationRecord | undefined>;
    saveAnchor(anchor: N4AnchorRecord): Promise<N4AnchorRecord>;
    listAnchors(projectId: string): Promise<readonly N4AnchorRecord[]>;
    recordTransfer(input: {
        readonly sourceProjectId: string;
        readonly targetProjectId: string;
        readonly contentHash: string;
        readonly allowed: boolean;
        readonly reason: string;
        readonly occurredAt: string;
    }): Promise<void>;
}

export const N4QualificationStore = Symbol('N4QualificationStore');
