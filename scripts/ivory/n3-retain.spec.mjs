import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    N3_RETAIN_SCHEMA,
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
        assert.equal(record.decision.supportMatrix, 'open-pending-onboarding');
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
