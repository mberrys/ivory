import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildCriteria,
    REQUIRED_CYCLES,
    REQUIRED_EXTERNAL_BYTES,
} from '../../../scripts/n2-v2-criteria.mjs';

const DIGEST = 'a'.repeat(64);

function stormRow(index, acknowledged) {
    return {
        index,
        fault: acknowledged ? 'afterDbCommit' : 'beforeBlobInstall',
        childExitedBeforeReopen: true,
        acknowledged,
        receiptCountBeforeRetry: acknowledged ? 1 : 0,
        visibleBeforeRetry: acknowledged,
        payloadMatchesBeforeRetry: acknowledged,
        receiptCountAfterRetry: 1,
        revisionCountAfterRetry: 1,
        visibleAfterRetry: true,
        payloadMatchesAfterRetry: true,
        blobVerifiedAfterRetry: true,
        retryReplayed: acknowledged,
        receiptMatchesAcknowledged: acknowledged ? true : null,
        danglingVisibleBlobs: 0,
        error: null,
        pass: true,
    };
}

function ledger(cycles = REQUIRED_CYCLES) {
    return Array.from({ length: cycles }, (_, index) => stormRow(index, index % 8 >= 3));
}

function validRaw(cycles = REQUIRED_CYCLES) {
    return {
        repositoryCommit: 'deadbeef',
        repositoryBranch: 'v2-n2-experiment',
        fixtureDigest: DIGEST,
        sections: { tests: 'ran', storm: 'ran', export: 'ran', scale: 'ran' },
        skippedSections: [],
        tests: { passed: true },
        interruptStorm: {
            cycles,
            measuredFromResults: true,
            resultCount: cycles,
            failedResultCount: 0,
            firstFailureIndex: null,
            acknowledgedCount: cycles - Math.ceil(cycles / 8),
            unacknowledgedCount: Math.ceil(cycles / 8),
            acknowledgedNeverLost: true,
            oneEffectPerKey: true,
            noVisibleUninstalledBlob: true,
            ledgerSha256: 'b'.repeat(64),
            childrenExitedBeforeReopen: true,
        },
        exportImport: { preserved: true, blobCount: 1, projectSeq: 1 },
        scale: {
            documents: 1000,
            largeBlob: {
                kind: 'cas-admitted-bytes',
                logicalByteSize: REQUIRED_EXTERNAL_BYTES,
                physicalBytesCopied: REQUIRED_EXTERNAL_BYTES,
                casAdmissionPath: true,
                contentAddressedScaleProof: true,
            },
            annotations: 100000,
            blobBytes: REQUIRED_EXTERNAL_BYTES,
            largeDigest: 'c'.repeat(64),
            sparsePlaceholder: false,
            casAdmissionPath: true,
            casVerificationPath: true,
            casBindingVerified: true,
            casStagingLeftover: false,
            physicalBytesCopied: REQUIRED_EXTERNAL_BYTES,
            casVerifiedBytes: REQUIRED_EXTERNAL_BYTES,
            openMs: 2544,
            memoryAfterOpen: {},
            memoryAfterScale: {},
            metadataP95Ms: 1.49,
            searchMs: 297,
            snapshotMs: 366,
            metadataBudgetMs: 200,
            searchBudgetMs: 1000,
            snapshotBudgetMs: 2000,
            metadataPass: true,
            searchPass: true,
            snapshotPass: true,
        },
    };
}

function evaluate(overrides = {}) {
    const raw = overrides.raw ?? validRaw();
    return buildCriteria({
        recordOnly: false,
        verifierExitCode: 0,
        raw,
        ledgerRows: overrides.ledgerRows ?? ledger(raw.interruptStorm.resultCount ?? REQUIRED_CYCLES),
        ledgerDigestMatches: overrides.ledgerDigestMatches ?? true,
        head: 'deadbeef',
        fixtureDigest: DIGEST,
        ...(overrides.args ?? {}),
    });
}

test('a full measured run passes every criterion', () => {
    const { automatedPass, criteria } = evaluate();
    assert.equal(automatedPass, true, JSON.stringify(criteria, null, 2));
});

test('--record-only can never qualify', () => {
    const { automatedPass, criteria } = evaluate({ args: { recordOnly: true } });
    assert.equal(criteria.fullVerifierRunCompleted.pass, false);
    assert.match(String(criteria.fullVerifierRunCompleted.reason), /record-only/);
    assert.equal(automatedPass, false);
});

test('a retained record with no per-cycle ledger is rejected', () => {
    const { criteria, automatedPass } = evaluate({ ledgerRows: [] });
    assert.equal(criteria.stormResultLedgerRetained.pass, false);
    assert.equal(criteria.stormResultCount.pass, false);
    assert.equal(criteria.acknowledgedCommitsNeverLost.pass, false);
    assert.equal(automatedPass, false);
});

test('a ledger whose sha256 does not match the raw artifact is rejected', () => {
    const { criteria } = evaluate({ ledgerDigestMatches: false });
    assert.equal(criteria.stormResultLedgerRetained.pass, false);
});

test('fewer than 1000 cycles is rejected', () => {
    const { criteria, automatedPass } = evaluate({
        raw: validRaw(20),
        ledgerRows: ledger(20),
    });
    assert.equal(criteria.stormResultCount.pass, false);
    assert.equal(automatedPass, false);
});

test('a sparse placeholder blob is rejected', () => {
    const raw = validRaw();
    raw.scale.sparsePlaceholder = true;
    raw.scale.casAdmissionPath = false;
    raw.scale.casVerificationPath = false;
    raw.scale.casBindingVerified = false;
    raw.scale.physicalBytesCopied = 0;
    raw.scale.casVerifiedBytes = 0;
    const { criteria, automatedPass } = evaluate({ raw });
    assert.equal(criteria.casPhysicalAdmission.pass, false);
    assert.equal(criteria.casBlobBoundToVisibleRevision.pass, false);
    assert.equal(automatedPass, false);
});

test('a skipped section is rejected', () => {
    const raw = validRaw();
    raw.sections.scale = 'skipped';
    raw.skippedSections = ['scale'];
    const { criteria } = evaluate({ raw });
    assert.equal(criteria.allSectionsRan.pass, false);
});

test('a commit mismatch is rejected', () => {
    const { criteria } = evaluate({ args: { head: 'somethingelse' } });
    assert.equal(criteria.verifierCommitMatchesHead.pass, false);
});

test('a fixture changed after the run is rejected', () => {
    const { criteria } = evaluate({ args: { fixtureDigest: 'f'.repeat(64) } });
    assert.equal(criteria.fixtureUnchanged.pass, false);
});

test('a verifier that exited non-zero is rejected', () => {
    const { criteria } = evaluate({ args: { verifierExitCode: 1 } });
    assert.equal(criteria.fullVerifierRunCompleted.pass, false);
});

test('recorded booleans that disagree with the rows are rejected', () => {
    const raw = validRaw();
    raw.interruptStorm.acknowledgedNeverLost = true;
    const { criteria } = evaluate({
        raw,
        ledgerRows: ledger().map((row, index) => (index === 0
            ? { ...row, pass: false, acknowledged: true, visibleBeforeRetry: false, payloadMatchesBeforeRetry: false }
            : row)),
    });
    assert.equal(criteria.acknowledgedCommitsNeverLost.observed, false);
    assert.equal(criteria.noFailedStormCycles.pass, false);
});

test('an all-acknowledged ledger fails the vacuity guard', () => {
    const rows = ledger().map(row => stormRow(row.index, true));
    const { criteria } = evaluate({ ledgerRows: rows });
    assert.equal(criteria.bothAcknowledgementPathsExercised.pass, false);
});

test('a ledger row whose interrupted child never exited is rejected', () => {
    const rows = ledger().map((row, index) => (index === 0 ? { ...row, childExitedBeforeReopen: false, pass: false } : row));
    const { criteria } = evaluate({ ledgerRows: rows });
    assert.equal(criteria.childrenExitedBeforeReopen.observed, false);
    assert.equal(criteria.noFailedStormCycles.pass, false);
});

test('a sparse or unlabeled large blob fails the CAS classifier criterion', () => {
    const sparse = validRaw();
    sparse.scale.sparsePlaceholder = true;
    sparse.scale.largeBlob = {
        kind: 'sparse-zero-placeholder',
        logicalByteSize: REQUIRED_EXTERNAL_BYTES,
        physicalBytesCopied: 0,
        casAdmissionPath: false,
    };
    assert.equal(evaluate({ raw: sparse }).criteria.casScaleClassifierAgrees.pass, false);

    const unlabeled = validRaw();
    delete unlabeled.scale.largeBlob;
    assert.equal(evaluate({ raw: unlabeled }).criteria.casScaleClassifierAgrees.pass, false);

    const real = validRaw();
    real.scale.largeBlob = {
        kind: 'cas-admitted-bytes',
        logicalByteSize: REQUIRED_EXTERNAL_BYTES,
        physicalBytesCopied: REQUIRED_EXTERNAL_BYTES,
        casAdmissionPath: true,
    };
    assert.equal(evaluate({ raw: real }).criteria.casScaleClassifierAgrees.pass, true);
});
