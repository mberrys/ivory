// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { SourceAdmissionPort, SourceAdmissionResult } from '@ivory-tower/adapters';
import { SourceMetadata } from '@ivory-tower/contracts';

function admissionResult(metadata: SourceMetadata, message: string, allowed: boolean, transferPermitted = allowed): SourceAdmissionResult {
    return {
        allowed,
        reason: message,
        contentClass: metadata.contentClass,
        rightsBasisKind: allowed ? 'openLicence' : 'none',
        acquisitionRoute: metadata.acquisitionRoute,
        deploymentTopology: 'vendorHosted',
        ingestPermitted: allowed,
        transferPermitted,
        ingestReason: message,
        transferReason: message,
    };
}

export class FailClosedAdmissionPolicy implements SourceAdmissionPort {
    async admit(_metadata: SourceMetadata, _contentHash: string): Promise<SourceAdmissionResult> {
        return {
            allowed: false,
            reason: 'No supported-content policy has authorized this source.',
            contentClass: 'unknownProvenance',
            rightsBasisKind: 'none',
            acquisitionRoute: 'upload',
            deploymentTopology: 'vendorHosted',
            ingestPermitted: false,
            transferPermitted: false,
            ingestReason: 'No supported-content policy has authorized this source.',
            transferReason: 'No supported-content policy has authorized this source.',
        };
    }
}

export class SafeOpenAdmissionPolicy implements SourceAdmissionPort {
    constructor(private readonly acceptedLicenses: ReadonlySet<string>) {}

    async admit(metadata: SourceMetadata, _contentHash: string): Promise<SourceAdmissionResult> {
        if (!['application/pdf', 'text/plain', 'text/markdown'].includes(metadata.contentType)) {
            return admissionResult(metadata, 'The content type is outside the V1 safe-open allowlist.', false);
        }
        if (!this.acceptedLicenses.has(metadata.license)) {
            return admissionResult(metadata, 'The source license is not an approved V1 reuse term.', false);
        }
        if (metadata.authorizationEvidence.trim().length === 0) {
            return admissionResult(metadata, 'Authorization evidence is required before processing.', false);
        }
        return admissionResult(metadata, 'Source admitted by the versioned safe-open policy.', true);
    }
}
