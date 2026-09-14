import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readManifest, validateManifest, verifyGeneratedMap } from './cutline-model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = readManifest(path.join(ROOT, 'docs/generated/v1-cutline.json'));

function clone() {
    return structuredClone(manifest);
}

test('the generated snapshot is internally consistent', () => {
    assert.deepEqual(validateManifest(manifest, { repositoryRoot: ROOT }).errors, []);
});

test('rejects an unclassified issue', () => {
    const candidate = clone();
    candidate.issues[0].releaseClass = null;
    assert.match(validateManifest(candidate).errors.join('\n'), /invalid or missing Release class/);
});

test('rejects a V1-required issue in Phase 7', () => {
    const candidate = clone();
    candidate.issues[0].phase = 7;
    assert.match(validateManifest(candidate).errors.join('\n'), /V1-required issue is outside Phases 1-6/);
});

test('rejects a V1-required issue blocked by Post-V1 work', () => {
    const candidate = clone();
    candidate.issues.find(issue => issue.id === 128).blockers = [13];
    assert.match(validateManifest(candidate).errors.join('\n'), /depends on Post-V1 IV-13/);
});

test('rejects duplicate and missing IDs', () => {
    const candidate = clone();
    candidate.issues = candidate.issues.slice(0, -1);
    candidate.issues.push({ ...candidate.issues[0], id: candidate.issues[1].id });
    const errors = validateManifest(candidate).errors.join('\n');
    assert.match(errors, /duplicate issue id/);
    assert.match(errors, /missing issue id/);
});

test('rejects incomplete Conditional metadata', () => {
    const candidate = clone();
    candidate.classificationMetadata[0].ifNotTriggered = '';
    assert.match(validateManifest(candidate).errors.join('\n'), /missing Conditional metadata field ifNotTriggered/);
});

test('accepts generated cutline blocks with CRLF line endings', () => {
    const documentPath = path.join(ROOT, 'docs/v1-build-vs-open-source.md');
    const document = fs.readFileSync(documentPath, 'utf8');
    const crlfDocumentPath = path.join(ROOT, 'docs/.v1-cutline-crlf-test.md');
    fs.writeFileSync(crlfDocumentPath, document.replace(/\n/g, '\r\n'), 'utf8');
    try {
        assert.equal(verifyGeneratedMap(crlfDocumentPath, manifest).ok, true);
    } finally {
        fs.rmSync(crlfDocumentPath, { force: true });
    }
});
