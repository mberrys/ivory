// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// @ts-check
export const N6_RESEARCHER_RECORD_SCHEMA = 'ivory-n6-researcher-record/1';
export const N6_STUDY_KIT = 'docs/experiments/n6-researcher-study-kit.md';
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
 * The automated verifier never invents researcher observations: it derives the human gate from the
 * retained researcher record and stays pending when that record is absent or does not qualify.
 */
export function deriveN6HumanQualification(record) {
    const requiredResearchers = N6_REQUIRED_RESEARCHERS;
    const requiredPasses = N6_REQUIRED_PASSES;
    if (record === undefined || record === null || record.participantKind !== N6_HUMAN_PARTICIPANT_KIND) {
        return {
            status: 'technical-pass-human-pending',
            humanQualification: 'pending',
            observedPasses: null,
            participants: null,
            note: 'No qualifying human participant record is present; the automated verifier does not invent researcher observations.',
        };
    }
    const participants = Array.isArray(record.participants) ? record.participants : [];
    const observedPasses = participants.filter(qualifies).length;
    const qualified = participants.length >= requiredResearchers && observedPasses >= requiredPasses;
    return {
        status: qualified ? 'human-qualified' : 'technical-pass-human-pending',
        humanQualification: qualified ? 'qualified' : 'pending',
        observedPasses,
        participants,
        note: qualified
            ? `Qualified by ${observedPasses}/${participants.length} participants completing the no-code loop (bar >= ${requiredPasses} of ${requiredResearchers}); see docs/experiments/n6-researcher-record.json.`
            : `Recorded participants did not clear the bar (>= ${requiredPasses} qualifying passes of >= ${requiredResearchers} participants); the human gate stays pending.`,
    };
}

export function n6HumanLimitation(qualification) {
    return qualification.status === 'human-qualified'
        ? 'The five-researcher no-code study is qualified by docs/experiments/n6-researcher-record.json.'
        : 'Five-researcher no-code study and executable product workflow remain pending.';
}
