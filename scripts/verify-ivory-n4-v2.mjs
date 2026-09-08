// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = path.join(root, 'artifacts', 'n4', 'qualification-ledger.json');
const retainedPath = path.join(root, 'docs', 'experiments', 'n4-v2-evidence.json');
const command = 'npm run verify:ivory-n4-v2';

function run(commandName, args, options = {}) {
    return execFileSync(commandName, args, { cwd: root, stdio: 'inherit', ...options });
}

function runNpm(args) {
    if (process.platform !== 'win32') return run('npm', args);
    return run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd ' + args.join(' ')]);
}

function repositoryCommit() {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    } catch {
        return 'unknown';
    }
}

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function readLedger() {
    if (!existsSync(ledgerPath)) return undefined;
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    return ledger.experimentVersion === 'n4-v2' ? ledger : undefined;
}

function rawArtifacts(ledger) {
    return (ledger?.fixtureAttempts ?? []).flatMap(attempt =>
        Object.entries(attempt.converters ?? {}).flatMap(([converter, result]) =>
                result.rawArtifact === undefined && result.representationArtifact === undefined
                    ? []
                : [{ fixture: attempt.path, converter, rawArtifact: result.rawArtifact, representationArtifact: result.representationArtifact }],
        ),
    );
}

function retain(ledger, failure) {
    const rawLedger = existsSync(ledgerPath) ? readFileSync(ledgerPath) : undefined;
    const retained = {
        schemaVersion: 1,
        experiment: 'N4 exact fragment anchors and ingestion fidelity',
        experimentVersion: 'n4-v2',
        repositoryCommit: ledger?.repositoryCommit ?? repositoryCommit(),
        command,
        generatedAt: ledger?.generatedAt ?? new Date().toISOString(),
        timing: ledger?.timing,
        status: ledger?.status ?? 'NO-GO',
        fixtureManifest: ledger?.fixtureManifest ?? [],
        converters: (ledger?.converters ?? []).map(converter => ({
            label: converter.label,
            version: converter.version,
            image: converter.image,
            status: converter.status,
            health: converter.health,
        })),
        observations: {
            attemptedFixtures: ledger?.fixtureAttempts?.length ?? 0,
            convertedFixtures: ledger?.fixturesDetail?.filter(fixture => Object.keys(fixture.representations ?? {}).length === 2).length ?? 0,
            anchorsFromA: ledger?.anchors?.length ?? 0,
            classificationMatrix: ledger?.matrix,
            falseExact: ledger?.falseExact,
            reviewQueueSize: ledger?.reviewQueue?.length ?? 0,
        },
        criteria: ledger?.criteria ?? {},
        persistence: ledger?.persistence,
        transfer: ledger?.transfer,
        failures: ledger?.failures ?? [],
        anchorSelectionFailures: ledger?.anchorSelectionFailures ?? [],
        rawArtifacts: rawArtifacts(ledger),
        rawLedger: rawLedger === undefined
            ? undefined
            : { path: 'artifacts/n4/qualification-ledger.json', sha256: sha256(rawLedger), bytes: rawLedger.byteLength },
        architectureDecision: ledger?.architectureDecision,
        qualificationRunFailure: ledger?.runFailure,
        failure,
    };
    writeFileSync(retainedPath, JSON.stringify(retained, null, 2) + '\n');
    return retained;
}

let runnerError;
try {
    runNpm([
        'exec',
        '--',
        'lerna',
        'run',
        'compile',
        '--scope',
        '@ivory-tower/application',
        '--scope',
        '@ivory-tower/infrastructure',
        '--include-dependencies',
        '--stream',
    ]);
    run(process.execPath, ['scripts/qualify-n4.mjs'], {
        env: {
            ...process.env,
            N4_QUALIFICATION_COMMAND: command,
        },
    });
} catch (error) {
    runnerError = error instanceof Error ? error.message : String(error);
}

const ledger = readLedger();
const retained = retain(ledger, runnerError === undefined ? undefined : {
    phase: ledger === undefined ? 'compile-or-runner' : 'qualification',
    message: runnerError,
});
if (retained.status !== 'qualified') {
    console.error('N4 V2 retained evidence is NO-GO: ' + retainedPath);
    process.exitCode = 1;
} else {
    console.log('N4 V2 retained evidence written: ' + retainedPath);
}
