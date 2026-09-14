// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { EgressPolicyPort } from '@ivory-tower/adapters';

export class FailClosedEgressPolicy implements EgressPolicyPort {
    async authorize(_request: {
        readonly purpose: string;
        readonly target: string;
        readonly contentHash?: string;
    }): Promise<{ allowed: boolean; reason: string }> {
        return { allowed: false, reason: 'External egress is not configured for this runtime.' };
    }
}

export class AllowlistedEgressPolicy implements EgressPolicyPort {
    constructor(private readonly allowedHosts: ReadonlySet<string>) {}

    async authorize(request: {
        readonly purpose: string;
        readonly target: string;
        readonly contentHash?: string;
    }): Promise<{ allowed: boolean; reason: string }> {
        let hostname: string;
        try {
            hostname = new URL(request.target).hostname.toLowerCase();
        } catch {
            return { allowed: false, reason: 'Egress target is not a valid URL.' };
        }
        if (!this.allowedHosts.has(hostname)) {
            return { allowed: false, reason: `Egress target is not allowlisted for ${request.purpose}.` };
        }
        return { allowed: true, reason: 'Egress target is allowlisted.' };
    }
}
