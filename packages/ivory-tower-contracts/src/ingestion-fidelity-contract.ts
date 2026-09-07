// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { z } from 'zod';

/** The raw bytes remain the canonical representation; every derived form points back to them. */
export const rawRepresentationSchema = z.object({
    sourceVersionId: z.string().min(1),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    objectKey: z.string().min(1),
    contentType: z.string().min(1),
    byteLength: z.number().int().nonnegative(),
});

export const missingnessSchema = z.enum(['present', 'empty', 'missing', 'notApplicable']);

const typedValueSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('string'), value: z.string() }),
    z.object({ kind: z.literal('number'), value: z.number().finite() }),
    z.object({ kind: z.literal('boolean'), value: z.boolean() }),
    z.object({ kind: z.literal('date'), value: z.string().datetime() }),
]);

export const tableCellSchema = z.object({
    column: z.string().min(1),
    missingness: missingnessSchema,
    value: typedValueSchema.optional(),
    rawText: z.string(),
}).superRefine((cell, context) => {
    if (cell.missingness === 'present' && cell.value === undefined) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'present cells must retain a typed value',
            path: ['value'],
        });
    }
    if (['missing', 'notApplicable'].includes(cell.missingness) && cell.value !== undefined) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${cell.missingness} cells must not retain a typed value`,
            path: ['value'],
        });
    }
});

export const tableRowSchema = z.object({
    rowId: z.string().min(1),
    sourceRowNumber: z.number().int().nonnegative(),
    cells: z.array(tableCellSchema),
});

export const tableRepresentationSchema = z.object({
    sourceVersionId: z.string().min(1),
    tableOrdinal: z.number().int().nonnegative(),
    headers: z.array(z.string().min(1)),
    rows: z.array(tableRowSchema),
    rawRepresentation: rawRepresentationSchema,
}).superRefine((table, context) => {
    const headers = new Set(table.headers);
    if (headers.size !== table.headers.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'table headers must be unique', path: ['headers'] });
    }
    const rowIds = new Set<string>();
    const sourceRows = new Set<number>();
    table.rows.forEach((row, rowIndex) => {
        if (rowIds.has(row.rowId)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'rowId must be unique within a table',
                path: ['rows', rowIndex, 'rowId'],
            });
        }
        if (sourceRows.has(row.sourceRowNumber)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'sourceRowNumber must be unique within a table',
                path: ['rows', rowIndex, 'sourceRowNumber'],
            });
        }
        rowIds.add(row.rowId);
        sourceRows.add(row.sourceRowNumber);
        const columns = row.cells.map(cell => cell.column);
        if (new Set(columns).size !== columns.length || columns.some(column => !headers.has(column))) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'row cells must name unique declared headers',
                path: ['rows', rowIndex, 'cells'],
            });
        }
    });
});

export const extractionFailureSchema = z.object({
    code: z.enum(['unsupported_format', 'ocr_required', 'converter_failed', 'invalid_encoding', 'size_limit']),
    message: z.string().min(1),
    retryable: z.boolean(),
    attempt: z.number().int().positive(),
    nextAction: z.enum(['retry', 'select_supported_converter', 'provide_ocr', 'inspect_source']),
});

export type RawRepresentation = z.infer<typeof rawRepresentationSchema>;
export type Missingness = z.infer<typeof missingnessSchema>;
export type TypedValue = z.infer<typeof typedValueSchema>;
export type TableCell = z.infer<typeof tableCellSchema>;
export type TableRow = z.infer<typeof tableRowSchema>;
export type TableRepresentation = z.infer<typeof tableRepresentationSchema>;
export type ExtractionFailure = z.infer<typeof extractionFailureSchema>;
