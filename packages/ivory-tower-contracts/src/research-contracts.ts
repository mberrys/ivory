// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { z } from 'zod';
import { protocolVersionRefSchema } from './research-protocol-contract';

const nonEmpty = z.string().trim().min(1);

// Errors the service publishes for these contracts.
export const ERROR_PROJECT_NOT_FOUND = 'project_not_found';
export const ERROR_REVISION_STALE = 'revision_stale';
export const ERROR_CITATION_NOT_FOUND = 'citation_not_found';
export const ERROR_CITATION_STALE = 'citation_stale';
export const ERROR_SOURCE_NOT_FOUND = 'source_not_found';
export const ERROR_REVISION_CONFLICT = 'revision_conflict';
export const ERROR_INVALID_EDIT_RANGE = 'invalid_edit_range';

// --- project-open ---
export const projectOpenRequestSchema = z.object({
    projectId: nonEmpty,
    revision: nonEmpty.optional(), // omit => head revision
});
export const projectOpenResponseSchema = z.object({
    projectId: nonEmpty,
    revision: nonEmpty, // immutable opened revision
    headRevision: nonEmpty,
    openedAt: z.string().datetime(),
    entryPaths: z.array(nonEmpty),
});

// --- fixture reset (equivalent initial project states, doc line 28) ---
export const fixtureResetRequestSchema = z.object({
    projectId: nonEmpty,
    fixture: z.enum(['research.py', 'research.R', 'research.qmd', 'conditional.ipynb', 'all']).default('all'),
});
export const fixtureResetResponseSchema = z.object({
    projectId: nonEmpty,
    revision: nonEmpty,
    entryPaths: z.array(nonEmpty),
    sourceHashes: z.record(nonEmpty, z.string().regex(/^[a-f0-9]{64}$/)),
    resetAt: z.string().datetime(),
});

// --- exact citation resolution ---
export const citationResolutionRequestSchema = z.object({
    projectId: nonEmpty,
    revision: nonEmpty,
    citationId: nonEmpty,
});
export const citationAnchorSchema = z.object({
    sourcePath: nonEmpty,
    sourceRevision: nonEmpty,
    anchorId: nonEmpty,
    passage: z.string().min(1), // exact display projection (bytes)
    startOffset: z.number().int().nonnegative(),
    endOffset: z.number().int().nonnegative(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const citationResolutionResponseSchema = z.object({
    citationId: nonEmpty,
    projectId: nonEmpty,
    resolvedAt: z.string().datetime(),
    anchor: citationAnchorSchema,
});

// --- resolved RunSpec ---
export const runRequestSchema = z.object({
    projectId: nonEmpty,
    revision: nonEmpty,
    protocolVersionId: nonEmpty.optional(),
});
export const resolvedRunSpecSchema = z.object({
    runId: nonEmpty,
    projectId: nonEmpty,
    revision: nonEmpty,
    protocolVersionRef: protocolVersionRefSchema.optional(),
    sourceSetVersion: nonEmpty,
    environment: z.record(z.string().min(1), z.string()),
    commands: z.array(nonEmpty),
});
export const runSpecResolutionResponseSchema = z.object({
    runId: nonEmpty,
    resolvedRunSpec: resolvedRunSpecSchema,
    semanticResult: z.unknown().optional(),
});

// --- revision-based project-edit (first writer wins) ---
export const editKindSchema = z.enum(['replace', 'insert', 'delete']);
export const projectEditRequestSchema = z.object({
    projectId: nonEmpty,
    baseRevision: nonEmpty,
    sourcePath: nonEmpty,
    edit: z.object({
        kind: editKindSchema,
        startOffset: z.number().int().nonnegative(),
        endOffset: z.number().int().nonnegative(),
        text: z.string(),
    }),
});
export const projectEditResponseSchema = z.object({
    projectId: nonEmpty,
    sourcePath: nonEmpty,
    baseRevision: nonEmpty,
    newRevision: nonEmpty,
    appliedAt: z.string().datetime(),
});
export const projectEditConflictSchema = z.object({
    code: z.literal(ERROR_REVISION_CONFLICT),
    baseRevision: nonEmpty,
    headRevision: nonEmpty,
    authoritative: z.object({
        sourcePath: nonEmpty,
        revision: nonEmpty,
        bytes: z.string(),
        contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    rejectedRequest: projectEditRequestSchema, // unchanged rejection evidence
});
