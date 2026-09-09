import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareClients } from './compare.mjs';
const records = () =>
    ['theia', 'cli', 'r', 'python'].map(client => ({
        client,
        resolvedRunSpec: { sourceVersion: 'v1', environment: { r: '4' }, timestamp: 'meaningful' },
        semanticResult: { value: 42 },
        metadata: { actor: client, receipt: client, time: client },
    }));
test('requires all real-client observations', () => {
    assert.equal(compareClients([]).status, 'blocked');
    const input = records();
    input[0].resolvedRunSpec = null;
    assert.equal(compareClients(input).status, 'blocked');
});

test('V2 unexecuted fixture results cannot qualify client equivalence', () => {
    const input = records();
    for (const record of input) record.semanticResult = { status: 'not-executed', output: [] };
    assert.equal(compareClients(input).status, 'blocked');
    assert.equal(compareClients([null, null, null, null]).status, 'blocked');
});
test('permits only metadata outside the complete content projections to differ', () => {
    assert.equal(compareClients(records()).status, 'passed');
    for (const field of ['sourceVersion', 'timestamp', 'environment']) {
        const input = records();
        input[1].resolvedRunSpec[field] = 'changed';
        assert.equal(compareClients(input).status, 'failed');
    }
    const input = records();
    input[3].semanticResult.value = 43;
    assert.equal(compareClients(input).status, 'failed');
});
