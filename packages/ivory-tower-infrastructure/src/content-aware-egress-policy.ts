// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { EgressPolicyPort, SourceRecordPort } from '@ivory-tower/adapters';
import { AllowlistedEgressPolicy } from './egress-policy';

export class ContentAwareAllowlistedEgressPolicy implements EgressPolicyPort {
    private readonly destinationPolicy: AllowlistedEgressPolicy;

    constructor(
        allowedHosts: ReadonlySet<string>,
        private readonly sourceRecords: SourceRecordPort,
    ) {
        this.destinationPolicy = new AllowlistedEgressPolicy(allowedHosts);
    }

    async authorize(request: {
        readonly purpose: string;
        readonly target: string;
        readonly contentHash?: string;
    }): Promise<{ allowed: boolean; reason: string }> {
        if (request.contentHash === undefined || request.contentHash.length === 0) {
            return { allowed: false, reason: 'Egress requires a content hash to evaluate transfer rights.' };
        }

        const source = await this.sourceRecords.getByContentHash(request.contentHash);
        if (source === undefined) {
            return { allowed: false, reason: 'No admitted source matches the supplied content hash.' };
        }
        if (!source.transferPermitted) {
            return { allowed: false, reason: source.transferReason };
        }

        return this.destinationPolicy.authorize(request);
    }
}

export function readEgressAllowedHostsFromEnvironment(): ReadonlySet<string> {
    return new Set(
        (process.env.IVORY_EGRESS_ALLOWED_HOSTS ?? '')
            .split(',')
            .map(value => value.trim().toLowerCase())
            .filter(Boolean),
    );
}
