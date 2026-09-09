#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildV2Evidence } from './n2-v2-evidence.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VERIFY = join(ROOT, 'spikes', 'n2-durable-store', 'verify.mjs');
const RAW_ARTIFACT = process.env.N2_V2_RAW_ARTIFACT ?? join(ROOT, 'artifacts', 'n2', 'evidence.json');
const EVIDENCE = process.env.N2_V2_EVIDENCE ?? join(ROOT, 'docs', 'experiments', 'n2-v2-evidence.json');
const FIXTURE_ROOT = join(ROOT, 'spikes', 'n2-durable-store');

const argv = process.argv.slice(2);
const recordOnly = argv.includes('--record-only');
const verifierArgs = argv.filter(argument => argument !== '--record-only');
let verifierExitCode;

if (!recordOnly) {
    verifierExitCode = await runVerifier(verifierArgs);
}

const raw = JSON.parse(await readFile(RAW_ARTIFACT, 'utf8'));
const fixtureFiles = await collectFixtureFiles(FIXTURE_ROOT);
const fixtureDigest = digestManifest(fixtureFiles);
const rawArtifactBytes = await readFile(RAW_ARTIFACT);
const rawArtifactDigest = createHash('sha256').update(rawArtifactBytes).digest('hex');

const evidence = buildV2Evidence({
    recordOnly,
    verifierExitCode,
    argv,
    raw,
    fixtureFiles,
    fixtureDigest,
    rawArtifactDigest,
    rawArtifactPath: relative(ROOT, RAW_ARTIFACT).replaceAll('\\', '/'),
    repositoryCommit: git('rev-parse', 'HEAD'),
    repositoryBranch: git('branch', '--show-current'),
    generatedAt: new Date().toISOString(),
});

await mkdir(join(ROOT, 'docs', 'experiments'), { recursive: true });
await writeFile(EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
process.stdout.write(
    `${JSON.stringify(
        {
            ok: evidence.automatedPass,
            recordOnly,
            verifierCompleted: evidence.criteria.verifierCompleted,
            contentAddressedScaleProof: evidence.criteria.contentAddressedScaleProof.pass,
            evidence: relative(ROOT, EVIDENCE).replaceAll('\\', '/'),
            repositoryCommit: evidence.repositoryCommit,
            snapshotMs: raw.scale?.snapshotMs,
            automatedPass: evidence.automatedPass,
            architectureStatus: evidence.decision.architectureStatus,
        },
        null,
        2,
    )}\n`,
);
if (!evidence.automatedPass) {
    process.exitCode = 1;
}

function git(...args) {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

async function runVerifier(args) {
    return await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [VERIFY, ...args], { cwd: ROOT, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve(code ?? (signal === null ? 1 : 1)));
    });
}

async function collectFixtureFiles(directory, prefix = '') {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
    const files = [];
    for (const entry of entries) {
        if (entry.name === 'node_modules') {
            continue;
        }
        const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
        const absolutePath = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectFixtureFiles(absolutePath, relativePath)));
        } else if (entry.isFile()) {
            const digest = createHash('sha256')
                .update(await readFile(absolutePath))
                .digest('hex');
            files.push({ path: `spikes/n2-durable-store/${relativePath}`, sha256: digest });
        }
    }
    return files;
}

function digestManifest(files) {
    return createHash('sha256')
        .update(files.map(file => `${file.path}\0${file.sha256}\n`).join(''))
        .digest('hex');
}
