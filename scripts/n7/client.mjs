// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function connect({ live = false, testControl = false } = {}) {
    const token = randomBytes(32).toString('hex');
    const env = { N7_CONTROL_TOKEN: token, N7_LIVE: live ? '1' : '0', N7_TEST_CONTROL: testControl ? '1' : '0' };
    for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', ...(live ? ['N7_ENDPOINT', 'N7_MODEL', 'N7_API_KEY'] : [])]) {
        if (process.env[key]) env[key] = process.env[key];
    }
    const transport = new StdioClientTransport({ command: process.execPath,
        args: [fileURLToPath(new URL('../../packages/ivory-tower-agent-experiment/lib/server.js', import.meta.url))], env, stderr: 'pipe' });
    let received = '';
    let timer;
    const ready = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('control_start_timeout')), 10000);
        transport.stderr.on('data', chunk => {
            received += chunk.toString();
            for (const line of received.split('\n')) {
                try { const value = JSON.parse(line); if (Number.isInteger(value.controlPort)) resolve(value.controlPort); } catch { /* startup diagnostics */ }
            }
        });
    });
    const client = new Client({ name: 'ivory-n7-qualification', version: '0.1.0' });
    let port;
    try { [, port] = await Promise.all([client.connect(transport), ready]); }
    catch (error) { await transport.close(); throw error; }
    finally { clearTimeout(timer); }
    async function control(operation, input = {}) {
        const response = await fetch(`http://127.0.0.1:${port}/${operation}`, {
            method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify(input), signal: AbortSignal.timeout(35000), redirect: 'error',
        });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error);
        return value;
    }
    return {
        client, control, controlUrl: `http://127.0.0.1:${port}`,
        async tool(name, args) {
            const result = await client.callTool({ name, arguments: args });
            if (result.isError) throw new Error(result.content?.[0]?.text ?? 'tool_failed');
            return JSON.parse(result.content[0].text);
        },
        close: () => client.close(),
    };
}
