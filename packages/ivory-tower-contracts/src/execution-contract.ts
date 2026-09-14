// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { z } from 'zod';
import { ExecutionKind, ExecutionStatus } from '@ivory-tower/domain';

export const CONTRACT_VERSION = 1;

export const executionKindSchema = z.enum(['ingest', 'convert', 'index', 'retrieve', 'generate', 'validate', 'export']);
export const executionStatusSchema = z.enum(['queued', 'running', 'cancelling', 'succeeded', 'failed', 'cancelled']);
export const executionEventTypeSchema = z.enum(['status', 'progress', 'token', 'error', 'complete']);

export const createExecutionRequestSchema = z.object({
    kind: executionKindSchema,
    input: z.unknown(),
    contractVersion: z.number().int().positive().default(CONTRACT_VERSION),
});

export const executionFailureSchema = z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
});

export const executionResponseSchema = z.object({
    id: z.string().min(1),
    kind: executionKindSchema,
    status: executionStatusSchema,
    contractVersion: z.number().int().positive(),
    idempotencyKey: z.string().min(1),
    attempt: z.number().int().nonnegative(),
    progress: z.number().min(0).max(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    result: z.unknown().optional(),
    failure: executionFailureSchema.optional(),
});

export const executionEventSchema = z.object({
    id: z.string().min(1),
    executionId: z.string().min(1),
    sequence: z.number().int().positive(),
    type: executionEventTypeSchema,
    payload: z.unknown(),
    occurredAt: z.string().datetime(),
});

export type CreateExecutionRequest = z.infer<typeof createExecutionRequestSchema> & { kind: ExecutionKind };
export type ExecutionResponse = z.infer<typeof executionResponseSchema> & { status: ExecutionStatus };
export type ExecutionEventResponse = z.infer<typeof executionEventSchema>;

export function toExecutionResponse(record: {
    id: string;
    kind: ExecutionKind;
    status: ExecutionStatus;
    contractVersion: number;
    idempotencyKey: string;
    attempt: number;
    progress: number;
    createdAt: string;
    updatedAt: string;
    result: unknown;
    failure: { code: string; message: string; retryable: boolean } | undefined;
}): ExecutionResponse {
    return executionResponseSchema.parse({
        id: record.id,
        kind: record.kind,
        status: record.status,
        contractVersion: record.contractVersion,
        idempotencyKey: record.idempotencyKey,
        attempt: record.attempt,
        progress: record.progress,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        result: record.result === undefined ? undefined : record.result,
        failure: record.failure,
    }) as ExecutionResponse;
}
