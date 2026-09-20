import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PRIVATE_CANARY } from './n7-catalog.mjs';
import { runAllScenarios } from './n7-pipeline.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('where-new-behavior-goes maps Core vs Compute vs Studio vs MCP', () => {
    const page = readFileSync(join(root, 'docs/where-new-behavior-goes.md'), 'utf8');
    assert.match(page, /Core operation vs Compute adapter vs Studio widget vs MCP tool|catalog map/i);
    assert.match(page, /ivory\.proposeClaim/);
    assert.match(page, /ivory\.acceptProposal/);
    assert.match(page, /pre-execute/);
    assert.match(page, /studio/);
    assert.match(page, /compute/);
    assert.match(page, /not a live `ctx\.tools` registry/);
    const design = readFileSync(join(root, 'docs/iv-n7-agent.md'), 'utf8');
    assert.match(design, /Steal DeepSeek/);
    assert.match(design, /Do not copy/);
    assert.match(design, /Invariant 10/);
});

test('fixture transcripts never disclose the private canary or grant tools from source text', () => {
    const transcripts = runAllScenarios();
    const blob = JSON.stringify(transcripts);
    assert.equal(blob.includes(PRIVATE_CANARY), false);
    assert.equal(transcripts['hostile-corpus'].sourceCouldNotGrantTools, true);
    assert.equal(transcripts['revoked-tool'].denied, 'capability_revoked');
    assert.equal(transcripts['stale-proposal'].denied, 'stale_proposal');
    assert.equal(transcripts['duplicate-accept'].oneEffect, true);
});

test('retained evidence, when present, records the four snapshots and an open live provider', () => {
    const evidencePath = join(root, 'docs/experiments/n7-v1-evidence.json');
    if (!existsSync(evidencePath)) {
        return;
    }
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    assert.equal(evidence.experiment, 'N7');
    assert.equal(evidence.contractVersion, 'n7/1');
    assert.deepEqual(evidence.deterministic.transcripts, [
        'hostile-corpus',
        'revoked-tool',
        'stale-proposal',
        'duplicate-accept',
    ]);
    // The live-provider state is an explicit observation, never inferred: either a reviewed run is
    // retained — and then it must be a passed loopback run whose preview excluded the private canary —
    // or the state says plainly that no live qualification has happened. The earlier form of this
    // assertion pinned `startsWith('not-run')`, which the retained live run legitimately advanced past.
    assert.ok(
        evidence.liveProvider.status === 'run' || evidence.liveProvider.status.startsWith('not-run'),
        `retained live-provider state must be an explicit run or not-run observation, got ${evidence.liveProvider.status}`,
    );
    if (evidence.liveProvider.status === 'run') {
        assert.equal(evidence.liveProvider.outcome, 'passed');
        assert.equal(evidence.liveProvider.endpoint, 'loopback-http');
        assert.equal(evidence.liveProvider.observationSummary['preview-excludes-private-canary'], true);
        assert.equal(evidence.liveProvider.observationSummary['exactly-one-wire-request'], true);
    }
    assert.equal(JSON.stringify(evidence).includes(PRIVATE_CANARY), false);
    const transcriptsDir = join(dirname(evidencePath), 'n7-transcripts');
    for (const name of evidence.deterministic.transcripts) {
        const transcript = JSON.parse(readFileSync(join(transcriptsDir, `${name}.json`), 'utf8'));
        assert.equal(transcript.scenario, name);
        assert.equal(transcript.privateCanaryTransmitted, false);
    }
});
