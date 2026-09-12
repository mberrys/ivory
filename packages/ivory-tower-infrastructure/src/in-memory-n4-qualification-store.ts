// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { N4QualificationStore, N4ProjectRecord } from '@ivory-tower/adapters';
import { N4AnchorRecord, N4RepresentationRecord } from '@ivory-tower/contracts';

function copy<T>(value: T): T {
    return structuredClone(value);
}

/** Test adapter that retains the same immutability and transfer rules as the SQL store. */
export class InMemoryN4QualificationStore implements N4QualificationStore {
    private readonly projects = new Map<string, N4ProjectRecord>();
    private readonly projectSources = new Map<string, Set<string>>();
    private readonly representations = new Map<string, N4RepresentationRecord>();
    private readonly anchors = new Map<string, N4AnchorRecord>();
    readonly transfers: Array<{
        sourceProjectId: string;
        targetProjectId: string;
        contentHash: string;
        allowed: boolean;
        reason: string;
        occurredAt: string;
    }> = [];

    async ensureProject(project: N4ProjectRecord): Promise<N4ProjectRecord> {
        const existing = this.projects.get(project.id);
        if (existing !== undefined) {return copy(existing); }
        this.projects.set(project.id, copy(project));
        return copy(project);
    }
    async addSourceToProject(projectId: string, contentHash: string): Promise<void> {
        if (!this.projects.has(projectId)) {throw new Error(`Unknown N4 project: ${projectId}`); }
        const hashes = this.projectSources.get(projectId) ?? new Set<string>();
        hashes.add(contentHash);
        this.projectSources.set(projectId, hashes);
    }
    async listProjectSourceHashes(projectId: string): Promise<readonly string[]> {
        return [...(this.projectSources.get(projectId) ?? [])].sort();
    }
    async persistRepresentation(representation: N4RepresentationRecord): Promise<N4RepresentationRecord> {
        const existing = this.representations.get(representation.id);
        if (existing !== undefined) {
            if (JSON.stringify(existing) !== JSON.stringify(representation)) {throw new Error(`N4 representation is immutable: ${representation.id}`); }
            return copy(existing);
        }
        this.representations.set(representation.id, copy(representation));
        return copy(representation);
    }
    async getRepresentation(representationId: string): Promise<N4RepresentationRecord | undefined> {
        const value = this.representations.get(representationId);
        return value === undefined ? undefined : copy(value);
    }
    async saveAnchor(anchor: N4AnchorRecord): Promise<N4AnchorRecord> {
        if (!this.projects.has(anchor.projectId)) {throw new Error(`Unknown N4 project: ${anchor.projectId}`); }
        if (!this.representations.has(anchor.representationId)) {throw new Error(`Unknown N4 representation: ${anchor.representationId}`); }
        const existing = this.anchors.get(anchor.id);
        if (existing !== undefined) {
            if (JSON.stringify(existing) !== JSON.stringify(anchor)) {throw new Error(`N4 anchor is immutable: ${anchor.id}`); }
            return copy(existing);
        }
        this.anchors.set(anchor.id, copy(anchor));
        return copy(anchor);
    }
    async listAnchors(projectId: string): Promise<readonly N4AnchorRecord[]> {
        const projectSourceHashes = this.projectSources.get(projectId) ?? new Set<string>();
        return [...this.anchors.values()]
            .filter(anchor => {
                if (anchor.projectId === projectId) {return true; }
                const representation = this.representations.get(anchor.representationId);
                return representation !== undefined && projectSourceHashes.has(representation.contentHash);
            })
            .map(copy);
    }
    async recordTransfer(input: {
        sourceProjectId: string;
        targetProjectId: string;
        contentHash: string;
        allowed: boolean;
        reason: string;
        occurredAt: string;
    }): Promise<void> {
        if (!this.projects.has(input.sourceProjectId) || !this.projects.has(input.targetProjectId)) {throw new Error('N4 transfer requires existing projects.'); }
        this.transfers.push(copy(input));
        if (!input.allowed) {return; }
        if (!(this.projectSources.get(input.sourceProjectId) ?? new Set()).has(input.contentHash)) {throw new Error('N4 transfer source is not a project member.'); }
        await this.addSourceToProject(input.targetProjectId, input.contentHash);
    }
}
