// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { createHash } from 'node:crypto';
import { IncomingMessage, Server, ServerResponse, createServer } from 'node:http';
import { URL } from 'node:url';
import {
    ClockPort,
    EgressPolicyPort,
    ExecutionIdPort,
    ExecutionStorePort,
    ObjectStorePort,
    SourceRecordPort,
    SourceAdmissionPort,
} from '@ivory-tower/adapters';
import { ExecutionService } from '@ivory-tower/application';
import {
    CreateExecutionRequest,
    ContentClass,
    executionEventSchema,
    createExecutionRequestSchema,
    sourceMetadataSchema,
    SourceUploadResponse,
    toExecutionResponse,
} from '@ivory-tower/contracts';
import { isTerminalExecutionStatus } from '@ivory-tower/domain';
import { captureIvoryException, IvoryReadyReport, isIvoryReadyHttpOk } from '@ivory-tower/infrastructure';

export interface ApiServerDependencies {
    readonly executionService: ExecutionService;
    readonly executionStore: ExecutionStorePort;
    readonly objectStore?: ObjectStorePort;
    readonly sourceRecords?: SourceRecordPort;
    readonly admission?: SourceAdmissionPort;
    readonly egress?: EgressPolicyPort;
    readonly ids?: ExecutionIdPort;
    readonly clock?: ClockPort;
    readonly readiness?: () => Promise<IvoryReadyReport>;
    readonly maxBodyBytes?: number;
}

export class ApiError extends Error {
    constructor(
        readonly statusCode: number,
        readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

interface SourceUploadMetadata {
    readonly filename: string;
    readonly contentType: string;
    readonly license: string;
    readonly authorizationEvidence: string;
    readonly contentClass: ContentClass;
    readonly acquisitionRoute: 'publisherApi' | 'upload' | 'openRepository';
    readonly itemLicenceConfirmed?: boolean;
}

function parseOptionalBooleanHeader(value: string | string[] | undefined): boolean | undefined {
    if (value === undefined) {
        return undefined;
    }
    const normalized = Array.isArray(value) ? value[0] : value;
    if (normalized === undefined || normalized.length === 0) {
        return undefined;
    }
    if (normalized === 'true') {
        return true;
    }
    if (normalized === 'false') {
        return false;
    }
    return undefined;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown, headers: Record<string, string> = {}): void {
    const encoded = JSON.stringify(body);
    response.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(encoded),
        ...headers,
    });
    response.end(encoded);
}

function sendError(response: ServerResponse, error: unknown): void {
    if (error instanceof ApiError) {
        sendJson(response, error.statusCode, { error: { code: error.code, message: error.message } });
        return;
    }
    sendJson(response, 500, { error: { code: 'internal_error', message: 'The request could not be completed.' } });
}

async function readBody(request: IncomingMessage, maximumBytes: number): Promise<Buffer> {
    const declaredLength = Number(request.headers['content-length'] ?? 0);
    if (declaredLength > maximumBytes) {
        throw new ApiError(413, 'body_too_large', `Request body exceeds the ${maximumBytes}-byte limit.`);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > maximumBytes) {
            throw new ApiError(413, 'body_too_large', `Request body exceeds the ${maximumBytes}-byte limit.`);
        }
        chunks.push(buffer);
    }
    return Buffer.concat(chunks);
}

function parseJson(buffer: Buffer): unknown {
    try {
        return JSON.parse(buffer.toString('utf8'));
    } catch {
        throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.');
    }
}

function extractExecutionId(pathname: string): string | undefined {
    const match = /^\/v1\/executions\/([^/]+)$/.exec(pathname);
    return match?.[1];
}

function extractEventExecutionId(pathname: string): string | undefined {
    const match = /^\/v1\/executions\/([^/]+)\/events$/.exec(pathname);
    return match?.[1];
}

function writeEvent(response: ServerResponse, event: { id: string; type: string; payload: unknown }): void {
    const encoded = JSON.stringify(event.payload);
    response.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${encoded}\n\n`);
}

async function uploadSource(
    request: IncomingMessage,
    dependencies: ApiServerDependencies,
    metadata: SourceUploadMetadata,
    maximumBytes: number,
): Promise<SourceUploadResponse> {
    const ingestionUnavailable =
        dependencies.objectStore === undefined ||
        dependencies.sourceRecords === undefined ||
        dependencies.admission === undefined ||
        dependencies.ids === undefined ||
        dependencies.clock === undefined;
    if (ingestionUnavailable) {
        throw new ApiError(503, 'source_ingestion_unavailable', 'Source ingestion is not configured for this runtime.');
    }
    const content = await readBody(request, maximumBytes);
    const contentHash = createHash('sha256').update(content).digest('hex');
    const decision = await dependencies.admission.admit(metadata, contentHash);
    if (!decision.allowed) {
        throw new ApiError(422, 'source_not_admitted', decision.reason);
    }
    const sourceId = dependencies.ids.next();
    const objectKey = `sources/${contentHash}`;
    const stored = await dependencies.objectStore.putImmutable(objectKey, content, metadata.contentType);
    const admittedAt = dependencies.clock.now().toISOString();
    const source = await dependencies.sourceRecords.persistSource({
        id: sourceId,
        contentHash,
        objectKey: stored.key,
        contentType: metadata.contentType,
        license: metadata.license,
        authorizationEvidence: metadata.authorizationEvidence,
        admissionPolicyVersion: 'iv-128-v1',
        admittedAt,
        contentClass: decision.contentClass,
        rightsBasisKind: decision.rightsBasisKind,
        acquisitionRoute: decision.acquisitionRoute,
        deploymentTopology: decision.deploymentTopology,
        ingestPermitted: decision.ingestPermitted,
        transferPermitted: decision.transferPermitted,
        ingestReason: decision.ingestReason,
        transferReason: decision.transferReason,
    });
    return {
        sourceId: source.id,
        contentHash: source.contentHash,
        objectKey: source.objectKey,
        admittedAt: source.admittedAt,
    };
}

export function createApiServer(dependencies: ApiServerDependencies): Server {
    const maximumBytes = dependencies.maxBodyBytes ?? 10 * 1024 * 1024;
    return createServer(async (request, response) => {
        try {
            const method = request.method ?? 'GET';
            const url = new URL(request.url ?? '/', 'http://ivory-tower.local');
            if (method === 'GET' && url.pathname === '/health/live') {
                sendJson(response, 200, { status: 'ok' });
                return;
            }
            if (method === 'GET' && url.pathname === '/health/ready') {
                const report: IvoryReadyReport =
                    dependencies.readiness === undefined ? { status: 'ready', checks: [] } : await dependencies.readiness();
                sendJson(response, isIvoryReadyHttpOk(report) ? 200 : 503, report);
                return;
            }
            if (method === 'POST' && url.pathname === '/v1/executions') {
                const parsed = createExecutionRequestSchema.safeParse(parseJson(await readBody(request, maximumBytes)));
                if (!parsed.success) {
                    throw new ApiError(400, 'invalid_request', 'The execution request does not match the versioned contract.');
                }
                const idempotencyKey = request.headers['idempotency-key'];
                if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
                    throw new ApiError(400, 'missing_idempotency_key', 'An Idempotency-Key header is required.');
                }
                const result = await dependencies.executionService.create(parsed.data as CreateExecutionRequest, idempotencyKey);
                sendJson(response, result.replayed ? 200 : 202, toExecutionResponse(result.record), {
                    location: `/v1/executions/${result.record.id}`,
                    'cache-control': 'no-store',
                });
                return;
            }
            if (method === 'POST' && url.pathname === '/v1/sources') {
                const metadataResult = sourceMetadataSchema.safeParse({
                    filename: request.headers['x-source-filename'],
                    contentType: request.headers['x-source-content-type'],
                    license: request.headers['x-source-license'],
                    authorizationEvidence: request.headers['x-source-authorization-evidence'],
                    contentClass: request.headers['x-source-content-class'],
                    acquisitionRoute: request.headers['x-source-acquisition-route'],
                    itemLicenceConfirmed: parseOptionalBooleanHeader(request.headers['x-source-item-licence-confirmed']),
                });
                if (!metadataResult.success) {
                    throw new ApiError(400, 'invalid_source_metadata', 'Source metadata is required before admission.');
                }
                const uploaded = await uploadSource(request, dependencies, metadataResult.data, maximumBytes);
                sendJson(response, 201, uploaded, { 'cache-control': 'no-store' });
                return;
            }
            const eventExecutionId = extractEventExecutionId(url.pathname);
            if (method === 'GET' && eventExecutionId !== undefined) {
                await streamEvents(
                    response,
                    dependencies,
                    eventExecutionId,
                    Number(url.searchParams.get('after') ?? request.headers['last-event-id'] ?? 0),
                );
                return;
            }
            const executionId = extractExecutionId(url.pathname);
            if (executionId !== undefined && method === 'GET') {
                const record = await dependencies.executionService.get(executionId);
                if (record === undefined) {
                    throw new ApiError(404, 'execution_not_found', 'Execution was not found.');
                }
                sendJson(response, 200, toExecutionResponse(record), { 'cache-control': 'no-store' });
                return;
            }
            if (executionId !== undefined && method === 'DELETE') {
                const record = await dependencies.executionService.cancel(executionId);
                if (record === undefined) {
                    throw new ApiError(404, 'execution_not_found', 'Execution was not found.');
                }
                sendJson(response, 202, toExecutionResponse(record), { 'cache-control': 'no-store' });
                return;
            }
            throw new ApiError(404, 'route_not_found', 'Route was not found.');
        } catch (error) {
            if (!(error instanceof ApiError)) {
                captureIvoryException(error, {
                    stage: 'api_request',
                    method: request.method ?? 'GET',
                    path: new URL(request.url ?? '/', 'http://ivory-tower.local').pathname,
                });
            }
            if (!response.headersSent) {
                sendError(response, error);
            } else {
                response.destroy(error instanceof Error ? error : undefined);
            }
        }
    });
}

async function streamEvents(
    response: ServerResponse,
    dependencies: ApiServerDependencies,
    executionId: string,
    afterSequence: number,
): Promise<void> {
    const record = await dependencies.executionService.get(executionId);
    if (record === undefined) {
        throw new ApiError(404, 'execution_not_found', 'Execution was not found.');
    }
    response.writeHead(200, {
        'cache-control': 'no-cache, no-store',
        connection: 'keep-alive',
        'content-type': 'text/event-stream; charset=utf-8',
        'x-accel-buffering': 'no',
    });
    let lastSequence = Number.isFinite(afterSequence) ? Math.max(0, afterSequence) : 0;
    let polling = false;
    const poll = async () => {
        if (polling || response.writableEnded) {
            return;
        }
        polling = true;
        try {
            const events = await dependencies.executionService.events(executionId, lastSequence);
            for (const event of events) {
                const valid = executionEventSchema.parse(event);
                writeEvent(response, valid);
                lastSequence = valid.sequence;
            }
            const latest = await dependencies.executionService.get(executionId);
            if (latest !== undefined && isTerminalExecutionStatus(latest.status) && events.length === 0) {
                clearInterval(interval);
                response.end();
            }
        } finally {
            polling = false;
        }
    };
    const interval = setInterval(() => {
        poll().catch(error => response.destroy(error));
    }, 500);
    response.on('close', () => clearInterval(interval));
    await poll();
}
