import assert from 'node:assert/strict';
import test from 'node:test';
import { createN7World } from './n7-catalog.mjs';
import { FixtureProvider, ToolPipeline, loadRecordedFixture } from './n7-pipeline.mjs';
import { IvoryMcpPresenter, listMcpTools, profilesFor } from './n7-mcp.mjs';

test('MCP presenter exposes only resolve_fragment and propose_claim', () => {
    const tools = listMcpTools();
    assert.deepEqual(tools.map(item => item.name), ['resolve_fragment', 'propose_claim']);
    assert.deepEqual(tools.map(item => item.effectClass), ['Query', 'Proposal']);
    const world = createN7World();
    const presenter = new IvoryMcpPresenter(new ToolPipeline(world.core, { provider: new FixtureProvider() }), {
        capabilityId: world.capability.id,
    });
    assert.throws(() => presenter.callTool('bash', { command: 'rm -rf /' }), /arbitrary_execution_denied/);
    assert.throws(() => presenter.callTool('ivory.acceptProposal', {}), /arbitrary_execution_denied/);
    assert.throws(() => presenter.callTool('accept_proposal', {}), /arbitrary_execution_denied/);
});

test('MCP read-and-propose path uses the same catalog as CLI accept', () => {
    const world = createN7World();
    const pipeline = new ToolPipeline(world.core, { provider: new FixtureProvider() });
    const presenter = new IvoryMcpPresenter(pipeline, { capabilityId: world.capability.id });
    const excerpt = presenter.callTool('resolve_fragment', { ref: world.fragment });
    const fixture = loadRecordedFixture();
    const proposal = presenter.callTool('propose_claim', {
        text: fixture.candidate.text,
        role: fixture.candidate.role,
        rationale: fixture.candidate.rationale,
        fragmentRef: world.fragment,
        excerptDigest: excerpt.digest,
        expectedClaim: world.claim,
        provider: fixture.provider,
        model: fixture.model,
    });
    const receipt = world.core.dispatch({
        operation: 'ivory.acceptProposal',
        surface: 'cli',
        actor: world.researcher,
        input: { id: proposal.id, digest: proposal.digest, idempotencyKey: 'from-mcp' },
    });
    assert.equal(world.core.getRevision(receipt.claimRef).payload.authorType, 'model');
    assert.equal(world.core.resolveCitation(world.core.getRevision(receipt.linkRef).payload.targets[0]).quote, excerpt.quote);
});

test('studio, cli, mcp, and compute share one catalog and differ only by surface', () => {
    assert.deepEqual(profilesFor('ivory.resolveFragment'), ['studio', 'cli', 'mcp']);
    assert.deepEqual(profilesFor('ivory.acceptProposal'), ['studio', 'cli']);
    assert.deepEqual(profilesFor('ivory.previewRunSpec'), ['studio', 'cli', 'compute']);
    assert.equal(profilesFor('ivory.proposeClaim').includes('compute'), false);
});
