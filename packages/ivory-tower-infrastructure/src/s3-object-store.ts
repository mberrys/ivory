// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import {
    HeadBucketCommand,
    GetObjectCommand,
    HeadObjectCommand,
    NotFound,
    PutObjectCommand,
    S3Client,
    S3ServiceException,
} from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { ObjectStorePort } from '@ivory-tower/adapters';

export interface S3CompatibleObjectStoreOptions {
    readonly endpoint?: string;
    readonly region?: string;
    readonly accessKeyId?: string;
    readonly secretAccessKey?: string;
    readonly forcePathStyle?: boolean;
}

/** Immutable-byte adapter for S3 and S3-compatible object stores. */
export class S3CompatibleObjectStore implements ObjectStorePort {
    private readonly client: S3Client;
    private readonly bucket: string;

    constructor(bucket: string, options: S3CompatibleObjectStoreOptions = {}) {
        this.bucket = bucket;
        this.client = new S3Client({
            endpoint: options.endpoint,
            region: options.region ?? 'us-east-1',
            forcePathStyle: options.forcePathStyle ?? false,
            credentials:
                options.accessKeyId === undefined || options.secretAccessKey === undefined
                    ? undefined
                    : {
                          accessKeyId: options.accessKeyId,
                          secretAccessKey: options.secretAccessKey,
                      },
        });
    }

    async probe(): Promise<void> {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    }

    async putImmutable(key: string, content: Uint8Array, contentType: string): Promise<{ key: string; etag: string }> {
        const contentHash = createHash('sha256').update(content).digest('hex');
        try {
            const existing = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
            const existingHash = existing.Metadata?.['content-sha256'];
            if (existingHash !== contentHash) {
                throw new Error(`Immutable object already exists with different content: ${key}`);
            }
            return { key, etag: existingHash };
        } catch (error) {
            if (!isMissingObject(error)) {
                throw error;
            }
        }

        try {
            const uploaded = await this.client.send(
                new PutObjectCommand({
                    Bucket: this.bucket,
                    Key: key,
                    Body: content,
                    ContentType: contentType,
                    Metadata: { 'content-sha256': contentHash },
                    IfNoneMatch: '*',
                }),
            );
            return { key, etag: stripQuotes(uploaded.ETag) ?? contentHash };
        } catch (error) {
            if (!isPreconditionFailure(error)) {
                throw error;
            }
            const existing = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
            if (existing.Metadata?.['content-sha256'] !== contentHash) {
                throw new Error(`Immutable object already exists with different content: ${key}`);
            }
            return { key, etag: existing.Metadata['content-sha256'] };
        }
    }

    async get(key: string): Promise<Uint8Array> {
        const output = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        const body = output.Body;
        if (body === undefined) {
            throw new Error(`Object store returned an empty body: ${key}`);
        }
        if ('transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
            return body.transformToByteArray();
        }
        const chunks: Uint8Array[] = [];
        for await (const chunk of body as AsyncIterable<Uint8Array>) {
            chunks.push(chunk);
        }
        const total = chunks.reduce((length, chunk) => length + chunk.byteLength, 0);
        const result = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return result;
    }
}

function stripQuotes(value: string | undefined): string | undefined {
    return value?.replace(/^"|"$/g, '');
}

function isMissingObject(error: unknown): boolean {
    return (
        error instanceof NotFound ||
        (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) ||
        (error instanceof Object &&
            '$metadata' in error &&
            (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
    );
}

function isPreconditionFailure(error: unknown): boolean {
    return error instanceof S3ServiceException && error.$metadata.httpStatusCode === 412;
}
