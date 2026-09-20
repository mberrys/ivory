// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { N7_DECISIONS, retainedDecision, retainedLiveProvider } from './n7-retain-policy.mjs';

test('a deterministic re-run never overwrites a retained reviewed live-provider run', () => {
    const previous = {
        observedAt: '2026-09-13T23:25:37.110Z',
        liveProvider: {
            status: 'run',
            outcome: 'passed',
            endpoint: 'loopback-http',
            model: 'qwen3-4b-instruct-2507',
            observationSummary: { 'preview-excludes-private-canary': true },
        },
    };
    const retained = retainedLiveProvider(previous, { liveConfigured: false });
    assert.equal(retained.status, 'run');
    assert.equal(retained.outcome, 'passed');
    assert.equal(retained.model, 'qwen3-4b-instruct-2507');
    assert.equal(retained.observationSummary['preview-excludes-private-canary'], true);
    assert.equal(retained.carriedForwardFrom, '2026-09-13T23:25:37.110Z');
    assert.match(retained.carryForwardReason, /did not re-observe/);

    // A configured provider does not license discarding the retained run either.
    assert.equal(retainedLiveProvider(previous, { liveConfigured: true }).status, 'run');
});

test('without retained live evidence the record states plainly that no live run happened', () => {
    assert.equal(retainedLiveProvider(undefined, {}).status, 'not-run');
    assert.equal(retainedLiveProvider({ liveProvider: { status: 'not-run' } }, {}).status, 'not-run');
    assert.equal(retainedLiveProvider(undefined, { liveConfigured: true }).status, 'not-run-in-retain');
    assert.match(retainedLiveProvider(undefined, {}).reason, /opt-in/);
});

test('only a passing suite with a retained live run carries the decision the N7 gate closes on', () => {
    assert.equal(N7_DECISIONS.includes('bounded-experiment-pass'), true);
    assert.equal(retainedDecision({ testsPassed: true, liveRetained: true }), 'bounded-experiment-pass');
    assert.equal(retainedDecision({ testsPassed: true, liveRetained: false }), 'deterministic-pass-live-provider-open');
    assert.equal(retainedDecision({ testsPassed: false, liveRetained: true }), 'failed-or-incomplete');
    assert.equal(retainedDecision({ testsPassed: false, liveRetained: false }), 'failed-or-incomplete');
    assert.equal(N7_DECISIONS.includes(retainedDecision({ testsPassed: true, liveRetained: true })), true);
    assert.equal(N7_DECISIONS.includes(retainedDecision({ testsPassed: true, liveRetained: false })), true);
});
