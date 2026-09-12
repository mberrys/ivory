import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, lstat, rename } from 'node:fs/promises';
import { join, resolve, delimiter } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectProject, json, writeJson, digestBytes, canonicalize } from './portable.mjs';

export function run(executable, args, options = {}) {
    return new Promise((resolveRun, reject) => {
        const child = spawn(executable, args, { windowsHide: true, ...options, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        const timer = setTimeout(() => child.kill(), 120000);
        child.stdout.on('data', data => { stdout += data; if (stdout.length > 2e6) { child.kill(); } });
        child.stderr.on('data', data => { stderr += data; if (stderr.length > 2e6) { child.kill(); } });
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('close', code => {
            clearTimeout(timer);
            if (code !== 0) { reject(new Error(`Command failed (${code}): ${executable}\n${stderr}`)); }
            else { resolveRun({ stdout: stdout.trim(), stderr: stderr.trim() }); }
        });
    });
}

export function compare(actual, policy) {
    for (const [key, expected] of Object.entries(policy.exact)) { assert.equal(actual[key], expected, `Exact comparison: ${key}`); }
    for (const [key, expected] of Object.entries(policy.numeric)) {
        assert.ok(Number.isFinite(actual[key]) && Math.abs(actual[key] - expected) <=
            policy.absoluteTolerance + policy.relativeTolerance * Math.abs(expected), `Numeric comparison: ${key}`);
    }
}

function isolatedEnv(runtime, project) {
    const home = join(project, '.ivory/local/n6-home');
    // Deliberately exclude provider keys, PYTHONPATH, R_PROFILE, and host package paths.
    return { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC,
        PATH: [join(runtime.quarto, 'bin'), join(process.env.SystemRoot ?? '/usr', 'System32')].join(delimiter),
        PATHEXT: '.COM;.EXE;.BAT;.CMD', QUARTO_R: runtime.r, QUARTO_PYTHON: runtime.python,
        HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, TEMP: home, TMP: home,
        LANG: 'C', LC_ALL: 'C', R_LIBS: home, R_LIBS_USER: home, R_LIBS_SITE: home,
        R_DEFAULT_PACKAGES: 'NULL',
        R_ENVIRON_USER: '', R_PROFILE_USER: '', PYTHONNOUSERSITE: '1',
        QUARTO_BIN_PATH: join(runtime.quarto, 'bin'), QUARTO_SHARE_PATH: join(runtime.quarto, 'share'),
        DENO_DOM_PLUGIN: join(runtime.quarto, 'bin/tools/deno_dom/plugin.dll'),
        DENO_DIR: join(home, 'deno'), DENO_NO_UPDATE_CHECK: '1', NO_COLOR: '1' };
}

async function preflight(runtime, lock, options) {
    assert.equal(lock.format, 'ivory-n6-runtime/1');
    const python = await run(runtime.python, ['-I', '-S', '-c', 'import platform; print(platform.python_version())'], options);
    const r = await run(runtime.r, ['--vanilla', '-e', 'cat(as.character(getRversion()))'], options);
    const quarto = (await readFile(join(runtime.quarto, 'share/version'), 'utf8')).trim();
    assert.equal(python.stdout, lock.python.version, 'Python version mismatch');
    assert.equal(r.stdout, lock.r.version, 'R version mismatch');
    assert.equal(quarto, lock.quarto.version, 'Quarto version mismatch');
    assert.deepEqual(lock.python.packages, [], 'This fixture requires standard-library-only Python');
    for (const module of lock.python.stdlib) {
        assert.match(module, /^[a-z][a-z0-9_]*$/);
        await run(runtime.python, ['-I', '-S', '-c', `import ${module}`], options);
    }
    for (const packageName of lock.r.packages) {
        assert.match(packageName, /^[A-Za-z][A-Za-z0-9.]*$/);
        await run(runtime.r, ['--vanilla', '-e', `stopifnot(requireNamespace('${packageName}', quietly=TRUE))`], options);
    }
    return { python: python.stdout, r: r.stdout, quarto,
        executableDigests: { python: digestBytes(await readFile(runtime.python)), r: digestBytes(await readFile(runtime.r)),
            quarto: digestBytes(await readFile(join(runtime.quarto, 'bin/quarto.js'))) } };
}

export async function reproduce(projectPath, runtimeConfig) {
    const project = resolve(projectPath);
    const resultFile = join(project, '.ivory/local/n6-last-attempt.json');
    // Invalidate any previous success before even validating inputs.
    await writeJson(resultFile, { status: 'running' });
    const attempt = { status: 'failed', noModel: true, startedAt: new Date().toISOString() };
    try {
        const inspected = await inspectProject(project);
        // Editable working files must match this captured run, not hidden local edits.
        for (const [path, digest] of Object.entries(inspected.study.files)) {
            const file = join(project, path), stat = await lstat(file);
            assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'Run input must be a regular file');
            assert.equal(digestBytes(await readFile(file)), digest, `Uncaptured input change: ${path}`);
        }
        const runtime = await json(runtimeConfig);
        const options = { cwd: project, env: isolatedEnv(runtime, project) };
        await mkdir(options.env.HOME, { recursive: true });
        const lock = await json(join(project, 'environments/runtime-lock.json'));
        attempt.versions = await preflight(runtime, lock, options);
        // Retain prior outputs as a distinct attempt; stale files cannot satisfy this run.
        const output = join(project, 'results');
        if (await lstat(output).catch(() => undefined)) {
            await rename(output, join(project, `.ivory/local/n6-previous-${randomUUID()}`));
        }
        await mkdir(output);
        await run(runtime.python, ['-I', '-S', 'analysis/transform.py'], options);
        await run(runtime.r, ['--vanilla', 'analysis/analyse.R'], options);
        const python = await json(join(output, 'python.json')), r = await json(join(output, 'r.json'));
        compare(python, { ...inspected.study.comparisons, numeric: {} });
        compare(r, inspected.study.comparisons);
        assert.deepEqual(python.participantIds, Array.from({ length: 30 }, (_, i) => i + 1), 'Row identities changed');
        const lines = inspected.citations.map((citation, i) =>
            `### Evidence ${i + 1} {#evidence-${i + 1}}\n\n${citation.quote}\n\n` +
            `Exact revision: \`${citation.ref.revisionId}\`; source: \`${citation.sourceRevisionId}\`. ` +
            `Status: **${citation.current ? 'current' : 'retained original'}**.\n`);
        const links = [...inspected.records.values()].filter(r => r.objectType === 'evidenceLink').map(r =>
            `- **${r.payload.role}** — ${r.payload.rationale} Author: ${r.payload.linkAuthor}. Exact claim: \`${r.payload.claimRef.revisionId}\`.`);
        await writeFile(join(output, 'evidence.md'), lines.join('\n') + '\n' + links.join('\n'));
        await writeFile(join(output, 'analysis.md'), `Rows: ${r.rowCount}; missing: ${r.missingCount}; sum: ${r.sum}; mean: ${r.mean}.\n`);
        const deno = join(runtime.quarto, 'bin/tools/x86_64/deno.exe');
        await run(deno, ['run', '--cached-only', '--unstable-kv', '--unstable-ffi', '--no-config', '--no-lock',
            '--allow-all', '--no-check', '--v8-flags=--enable-experimental-regexp-engine',
            join(runtime.quarto, 'bin/quarto.js'), 'render', 'analysis/dossier.qmd', '--to', 'html'], options);
        const html = await readFile(join(project, 'analysis/dossier.html'), 'utf8');
        for (const citation of inspected.citations) {
            assert.ok(html.includes(citation.ref.revisionId) && html.includes(citation.sourceRevisionId), 'Rendered citation missing');
        }
        const after = await inspectProject(project);
        assert.equal(canonicalize(after.dump), canonicalize(inspected.dump), 'Reproduction mutated research records');
        Object.assign(attempt, { status: 'passed', analytical: r, citationsResolved: inspected.citations.length,
            semanticDigest: digestBytes(Buffer.from(canonicalize(inspected.dump))),
            htmlDigest: digestBytes(Buffer.from(html)), comparisonPolicy: inspected.study.comparisons,
            presentation: 'HTML rendered; byte identity is not analytical equivalence; PDF not qualified' });
    } catch (error) { attempt.error = error.message; throw error; }
    finally { await writeJson(resultFile, attempt); }
    return attempt;
}
