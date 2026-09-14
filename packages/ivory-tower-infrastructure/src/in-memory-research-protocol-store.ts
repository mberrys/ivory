// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ProtocolArtifact, ProtocolExportReference, ProtocolRunReference, ResearchProtocolVersion } from '@ivory-tower/contracts';
import { ResearchProtocolStore } from '@ivory-tower/adapters';

function clone<T>(value: T): T {
    return structuredClone(value);
}

export class InMemoryResearchProtocolStore implements ResearchProtocolStore {
    private readonly versions = new Map<string, ResearchProtocolVersion>();
    private readonly artifacts = new Map<string, ProtocolArtifact[]>();
    private readonly runs = new Map<string, ProtocolRunReference>();
    private readonly exports = new Map<string, ProtocolExportReference>();

    async saveVersion(version: ResearchProtocolVersion): Promise<ResearchProtocolVersion> {
        const existing = this.versions.get(version.protocolVersionId);
        if (existing?.stage === 'export_snapshot') {
            throw new Error(`Export snapshot ${version.protocolVersionId} is immutable.`);
        }
        this.versions.set(version.protocolVersionId, clone(version));
        return clone(version);
    }

    async getVersion(protocolVersionId: string): Promise<ResearchProtocolVersion | undefined> {
        const version = this.versions.get(protocolVersionId);
        return version === undefined ? undefined : clone(version);
    }

    async listVersions(protocolId: string): Promise<readonly ResearchProtocolVersion[]> {
        return [...this.versions.values()]
            .filter(version => version.protocolId === protocolId)
            .sort((left, right) => left.versionNumber - right.versionNumber)
            .map(clone);
    }

    async attachArtifact(artifact: ProtocolArtifact): Promise<void> {
        if (!this.versions.has(artifact.protocolVersionId)) {
            throw new Error(`Unknown protocol version ${artifact.protocolVersionId}.`);
        }
        const artifacts = this.artifacts.get(artifact.protocolVersionId) ?? [];
        if (!artifacts.some(existing => existing.artifactId === artifact.artifactId)) {
            artifacts.push(clone(artifact));
            this.artifacts.set(artifact.protocolVersionId, artifacts);
        }
    }

    async listArtifacts(protocolVersionId: string): Promise<readonly ProtocolArtifact[]> {
        return (this.artifacts.get(protocolVersionId) ?? []).map(clone);
    }

    async saveRun(reference: ProtocolRunReference): Promise<ProtocolRunReference> {
        this.runs.set(reference.runId, clone(reference));
        return clone(reference);
    }

    async saveExport(reference: ProtocolExportReference): Promise<ProtocolExportReference> {
        const version = this.versions.get(reference.protocolVersionId);
        if (version?.stage !== 'export_snapshot') {
            throw new Error(`Protocol version ${reference.protocolVersionId} is not an export snapshot.`);
        }
        this.exports.set(reference.exportId, clone(reference));
        return clone(reference);
    }
}
