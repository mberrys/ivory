// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// @ts-check
export const N6_RESEARCHER_RECORD_SCHEMA = 'ivory-n6-researcher-record/1';
export const N6_STUDY_KIT = 'docs/experiments/n6-researcher-study-kit.md';
export const N6_TECHNICAL_STATUS = 'technical-pass';
export const N6_REQUIRED_RESEARCHERS = 5;
export const N6_REQUIRED_PASSES = 4;
export const N6_HUMAN_PARTICIPANT_KIND = 'human-researcher';

function qualifies(participant) {
    return participant?.completedNoCode === true
        && participant.explainedSupportingLink === true
        && participant.explainedChallengingLink === true
        && participant.distinguishedOldFromCurrent === true;
}

/**
 * The N6 gate is the technical pass; the five-researcher product-value study is an optional
 * measurement (owner decision 2026-09-13). This reader derives only the informational cohort
 * observation from the retained researcher record: it never invents researcher observations,
 * and a missing, pending or empty cohort never keeps the record open.
 */
export function deriveN6HumanQualification(record) {
    const requiredResearchers = N6_REQUIRED_RESEARCHERS;
    const requiredPasses = N6_REQUIRED_PASSES;
    if (record === undefined || record === null || record.participantKind !== N6_HUMAN_PARTICIPANT_KIND) {
        return {
            status: N6_TECHNICAL_STATUS,
            humanQualification: 'pending',
            observedPasses: null,
            participants: null,
            note: 'No qualifying human participant record is present; the automated verifier does not invent researcher observations. The optional five-researcher study never gates this record.',
        };
    }
    const participants = Array.isArray(record.participants) ? record.participants : [];
    const observedPasses = participants.filter(qualifies).length;
    const qualified = participants.length >= requiredResearchers && observedPasses >= requiredPasses;
    return {
        status: N6_TECHNICAL_STATUS,
        humanQualification: qualified ? 'qualified' : 'pending',
        observedPasses,
        participants,
        note: qualified
            ? `Optional cohort observation: ${observedPasses}/${participants.length} participants completed the no-code loop (study bar >= ${requiredPasses} of ${requiredResearchers}); reported, never gated — see docs/experiments/n6-researcher-record.json.`
            : `Optional cohort observation: ${observedPasses}/${participants.length} qualifying passes, below the study's own bar (>= ${requiredPasses} of ${requiredResearchers}); reported informationally, it never keeps the record open.`,
    };
}

/**
 * The five-researcher study is optional: it is retained and reported if it runs, but no exit
 * criterion, format-freeze condition or release claim depends on it (owner decision 2026-09-13).
 */
export function n6HumanLimitation() {
    return 'The five-researcher product-value study is an optional measurement, not an exit criterion (owner decision 2026-09-13); see docs/experiments/n6-researcher-record.json.';
}
