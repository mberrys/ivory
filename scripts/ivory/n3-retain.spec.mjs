import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    N3_RETAIN_SCHEMA,
    N3_SUPPORT_MATRIX_DECIDED,
    N3_SUPPORT_MATRIX_OPEN,
    qualificationSummary,
    sanitize,
} from './n3-retain.mjs';

const retainModule = fileURLToPath(new URL('./n3-retain.mjs', import.meta.url));

function passingEvidence(language) {
    return {
        schema: 'ivory-tower.n3-evidence',
        experiment: 'N3',
        experimentVersion: '2.0',
        gitCommit: 'a'.repeat(40),
        language,
        image: `example/image@sha256:${'b'.repeat(64)}`,
        command: { executable: 'C:\\Program Files\\nodejs\\node.exe', arguments: ['--language', language] },
        platform: { platform: 'win32', arch: 'x64', release: '10.0.26200', cpuModel: 'test', totalMemoryBytes: 1 },
        runtimeVersions: { docker: { client: { os: 'windows' }, server: { os: 'linux' } } },
        runtime: { status: 'observed', coldInstall: { elapsedMs: 1234, imageWasCachedBeforePull: false }, warmLaunchMs: 900 },
        acceptance: {
            requiredCanariesDenied: language === 'python' ? true : null,
            escapeProbesRecorded: language === 'python' ? true : null,
            inputUnchanged: true,
            childProcessesTerminated: language === 'python' ? true : null,
            controlsEnforced: true,
            mountSurfaceMinimal: true,
            noPrivilegedEscalation: true,
            lateResultsFenced: true,
            oneTerminalPublicationOutcome: true,
            publicationRecoveredAfterInterrupt: true,
            resultOutputValidated: true,
            validOutputNotAdmittedAsFailure: true,
        },
    };
}

test('N3 qualification summary requires observed runtime and no failed acceptance', () => {
    assert.deepEqual(qualificationSummary(passingEvidence('python')), { status: 'runtime-qualified', failures: [] });
    assert.deepEqual(qualificationSummary({
        ...passingEvidence('python'),
        acceptance: { ...passingEvidence('python').acceptance, mountSurfaceMinimal: false },
    }), { status: 'protocol-only', failures: ['mountSurfaceMinimal'] });
    assert.deepEqual(qualificationSummary({
        ...passingEvidence('python'),
        runtime: { status: 'failed' },
    }).status, 'protocol-only');
    assert.equal(qualificationSummary(undefined).status, 'protocol-only');
});

test('N3 retention sanitizes local paths and preserves digests', () => {
    const root = 'C:\\dev\\repos\\ivory-tower';
    const sanitized = sanitize({
        script: `${root}\\scripts\\ivory\\n3-compute.mjs`,
        home: 'C:\\Users\\someone\\.docker',
        digest: 'sha256:deadbeef',
        nested: [{ note: 'staged under C:\\Users\\someone\\AppData\\Local\\Temp\\ivory-n3-run-abc' }],
    }, { root, home: 'C:\\Users\\someone', temp: 'C:\\Users\\someone\\AppData\\Local\\Temp' });
    const text = JSON.stringify(sanitized);
    assert.equal(text.includes('C:\\Users\\someone'), false);
    assert.match(text, /<repo>\/scripts\/ivory\/n3-compute\.mjs/);
    assert.match(text, /<tmp>\/ivory-n3-run-abc/);
    assert.match(text, /sha256:deadbeef/);
    assert.equal(sanitized.home, '<home>/.docker');
});

test('retain:ivory-n3 writes a qualified record and exits 2 for protocol-only input', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-n3-retain-'));
    try {
        const pythonPath = path.join(root, 'python.json');
        const rPath = path.join(root, 'r.json');
        const outPath = path.join(root, 'n3-evidence.json');
        await fs.writeFile(pythonPath, `${JSON.stringify(passingEvidence('python'), null, 2)}\n`);
        await fs.writeFile(rPath, `${JSON.stringify(passingEvidence('r'), null, 2)}\n`);

        const ok = await spawnNode([retainModule, '--python', pythonPath, '--r', rPath, '--out', outPath]);
        assert.equal(ok.code, 0, ok.stderr);
        const record = JSON.parse(await fs.readFile(outPath, 'utf8'));
        assert.equal(record.schema, N3_RETAIN_SCHEMA);
        assert.equal(record.status, 'runtime-qualified');
        assert.deepEqual(record.qualification.failures, []);
        assert.equal(record.qualification.languageNeutral, true);
        // The platform decision plus the retained runtime qualification decide
        // the support matrix; no onboarding cohort is required.
        assert.equal(record.decision.supportMatrix, N3_SUPPORT_MATRIX_DECIDED);
        assert.equal(record.onboarding, null);
        assert.equal(record.python.language, 'python');
        assert.equal(record.r.language, 'r');

        const degraded = JSON.parse(JSON.stringify(passingEvidence('r')));
        degraded.runtime.status = 'unavailable';
        await fs.writeFile(rPath, `${JSON.stringify(degraded, null, 2)}\n`);
        const bad = await spawnNode([retainModule, '--python', pythonPath, '--r', rPath, '--out', outPath]);
        assert.equal(bad.code, 2, bad.stderr);
        const kept = JSON.parse(await fs.readFile(outPath, 'utf8'));
        assert.equal(kept.status, 'protocol-only');

        // The retained copy carries no machine paths even when the input does.
        const leaked = JSON.parse(JSON.stringify(passingEvidence('python')));
        leaked.command.executable = path.join(os.homedir(), 'bin', 'node.exe');
        await fs.writeFile(pythonPath, `${JSON.stringify(leaked, null, 2)}\n`);
        await fs.writeFile(rPath, `${JSON.stringify(passingEvidence('r'), null, 2)}\n`);
        const second = await spawnNode([retainModule, '--python', pythonPath, '--r', rPath, '--out', outPath]);
        assert.equal(second.code, 0, second.stderr);
        const secondRecord = await fs.readFile(outPath, 'utf8');
        assert.equal(secondRecord.includes(os.homedir().replaceAll('\\', '/')), false);
        assert.match(secondRecord, /<home>\/bin\/node\.exe/);

        // A cohort is an optional adoption observation: it is retained as-is
        // and never gates the support matrix.
        const onboardingPath = path.join(root, 'onboarding.json');
        await fs.writeFile(onboardingPath, `${JSON.stringify({
            schema: 'ivory-n3-onboarding/1',
            instructionsVersion: 'docs/experiments/n3-onboarding-protocol.md@abc1234',
            platform: 'windows-11-x64-docker-desktop-linux',
            participants: [1, 2, 3, 4, 5].map(index => ({
                id: `p${index}`,
                date: '2026-09-14',
                outcome: index === 5 ? 'blocked' : 'enabled',
                enabledWithinMinutes: index === 5 ? 22 : 10 + index,
                largeDownloadBytes: 0,
            })),
        }, null, 2)}\n`);
        await fs.writeFile(pythonPath, `${JSON.stringify(passingEvidence('python'), null, 2)}\n`);
        const observed = await spawnNode([
            retainModule, '--python', pythonPath, '--r', rPath, '--onboarding', onboardingPath, '--out', outPath,
        ]);
        assert.equal(observed.code, 0, observed.stderr);
        const observedRecord = JSON.parse(await fs.readFile(outPath, 'utf8'));
        assert.equal(observedRecord.decision.supportMatrix, N3_SUPPORT_MATRIX_DECIDED);
        assert.equal(observedRecord.onboarding.observed, true);
        assert.equal(observedRecord.onboarding.acceptance.withinTarget, 4);

        // An empty onboarding record is not-applicable: retained, never a
        // failure, and still not the deciding input.
        await fs.writeFile(onboardingPath, `${JSON.stringify({
            schema: 'ivory-n3-onboarding/1',
            participants: [],
        }, null, 2)}\n`);
        const emptyObserved = await spawnNode([
            retainModule, '--python', pythonPath, '--r', rPath, '--onboarding', onboardingPath, '--out', outPath,
        ]);
        assert.equal(emptyObserved.code, 0, emptyObserved.stderr);
        const emptyRecord = JSON.parse(await fs.readFile(outPath, 'utf8'));
        assert.equal(emptyRecord.decision.supportMatrix, N3_SUPPORT_MATRIX_DECIDED);
        assert.equal(emptyRecord.onboarding.observed, false);
        assert.equal(emptyRecord.onboarding.acceptance, null);

        // Without --onboarding the observation is simply absent.
        const noCohort = await spawnNode([retainModule, '--python', pythonPath, '--r', rPath, '--out', outPath]);
        assert.equal(noCohort.code, 0, noCohort.stderr);
        assert.equal(JSON.parse(await fs.readFile(outPath, 'utf8')).onboarding, null);

        // A platform other than the decided pilot leaves the matrix open even
        // though the runtime itself is qualified.
        const otherPlatform = JSON.parse(JSON.stringify(passingEvidence('python')));
        otherPlatform.platform = { ...otherPlatform.platform, platform: 'darwin', arch: 'arm64' };
        await fs.writeFile(pythonPath, `${JSON.stringify(otherPlatform, null, 2)}\n`);
        const otherMachine = await spawnNode([retainModule, '--python', pythonPath, '--r', rPath, '--out', outPath]);
        assert.equal(otherMachine.code, 0, otherMachine.stderr);
        assert.equal(JSON.parse(await fs.readFile(outPath, 'utf8')).decision.supportMatrix, N3_SUPPORT_MATRIX_OPEN);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

function spawnNode(args) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', code => resolve({ code, stdout, stderr }));
    });
}
