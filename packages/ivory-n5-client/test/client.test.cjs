// Transport tests are synthetic, not N5 service-equivalence evidence.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ExecutionClient, HttpError } = require('../src/client.cjs');

test('retains exact request and key on explicit retry, without hidden retries', async () => {
    const requests = [];
    const client = new ExecutionClient('http://service', async (url, init) => {
        requests.push({ url, ...init });
        if (requests.length === 1) {
            throw new TypeError('disconnected after acceptance');
        }
        return Response.json({ id: 'accepted' });
    });
    const body = { kind: 'validate', input: { parameter: 3 }, contractVersion: 1 };
    await assert.rejects(client.submit(body, 'retained-key'));
    assert.equal(requests.length, 1);
    await client.submit(body, 'retained-key');
    assert.deepEqual(requests[0], requests[1]);
    assert.throws(() => client.submit(body, ''), /Idempotency-Key/);
});

test('preserves conflict status and service payload', async () => {
    const payload = { error: { code: 'revision_conflict', revision: 'r2' } };
    const client = new ExecutionClient('http://service', async () => Response.json(payload, { status: 409 }));
    await assert.rejects(
        client.submit({}, 'key'),
        error => error instanceof HttpError && error.status === 409 && JSON.stringify(error.body) === JSON.stringify(payload),
    );
});

function sse(text, split = 7) {
    const bytes = new TextEncoder().encode(text);
    return new Response(
        new ReadableStream({
            start(controller) {
                for (let i = 0; i < bytes.length; i += split) {
                    controller.enqueue(bytes.slice(i, i + split));
                }
                controller.close();
            },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
    );
}

test('SSE handles split UTF-8/CRLF and resumes with numeric sequence', async () => {
    let seen;
    const client = new ExecutionClient('http://service', async (url, init) => {
        seen = { url, init };
        return sse(': heartbeat\r\n\r\nid: e:1\r\ndata: {}\r\n\r\nid: e:2\r\nevent: status\r\ndata: {"text":"é"}\r\n\r\n');
    });
    const events = [];
    for await (const event of client.events('e', 1)) {
        events.push(event);
    }
    assert.deepEqual(events, [{ sequence: 2, type: 'status', payload: { text: 'é' } }]);
    assert.equal(seen.url, 'http://service/v1/executions/e/events?after=1');
    assert.equal(seen.init.headers['Last-Event-ID'], '1');
});

test('rejects event IDs from another execution rather than guessing a cursor', async () => {
    const client = new ExecutionClient('http://service', async () => sse('id: other:1\ndata: {}\n\n'));
    await assert.rejects(async () => {
        for await (const event of client.events('e')) {
            assert.fail(JSON.stringify(event));
        }
    }, /unrecognized/);
});

test('watch reconnects through status and replay without mutation', async () => {
    const requests = [];
    let streams = 0;
    const client = new ExecutionClient('http://service', async (url, init) => {
        requests.push({ url, method: init.method ?? 'GET' });
        if (url.includes('/events')) {
            streams++;
            if (streams === 1) {
                throw new TypeError('service restart');
            }
            return sse('id: e:1\nevent: complete\ndata: {}\n\n');
        }
        return Response.json({ id: 'e', status: streams >= 2 ? 'succeeded' : 'running' });
    });
    const messages = [];
    for await (const message of client.watch('e', AbortSignal.timeout(3000))) {
        messages.push(message);
    }
    assert.ok(messages.some(message => message.value === 'disconnected'));
    assert.ok(messages.some(message => message.kind === 'event'));
    assert.ok(requests.every(request => request.method === 'GET'));
    assert.equal(messages.at(-1).value.status, 'succeeded');
});

test('research actions post to the published contract routes without dropping payloads', async () => {
    const calls = [];
    const client = new ExecutionClient('http://service', async (url, init) => {
        calls.push({ url, ...init });
        return Response.json({ ok: true });
    });
    await client.openProject({ projectId: 'n5-demo' });
    await client.resolveCitation({ projectId: 'n5-demo', revision: 'rev-1', citationId: 'cite-research-py' });
    await client.requestRun({ projectId: 'n5-demo', revision: 'rev-1' });
    await client.submitEdit({ projectId: 'n5-demo', baseRevision: 'rev-1', sourcePath: 'research.py',
        edit: { kind: 'replace', startOffset: 0, endOffset: 4, text: '# x\n' } }, 'edit-key');
    assert.deepEqual(calls.map(call => call.url), [
        'http://service/v1/projects/open', 'http://service/v1/citations/resolve',
        'http://service/v1/runspecs/resolve', 'http://service/v1/projects/edits',
    ]);
    assert.equal(JSON.parse(calls[0].body).projectId, 'n5-demo');
    assert.equal(calls[3].headers['Idempotency-Key'], 'edit-key');
    assert.throws(() => client.submitEdit({}, ''), /Idempotency-Key/);
});
