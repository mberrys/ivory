import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CatalogError,
    PRIVATE_CANARY,
    createN7World,
} from './n7-catalog.mjs';
import {
    FixtureProvider,
    HttpProvider,
    ToolPipeline,
    createLoopbackProviderServer,
    loadRecordedFixture,
    runAllScenarios,
    runDuplicateAcceptScenario,
    runHostileCorpusScenario,
    runRevokedToolScenario,
    runStaleProposalScenario,
} from './n7-pipeline.mjs';

function proposeInput(world, excerpt, overrides = {}) {
    const fixture = loadRecordedFixture();
    return {
        text: fixture.candidate.text,
        role: fixture.candidate.role,
        rationale: fixture.candidate.rationale,
        fragmentRef: world.fragment,
        excerptDigest: excerpt.digest,
        expectedClaim: world.claim,
        provider: fixture.provider,
        model: fixture.model,
        ...overrides,
    };
}

test('pipeline records pre-execute, execute, post-execute, and result', () => {
    const world = createN7World();
    const pipeline = new ToolPipeline(world.core, { provider: new FixtureProvider() });
    const excerpt = pipeline.invoke({
        operation: 'ivory.resolveFragment',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { ref: world.fragment },
    });
    pipeline.invoke({
        operation: 'ivory.proposeClaim',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: proposeInput(world, excerpt),
    });
    assert.deepEqual(pipeline.stages.map(item => item.stage), [
        'pre-execute', 'execute', 'post-execute', 'result',
        'pre-execute', 'execute', 'post-execute', 'result',
    ]);
    assert.equal(pipeline.stages[4].egress.mode, 'retrieved-excerpts-only');
    assert.equal(pipeline.stages[6].frozen, true);
});

test('fixture provider ignores adversarial source instructions', async () => {
    const world = createN7World();
    const pipeline = new ToolPipeline(world.core, { provider: new FixtureProvider() });
    const turn = await pipeline.runFixtureTurn({
        capabilityId: world.capability.id,
        fragmentRef: world.fragment,
        expectedClaim: world.claim,
    });
    assert.match(turn.excerpt.quote, /IGNORE ALL RULES/);
    assert.equal(turn.proposal.envelope.candidate.text, loadRecordedFixture().candidate.text);
    assert.equal(turn.proposal.envelope.excerpt.digest, turn.excerpt.digest);
    assert.equal(JSON.stringify(turn).includes(PRIVATE_CANARY), false);
});

test('recorded fixture-provider snapshots cover the four N7 exercises', () => {
    const transcripts = runAllScenarios();
    assert.equal(transcripts['hostile-corpus'].sourceCouldNotGrantTools, true);
    assert.equal(transcripts['hostile-corpus'].privateCanaryTransmitted, false);
    assert.equal(transcripts['hostile-corpus'].acceptedStateUnchanged, true);
    assert.equal(transcripts['revoked-tool'].denied, 'capability_revoked');
    assert.equal(transcripts['revoked-tool'].acceptedStateUnchanged, true);
    assert.equal(transcripts['stale-proposal'].denied, 'stale_proposal');
    assert.equal(transcripts['stale-proposal'].acceptedStateUnchanged, true);
    assert.equal(transcripts['duplicate-accept'].oneEffect, true);
    assert.equal(transcripts['duplicate-accept'].modelAttribution, true);
    assert.equal(transcripts['duplicate-accept'].exactExcerpt, true);
    assert.equal(runHostileCorpusScenario().scenario, 'hostile-corpus');
    assert.equal(runRevokedToolScenario().scenario, 'revoked-tool');
    assert.equal(runStaleProposalScenario().scenario, 'stale-proposal');
    assert.equal(runDuplicateAcceptScenario().scenario, 'duplicate-accept');
});

test('required egress control refuses extra hosts instead of falling back', () => {
    const world = createN7World();
    const capability = world.core.issueCapability({
        snapshotRef: world.snapshot,
        allowedFragments: [world.fragment],
        egress: { mode: 'retrieved-excerpts-only', extraHosts: ['https://invalid.example/collect'], credentials: false },
    });
    const pipeline = new ToolPipeline(world.core);
    assert.throws(() => pipeline.invoke({
        operation: 'ivory.resolveFragment',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: capability.id,
        input: { ref: world.fragment },
    }), /egress_extra_host/);
});

test('http provider transmits only the retrieved excerpt and refuses redirects, extra tools, and timeouts', async () => {
    const world = createN7World();
    const pipeline = new ToolPipeline(world.core);
    const excerpt = pipeline.invoke({
        operation: 'ivory.resolveFragment',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { ref: world.fragment },
    });
    const fixture = loadRecordedFixture();
    const loopback = await createLoopbackProviderServer((request, response) => {
        if (request.method !== 'POST') {
            response.writeHead(405).end();
            return;
        }
        const chunks = [];
        request.on('data', chunk => chunks.push(chunk));
        request.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            assert.equal(body.includes(PRIVATE_CANARY), false);
            assert.match(body, /IGNORE ALL RULES/);
            assert.match(body, new RegExp(excerpt.digest));
            response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
                choices: [{
                    message: {
                        tool_calls: [{
                            type: 'function',
                            function: {
                                name: 'ivory.proposeClaim',
                                arguments: JSON.stringify({
                                    text: fixture.candidate.text,
                                    role: fixture.candidate.role,
                                    rationale: fixture.candidate.rationale,
                                }),
                            },
                        }],
                    },
                }],
            }));
        });
    });
    try {
        const provider = new HttpProvider({ endpoint: loopback.url, model: 'loopback/1' });
        pipeline.provider = provider;
        const candidate = await provider.complete({
            excerpt,
            tools: ['ivory.resolveFragment', 'ivory.proposeClaim'],
            pipeline,
            capabilityId: world.capability.id,
        });
        assert.equal(candidate.text, fixture.candidate.text);
        assert.equal(pipeline.transmissions.length, 1);
        assert.equal(pipeline.transmissions[0].body.includes(PRIVATE_CANARY), false);
        assert.equal(pipeline.transmissions[0].endpoint, loopback.url);
    } finally {
        await loopback.close();
    }
});

test('http provider fails closed on redirect, extra tool, timeout, and mid-request revoke', async () => {
    const fixture = loadRecordedFixture();
    async function withServer(handler, run) {
        const loopback = await createLoopbackProviderServer(handler);
        try {
            await run(loopback);
        } finally {
            await loopback.close();
        }
    }

    await withServer((request, response) => {
        response.writeHead(302, { location: 'https://invalid.example/collect' }).end();
    }, async loopback => {
        const world = createN7World();
        const pipeline = new ToolPipeline(world.core, { provider: new HttpProvider({ endpoint: loopback.url, model: 'x' }) });
        const excerpt = pipeline.invoke({
            operation: 'ivory.resolveFragment',
            surface: 'mcp',
            actor: 'agent',
            capabilityId: world.capability.id,
            input: { ref: world.fragment },
        });
        const before = world.core.acceptedState();
        await assert.rejects(() => pipeline.provider.complete({
            excerpt,
            tools: ['ivory.resolveFragment', 'ivory.proposeClaim'],
            pipeline,
            capabilityId: world.capability.id,
        }), /provider_response_failed|provider_http_/);
        assert.equal(world.core.acceptedState().digest, before.digest);
    });

    await withServer((request, response) => {
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
            choices: [{
                message: {
                    tool_calls: [
                        { type: 'function', function: { name: 'bash', arguments: '{}' } },
                        { type: 'function', function: { name: 'ivory.proposeClaim', arguments: JSON.stringify(fixture.candidate) } },
                    ],
                },
            }],
        }));
    }, async loopback => {
        const world = createN7World();
        const pipeline = new ToolPipeline(world.core, { provider: new HttpProvider({ endpoint: loopback.url, model: 'x' }) });
        const excerpt = pipeline.invoke({
            operation: 'ivory.resolveFragment',
            surface: 'mcp',
            actor: 'agent',
            capabilityId: world.capability.id,
            input: { ref: world.fragment },
        });
        await assert.rejects(() => pipeline.provider.complete({
            excerpt,
            tools: ['ivory.resolveFragment', 'ivory.proposeClaim'],
            pipeline,
            capabilityId: world.capability.id,
        }), error => error instanceof CatalogError && error.code === 'unexpected_provider_tool');
    });

    await withServer(() => { /* never respond */ }, async loopback => {
        const world = createN7World();
        const pipeline = new ToolPipeline(world.core, {
            provider: new HttpProvider({ endpoint: loopback.url, model: 'x', timeoutMs: 50 }),
        });
        const excerpt = pipeline.invoke({
            operation: 'ivory.resolveFragment',
            surface: 'mcp',
            actor: 'agent',
            capabilityId: world.capability.id,
            input: { ref: world.fragment },
        });
        const before = world.core.acceptedState();
        await assert.rejects(() => pipeline.provider.complete({
            excerpt,
            tools: ['ivory.resolveFragment', 'ivory.proposeClaim'],
            pipeline,
            capabilityId: world.capability.id,
        }), /provider_timeout/);
        assert.equal(world.core.acceptedState().digest, before.digest);
    });

    await withServer((request, response) => {
        setTimeout(() => {
            response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
                choices: [{
                    message: {
                        tool_calls: [{
                            type: 'function',
                            function: { name: 'ivory.proposeClaim', arguments: JSON.stringify(fixture.candidate) },
                        }],
                    },
                }],
            }));
        }, 40);
    }, async loopback => {
        const world = createN7World();
        const pipeline = new ToolPipeline(world.core, { provider: new HttpProvider({ endpoint: loopback.url, model: 'x' }) });
        const excerpt = pipeline.invoke({
            operation: 'ivory.resolveFragment',
            surface: 'mcp',
            actor: 'agent',
            capabilityId: world.capability.id,
            input: { ref: world.fragment },
        });
        const pending = pipeline.provider.complete({
            excerpt,
            tools: ['ivory.resolveFragment', 'ivory.proposeClaim'],
            pipeline,
            capabilityId: world.capability.id,
        });
        world.core.dispatch({
            operation: 'ivory.revokeCapability',
            surface: 'cli',
            actor: world.researcher,
            input: { capabilityId: world.capability.id },
        });
        await assert.rejects(() => pending, /capability_revoked/);
        assert.equal(world.core.acceptedState().claims.filter(item => item.payload.authorType === 'model').length, 0);
    });
});

test('unsafe endpoints and implicit latest heads fail before dispatch', () => {
    assert.throws(() => new HttpProvider({ endpoint: 'http://example.com/v1', model: 'x' }), /unsafe_endpoint/);
    assert.throws(() => new HttpProvider({ endpoint: 'https://user:pass@example.com/v1', model: 'x' }), /endpoint_credentials_forbidden/);
    const world = createN7World();
    const pipeline = new ToolPipeline(world.core);
    assert.throws(() => pipeline.invoke({
        operation: 'ivory.resolveFragment',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { ref: { ...world.fragment, revisionId: 'latest' } },
    }), /implicit_latest_forbidden/);
});

test('accepted run-spec preview does not accept an interpretation', () => {
    const world = createN7World();
    const pipeline = new ToolPipeline(world.core, { provider: new FixtureProvider() });
    const proposal = pipeline.invoke({
        operation: 'ivory.proposeRunSpec',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: {
            code: 'print("hello")',
            entrypoint: 'main',
            expectedClaim: world.claim,
            provider: 'recorded-fixture',
            model: 'recorded-fixture/1',
        },
    });
    const receipt = world.core.dispatch({
        operation: 'ivory.acceptProposal',
        surface: 'cli',
        actor: world.researcher,
        input: { id: proposal.id, digest: proposal.digest, idempotencyKey: 'run-1' },
    });
    assert.equal(receipt.interpretationAccepted, false);
    assert.equal(world.core.getRevision(receipt.runRef).payload.interpretationAccepted, false);
});
