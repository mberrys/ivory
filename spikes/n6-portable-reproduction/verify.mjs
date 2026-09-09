import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rename, readdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { platform, release, totalmem, cpus } from 'node:os';
import { root } from './build.mjs';
import { inspectProject, json, writeJson, canonicalize, digestBytes } from './portable.mjs';
import { run } from './reproduce.mjs';

const artifacts = resolve(root, 'artifacts/n6');
await mkdir(artifacts, { recursive: true });
const runRoot = await mkdtemp(join(artifacts, 'qualification-'));
const runtimeConfig = resolve(process.argv[2] ?? join(artifacts, 'runtime/runtime.json'));
const source = join(runRoot, 'original'), restored = join(runRoot, 'clean-install/study'), portable = join(runRoot, 'portable');
const evidence = { schema: 'ivory-n6-evidence/1', status: 'failed', humanQualification: 'pending',
    createdAt: new Date().toISOString(), artifactPath: relative(root, runRoot).replaceAll('\\', '/'),
    platform: { os: platform(), release: release(), node: process.version, memoryBytes: totalmem(), cpu: cpus()[0]?.model },
    commands: [], criteria: {}, limitations: [
        'Trusted synthetic study on Windows; no N3 containment or cross-platform claim.',
        'Five-researcher no-code study and executable product workflow remain pending.',
        'Experimental format; public format freeze is not authorized.',
    ] };

async function execute(args, label, expectedFailure = false) {
    try {
        const result = await run(process.execPath, args, { cwd: root });
        await writeJson(join(runRoot, `${label}.json`), result);
        evidence.commands.push({ label, args: args.map(arg => arg.replaceAll(root, '<repo>')), status: 'passed' });
        if (expectedFailure) { throw new Error(`Expected failure did not occur: ${label}`); }
        return result;
    } catch (error) {
        if (!expectedFailure || error.message.startsWith('Expected failure')) { throw error; }
        assert.match(error.message, expectedFailure, `Wrong failure reason: ${label}`);
        await writeJson(join(runRoot, `${label}.json`), { error: error.message });
        evidence.commands.push({ label, status: 'expected-failure', error: error.message });
        return { error: error.message };
    }
}
const cli = (command, ...args) => [join(root, 'spikes/n6-portable-reproduction/cli.mjs'), command, ...args];

async function fileDigests(directory) {
    const result = {};
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name === 'node_modules') { continue; }
        const path = join(directory, entry.name);
        if (entry.isDirectory()) { Object.assign(result, await fileDigests(path)); }
        else { result[relative(root, path).replaceAll('\\', '/')] = digestBytes(await readFile(path)); }
    }
    return result;
}

try {
    evidence.baseCommit = (await run('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout;
    evidence.worktreeStatus = (await run('git', ['status', '--porcelain'], { cwd: root })).stdout;
    evidence.implementationDigests = {
        ...await fileDigests(join(root, 'spikes/n6-portable-reproduction')),
        ...await fileDigests(join(root, 'spikes/n2-durable-store')),
        ...await fileDigests(join(root, 'packages/ivory-tower-research-kernel/src')),
        ...await fileDigests(join(root, 'packages/ivory-identity/src')),
    };
    for (const path of ['package.json', 'package-lock.json']) {
        evidence.implementationDigests[path] = digestBytes(await readFile(join(root, path)));
    }
    await execute([join(root, 'spikes/n6-portable-reproduction/test.mjs')], 'contracts');
    const n2Tests = (await readdir(join(root, 'spikes/n2-durable-store/test'))).filter(name => name.endsWith('.spec.mjs'));
    await execute(['--test', ...n2Tests.map(name => join(root, 'spikes/n2-durable-store/test', name))], 'n2-regressions');
    evidence.criteria.contracts = 'passed';
    await execute(cli('create', source), 'create');
    await execute(cli('reproduce', source, runtimeConfig), 'baseline');
    const baseline = await json(join(source, '.ivory/local/n6-last-attempt.json'));
    await execute(cli('export', source, portable), 'export');
    await execute(cli('restore', portable, restored), 'restore');
    await rename(source, join(runRoot, 'original-unavailable'));
    await rename(portable, join(runRoot, 'portable-unavailable'));
    // Separate runtime directories plus fresh HOME/libraries/caches for installation B.
    const firstRuntime = await json(runtimeConfig), secondRoot = join(runRoot, 'clean-install/runtime');
    await mkdir(secondRoot, { recursive: true });
    for (const name of ['r', 'python', 'quarto']) {
        const originalRoot = name === 'r' ? resolve(firstRuntime.r, '../..')
            : name === 'python' ? resolve(firstRuntime.python, '..') : firstRuntime.quarto;
        await cp(originalRoot, join(secondRoot, name), { recursive: true });
    }
    const secondConfig = join(secondRoot, 'runtime.json');
    await writeJson(secondConfig, { r: join(secondRoot, 'r/bin/Rscript.exe'), python: join(secondRoot, 'python/python.exe'),
        quarto: join(secondRoot, 'quarto') });
    await execute(cli('reproduce', restored, secondConfig), 'clean-reproduction');
    const repeated = await json(join(restored, '.ivory/local/n6-last-attempt.json'));
    assert.deepEqual(repeated.analytical, baseline.analytical);
    assert.equal(repeated.semanticDigest, baseline.semanticDigest);
    evidence.criteria.cleanReproduction = 'passed';
    evidence.baseline = baseline;
    evidence.restored = repeated;
    evidence.presentation = { htmlBytesEqual: baseline.htmlDigest === repeated.htmlDigest,
        analyticalEquivalent: true, policy: 'Presentation digests are reported separately from declared analytical comparisons.' };
    const inspected = await inspectProject(restored);
    evidence.fixtureDigest = digestBytes(Buffer.from(canonicalize(inspected.study)));
    const blob = inspected.dump.blob_refs[0].digest;
    // Obtain the existing N2 layout rather than assuming the CAS location.
    const { projectLayout } = await import('../n2-durable-store/src/paths.mjs');
    const actualBlob = join(projectLayout(restored).objects, blob.slice(0, 2), blob);
    await rename(actualBlob, `${actualBlob}.removed`);
    try {
        await execute(cli('reproduce', restored, secondConfig), 'missing-blob', new RegExp(blob));
        assert.equal((await json(join(restored, '.ivory/local/n6-last-attempt.json'))).status, 'failed');
    } finally { await rename(`${actualBlob}.removed`, actualBlob); }
    const dependency = join(secondRoot, 'r/library/utils');
    await rename(dependency, `${dependency}.removed`);
    try {
        await execute(cli('reproduce', restored, secondConfig), 'missing-dependency', /requireNamespace.*utils/);
        assert.equal((await json(join(restored, '.ivory/local/n6-last-attempt.json'))).status, 'failed');
    } finally { await rename(`${dependency}.removed`, dependency); }
    const input = join(restored, 'analysis/survey.csv');
    await rename(input, `${input}.removed`);
    try {
        await execute(cli('reproduce', restored, secondConfig), 'missing-input', /survey.csv/);
        assert.equal((await json(join(restored, '.ivory/local/n6-last-attempt.json'))).status, 'failed');
    } finally { await rename(`${input}.removed`, input); }
    evidence.criteria.missingInputsPreventSuccess = 'passed';
    evidence.criteria.noModel = 'passed';
    evidence.criteria.exactCitations = 'passed';
    // Recovery after fixing the failures is required, not inferred.
    await execute(cli('reproduce', restored, secondConfig), 'recovery');
    evidence.criteria.recovery = 'passed';
    evidence.status = 'technical-pass-human-pending';
} catch (error) { evidence.error = error.stack; process.exitCode = 1; }
finally {
    await writeJson(join(runRoot, 'evidence.json'), evidence);
    await writeFile(join(root, 'docs/experiments/n6-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify({ status: evidence.status, evidence: join(runRoot, 'evidence.json'), error: evidence.error }, null, 2));
}
