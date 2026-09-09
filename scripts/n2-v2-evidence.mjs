import { evaluateStormResults } from '../spikes/n2-durable-store/src/storm-results.mjs';
import { describeLargeBlob } from '../spikes/n2-durable-store/src/scale.mjs';

export const EVIDENCE_VERSION = 'n2-v2-evidence/2';
export const LIVE_VERIFIER_REQUIRED = 'live verifier process exit 0';
export const EXACT_QUALIFICATION_COMMAND = 'npm.cmd run verify:ivory-n2-v2 -- --cycles 1000';
export const CAS_SCALE_REQUIRED = 'content-addressed admission of the configured large blob; sparse zeros are not sufficient';

export function verifierCompletedCriterion({ recordOnly, verifierExitCode }) {
    if (recordOnly) {
        return {
            observed: 'not-run',
            required: LIVE_VERIFIER_REQUIRED,
            skipped: true,
            skipReason: '--record-only',
            pass: false,
        };
    }
    if (verifierExitCode === undefined) {
        return {
            observed: 'not-run',
            required: LIVE_VERIFIER_REQUIRED,
            skipped: true,
            skipReason: 'verifier process was not started',
            pass: false,
        };
    }
    return {
        observed: verifierExitCode,
        required: LIVE_VERIFIER_REQUIRED,
        skipped: false,
        pass: verifierExitCode === 0,
    };
}

export function buildCriteria({ recordOnly, verifierExitCode, raw = {} }) {
    const storm = raw.interruptStorm ?? {};
    const scale = raw.scale ?? {};
    const stormFlags = evaluateStormResults(storm.results);
    const resultCount = Array.isArray(storm.results) ? storm.results.length : 0;
    const largeBlob = describeLargeBlob(scale);
    return {
        verifierCompleted: verifierCompletedCriterion({ recordOnly, verifierExitCode }),
        interruptionCycles: {
            observed: resultCount,
            required: 1000,
            measuredFromResults: stormFlags.measuredFromResults,
            pass: stormFlags.measuredFromResults && resultCount >= 1000,
        },
        acknowledgedCommitsNeverLost: {
            observed: stormFlags.acknowledgedNeverLost,
            required: true,
            measuredFromResults: stormFlags.measuredFromResults,
            resultCount: stormFlags.resultCount,
            pass: stormFlags.measuredFromResults && stormFlags.acknowledgedNeverLost === true,
        },
        oneSemanticEffectPerIdempotencyKey: {
            observed: stormFlags.oneEffectPerKey,
            required: true,
            measuredFromResults: stormFlags.measuredFromResults,
            resultCount: stormFlags.resultCount,
            pass: stormFlags.measuredFromResults && stormFlags.oneEffectPerKey === true,
        },
        noVisibleReferenceToUninstalledBlob: {
            observed: stormFlags.noVisibleUninstalledBlob,
            required: true,
            measuredFromResults: stormFlags.measuredFromResults,
            resultCount: stormFlags.resultCount,
            pass: stormFlags.measuredFromResults && stormFlags.noVisibleUninstalledBlob === true,
        },
        interruptChildExitedBeforeReopen: {
            observed: stormFlags.childrenExitedBeforeReopen,
            required: true,
            measuredFromResults: stormFlags.measuredFromResults,
            resultCount: stormFlags.resultCount,
            pass: stormFlags.measuredFromResults && stormFlags.childrenExitedBeforeReopen === true,
        },
        semanticExportImport: {
            observed: raw.exportImport?.preserved === true && raw.exportImport?.measuredThisRun === true,
            required: true,
            pass: raw.exportImport?.preserved === true && raw.exportImport?.measuredThisRun === true,
        },
        metadataP95: {
            observedMs: scale.metadataP95Ms,
            budgetMs: scale.metadataBudgetMs ?? 200,
            pass: scale.measuredThisRun === true && scale.metadataPass === true,
        },
        sourceSearch: {
            observedMs: scale.searchMs,
            budgetMs: scale.searchBudgetMs ?? 1000,
            pass: scale.measuredThisRun === true && scale.searchPass === true,
        },
        unchangedSnapshot: {
            observedMs: scale.snapshotMs,
            budgetMs: scale.snapshotBudgetMs ?? 2000,
            pass: scale.measuredThisRun === true && scale.snapshotPass === true,
        },
        startupAndMemoryRecorded: {
            observed: {
                startupMs: scale.openMs,
                memoryAfterOpen: scale.memoryAfterOpen,
                memoryAfterScale: scale.memoryAfterScale,
            },
            pass: scale.measuredThisRun === true
                && Number.isFinite(scale.openMs)
                && scale.memoryAfterOpen !== undefined
                && scale.memoryAfterScale !== undefined,
        },
        contentAddressedScaleProof: {
            observed: largeBlob,
            required: CAS_SCALE_REQUIRED,
            pass: largeBlob.contentAddressedScaleProof === true,
        },
    };
}

export function buildLimitations({ raw = {}, recordOnly, largeBlob }) {
    const lines = [];
    if (recordOnly) {
        lines.push(
            'This invocation used --record-only: the live verifier did not run, verifierCompleted cannot pass, and automatedPass cannot be claimed from a wrap of a prior artifact.',
        );
    }
    if (raw.durabilityEnvelope) {
        lines.push(raw.durabilityEnvelope);
    }
    lines.push(
        'Storm success criteria are recomputed from interruptStorm.results. Claimed booleans without per-cycle results cannot pass, and skipped/prior-artifact storm sections are not treated as freshly measured.',
    );
    const blob = largeBlob ?? describeLargeBlob(raw.scale ?? {});
    lines.push(
        `The large-blob fixture is ${blob.kind} (logicalByteSize=${blob.logicalByteSize ?? 'unspecified'}, physicalBytesCopied=${blob.physicalBytesCopied ?? 'unspecified'}, casAdmissionPath=${blob.casAdmissionPath}, digestSource=${blob.digestSource ?? 'unspecified'}). It is not a content-addressed admission of 10 GiB of payload and is not a completed 10 GB CAS scale proof. Metadata/search/snapshot timings measure the SQL path only.`,
    );
    lines.push(
        'The result is one machine observation; it is not a cross-platform or hardware-power-loss qualification.',
    );
    lines.push(
        'The raw verifier artifact is ignored and is retained here by digest; rerun the exact qualification command without --record-only to regenerate it.',
    );
    return lines;
}

export function buildDecision({ automatedPass, recordOnly, raw = {} }) {
    if (recordOnly) {
        return {
            architectureStatus: 'incomplete-verifier-skipped',
            engine: raw.decision?.engine ?? 'undecided',
            engineEvidenceStatus: 'not-qualified',
            productionDependency: 'Final production persistence implementation waits for selected-engine sign-off.',
            sqliteComparison: raw.sqliteComparison,
        };
    }
    if (!automatedPass) {
        return {
            architectureStatus: 'qualification-incomplete',
            engine: raw.decision?.engine ?? 'undecided',
            engineEvidenceStatus: 'not-qualified',
            productionDependency: 'Final production persistence implementation waits for selected-engine sign-off.',
            sqliteComparison: raw.sqliteComparison,
        };
    }
    return {
        architectureStatus: 'protocol-pass-engine-decision-provisional',
        engine: raw.decision?.engine ?? 'undecided',
        engineEvidenceStatus: 'pglite-default-on-recorded-reference-machine',
        productionDependency: 'Final production persistence implementation waits for selected-engine sign-off.',
        sqliteComparison: raw.sqliteComparison,
    };
}

export function buildV2Evidence({
    recordOnly,
    verifierExitCode,
    argv = [],
    raw = {},
    fixtureFiles = [],
    fixtureDigest,
    rawArtifactDigest,
    rawArtifactPath = 'artifacts/n2/evidence.json',
    repositoryCommit,
    repositoryBranch,
    generatedAt,
}) {
    const criteria = buildCriteria({ recordOnly, verifierExitCode, raw });
    const requiredZero = Object.values(criteria).some(row => row.required === 0);
    if (requiredZero) {
        throw new Error('verifier/evidence criteria must not advertise required: 0');
    }
    const automatedPass = recordOnly === true
        ? false
        : Object.values(criteria).every(row => row.pass === true);
    if (recordOnly && (automatedPass || criteria.verifierCompleted.pass)) {
        throw new Error('--record-only must not claim automatedPass or verifierCompleted.pass');
    }
    const scale = raw.scale ?? {};
    const storm = raw.interruptStorm ?? {};
    const stormFlags = evaluateStormResults(storm.results);
    const largeBlob = describeLargeBlob(scale);
    const annotatedScale = { ...scale, largeBlob };
    const annotatedStorm = {
        ...storm,
        ...stormFlags,
        claimedBooleansIgnoredWithoutResults: stormFlags.measuredFromResults !== true,
    };
    return {
        evidenceVersion: EVIDENCE_VERSION,
        experiment: 'N2 durable store, blob admission and recovery',
        issue: raw.issue ?? 'MB-592',
        contract: 'durable-admission-semantic-commit/1',
        repositoryCommit,
        repositoryBranch,
        sourceDocuments: ['docs/iv-n2-durable-store.md', 'Ivory Tower V1 High-Level Architecture and Implementation Plan.pdf'],
        exactQualificationCommand: EXACT_QUALIFICATION_COMMAND,
        qualificationCommandExecuted: recordOnly !== true,
        recordOnly: recordOnly === true,
        invocation: argv,
        configuration: {
            cycles: stormFlags.resultCount,
            documents: scale.documents,
            annotations: scale.annotations,
            largeBlob,
            relaxedDurability: raw.relaxedDurability,
            metadataBudgetMs: scale.metadataBudgetMs,
            sourceSearchBudgetMs: scale.searchBudgetMs,
            unchangedSnapshotBudgetMs: scale.snapshotBudgetMs,
        },
        platform: raw.hardware,
        fixture: {
            root: 'spikes/n2-durable-store',
            digest: fixtureDigest,
            files: fixtureFiles,
        },
        rawArtifact: {
            path: rawArtifactPath,
            sha256: rawArtifactDigest,
            tracked: false,
        },
        observations: {
            tests: raw.tests,
            interruptionStorm: annotatedStorm,
            exportImport: raw.exportImport,
            scale: annotatedScale,
            engineCandidate: raw.engineCandidate,
        },
        criteria,
        automatedPass,
        decision: buildDecision({ automatedPass, recordOnly, raw }),
        limitations: buildLimitations({ raw, recordOnly, largeBlob }),
        generatedAt,
    };
}
