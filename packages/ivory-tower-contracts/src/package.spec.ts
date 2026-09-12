// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { createExecutionRequestSchema } from './execution-contract';
import { extractionFailureSchema, tableRepresentationSchema } from './ingestion-fidelity-contract';
import { expect } from 'chai';

describe('@ivory-tower/contracts package', () => {
    it('applies the default contract version', () => {
        const request = createExecutionRequestSchema.parse({ kind: 'convert', input: { sourceId: 'src-1' } });
        expect(request.contractVersion).to.equal(1);
    });

    it('preserves typed values, missingness, and stable source row identity', () => {
        const table = tableRepresentationSchema.parse({
            sourceVersionId: 'sv_source-version',
            tableOrdinal: 0,
            headers: ['label', 'count'],
            rows: [
                {
                    rowId: 'row:0:1',
                    sourceRowNumber: 1,
                    cells: [
                        { column: 'label', rawText: 'Ångström', missingness: 'present', value: { kind: 'string', value: 'Ångström' } },
                        { column: 'count', rawText: '', missingness: 'missing' },
                    ],
                },
            ],
            rawRepresentation: {
                sourceVersionId: 'sv_source-version',
                contentHash: 'a'.repeat(64),
                objectKey: 'sources/raw.csv',
                contentType: 'text/csv',
                byteLength: 24,
            },
        });

        expect(table.rows[0].rowId).to.equal('row:0:1');
        expect(table.rows[0].cells[0].value).to.deep.equal({ kind: 'string', value: 'Ångström' });
        expect(table.rows[0].cells[1].missingness).to.equal('missing');
        expect(table.rows[0].cells[1].value).to.equal(undefined);
    });

    it('keeps unsupported and OCR-needed extraction failures visible and retryable', () => {
        const failure = extractionFailureSchema.parse({
            code: 'ocr_required',
            message: 'The input contains no usable text layer.',
            retryable: true,
            attempt: 1,
            nextAction: 'provide_ocr',
        });

        expect(failure.retryable).to.equal(true);
        expect(failure.nextAction).to.equal('provide_ocr');
    });

    it('rejects a missing value that has been silently coerced to a typed value', () => {
        expect(() =>
            tableRepresentationSchema.parse({
                sourceVersionId: 'sv_source-version',
                tableOrdinal: 0,
                headers: ['count'],
                rows: [
                    {
                        rowId: 'row:0:1',
                        sourceRowNumber: 1,
                        cells: [{ column: 'count', rawText: '', missingness: 'missing', value: { kind: 'number', value: 0 } }],
                    },
                ],
                rawRepresentation: {
                    sourceVersionId: 'sv_source-version',
                    contentHash: 'b'.repeat(64),
                    objectKey: 'sources/raw.csv',
                    contentType: 'text/csv',
                    byteLength: 1,
                },
            }),
        ).to.throw();
    });
});
