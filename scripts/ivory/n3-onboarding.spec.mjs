import assert from 'node:assert/strict';
import test from 'node:test';
import { onboardingAcceptance } from './n3-onboarding.mjs';

function participant(id, minutes, outcome = 'enabled', largeDownloadBytes = 0) {
    return { id, date: '2026-09-14', outcome, enabledWithinMinutes: minutes, largeDownloadBytes };
}

test('N3 onboarding acceptance requires four of five within fifteen minutes', () => {
    const passing = {
        schema: 'ivory-n3-onboarding/1',
        instructionsVersion: 'docs/experiments/n3-onboarding-protocol.md@abc1234',
        platform: 'windows-11-x64-docker-desktop-linux',
        participants: [
            participant('p1', 11), participant('p2', 14), participant('p3', 9),
            participant('p4', 15, 'enabled', 986_000_000), participant('p5', 22, 'blocked'),
        ],
    };
    const outcome = onboardingAcceptance(passing);
    assert.equal(outcome.observed, true);
    assert.equal(outcome.withinTarget, 4);
    assert.equal(outcome.blocked, 1);
    assert.equal(outcome.largeDownloadsReported, 1);
    assert.equal(outcome.participantCount, 5);

    // Three of five is not enough.
    assert.equal(onboardingAcceptance({
        ...passing,
        participants: [participant('p1', 11), participant('p2', 14), participant('p3', 9),
            participant('p4', 30, 'enabled'), participant('p5', 22, 'blocked')],
    }).observed, false);

    // An unreported download is a record defect, not a pass.
    assert.equal(onboardingAcceptance({
        ...passing,
        participants: [participant('p1', 11), participant('p2', 14), participant('p3', 9),
            { ...participant('p4', 15), largeDownloadBytes: undefined }, participant('p5', 22, 'blocked')],
    }).observed, false);

    // Under five participants the observation is incomplete.
    assert.equal(onboardingAcceptance({ ...passing, participants: passing.participants.slice(0, 4) }).observed, false);

    // Exactly fifteen minutes counts as within target.
    assert.equal(onboardingAcceptance({
        ...passing,
        participants: [participant('p1', 15), participant('p2', 15), participant('p3', 15),
            participant('p4', 15), participant('p5', 16, 'blocked')],
    }).observed, true);

    // No record at all is not-applicable, not a failure.
    assert.equal(onboardingAcceptance(undefined), null);
    assert.equal(onboardingAcceptance({}), null);
    assert.equal(onboardingAcceptance({ schema: 'ivory-n3-onboarding/1', participants: [] }), null);
});
