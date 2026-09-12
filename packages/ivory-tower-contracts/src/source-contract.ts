// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { z } from 'zod';

export const contentClassSchema = z.enum([
    'openLicensed',
    'pmcOpenAccess',
    'arxivPreprint',
    'doajJournal',
    'preprintServer',
    'publicDomainArchive',
    'researcherAuthored',
    'publisherLicensed',
    'institutionallyLicensedBook',
    'unknownProvenance',
    'shadowLibrary',
]);

export const acquisitionRouteSchema = z.enum(['publisherApi', 'upload', 'openRepository']);

export const deploymentTopologySchema = z.enum(['vendorHosted', 'selfHostedAtResearchOrganization']);

export const rightsBasisKindSchema = z.enum([
    'openLicence',
    'publicDomain',
    'researcherAuthored',
    'publisherTdmAgreement',
    'researchOrganizationException',
    'none',
]);

export const rightsBasisSchema = z.object({
    kind: rightsBasisKindSchema,
    licence: z.string().min(1).max(255).optional(),
    publisher: z.string().min(1).max(255).optional(),
    apiMediated: z.boolean().optional(),
    permitsThirdPartyDisclosure: z.boolean().optional(),
    jurisdiction: z.enum(['eu', 'uk', 'us']).optional(),
});

export const sourceMetadataSchema = z.object({
    filename: z.string().min(1).max(255),
    contentType: z.string().min(1).max(255),
    license: z.string().min(1).max(255),
    authorizationEvidence: z.string().min(1).max(2000),
    contentClass: contentClassSchema,
    acquisitionRoute: acquisitionRouteSchema.default('upload'),
    itemLicenceConfirmed: z.boolean().optional(),
    rightsBasis: rightsBasisSchema.optional(),
});

export const sourceUploadResponseSchema = z.object({
    sourceId: z.string().min(1),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    objectKey: z.string().min(1),
    admittedAt: z.string().datetime(),
});

export type ContentClass = z.infer<typeof contentClassSchema>;
export type AcquisitionRoute = z.infer<typeof acquisitionRouteSchema>;
export type DeploymentTopology = z.infer<typeof deploymentTopologySchema>;
export type RightsBasisKind = z.infer<typeof rightsBasisKindSchema>;
export type RightsBasis = z.infer<typeof rightsBasisSchema>;
export type SourceMetadata = z.infer<typeof sourceMetadataSchema>;
export type SourceUploadResponse = z.infer<typeof sourceUploadResponseSchema>;
