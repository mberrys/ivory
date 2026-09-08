// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
'use strict';

// Transport only. Routes come from ivory-tower-api/src/api-server.ts.
// Deliberately does not import contracts: their current barrel imports domain code.
class HttpError extends Error {
    constructor(status, body) {
        super(`Service returned HTTP ${status}`);
        this.status = status;
        this.body = body;
    }
}

const missingCapabilities = Object.freeze(['project', 'citation', 'resolvedRunSpec', 'competingEdits']);

class ExecutionClient {
    constructor(baseUrl, fetcher = globalThis.fetch) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.fetcher = fetcher;
    }

    async request(path, { method = 'GET', body, key, signal } = {}) {
        const response = await this.fetcher(this.baseUrl + path, {
            method,
            headers: {
                Accept: 'application/json',
                ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
                ...(key ? { 'Idempotency-Key': key } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal,
            redirect: 'error',
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new HttpError(response.status, payload);
        }
        return payload;
    }

    ready(signal) {
        return this.request('/health/ready', { signal });
    }
    get(id, signal) {
        return this.request(`/v1/executions/${encodeURIComponent(id)}`, { signal });
    }
    submit(body, key, signal) {
        if (typeof key !== 'string' || !key.trim()) {
            throw new Error('Supply and retain an Idempotency-Key before submission.');
        }
        // No automatic mutation retries. Caller retains the exact body and key after uncertainty.
        return this.request('/v1/executions', { method: 'POST', body, key, signal });
    }

    async *events(id, after = 0, signal) {
        if (!Number.isSafeInteger(after) || after < 0) {
            throw new Error('Invalid event sequence');
        }
        const response = await this.fetcher(`${this.baseUrl}/v1/executions/${encodeURIComponent(id)}/events?after=${after}`, {
            headers: { Accept: 'text/event-stream', 'Last-Event-ID': String(after) },
            signal,
            redirect: 'error',
        });
        if (!response.ok) {
            throw new HttpError(response.status, await response.json());
        }
        if (!response.headers.get('content-type')?.startsWith('text/event-stream') || !response.body) {
            throw new Error('Expected an SSE response');
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                buffer = buffer.replace(/\r\n/g, '\n');
                let end;
                while ((end = buffer.indexOf('\n\n')) >= 0) {
                    const frame = buffer.slice(0, end);
                    if (frame.length > 1024 * 1024) {
                        throw new Error('SSE frame exceeds transport limit');
                    }
                    buffer = buffer.slice(end + 2);
                    const lines = frame.split('\n');
                    const data = lines
                        .filter(line => line.startsWith('data:'))
                        .map(line => line.slice(5).replace(/^ /, ''))
                        .join('\n');
                    if (!data) {
                        continue;
                    }
                    const rawId = lines
                        .find(line => line.startsWith('id:'))
                        ?.slice(3)
                        .trim();
                    // Both repository stores emit `${executionId}:${sequence}`;
                    // the HTTP route resumes by numeric sequence, not the full ID.
                    const suffix = rawId?.startsWith(`${id}:`) ? rawId.slice(id.length + 1) : '';
                    if (!/^\d+$/.test(suffix)) {
                        throw new Error('Replay blocked: unrecognized service event ID');
                    }
                    const sequence = Number(suffix);
                    if (!Number.isSafeInteger(sequence)) {
                        throw new Error('Invalid SSE sequence');
                    }
                    if (sequence <= after) {
                        continue;
                    }
                    after = sequence;
                    yield {
                        sequence,
                        type:
                            lines
                                .find(line => line.startsWith('event:'))
                                ?.slice(6)
                                .trim() ?? 'message',
                        payload: JSON.parse(data),
                    };
                }
                if (buffer.length > 1024 * 1024) {
                    throw new Error('SSE frame exceeds transport limit');
                }
            }
        } finally {
            await reader.cancel().catch(() => undefined);
            reader.releaseLock();
        }
    }

    async *watch(id, signal) {
        let after = 0;
        let delay = 250;
        while (!signal.aborted) {
            try {
                yield { kind: 'status', value: await this.get(id, signal) };
                yield { kind: 'connection', value: 'connected' };
                for await (const event of this.events(id, after, signal)) {
                    after = event.sequence;
                    delay = 250;
                    yield { kind: 'event', value: event };
                }
                const status = await this.get(id, signal);
                yield { kind: 'status', value: status };
                if (['succeeded', 'failed', 'cancelled'].includes(status.status)) {
                    return;
                }
            } catch (error) {
                if (signal.aborted) {
                    return;
                }
                if (!(error instanceof TypeError) && !(error instanceof HttpError && error.status >= 500)) {
                    throw error;
                }
                yield { kind: 'connection', value: 'disconnected' };
            }
            await new Promise(resolve => {
                const done = () => {
                    clearTimeout(timer);
                    signal.removeEventListener('abort', done);
                    resolve();
                };
                const timer = setTimeout(done, delay);
                signal.addEventListener('abort', done, { once: true });
                if (signal.aborted) {
                    done();
                }
            });
            delay = Math.min(delay * 2, 10000);
        }
    }
}

module.exports = { ExecutionClient, HttpError, missingCapabilities };
