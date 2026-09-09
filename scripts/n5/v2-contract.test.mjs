import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { InMemoryResearchService } from '../../packages/ivory-tower-infrastructure/src/in-memory-research-service.ts';

const clients = ['theia', 'cli', 'r', 'python'];
const edit = { kind: 'insert', startOffset: 0, endOffset: 0, text: '# revised\n' };

test('equivalent fixture resets produce identical complete RunSpecs', () => {
    const core = service();
    const first = core.resolveRunSpec('n5-demo', 'rev-1');
    core.reset();
    assert.deepEqual(core.resolveRunSpec('n5-demo', 'rev-1'), first);
});
function service() {
    const result = new InMemoryResearchService({
        fixturesDir: fileURLToPath(new URL('../../examples/ivory-n5-browser/fixtures/', import.meta.url)),
    });
    result.reset();
    return result;
}

test('V2 accepted edits replay exactly and reject changed input under the same key', () => {
    const core = service();
    const accepted = core.submitEdit('n5-demo', 'rev-1', 'research.py', edit, 'accepted');
    const original = structuredClone(accepted.record);
    accepted.record.newRevision = 'client-tampering';
    assert.deepEqual(core.submitEdit('n5-demo', 'rev-1', 'research.py', edit, 'accepted'), { replayed: true, record: original });
    assert.throws(
        () => core.submitEdit('n5-demo', 'rev-1', 'research.py', { ...edit, text: 'other' }, 'accepted'),
        error => error.code === 'idempotency_conflict',
    );
    assert.equal(core.open('n5-demo').headRevision, 'rev-2');
});

test('V2 historical citations and resolved inputs remain immutable after edits', () => {
    const core = service();
    const anchor = core.resolveCitation('n5-demo', 'rev-1', 'cite-research-py').anchor;
    const run = core.resolveRunSpec('n5-demo', 'rev-1');
    assert.equal(run.semanticResult.status, 'not-executed');
    core.submitEdit('n5-demo', 'rev-1', 'research.py', edit, 'edit');
    assert.deepEqual(core.resolveCitation('n5-demo', 'rev-1', 'cite-research-py').anchor, anchor);
    assert.deepEqual(core.resolveRunSpec('n5-demo', 'rev-1'), run);
    assert.notEqual(core.resolveRunSpec('n5-demo', 'rev-2').resolvedRunSpec.sourceSetVersion, run.resolvedRunSpec.sourceSetVersion);
    assert.equal(core.open('n5-demo', 'rev-1').revision, 'rev-1');
    assert.throws(
        () => core.resolveCitation('n5-demo', 'rev-999', 'cite-research-py'),
        error => error.code === 'citation_stale',
    );
});

// These are Core contract cases, not observations from installed clients.
for (const first of clients) {
    for (const second of clients.filter(client => client !== first)) {
        test(`V2 competing edit contract: ${first} then ${second}`, () => {
            const core = service();
            core.submitEdit('n5-demo', 'rev-1', 'research.py', edit, first);
            assert.throws(
                () => core.submitEdit('n5-demo', 'rev-1', 'research.py', { ...edit, text: second }, second),
                error => error.code === 'revision_conflict' && error.headRevision === 'rev-2',
            );
            assert.equal(core.open('n5-demo').headRevision, 'rev-2');
        });
    }
}

test('V2 invalid edits cannot advance the project', () => {
    const core = service();
    for (const invalid of [
        { ...edit, endOffset: 2 },
        { ...edit, startOffset: 0.5 },
        { ...edit, kind: 'delete' },
    ]) {
        assert.throws(
            () => core.submitEdit('n5-demo', 'rev-1', 'research.py', invalid, 'invalid'),
            error => error.code === 'invalid_edit_range',
        );
    }
    assert.equal(core.open('n5-demo').headRevision, 'rev-1');
});
