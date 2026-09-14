// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v3';
import { fixture, ProposalCore, exactRefSchema, proposalSchema } from './core';
import { ProviderDispatcher } from './provider';

async function main(): Promise<void> {
    const token = process.env.N7_CONTROL_TOKEN;
    if (!token || token.length < 32) {
        throw new Error('trusted_control_token_required');
    }
    const f = fixture();
    const live = process.env.N7_LIVE === '1';
    const endpoint = live ? process.env.N7_ENDPOINT : 'https://recorded.invalid/v1/chat/completions';
    const model = live ? process.env.N7_MODEL : 'recorded-fixture/1';
    if (!endpoint || !model) {
        throw new Error('provider_configuration_required');
    }
    const core = new ProposalCore(f.kernel, [f.fragment], f.claim, live ? endpoint : 'recorded', model);
    const dispatcher = new ProviderDispatcher(core, { endpoint, model, apiKey: process.env.N7_API_KEY, recorded: !live });
    const researcher = 'local-researcher'; // Identity is bound to the trusted control channel, never tool arguments.
    const server = new McpServer({ name: 'ivory-n7', version: '0.1.0' });
    const result = (operation: () => unknown) => {
        try {
            return { content: [{ type: 'text' as const, text: JSON.stringify(operation()) }] };
        } catch (error) {
            return { isError: true, content: [{ type: 'text' as const, text: safeError(error) }] };
        }
    };
    server.registerTool(
        'read_excerpt',
        { description: 'Read one authorized exact research excerpt.', inputSchema: { ref: exactRefSchema } },
        input => result(() => core.readExcerpt(input.ref)),
    );
    server.registerTool(
        'propose_claim',
        { description: 'Propose a claim and one evidence link; cannot accept research changes.', inputSchema: proposalSchema },
        input => result(() => core.propose(input)),
    );

    // Experiment-only researcher channel. Loopback + unguessable token; never advertised through MCP.
    const control = createServer(async (request, response) => {
        const supplied = Buffer.from(request.headers.authorization ?? '');
        const expected = Buffer.from(`Bearer ${token}`);
        if (request.method !== 'POST' || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
            response.writeHead(403).end();
            return;
        }
        try {
            let body = '';
            for await (const chunk of request) {
                body += chunk.toString('utf8');
                if (Buffer.byteLength(body) > 65536) {
                    throw new Error('control_request_too_large');
                }
            }
            const input = JSON.parse(body || '{}');
            let output: unknown;
            switch (request.url) {
                case '/bootstrap':
                    output = { fragment: f.fragment, claim: f.claim, ungranted: f.ungranted, privateSource: f.privateSource };
                    break;
                case '/preview':
                    output = core.preview(z.string().parse(input.id));
                    break;
                case '/accept': {
                    const parsed = z.object({ id: z.string(), digest: z.string(), idempotencyKey: z.string() }).strict().parse(input);
                    output = core.accept(parsed.id, parsed.digest, parsed.idempotencyKey, researcher);
                    break;
                }
                case '/decline':
                    core.decline(z.string().parse(input.id));
                    output = { declined: true };
                    break;
                case '/revoke':
                    core.revoke();
                    output = { revoked: true };
                    break;
                case '/transmission':
                    output = dispatcher.preview(core.readExcerpt(exactRefSchema.parse(input.ref)));
                    break;
                case '/approve-transmission':
                    dispatcher.approve(z.string().parse(input.digest));
                    output = { approved: true };
                    break;
                case '/dispatch':
                    output = await dispatcher.dispatch(z.string().parse(input.digest));
                    break;
                case '/observations':
                    output = dispatcher.observations();
                    break;
                case '/state':
                    output = { sequence: f.kernel.sequence, claimHead: f.kernel.getHead(f.claim.objectId) };
                    break;
                case '/test-revise-claim':
                    if (process.env.N7_TEST_CONTROL !== '1' || live) {
                        throw new Error('test_control_disabled');
                    }
                    output = f.kernel.reviseClaim({
                        claimRef: f.claim,
                        expectedHead: f.kernel.getHead(f.claim.objectId)!,
                        text: 'Researcher changed the context.',
                        actor: researcher,
                    });
                    break;
                default:
                    response.writeHead(404).end();
                    return;
            }
            response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(output));
        } catch (error) {
            response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: safeError(error) }));
        }
    });
    await new Promise<void>(resolve => control.listen(0, '127.0.0.1', resolve));
    const address = control.address();
    if (!address || typeof address === 'string') {
        throw new Error('control_listen_failed');
    }
    process.stderr.write(`${JSON.stringify({ controlPort: address.port })}\n`);
    process.stdin.on('end', () => {
        control.closeAllConnections();
        control.close();
    });
    await server.connect(new StdioServerTransport());
}

function safeError(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    return /^[a-z][a-z0-9_]{0,80}$/.test(message) ? message : 'invalid_request';
}

main().catch(() => {
    process.stderr.write('n7_server_start_failed\n');
    process.exitCode = 1;
});
