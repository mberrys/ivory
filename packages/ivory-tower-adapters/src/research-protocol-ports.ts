// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ProtocolArtifact, ProtocolExportReference, ProtocolRunReference, ResearchProtocolVersion } from '@ivory-tower/contracts';

export interface ResearchProtocolStore {
    saveVersion(version: ResearchProtocolVersion): Promise<ResearchProtocolVersion>;
    getVersion(protocolVersionId: string): Promise<ResearchProtocolVersion | undefined>;
    listVersions(protocolId: string): Promise<readonly ResearchProtocolVersion[]>;
    attachArtifact(artifact: ProtocolArtifact): Promise<void>;
    listArtifacts(protocolVersionId: string): Promise<readonly ProtocolArtifact[]>;
    saveRun(reference: ProtocolRunReference): Promise<ProtocolRunReference>;
    saveExport(reference: ProtocolExportReference): Promise<ProtocolExportReference>;
}

export interface ResearchProtocolIdPort {
    next(): string;
}

export const ResearchProtocolStore = Symbol('ResearchProtocolStore');
export const ResearchProtocolIdPort = Symbol('ResearchProtocolIdPort');
