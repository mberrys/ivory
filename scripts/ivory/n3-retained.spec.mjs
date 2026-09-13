import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RECORD = path.join(ROOT, 'docs', 'experiments', 'n3-evidence.json');
const DOC = path.join(ROOT, 'docs', 'iv-n3-compute.md');
const DIGEST_IMAGE = /@sha256:[a-f0-9]{64}$/u;

async function readIfPresent(target) {
    try {
        return await fs.readFile(target, 'utf8');
    } catch {
        return undefined;
    }
}

test('N3 retained record and documentation never disagree about the gate', async () => {
    const recordText = await readIfPresent(RECORD);
    const doc = await readIfPresent(DOC);
    assert.notEqual(doc, undefined, 'docs/iv-n3-compute.md must exist');

    if (recordText === undefined) {
        // No retained OCI record: nothing may claim a decided support matrix,
        // and a deferral still requires an amended V1 plan of record. This is
        // the check that prevents a silent "deferred" or "done" claim.
        assert.doesNotMatch(doc, /pilot-decided/u,
            'without docs/experiments/n3-evidence.json the doc must not claim the support matrix is decided');
        assert.doesNotMatch(doc, /Deferred post-1\.0/u,
            'a deferral claim requires an amended V1 plan of record, not a docs edit');
        return;
    }

    const record = JSON.parse(recordText);
    assert.equal(record.schema, 'ivory-n3-evidence/1');
    assert.match(record.gitCommit, /^[0-9a-f]{40}$/u);
    assert.match(record.images.python, DIGEST_IMAGE);
    assert.match(record.images.r, DIGEST_IMAGE);
    assert.deepEqual(record.qualification.failures, []);
    assert.equal(record.qualification.python.status, 'runtime-qualified');
    assert.equal(record.qualification.r.status, 'runtime-qualified');
    assert.equal(record.qualification.languageNeutral, true);

    for (const [label, evidence] of [['python', record.python], ['r', record.r]]) {
        assert.equal(evidence.runtime.status, 'observed', `${label} runtime evidence must be observed`);
        assert.equal(typeof evidence.runtime.coldInstall?.elapsedMs, 'number', `${label} needs a cold-install measurement`);
        assert.equal(evidence.runtime.coldInstall.imageWasCachedBeforePull, false,
            `${label} cold-install measurement must not be a cached pull`);
        assert.equal(typeof evidence.runtime.warmLaunchMs, 'number', `${label} needs a warm-launch measurement`);
        assert.equal(typeof evidence.platform.release, 'string');
        assert.equal(evidence.acceptance.inputUnchanged, true, `${label} must not mutate the canonical input`);
        assert.equal(evidence.acceptance.mountSurfaceMinimal, true, `${label} must expose only the declared mounts`);
    }

    assert.equal(record.python.acceptance.requiredCanariesDenied, true);
    assert.equal(record.python.acceptance.escapeProbesRecorded, true);
    assert.equal(record.python.acceptance.childProcessesTerminated, true);
    assert.equal(record.python.acceptance.controlsEnforced, true);
    assert.equal(record.python.acceptance.noPrivilegedEscalation, true);
    assert.equal(record.python.acceptance.oneTerminalPublicationOutcome, true);
    assert.equal(record.python.configuration.publicationInterruptionRequested, true);
    assert.equal(record.python.acceptance.publicationRecoveredAfterInterrupt, true);

    // The support matrix is decided by the platform decision and the retained
    // runtime qualification — never by an onboarding cohort. A decided matrix
    // is valid with no cohort at all.
    assert.ok(
        record.decision.supportMatrix === 'pilot-decided' || record.decision.supportMatrix === 'open-pending-qualification',
        `unexpected supportMatrix: ${record.decision.supportMatrix}`,
    );
    if (record.decision.supportMatrix === 'pilot-decided') {
        assert.equal(record.status, 'runtime-qualified',
            'a decided matrix is backed by the retained runtime qualification');
    }

    // An onboarding observation is optional: absent or empty is not-applicable,
    // never a failure, and a retained observation is reported as-is.
    if (record.onboarding !== null && record.onboarding !== undefined) {
        assert.equal(typeof record.onboarding.observed, 'boolean',
            'a retained onboarding block carries its observed flag');
        assert.ok(record.onboarding.acceptance === null || typeof record.onboarding.acceptance === 'object',
            'a retained onboarding block carries an acceptance object or null (not-applicable)');
    }

    // The document must not contradict the record: it may not describe the
    // matrix as waiting on a cohort, and it must cite the state the record
    // carries.
    assert.doesNotMatch(doc, /open-pending-onboarding/u,
        'the doc must not cite the retired onboarding-gated state');
    assert.doesNotMatch(doc, /pending the onboarding cohort/u,
        'the doc must not claim the support matrix waits on a cohort');
    if (record.decision.supportMatrix === 'pilot-decided') {
        assert.match(doc, /supportMatrix: pilot-decided/u,
            'the doc must cite the decided support matrix the record carries');
    } else {
        assert.doesNotMatch(doc, /supportMatrix: pilot-decided/u,
            'the doc must not cite a decided matrix the record does not carry');
    }

    // Sanitization: no local machine paths in a committed record.
    assert.doesNotMatch(recordText, /AppData/u);
    assert.doesNotMatch(recordText, /[A-Z]:[\\/]{1,2}Users/u);
});
