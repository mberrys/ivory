// Synthetic wire tests only. These do not qualify research-service semantics.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { execFile } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const os = require('node:os');
const { promisify } = require('node:util');
const path = require('node:path');
const run = promisify(execFile);

test('CLI and Python preserve service JSON over a real HTTP connection', async () => {
    const server = createServer((request, response) => {
        assert.equal(request.method, 'GET');
        assert.equal(request.url, '/v1/executions/example');
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ id: 'example', result: { nested: [1, 'é', false, null] } }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const options = { env: { ...process.env, IVORY_N5_SERVICE_URL: `http://127.0.0.1:${server.address().port}` }, timeout: 10000 };
        const cli = await run(process.execPath, [path.join(__dirname, '../src/cli.cjs'), 'get', 'example'], options);
        const python = await run(
            process.env.IVORY_N5_PYTHON || 'python',
            [path.join(__dirname, '../helpers/ivory_n5.py'), 'get', 'example'],
            options,
        );
        assert.deepEqual(JSON.parse(cli.stdout), JSON.parse(python.stdout));
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('CLI and Python open projects against the published open route', async () => {
    const server = createServer((request, response) => {
        assert.equal(request.method, 'POST');
        assert.equal(request.url, '/v1/projects/open');
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({
            projectId: 'n5-demo', revision: 'rev-1', headRevision: 'rev-1',
            openedAt: '2026-09-07T00:00:00.000Z', entryPaths: ['research.py'],
        }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const requestFile = path.join(os.tmpdir(), `n5-open-${process.pid}.json`);
    writeFileSync(requestFile, JSON.stringify({ projectId: 'n5-demo' }));
    try {
        const options = { env: { ...process.env, IVORY_N5_SERVICE_URL: `http://127.0.0.1:${server.address().port}` }, timeout: 10000 };
        const cli = await run(process.execPath, [path.join(__dirname, '../src/cli.cjs'), 'open', requestFile], options);
        const python = await run(
            process.env.IVORY_N5_PYTHON || 'python',
            [path.join(__dirname, '../helpers/ivory_n5.py'), 'open', requestFile],
            options,
        );
        assert.deepEqual(JSON.parse(cli.stdout), JSON.parse(python.stdout));
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
