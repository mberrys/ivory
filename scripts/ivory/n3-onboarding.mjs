#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const N3_ONBOARDING_SCHEMA = 'ivory-n3-onboarding/1';
export const N3_ONBOARDING_TARGET_MINUTES = 15;
export const N3_ONBOARDING_REQUIRED_PARTICIPANTS = 5;
export const N3_ONBOARDING_REQUIRED_SUCCESSES = 4;

function argumentValue(name) {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

/**
 * Returns null when the observation is absent (empty or missing record): an
 * absent observation is not-applicable, never a pass or a failure.
 */
export function onboardingAcceptance(record) {
    const participants = record?.participants;
    if (record?.schema !== N3_ONBOARDING_SCHEMA || !Array.isArray(participants) || participants.length === 0) {
        return null;
    }
    const complete = participants.length >= N3_ONBOARDING_REQUIRED_PARTICIPANTS
        && participants.every(entry => typeof entry.id === 'string'
            && typeof entry.enabledWithinMinutes === 'number'
            && typeof entry.largeDownloadBytes === 'number');
    const withinTarget = participants.filter(entry => entry.outcome === 'enabled'
        && typeof entry.enabledWithinMinutes === 'number'
        && entry.enabledWithinMinutes <= N3_ONBOARDING_TARGET_MINUTES).length;
    return {
        observed: complete && withinTarget >= N3_ONBOARDING_REQUIRED_SUCCESSES,
        withinTarget,
        blocked: participants.filter(entry => entry.outcome === 'blocked').length,
        largeDownloadsReported: participants.filter(entry => entry.largeDownloadBytes > 0).length,
        participantCount: participants.length,
    };
}

async function main() {
    const recordPath = argumentValue('--record') ?? path.join(ROOT, 'docs', 'experiments', 'n3-onboarding-record.json');
    const record = JSON.parse(await fs.readFile(path.resolve(ROOT, recordPath), 'utf8'));
    const outcome = onboardingAcceptance(record);
    if (outcome === null) {
        console.log('N3 onboarding record is empty; the observation is not-applicable and the support matrix stays open.');
        return;
    }
    console.log(JSON.stringify(outcome, null, 2));
    if (!outcome.observed) {
        console.error(`N3 onboarding target not met: ${outcome.withinTarget}/${N3_ONBOARDING_REQUIRED_SUCCESSES} required within ${N3_ONBOARDING_TARGET_MINUTES} minutes.`);
        process.exitCode = 1;
    }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
