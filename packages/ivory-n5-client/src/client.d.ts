export class HttpError extends Error {
    readonly status: number;
    readonly body: unknown;
}
export const missingCapabilities: readonly string[];
export class ExecutionClient {
    constructor(baseUrl: string, fetcher?: typeof fetch);
    ready(signal?: AbortSignal): Promise<unknown>;
    get(id: string, signal?: AbortSignal): Promise<unknown>;
    submit(body: unknown, key: string, signal?: AbortSignal): Promise<unknown>;
    openProject(body: unknown, signal?: AbortSignal): Promise<unknown>;
    resolveCitation(body: unknown, signal?: AbortSignal): Promise<unknown>;
    requestRun(body: unknown, signal?: AbortSignal): Promise<unknown>;
    submitEdit(body: unknown, key: string, signal?: AbortSignal): Promise<unknown>;
    events(id: string, after?: number, signal?: AbortSignal): AsyncGenerator<{ sequence: number; type: string; payload: unknown }>;
    watch(id: string, signal: AbortSignal): AsyncGenerator<{ kind: string; value: unknown }>;
}
