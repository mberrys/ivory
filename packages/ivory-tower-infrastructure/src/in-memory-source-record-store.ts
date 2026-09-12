// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { SourceRecord, SourceRecordPort } from '@ivory-tower/adapters';

function clone<T>(value: T): T {
    return structuredClone(value);
}

export class InMemorySourceRecordStore implements SourceRecordPort {
    private readonly recordsByHash = new Map<string, SourceRecord>();

    async persistSource(record: SourceRecord): Promise<SourceRecord> {
        const existing = this.recordsByHash.get(record.contentHash);
        if (existing !== undefined) {
            return clone(existing);
        }
        this.recordsByHash.set(record.contentHash, clone(record));
        return clone(record);
    }

    async getByContentHash(contentHash: string): Promise<SourceRecord | undefined> {
        const record = this.recordsByHash.get(contentHash);
        return record === undefined ? undefined : clone(record);
    }
}
