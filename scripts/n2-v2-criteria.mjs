import { deriveStormSummary } from '../spikes/n2-durable-store/src/storm-ledger.mjs';
import { isContentAddressedScaleProof } from '../spikes/n2-durable-store/src/scale.mjs';

export const REQUIRED_CYCLES = 1000;
export const REQUIRED_EXTERNAL_BYTES = 10 * 1024 * 1024 * 1024;
const REQUIRED_SECTIONS = ['tests', 'storm', 'export', 'scale'];

/**
 * The N2 v2 qualification gate. Pure function of the raw artifact, the retained per-cycle
 * ledger and the repository state, so it can be pinned by unit tests instead of by a
 * 45-minute run. A criterion may only pass on a measurement from the run that just happened.
 */
export function buildCriteria({
    recordOnly,
    verifierExitCode,
    raw,
    ledgerRows,
    ledgerDigestMatches,
    head,
    fixtureDigest,
}) {
    const storm = raw?.interruptStorm ?? {};
    const scale = raw?.scale ?? {};
    const rows = Array.isArray(ledgerRows) ? ledgerRows : [];
    const summary = deriveStormSummary(rows);
    const ledgerRowCount = rows.length;
    const requiredCycles = REQUIRED_CYCLES;
    const requiredBytes = REQUIRED_EXTERNAL_BYTES;

    const criteria = {
        fullVerifierRunCompleted: {
            observed: recordOnly === true ? 'record-only' : verifierExitCode,
            required: 'a full verifier invocation that exits 0',
            pass: recordOnly !== true && verifierExitCode === 0,
            ...(recordOnly === true
                ? { reason: '--record-only rebuilds the retained record from an existing artifact and cannot qualify the gate' }
                : {}),
        },
        allSectionsRan: {
            observed: raw?.sections ?? null,
            required: REQUIRED_SECTIONS.map(name => `${name}: ran`),
            pass: raw?.sections !== undefined
                && REQUIRED_SECTIONS.every(name => raw.sections[name] === 'ran')
                && (raw?.skippedSections ?? []).length === 0,
        },
        verifierCommitMatchesHead: {
            observed: raw?.repositoryCommit ?? null,
            required: head,
            pass: typeof raw?.repositoryCommit === 'string' && raw.repositoryCommit === head,
        },
        fixtureUnchanged: {
            observed: raw?.fixtureDigest ?? null,
            required: fixtureDigest,
            pass: typeof raw?.fixtureDigest === 'string' && raw.fixtureDigest === fixtureDigest,
        },
        stormMeasuredFromResults: {
            observed: storm.measuredFromResults === true,
            required: true,
            pass: storm.measuredFromResults === true,
        },
        stormResultCount: {
            observed: storm.resultCount ?? 0,
            required: requiredCycles,
            ledgerRowCount,
            pass: Number.isFinite(storm.resultCount)
                && storm.resultCount >= requiredCycles
                && storm.resultCount === ledgerRowCount
                && summary.resultCount === ledgerRowCount,
        },
        stormResultLedgerRetained: {
            observed: ledgerRowCount,
            required: storm.resultCount ?? 0,
            digestMatches: ledgerDigestMatches === true,
            pass: ledgerRowCount > 0 && ledgerRowCount === storm.resultCount && ledgerDigestMatches === true,
        },
        acknowledgedCommitsNeverLost: {
            observed: summary.acknowledgedNeverLost,
            recorded: storm.acknowledgedNeverLost === true,
            pass: summary.acknowledgedNeverLost === true && storm.acknowledgedNeverLost === true,
        },
        oneSemanticEffectPerIdempotencyKey: {
            observed: summary.oneEffectPerKey,
            recorded: storm.oneEffectPerKey === true,
            pass: summary.oneEffectPerKey === true && storm.oneEffectPerKey === true,
        },
        noVisibleReferenceToUninstalledBlob: {
            observed: summary.noVisibleUninstalledBlob,
            recorded: storm.noVisibleUninstalledBlob === true,
            pass: summary.noVisibleUninstalledBlob === true && storm.noVisibleUninstalledBlob === true,
        },
        noFailedStormCycles: {
            observed: summary.failedResultCount,
            required: 0,
            firstFailureIndex: summary.firstFailureIndex,
            pass: ledgerRowCount > 0 && summary.failedResultCount === 0,
        },
        bothAcknowledgementPathsExercised: {
            observed: {
                acknowledged: summary.acknowledgedCount,
                unacknowledged: summary.unacknowledgedCount,
            },
            required: { acknowledged: '>= 1', unacknowledged: '>= 1' },
            pass: summary.acknowledgedCount >= 1 && summary.unacknowledgedCount >= 1,
        },
        childrenExitedBeforeReopen: {
            observed: summary.childrenExitedBeforeReopen,
            recorded: storm.childrenExitedBeforeReopen === true,
            pass: summary.childrenExitedBeforeReopen === true && storm.childrenExitedBeforeReopen === true,
        },
        casPhysicalAdmission: {
            observed: {
                sparsePlaceholder: scale.sparsePlaceholder === true,
                casAdmissionPath: scale.casAdmissionPath === true,
                casVerificationPath: scale.casVerificationPath === true,
                physicalBytesCopied: scale.physicalBytesCopied ?? 0,
                casVerifiedBytes: scale.casVerifiedBytes ?? 0,
                casStagingLeftover: scale.casStagingLeftover,
            },
            required: {
                sparsePlaceholder: false,
                casAdmissionPath: true,
                casVerificationPath: true,
                physicalBytesCopied: requiredBytes,
                casStagingLeftover: false,
            },
            pass: scale.sparsePlaceholder !== true
                && scale.casAdmissionPath === true
                && scale.casVerificationPath === true
                && Number.isFinite(scale.physicalBytesCopied)
                && scale.physicalBytesCopied >= requiredBytes
                && scale.casVerifiedBytes === scale.physicalBytesCopied
                && scale.casStagingLeftover === false,
        },
        casBlobBoundToVisibleRevision: {
            observed: scale.casBindingVerified === true,
            required: true,
            pass: scale.casBindingVerified === true,
        },
        casScaleClassifierAgrees: {
            observed: isContentAddressedScaleProof(scale),
            required: true,
            largeBlobKind: scale.largeBlob?.kind ?? null,
            pass: isContentAddressedScaleProof(scale) === true,
        },
        semanticExportImport: {
            observed: raw?.exportImport?.preserved === true,
            required: true,
            pass: raw?.exportImport?.preserved === true,
        },
        metadataP95: {
            observedMs: scale.metadataP95Ms,
            budgetMs: scale.metadataBudgetMs ?? 200,
            pass: scale.metadataPass === true && Number.isFinite(scale.metadataP95Ms) && scale.metadataP95Ms < 200,
        },
        sourceSearch: {
            observedMs: scale.searchMs,
            budgetMs: scale.searchBudgetMs ?? 1000,
            pass: scale.searchPass === true && Number.isFinite(scale.searchMs) && scale.searchMs < 1000,
        },
        unchangedSnapshot: {
            observedMs: scale.snapshotMs,
            budgetMs: scale.snapshotBudgetMs ?? 2000,
            pass: scale.snapshotPass === true && Number.isFinite(scale.snapshotMs) && scale.snapshotMs < 2000,
        },
        startupAndMemoryRecorded: {
            observed: {
                startupMs: scale.openMs,
                memoryAfterOpen: scale.memoryAfterOpen,
                memoryAfterScale: scale.memoryAfterScale,
            },
            pass: Number.isFinite(scale.openMs)
                && scale.memoryAfterOpen !== undefined
                && scale.memoryAfterScale !== undefined,
        },
    };

    const automatedPass = Object.values(criteria).every(result => result.pass === true);
    const failedCriteria = Object.entries(criteria)
        .filter(([, result]) => result.pass !== true)
        .map(([name]) => name);
    return { criteria, automatedPass, failedCriteria, summary, ledgerRowCount };
}
