// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ConversionPort } from '@ivory-tower/adapters';

export interface DoclingHttpConversionOptions {
    readonly endpoint: string;
    readonly apiKey?: string;
    readonly timeoutMs?: number;
}

export class DoclingConversionError extends Error {
    constructor(
        message: string,
        readonly retryable: boolean,
    ) {
        super(message);
        this.name = 'DoclingConversionError';
    }
}

interface DoclingResponse {
    readonly status?: string;
    readonly document?: {
        readonly md_content?: string;
        readonly text_content?: string;
    };
}

/** Calls private docling-serve with per-job bytes and no storage credentials. */
export class DoclingHttpConversionAdapter implements ConversionPort {
    private readonly endpoint: string;
    private readonly apiKey: string | undefined;
    private readonly timeoutMs: number;

    constructor(options: DoclingHttpConversionOptions) {
        this.endpoint = options.endpoint.replace(/\/$/, '');
        this.apiKey = options.apiKey;
        this.timeoutMs = options.timeoutMs ?? 120_000;
    }

    async convert(request: Parameters<ConversionPort['convert']>[0]): Promise<Awaited<ReturnType<ConversionPort['convert']>>> {
        const form = new FormData();
        const body = request.content.slice().buffer as ArrayBuffer;
        form.append('files', new Blob([body], { type: request.contentType }), request.filename);
        form.append('to_formats', 'md');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        const abortRequest = () => controller.abort(request.signal?.reason);
        request.signal?.addEventListener('abort', abortRequest, { once: true });
        try {
            const headers: Record<string, string> = {};
            if (this.apiKey !== undefined) {
                headers['X-Api-Key'] = this.apiKey;
            }
            const response = await fetch(`${this.endpoint}/v1/convert/file`, {
                method: 'POST',
                headers,
                body: form,
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new DoclingConversionError(
                    `Docling conversion failed with HTTP ${response.status}.`,
                    response.status >= 500 || response.status === 429,
                );
            }
            const result = (await response.json()) as DoclingResponse;
            const markdown = result.document?.md_content ?? result.document?.text_content;
            if (result.status === 'failure' || markdown === undefined) {
                throw new DoclingConversionError('Docling returned no successful markdown conversion.', false);
            }
            const artifact = new TextEncoder().encode(markdown);
            return {
                artifactKey: `conversions/${request.contentHash}/${request.parserVersion}.md`,
                parserVersion: request.parserVersion,
                artifact,
                artifactContentType: 'text/markdown',
                normalizedPassages: markdown
                    .split(/\n{2,}/u)
                    .filter(Boolean)
                    .map((text, ordinal) => ({ ordinal, text })),
            };
        } finally {
            clearTimeout(timeout);
            request.signal?.removeEventListener('abort', abortRequest);
        }
    }
}
