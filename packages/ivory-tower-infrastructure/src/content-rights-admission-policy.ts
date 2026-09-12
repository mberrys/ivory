// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { AcquisitionRoute, ContentClass, DeploymentTopology, RightsBasis, SourceMetadata } from '@ivory-tower/contracts';
import { SourceAdmissionPort, SourceAdmissionResult } from '@ivory-tower/adapters';
import {
    AdmissionRequest,
    decideAdmission,
    DeploymentTopology as PolicyTopology,
    RightsBasis as PolicyRightsBasis,
} from '@ivory-tower/content-policy';

const SUPPORTED_CONTENT_TYPES = new Set(['application/pdf', 'text/plain', 'text/markdown']);

function toPolicyTopology(topology: DeploymentTopology): PolicyTopology {
    switch (topology) {
        case 'vendorHosted':
            return 'vendorHosted';
        case 'selfHostedAtResearchOrganization':
            return 'selfHostedAtResearchOrganization';
        default: {
            const exhaustive: never = topology;
            return exhaustive;
        }
    }
}

function toPolicyRightsBasis(basis: RightsBasis): PolicyRightsBasis {
    return {
        kind: basis.kind,
        licence: basis.licence,
        publisher: basis.publisher,
        apiMediated: basis.apiMediated,
        permitsThirdPartyDisclosure: basis.permitsThirdPartyDisclosure,
        jurisdiction: basis.jurisdiction,
    };
}

function toAdmissionRequest(metadata: SourceMetadata, topology: DeploymentTopology): AdmissionRequest {
    return {
        contentClass: metadata.contentClass as ContentClass,
        topology: toPolicyTopology(topology),
        route: metadata.acquisitionRoute as AcquisitionRoute,
        itemLicenceConfirmed: metadata.itemLicenceConfirmed,
        basis: metadata.rightsBasis === undefined ? undefined : toPolicyRightsBasis(metadata.rightsBasis),
    };
}

function refusedTransport(contentType: string): SourceAdmissionResult {
    return {
        allowed: false,
        reason: 'The content type is outside the V1 safe-open allowlist.',
        contentClass: 'unknownProvenance',
        rightsBasisKind: 'none',
        acquisitionRoute: 'upload',
        deploymentTopology: 'vendorHosted',
        ingestPermitted: false,
        transferPermitted: false,
        ingestReason: 'The content type is outside the V1 safe-open allowlist.',
        transferReason: 'The content type is outside the V1 safe-open allowlist.',
    };
}

export class ContentRightsAdmissionPolicy implements SourceAdmissionPort {
    constructor(private readonly deploymentTopology: DeploymentTopology) {}

    async admit(metadata: SourceMetadata, _contentHash: string): Promise<SourceAdmissionResult> {
        if (!SUPPORTED_CONTENT_TYPES.has(metadata.contentType)) {
            return refusedTransport(metadata.contentType);
        }

        const decision = decideAdmission(toAdmissionRequest(metadata, this.deploymentTopology));
        const ingestPermitted = decision.ingest.outcome === 'permitted';
        const transferPermitted = decision.transfer.outcome === 'permitted';

        return {
            allowed: ingestPermitted,
            reason: ingestPermitted ? decision.ingest.reason : decision.ingest.reason,
            contentClass: metadata.contentClass,
            rightsBasisKind: ingestPermitted ? decision.ingest.basis : 'none',
            acquisitionRoute: metadata.acquisitionRoute,
            deploymentTopology: this.deploymentTopology,
            ingestPermitted,
            transferPermitted,
            ingestReason: decision.ingest.reason,
            transferReason: decision.transfer.reason,
        };
    }
}

export function readDeploymentTopologyFromEnvironment(): DeploymentTopology {
    const value = process.env.IVORY_DEPLOYMENT_TOPOLOGY?.trim();
    if (value === 'selfHostedAtResearchOrganization') {
        return 'selfHostedAtResearchOrganization';
    }
    return 'vendorHosted';
}
