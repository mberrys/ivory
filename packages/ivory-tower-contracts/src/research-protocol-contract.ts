// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { z } from 'zod';

export const researchProtocolStageSchema = z.enum(['exploratory', 'specified', 'export_snapshot']);
export type ResearchProtocolStage = z.infer<typeof researchProtocolStageSchema>;

export const selectionModeSchema = z.enum([
    'purposive',
    'theoretical',
    'archival',
    'case_based',
    'convenience',
    'exhaustive_within_source',
    'probability_based',
]);
export type SelectionMode = z.infer<typeof selectionModeSchema>;

const nonEmptyString = z.string().trim().min(1);

export const exploratoryClaimPostureSchema = z.object({
    kind: z.literal('exploratory'),
});

export const interpretiveClaimPostureSchema = z.object({
    kind: z.literal('interpretive'),
    interpretiveFrame: nonEmptyString,
    alternatives: z.array(nonEmptyString).min(1),
});

export const criticalDiscourseClaimPostureSchema = z.object({
    kind: z.literal('critical/discourse'),
    discoursePowerContext: nonEmptyString,
    positionalityContext: nonEmptyString,
});

export const historicalContextualClaimPostureSchema = z.object({
    kind: z.literal('historical/contextual'),
    historicalPeriod: nonEmptyString,
    sourceContext: nonEmptyString,
});

export const descriptiveClaimPostureSchema = z.object({
    kind: z.literal('descriptive'),
    observationScope: nonEmptyString,
});

export const associationalClaimPostureSchema = z.object({
    kind: z.literal('associational'),
    variables: z.array(nonEmptyString).min(2),
    adjustmentDefinitions: z.array(nonEmptyString),
});

export const causalClaimPostureSchema = z.object({
    kind: z.literal('causal'),
    estimand: nonEmptyString,
    design: nonEmptyString,
    identificationAssumptions: z.array(nonEmptyString).min(1),
    confounderStrategy: nonEmptyString,
});

export const claimPostureSchema = z.discriminatedUnion('kind', [
    exploratoryClaimPostureSchema,
    interpretiveClaimPostureSchema,
    criticalDiscourseClaimPostureSchema,
    historicalContextualClaimPostureSchema,
    descriptiveClaimPostureSchema,
    associationalClaimPostureSchema,
    causalClaimPostureSchema,
]);
export type ClaimPosture = z.infer<typeof claimPostureSchema>;

export const protocolVersionRefSchema = z.object({
    protocolId: nonEmptyString,
    protocolVersionId: nonEmptyString,
    stage: researchProtocolStageSchema,
    branchId: nonEmptyString,
});
export type ProtocolVersionRef = z.infer<typeof protocolVersionRefSchema>;

export const coverageClaimTermSchema = z.enum(['comprehensive', 'representative', 'systematic']);
export const coverageClaimSchema = z.object({
    term: coverageClaimTermSchema,
    sourceSelectionEvidence: nonEmptyString,
});

export const protocolChangeKindSchema = z.enum(['added', 'removed', 'changed']);
export const protocolChangeSchema = z.object({
    field: nonEmptyString,
    kind: protocolChangeKindSchema,
    previous: z.unknown().optional(),
    next: z.unknown().optional(),
    rationale: nonEmptyString,
});
export type ProtocolChange = z.infer<typeof protocolChangeSchema>;

export const researchProtocolVersionSchema = z.object({
    protocolId: nonEmptyString,
    protocolVersionId: nonEmptyString,
    versionNumber: z.number().int().positive(),
    stage: researchProtocolStageSchema,
    branchId: nonEmptyString,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    purpose: nonEmptyString,
    workingQuestionAim: nonEmptyString,
    taskIntent: nonEmptyString,
    sourceSetVersion: nonEmptyString,
    scope: nonEmptyString,
    selectionMode: selectionModeSchema,
    selectionRationale: nonEmptyString,
    inclusionRationale: nonEmptyString,
    exclusionRationale: nonEmptyString,
    boundaries: z.array(nonEmptyString).min(1),
    limitations: z.array(nonEmptyString).min(1),
    processingPolicyVersion: nonEmptyString,
    author: nonEmptyString,
    predecessor: protocolVersionRefSchema.optional(),
    changeRationale: nonEmptyString,
    posture: claimPostureSchema,
    coverageClaims: z.array(coverageClaimSchema),
    changes: z.array(protocolChangeSchema),
    affectedArtifactIds: z.array(nonEmptyString),
});
export type ResearchProtocolVersion = z.infer<typeof researchProtocolVersionSchema>;

export const claimKindSchema = z.enum(['substantive_system_claim', 'derived_system_observation', 'researcher_authored_assertion']);
export type ClaimKind = z.infer<typeof claimKindSchema>;

export const claimEvidenceOutcomeSchema = z.enum(['supported', 'refuted', 'unverifiable', 'insufficient_evidence']);
export type ClaimEvidenceOutcome = z.infer<typeof claimEvidenceOutcomeSchema>;

export const claimPostureEvaluationRequestSchema = z.object({
    protocolVersionId: nonEmptyString,
    text: nonEmptyString,
    kind: claimKindSchema,
    evidenceOutcome: claimEvidenceOutcomeSchema.optional(),
    causalContractValidated: z.boolean().default(false),
    auditLineage: nonEmptyString.optional(),
});
export type ClaimPostureEvaluationRequest = z.input<typeof claimPostureEvaluationRequestSchema>;

export const claimPostureValidationResultSchema = z.object({
    valid: z.boolean(),
    posture: claimPostureSchema,
    claimKind: claimKindSchema,
    evidenceOutcome: claimEvidenceOutcomeSchema.optional(),
    prohibitedLanguage: z.array(nonEmptyString),
    reasons: z.array(nonEmptyString),
});
export type ClaimPostureValidationResult = z.infer<typeof claimPostureValidationResultSchema>;

export const semanticProtocolDiffSchema = z.object({
    predecessor: protocolVersionRefSchema,
    successor: protocolVersionRefSchema,
    changes: z.array(protocolChangeSchema),
    affectedArtifactIds: z.array(nonEmptyString),
});
export type SemanticProtocolDiff = z.infer<typeof semanticProtocolDiffSchema>;

export const synthesisAdmissionRequestSchema = z.object({
    protocolVersionId: nonEmptyString,
    purpose: nonEmptyString,
    workingQuestionAim: nonEmptyString,
    sourceSetVersion: nonEmptyString,
    scope: nonEmptyString,
});
export type SynthesisAdmissionRequest = z.infer<typeof synthesisAdmissionRequestSchema>;

export const protocolRunReferenceSchema = z.object({
    runId: nonEmptyString,
    protocolVersionId: nonEmptyString,
});
export type ProtocolRunReference = z.infer<typeof protocolRunReferenceSchema>;

export const protocolExportReferenceSchema = z.object({
    exportId: nonEmptyString,
    protocolVersionId: nonEmptyString,
});
export type ProtocolExportReference = z.infer<typeof protocolExportReferenceSchema>;

export const protocolArtifactSchema = z.object({
    artifactId: nonEmptyString,
    protocolVersionId: nonEmptyString,
    kind: nonEmptyString,
});
export type ProtocolArtifact = z.infer<typeof protocolArtifactSchema>;
