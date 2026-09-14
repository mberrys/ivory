// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { N4QualificationStore, SourceRecordPort } from '@ivory-tower/adapters';

/**
 * Narrow N4 namespace transfer. It deliberately consults the existing source-rights record and
 * does not model users, roles, or general project authorization.
 */
export class N4TransferService {
    constructor(
        private readonly sources: SourceRecordPort,
        private readonly store: N4QualificationStore,
    ) {}

    async transfer(input: {
        sourceProjectId: string;
        targetProjectId: string;
        contentHash: string;
        occurredAt: string;
    }): Promise<{ allowed: boolean; reason: string }> {
        const source = await this.sources.getByContentHash(input.contentHash);
        const allowed = source?.transferPermitted === true;
        const reason = source === undefined ? 'No admitted source matches the supplied content hash.' : source.transferReason;
        await this.store.recordTransfer({ ...input, allowed, reason });
        return { allowed, reason };
    }
}
