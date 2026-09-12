// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ConversionPort, ExecutionJob, ObjectStorePort } from '@ivory-tower/adapters';
import { ExecutionHandlerContext, ExecutionHandlerRegistry } from './execution-processor';

interface ConversionInput {
    readonly contentHash: string;
    readonly filename: string;
    readonly contentType: string;
    readonly parserVersion?: string;
}

class InvalidConversionInputError extends Error {
    readonly retryable = false;
}

function readConversionInput(job: ExecutionJob): ConversionInput {
    if (typeof job.input !== 'object' || job.input === undefined) {
        throw new InvalidConversionInputError('Conversion jobs require an object input.');
    }
    const input = job.input as Partial<ConversionInput>;
    if (typeof input.contentHash !== 'string' || !/^[a-f0-9]{64}$/u.test(input.contentHash)) {
        throw new InvalidConversionInputError('Conversion jobs require a canonical SHA-256 content hash.');
    }
    if (typeof input.filename !== 'string' || input.filename.trim().length === 0) {
        throw new InvalidConversionInputError('Conversion jobs require a filename.');
    }
    if (typeof input.contentType !== 'string' || input.contentType.trim().length === 0) {
        throw new InvalidConversionInputError('Conversion jobs require a content type.');
    }
    return {
        contentHash: input.contentHash,
        filename: input.filename,
        contentType: input.contentType,
        parserVersion: input.parserVersion,
    };
}

export function createRuntimeExecutionHandlers(objectStore: ObjectStorePort, converter: ConversionPort): ExecutionHandlerRegistry {
    const convert = async (job: ExecutionJob, context: ExecutionHandlerContext): Promise<unknown> => {
        const input = readConversionInput(job);
        if (context.signal.aborted) {
            throw context.signal.reason instanceof Error ? context.signal.reason : new Error('Conversion was cancelled.');
        }
        const content = await objectStore.get(`sources/${input.contentHash}`);
        await context.reportProgress(0.2, { phase: 'source_loaded', contentHash: input.contentHash });
        const converted = await converter.convert({
            content,
            filename: input.filename,
            contentType: input.contentType,
            contentHash: input.contentHash,
            parserVersion: input.parserVersion ?? 'docling-serve-v1.21.0',
            signal: context.signal,
        });
        await context.reportProgress(0.8, { phase: 'converted', passageCount: converted.normalizedPassages.length });
        const stored = await objectStore.putImmutable(converted.artifactKey, converted.artifact, converted.artifactContentType);
        await context.reportProgress(1, { phase: 'artifact_stored', artifactKey: stored.key });
        return {
            artifactKey: stored.key,
            artifactEtag: stored.etag,
            parserVersion: converted.parserVersion,
            normalizedPassages: converted.normalizedPassages,
        };
    };
    return new Map([['convert', convert]]);
}
