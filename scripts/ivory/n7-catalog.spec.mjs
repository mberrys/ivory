import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CatalogError,
    HOSTILE_SOURCE,
    IvoryCatalog,
    OPERATIONS,
    PRIVATE_CANARY,
    createN7World,
    digestCanonical,
} from './n7-catalog.mjs';

test('catalog operations declare Query, Command, Execution, or Proposal', () => {
    for (const [name, operation] of Object.entries(OPERATIONS)) {
        assert.ok(['Query', 'Command', 'Execution', 'Proposal'].includes(operation.effectClass), name);
        assert.ok(operation.surfaces.length > 0, name);
        if (operation.modelFacing) {
            assert.ok(!operation.surfaces.includes('compute'), name);
            assert.equal(operation.surfaces.includes('mcp'), operation.effectClass === 'Query' || operation.effectClass === 'Proposal');
        } else {
            assert.equal(operation.surfaces.includes('mcp'), false, name);
        }
    }
    assert.equal(OPERATIONS['ivory.acceptProposal'].modelFacing, false);
    assert.equal(OPERATIONS['ivory.proposeClaim'].effectClass, 'Proposal');
    assert.equal(OPERATIONS['ivory.previewRunSpec'].effectClass, 'Execution');
});

test('no-model qualitative path creates a claim, annotation, and evidence link', () => {
    const world = createN7World();
    const claim = world.core.dispatch({
        operation: 'ivory.createClaim',
        surface: 'studio',
        actor: world.researcher,
        input: { text: 'A second human interpretation.' },
    });
    const annotation = world.core.dispatch({
        operation: 'ivory.annotateFragment',
        surface: 'cli',
        actor: world.researcher,
        input: { fragmentRef: world.fragment, text: 'Need to return to this sentence.' },
    });
    const link = world.core.dispatch({
        operation: 'ivory.linkEvidence',
        surface: 'studio',
        actor: world.researcher,
        input: {
            claimRef: claim,
            fragmentRef: world.fragment,
            role: 'supports',
            rationale: 'Human-coded support.',
        },
    });
    const citation = world.core.resolveCitation(world.fragment);
    assert.equal(citation.quote, HOSTILE_SOURCE);
    assert.equal(world.core.getRevision(claim).payload.authorType, 'human');
    assert.equal(world.core.getRevision(annotation).payload.author, world.researcher);
    assert.equal(world.core.getRevision(link).payload.linkAuthorType, 'human');
    assert.equal(world.core.getRevision(link).payload.reviewState, 'accepted');
});

test('exact refs reject latest, other projects, and ungranted fragments', () => {
    const world = createN7World();
    assert.throws(() => world.core.dispatch({
        operation: 'ivory.resolveFragment',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { ref: { ...world.fragment, revisionId: 'latest' } },
    }), error => error instanceof CatalogError && error.code === 'implicit_latest_forbidden');
    assert.throws(() => world.core.dispatch({
        operation: 'ivory.resolveFragment',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { ref: world.privateSource },
    }), /scope_denied/);
    assert.throws(() => world.core.dispatch({
        operation: 'ivory.resolveFragment',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { ref: world.ungranted },
    }), /scope_denied/);
    assert.throws(() => world.core.dispatch({
        operation: 'ivory.resolveFragment',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { ref: { ...world.fragment, revisionId: 'invented' } },
    }), /scope_denied/);
});

test('mcp cannot accept and compute cannot propose', () => {
    const world = createN7World();
    assert.throws(() => world.core.dispatch({
        operation: 'ivory.acceptProposal',
        surface: 'mcp',
        actor: world.researcher,
        input: { id: 'x', digest: 'y', idempotencyKey: 'k' },
    }), /surface_denied/);
    assert.throws(() => world.core.dispatch({
        operation: 'ivory.proposeClaim',
        surface: 'compute',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: {},
    }), /surface_denied/);
    const preview = world.core.dispatch({
        operation: 'ivory.previewRunSpec',
        surface: 'compute',
        actor: 'compute-supervisor',
        input: { snapshotRef: world.snapshot, operation: 'describe' },
    });
    assert.equal(preview.interpretationAccepted, false);
    assert.equal(preview.published, false);
});

test('capability cannot grant accept, and unexpected proposal fields fail closed', () => {
    const world = createN7World();
    assert.throws(() => world.core.issueCapability({
        snapshotRef: world.snapshot,
        allowedFragments: [world.fragment],
        allowedOperations: ['ivory.acceptProposal'],
    }), /capability_cannot_grant_human_plane/);
    const excerpt = world.core.dispatch({
        operation: 'ivory.resolveFragment',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { ref: world.fragment },
    });
    assert.throws(() => world.core.dispatch({
        operation: 'ivory.proposeClaim',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: {
            text: 'x',
            role: 'supports',
            rationale: 'y',
            fragmentRef: world.fragment,
            excerptDigest: excerpt.digest,
            expectedClaim: world.claim,
            provider: 'recorded-fixture',
            model: 'recorded-fixture/1',
            capabilities: ['accept', 'shell'],
        },
    }), /unexpected_proposal_field/);
});

test('proposals require a prior read of the exact excerpt', () => {
    const world = createN7World();
    assert.throws(() => world.core.dispatch({
        operation: 'ivory.proposeClaim',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: {
            text: 'x',
            role: 'supports',
            rationale: 'y',
            fragmentRef: world.fragment,
            excerptDigest: '0'.repeat(64),
            expectedClaim: world.claim,
            provider: 'recorded-fixture',
            model: 'recorded-fixture/1',
        },
    }), /unretrieved_or_mismatched_excerpt/);
});

test('decline leaves accepted research state unchanged and cannot be reversed by resubmit', () => {
    const world = createN7World();
    const excerpt = world.core.dispatch({
        operation: 'ivory.resolveFragment',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { ref: world.fragment },
    });
    const proposal = world.core.dispatch({
        operation: 'ivory.proposeClaim',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: {
            text: 'Advising can clarify a next step.',
            role: 'supports',
            rationale: 'The interviewee described advising as clarifying action.',
            fragmentRef: world.fragment,
            excerptDigest: excerpt.digest,
            expectedClaim: world.claim,
            provider: 'recorded-fixture',
            model: 'recorded-fixture/1',
        },
    });
    const before = world.core.acceptedState();
    world.core.dispatch({
        operation: 'ivory.declineProposal',
        surface: 'studio',
        actor: world.researcher,
        input: { id: proposal.id },
    });
    world.core.dispatch({
        operation: 'ivory.proposeClaim',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: {
            text: 'Advising can clarify a next step.',
            role: 'supports',
            rationale: 'The interviewee described advising as clarifying action.',
            fragmentRef: world.fragment,
            excerptDigest: excerpt.digest,
            expectedClaim: world.claim,
            provider: 'recorded-fixture',
            model: 'recorded-fixture/1',
        },
    });
    assert.throws(() => world.core.dispatch({
        operation: 'ivory.acceptProposal',
        surface: 'cli',
        actor: world.researcher,
        input: { id: proposal.id, digest: proposal.digest, idempotencyKey: 'k' },
    }), /proposal_declined/);
    assert.equal(world.core.acceptedState().digest, before.digest);
});

test('detached approval and mutated envelope cannot change a frozen proposal', () => {
    const world = createN7World();
    const excerpt = world.core.dispatch({
        operation: 'ivory.resolveFragment',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { ref: world.fragment },
    });
    const proposal = world.core.dispatch({
        operation: 'ivory.proposeClaim',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: {
            text: 'Advising can clarify a next step.',
            role: 'supports',
            rationale: 'The interviewee described advising as clarifying action.',
            fragmentRef: world.fragment,
            excerptDigest: excerpt.digest,
            expectedClaim: world.claim,
            provider: 'recorded-fixture',
            model: 'recorded-fixture/1',
        },
    });
    const preview = world.core.getProposal(proposal.id);
    preview.envelope.candidate.text = 'Unapproved change';
    assert.throws(() => world.core.dispatch({
        operation: 'ivory.acceptProposal',
        surface: 'cli',
        actor: world.researcher,
        input: { id: proposal.id, digest: digestCanonical(preview.envelope), idempotencyKey: 'k' },
    }), /approval_mismatch/);
    const receipt = world.core.dispatch({
        operation: 'ivory.acceptProposal',
        surface: 'cli',
        actor: world.researcher,
        input: { id: proposal.id, digest: proposal.digest, idempotencyKey: 'k' },
    });
    assert.equal(world.core.getRevision(receipt.claimRef).payload.text, 'Advising can clarify a next step.');
});

test('search results and inspect calls stay on exact pinned refs', () => {
    const world = createN7World();
    const search = world.core.dispatch({
        operation: 'ivory.searchMaterial',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { query: 'advising' },
    });
    assert.deepEqual(search.hits, [world.fragment]);
    assert.equal(search.hits[0].revisionId, world.fragment.revisionId);
    const inspected = world.core.dispatch({
        operation: 'ivory.inspectClaim',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { ref: world.claim },
    });
    assert.equal(inspected.authorType, 'human');
    const snapshot = world.core.dispatch({
        operation: 'ivory.inspectSnapshot',
        surface: 'mcp',
        actor: 'agent',
        capabilityId: world.capability.id,
        input: { ref: world.snapshot },
    });
    assert.equal(snapshot.ref.revisionId, world.snapshot.revisionId);
    assert.equal(JSON.stringify(world.core).includes(PRIVATE_CANARY), false);
});

test('isolated catalog instances do not share writers', () => {
    const left = new IvoryCatalog({ projectId: 'prj_a' });
    const right = new IvoryCatalog({ projectId: 'prj_b' });
    left.admitSource({ name: 'a', bytes: 'a', actor: 'researcher' });
    assert.equal(right.sequence, 0);
    assert.notEqual(left.projectId, right.projectId);
});
