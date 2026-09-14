// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// @ts-check
export const N1_HUMAN_RECORD_SCHEMA = 'ivory-n1-human-record/1';
export const N1_REQUIRED_RESEARCHERS = 3;
export const N1_REQUIRED_PASSES = 2;
export const N1_HUMAN_PARTICIPANT_KIND = 'human-qualitative-researcher';

function qualifies(seat) {
    const criteria = seat?.criteria ?? {};
    return seat?.result === 'pass'
        && criteria.provenanceNotEndorsement === true
        && criteria.silentReanchor === false
        && criteria.citationSurvival === true
        && criteria.carryForwardSeparate === true;
}

/**
 * The automated verifier never invents researcher observations: it derives the human gate from the
 * retained human record and stays open when that record is absent or does not qualify.
 */
export function deriveHumanValidation(record) {
    const requiredResearchers = N1_REQUIRED_RESEARCHERS;
    const requiredPasses = N1_REQUIRED_PASSES;
    if (record === undefined || record === null || record.participantKind !== N1_HUMAN_PARTICIPANT_KIND) {
        return {
            status: 'open',
            requiredResearchers,
            requiredPasses,
            observedResults: null,
            note: 'No qualifying human participant record is present; the automated verifier does not invent researcher observations.',
        };
    }
    const seats = Array.isArray(record.seats) ? record.seats : [];
    const observedPasses = seats.filter(qualifies).length;
    const closed = seats.length >= requiredResearchers && observedPasses >= requiredPasses;
    return {
        status: closed ? 'closed' : 'open',
        requiredResearchers,
        requiredPasses,
        observedResults: {
            kind: 'reader-protocol-exercise',
            doesNotCloseThisExperiment: false,
            protocol: record.protocol,
            exercisedBranch: record.exercisedBranch,
            exercisedCommit: record.exercisedCommit,
            fixture: record.fixture,
            recorded: record.recorded,
            participantKind: record.participantKind,
            attestation: record.attestation,
            observedPasses,
            seats,
        },
        note: closed
            ? `Closed by ${observedPasses}/${seats.length} qualifying passes (bar >= ${requiredPasses} of ${requiredResearchers}); see docs/experiments/n1-human-record.json.`
            : `Recorded participants did not clear the bar (>= ${requiredPasses} of >= ${requiredResearchers} qualifying passes); the gate stays open.`,
    };
}

export function humanLimitation(humanValidation) {
    return humanValidation.status === 'closed'
        ? 'The verifier proves the automated trace; the three-researcher interpretation gate is closed by docs/experiments/n1-human-record.json.'
        : 'The verifier proves the automated trace only; the three-researcher interpretation gate remains open.';
}
