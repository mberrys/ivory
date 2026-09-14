// @ts-check
'use strict';

// N5 live observation driver — protocol items 1 (client equivalence), 2 (twelve
// ordered competing edits) and 4 (exact citation navigation), executed against
// the canonical Core service and the built workbench. Raw outputs are written
// verbatim under artifacts/n5/; nothing here decides the gate. Requires:
//   - the canonical service (IVORY_N5_SERVICE_URL, default http://127.0.0.1:4100)
//   - the built workbench shell (IVORY_N5_SHELL_URL, default http://127.0.0.1:3107)
//   - Rscript on PATH (or C:/Program Files/R/R-4.6.1/bin present)
// Run: node scripts/n5/live-observation.mjs

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { compareClients } from './compare.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serviceUrl = (process.env.IVORY_N5_SERVICE_URL ?? 'http://127.0.0.1:4100').replace(/\/$/, '');
const shellUrl = (process.env.IVORY_N5_SHELL_URL ?? 'http://127.0.0.1:3107').replace(/\/$/, '');
const artifacts = path.join(root, 'artifacts', 'n5');
const clientsDir = path.join(artifacts, 'clients');
const conflictsDir = path.join(artifacts, 'conflicts');
const navigationDir = path.join(artifacts, 'navigation');
const requestsDir = path.join(artifacts, 'requests');
for (const directory of [clientsDir, conflictsDir, navigationDir, requestsDir, path.join(artifacts, 'tmp')]) {
    mkdirSync(directory, { recursive: true });
}

const clientNames = ['theia', 'cli', 'python', 'r'];
const fixtureBytes = readFileSync(path.join(root, 'examples/ivory-n5-browser/fixtures/research.py'), 'utf8');
const sha256 = value => createHash('sha256').update(value).digest('hex');

function writeJson(relative, value) {
    const file = path.join(artifacts, relative);
    writeFileSync(file, JSON.stringify(value, undefined, 2) + '\n');
    return file;
}

const requests = {
    open: { projectId: 'n5-demo', revision: 'rev-1' },
    cite: { projectId: 'n5-demo', revision: 'rev-1', citationId: 'cite-research-py' },
    run: { projectId: 'n5-demo', revision: 'rev-1' },
};
for (const [action, body] of Object.entries(requests)) {
    writeJson(`requests/${action}.json`, body);
}
const executionRequest = { kind: 'validate', input: {}, contractVersion: 1 };
writeJson('requests/execution.json', executionRequest);

const R_BIN = 'C:/Program Files/R/R-4.6.1/bin';
const QUARTO_BIN = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Quarto', 'bin');
const extraPath = [R_BIN, QUARTO_BIN].filter(directory => existsSync(directory));
const clientEnvironment = {
    ...process.env,
    IVORY_N5_SERVICE_URL: serviceUrl,
    PATH: [...extraPath, process.env.PATH ?? ''].join(path.delimiter),
};
const pythonCommand = process.env.IVORY_N5_PYTHON ?? 'python';

async function service(pathname, { method = 'POST', body, key } = {}) {
    const response = await fetch(serviceUrl + pathname, {
        method,
        headers: {
            accept: 'application/json',
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
            ...(key === undefined ? {} : { 'idempotency-key': key }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        parsed = text;
    }
    return { status: response.status, body: parsed };
}

const reset = () => service('/v1/fixtures/reset', { body: { projectId: 'n5-demo', fixture: 'all' } });

function runCommand(command, args) {
    const result = spawnSync(command, args, { cwd: root, env: clientEnvironment, encoding: 'utf8' });
    return {
        command: [command, ...args].join(' '),
        exitCode: result.status,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
    };
}

function cliInvocation(action, requestFile, key) {
    const args = [path.join(root, 'packages/ivory-n5-client/src/cli.cjs'), action, requestFile];
    if (key !== undefined) {
        args.push(key);
    }
    return runCommand(process.execPath, args);
}
function pythonInvocation(action, requestFile, key) {
    const args = [path.join(root, 'packages/ivory-n5-client/helpers/ivory_n5.py'), action, requestFile];
    if (key !== undefined) {
        args.push(key);
    }
    return runCommand(pythonCommand, args);
}
function rInvocation(action, requestFile, key) {
    const args = [path.join(root, 'packages/ivory-n5-client/helpers/ivory_n5.R'), action, requestFile];
    if (key !== undefined) {
        args.push(key);
    }
    return runCommand('Rscript', args);
}

// The plain R helper prints only the condition message on failure; this companion
// invocation reads the preserved conflict body from the same error condition so
// the R client's conflict payload is observable, not inferred.
function rConflictBody(requestFile, key) {
    const driver = path.join(artifacts, 'tmp', 'capture-r-conflict.R');
    writeFileSync(
        driver,
        [
            'args <- commandArgs(trailingOnly = TRUE)',
            'source(args[[1]])',
            'request <- paste(readLines(args[[2]], warn = FALSE, encoding = "UTF-8"), collapse = "\\n")',
            'tryCatch(cat(ivory_edit(request, args[[3]]), "\\n"), ivory_http_error = function(error) {',
            '    cat(sprintf(\'{"status": %d, "body": %s}\', as.integer(error$status), error$body), "\\n")',
            '})',
            '',
        ].join('\n'),
    );
    const helper = path.join(root, 'packages/ivory-n5-client/helpers/ivory_n5.R');
    const result = runCommand('Rscript', [driver, helper, requestFile, key]);
    let parsed;
    try {
        parsed = JSON.parse(result.stdout.trim());
    } catch {
        parsed = undefined;
    }
    return { ...result, parsed };
}

function loadPlaywright() {
    const require = createRequire(path.join(root, 'examples/ivory-n5-browser/package.json'));
    return require('playwright');
}

let browserDiagnostics = { console: [], failedRequests: [], errorResponses: [] };

async function launchWorkbench() {
    const { chromium } = loadPlaywright();
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    browserDiagnostics = { console: [], failedRequests: [], errorResponses: [] };
    page.on('console', message => browserDiagnostics.console.push({ type: message.type(), text: message.text() }));
    page.on('requestfailed', request =>
        browserDiagnostics.failedRequests.push({ url: request.url(), method: request.method(), failure: request.failure()?.errorText }),
    );
    page.on('response', response => {
        if (response.status() >= 400) {
            browserDiagnostics.errorResponses.push({ url: response.url(), status: response.status() });
        }
    });
    await page.goto(shellUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'N5 research client', exact: true }).waitFor({ timeout: 180000 });
    return { browser, page };
}

async function statusText(page) {
    return page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('pre[role="status"]'));
        const texts = nodes.map(node => node.textContent ?? '').filter(text => text.trim().length > 0);
        return texts.length === 0 ? null : texts[texts.length - 1];
    });
}

// The widget's own fetch is observed; the pane must then display the response.
// DOM-text change alone is not a signal: with the pinned fixture clock two
// successive successful edits render byte-identical responses.
const WIDGET_ROUTES = {
    open: '/v1/projects/open',
    cite: '/v1/citations/resolve',
    run: '/v1/runspecs/resolve',
    edit: '/v1/projects/edits',
};

async function theiaAction(page, { button, requestFile, key, route, networkWaitMs = 60000 }) {
    const requestText = readFileSync(requestFile, 'utf8');
    if (key !== undefined) {
        const keyInput = page.locator('label', { hasText: 'Idempotency key' }).locator('input');
        await keyInput.fill(key);
    }
    await page.locator('textarea[aria-label="Research request JSON"]').fill(requestText);
    const waitResponse = page.waitForResponse(
        response => response.url().includes(route) && response.request().method() === 'POST',
        { timeout: networkWaitMs },
    );
    await page.getByRole('button', { name: button, exact: true }).click();
    let response;
    try {
        response = await waitResponse;
    } catch (error) {
        const status = await statusText(page);
        const bodyText = await page.evaluate(() => document.body.innerText);
        writeJson('live-observation-failure.json', {
            action: { button, requestFile, key, route },
            statusText: status,
            bodyText: bodyText.slice(0, 400),
            console: browserDiagnostics.console.slice(-50),
            failedRequests: browserDiagnostics.failedRequests,
            errorResponses: browserDiagnostics.errorResponses,
        });
        console.error(`theia action produced no ${route} response: button=${button}\nstatus pane: ${(status ?? '').slice(0, 400)}`);
        throw error;
    }
    const network = { status: response.status(), body: await response.json().catch(() => undefined) };
    const matchesNetwork = parsed => {
        if (network.status < 300) {
            return JSON.stringify(parsed) === JSON.stringify(network.body);
        }
        return parsed?.status === network.status && JSON.stringify(parsed?.body) === JSON.stringify(network.body);
    };
    let raw;
    let parsed;
    const deadline = Date.now() + 10000;
    for (;;) {
        raw = await statusText(page);
        try {
            parsed = raw === null ? undefined : JSON.parse(raw);
        } catch {
            parsed = undefined;
        }
        if (parsed !== undefined && matchesNetwork(parsed)) {
            break;
        }
        if (Date.now() > deadline) {
            writeJson('live-observation-failure.json', {
                action: { button, requestFile, key, route },
                network,
                statusText: raw,
                console: browserDiagnostics.console.slice(-50),
                failedRequests: browserDiagnostics.failedRequests,
                errorResponses: browserDiagnostics.errorResponses,
            });
            throw new Error(`theia status pane did not display the ${route} response (HTTP ${network.status})`);
        }
        await page.waitForTimeout(250);
    }
    return { raw, parsed, network };
}

const observations = { clients: {}, conflicts: [], navigation: {} };

async function observeClients(page) {
    await reset();
    for (const client of clientNames) {
        for (const action of ['open', 'cite', 'run']) {
            const requestFile = path.join(requestsDir, `${action}.json`);
            let invocation;
            if (client === 'theia') {
                const button = { open: 'Open project', cite: 'Resolve citation', run: 'Request run' }[action];
                const result = await theiaAction(page, { button, requestFile, route: WIDGET_ROUTES[action] });
                invocation = {
                    command: `theia widget: fill research textarea with ${action}.json, click ${button}`,
                    exitCode: 0,
                    stdout: result.raw,
                    stderr: '',
                    httpStatus: result.network.status,
                };
                writeFileSync(path.join(clientsDir, `${client}-${action}.json`), result.raw + '\n');
            } else if (client === 'cli') {
                invocation = cliInvocation(action, requestFile);
            } else if (client === 'python') {
                invocation = pythonInvocation(action, requestFile);
            } else {
                invocation = rInvocation(action, requestFile);
            }
            const stdout = invocation.stdout.trim();
            if (invocation.exitCode !== 0) {
                throw new Error(`${client} ${action} failed (exit ${invocation.exitCode}): ${invocation.stderr.trim()} ${stdout}`);
            }
            observations.clients[client] = observations.clients[client] ?? { actions: {} };
            observations.clients[client].actions[action] = invocation;
            if (client !== 'theia') {
                writeFileSync(path.join(clientsDir, `${client}-${action}.json`), stdout + '\n');
            }
        }
    }
    const records = clientNames.map(client => {
        const raw = JSON.parse(readFileSync(path.join(clientsDir, `${client}-run.json`), 'utf8'));
        return { client, resolvedRunSpec: raw.resolvedRunSpec, semanticResult: raw.semanticResult };
    });
    const comparison = compareClients(records);
    writeJson('clients/compare.json', comparison);
    const actionComparisons = {};
    for (const action of ['open', 'cite']) {
        const parsed = clientNames.map(client => JSON.parse(readFileSync(path.join(clientsDir, `${client}-${action}.json`), 'utf8')));
        const differing = clientNames.filter((client, index) => JSON.stringify(parsed[index]) !== JSON.stringify(parsed[0]));
        actionComparisons[action] = differing.length === 0 ? { status: 'identical' } : { status: 'differing', clients: differing };
    }
    writeJson('clients/compare-actions.json', actionComparisons);
    return comparison;
}

// Protocol item 4: exact navigation to an immutable revision.
async function observeNavigation() {
    const citeAt = async revision => service('/v1/citations/resolve', { body: { projectId: 'n5-demo', revision, citationId: 'cite-research-py' } });

    const before = await citeAt('rev-1');
    if (before.status !== 200) {
        throw new Error(`pre-edit citation resolution failed: HTTP ${before.status}`);
    }
    const anchorBefore = before.body.anchor;
    const preEdit = {
        command: 'POST /v1/citations/resolve {"projectId":"n5-demo","revision":"rev-1","citationId":"cite-research-py"}',
        status: before.status,
        anchor: anchorBefore,
        verification: {
            sourceRevision: anchorBefore.sourceRevision,
            passageHashMatchesContentHash: sha256(anchorBefore.passage) === anchorBefore.contentHash,
            passageEqualsCommittedFixture: anchorBefore.passage === fixtureBytes,
            fixturePath: 'examples/ivory-n5-browser/fixtures/research.py',
        },
    };
    observations.navigation.beforeEdit = preEdit;
    writeJson('navigation/cite-rev-1-before-edit.json', preEdit);

    // One accepted edit moves head to rev-2 (CLI client, retained key).
    const moveRequest = {
        projectId: 'n5-demo',
        baseRevision: 'rev-1',
        sourcePath: 'research.py',
        edit: { kind: 'insert', startOffset: 0, endOffset: 0, text: '# nav edit\n' },
    };
    const moveFile = path.join(requestsDir, 'nav-edit.json');
    writeJson('requests/nav-edit.json', moveRequest);
    const move = cliInvocation('edit', moveFile, 'n5-nav-edit');
    const moveBody = JSON.parse(move.stdout.trim());
    if (move.exitCode !== 0 || moveBody.newRevision !== 'rev-2') {
        throw new Error(`navigation revision move failed: exit ${move.exitCode} ${move.stdout} ${move.stderr}`);
    }
    observations.navigation.revisionMove = { invocation: move, response: moveBody };
    writeJson('navigation/revision-move-edit.json', { invocation: move, response: moveBody });

    const after = await citeAt('rev-2');
    const anchorAfter = after.body.anchor;
    const postEdit = {
        command: 'POST /v1/citations/resolve {"projectId":"n5-demo","revision":"rev-2","citationId":"cite-research-py"}',
        status: after.status,
        anchor: anchorAfter,
        verification: {
            sourceRevisionStillRev1: anchorAfter.sourceRevision === 'rev-1',
            bytesUnchanged: anchorAfter.passage === anchorBefore.passage,
            contentHashUnchanged: anchorAfter.contentHash === anchorBefore.contentHash,
            passageEqualsCommittedFixture: anchorAfter.passage === fixtureBytes,
        },
    };
    observations.navigation.afterEdit = postEdit;
    writeJson('navigation/cite-rev-2-after-edit.json', postEdit);

    const stale = await citeAt('rev-1');
    const staleRecord = { command: 'resolve rev-1 while head is rev-2', status: stale.status, body: stale.body };
    observations.navigation.stale = staleRecord;
    writeJson('navigation/stale-rev-1-at-head-rev-2.json', staleRecord);

    const notFound = await service('/v1/citations/resolve', { body: { projectId: 'n5-demo', revision: 'rev-2', citationId: 'cite-unknown' } });
    const notFoundRecord = { command: 'resolve cite-unknown at rev-2', status: notFound.status, body: notFound.body };
    observations.navigation.notFound = notFoundRecord;
    writeJson('navigation/citation-not-found.json', notFoundRecord);

    const passed =
        preEdit.verification.passageHashMatchesContentHash &&
        preEdit.verification.passageEqualsCommittedFixture &&
        preEdit.verification.sourceRevision === 'rev-1' &&
        postEdit.verification.sourceRevisionStillRev1 &&
        postEdit.verification.bytesUnchanged &&
        postEdit.verification.contentHashUnchanged &&
        stale.status === 409 &&
        stale.body?.error?.code === 'citation_stale' &&
        notFound.status === 404 &&
        notFound.body?.error?.code === 'citation_not_found';
    writeJson('navigation/summary.json', { status: passed ? 'passed' : 'failed' });
    return passed;
}

// Protocol item 2: twelve ordered competing edits.
async function observeConflicts(page) {
    const results = [];
    for (const first of clientNames) {
        for (const second of clientNames) {
            if (first === second) {
                continue;
            }
            await reset();
            const firstRequest = {
                projectId: 'n5-demo',
                baseRevision: 'rev-1',
                sourcePath: 'research.py',
                edit: { kind: 'insert', startOffset: 0, endOffset: 0, text: `# edit by ${first}\n` },
            };
            const secondRequest = {
                ...firstRequest,
                edit: { kind: 'insert', startOffset: 0, endOffset: 0, text: `# edit by ${second}\n` },
            };
            const firstFile = path.join(requestsDir, `${first}--${second}-first.json`);
            const secondFile = path.join(requestsDir, `${first}--${second}-second.json`);
            writeJson(`requests/${first}--${second}-first.json`, firstRequest);
            writeJson(`requests/${first}--${second}-second.json`, secondRequest);
            const firstKey = `n5-${first}-${second}-first`;
            const secondKey = `n5-${first}-${second}-second`;

            let firstOutcome;
            if (first === 'theia') {
                const result = await theiaAction(page, { button: 'Submit edit', requestFile: firstFile, key: firstKey, route: WIDGET_ROUTES.edit });
                firstOutcome = { client: 'theia', exitCode: 0, parsed: result.parsed, raw: result.raw, httpStatus: result.network.status };
            } else {
                const invocation = first === 'cli' ? cliInvocation('edit', firstFile, firstKey) : first === 'python' ? pythonInvocation('edit', firstFile, firstKey) : rInvocation('edit', firstFile, firstKey);
                firstOutcome = {
                    client: first,
                    exitCode: invocation.exitCode,
                    parsed: invocation.exitCode === 0 ? JSON.parse(invocation.stdout.trim()) : undefined,
                    raw: invocation.stdout.trim(),
                    stderr: invocation.stderr.trim(),
                };
            }

            let secondOutcome;
            if (second === 'theia') {
                const result = await theiaAction(page, { button: 'Submit edit', requestFile: secondFile, key: secondKey, route: WIDGET_ROUTES.edit });
                secondOutcome = { client: 'theia', exitCode: 0, pane: result.parsed, raw: result.raw, httpStatus: result.network.status };
            } else if (second === 'r') {
                const invocation = rInvocation('edit', secondFile, secondKey);
                const capture = rConflictBody(secondFile, secondKey);
                secondOutcome = {
                    client: 'r',
                    exitCode: invocation.exitCode,
                    stderr: invocation.stderr.trim(),
                    parsed: capture.parsed,
                    captureCommand: capture.command,
                    captureExitCode: capture.exitCode,
                };
            } else {
                const invocation = second === 'cli' ? cliInvocation('edit', secondFile, secondKey) : pythonInvocation('edit', secondFile, secondKey);
                let parsed;
                if (second === 'cli') {
                    try {
                        parsed = JSON.parse(invocation.stderr.trim());
                    } catch {
                        parsed = undefined;
                    }
                } else {
                    try {
                        parsed = JSON.parse(invocation.stderr.trim());
                    } catch {
                        parsed = undefined;
                    }
                }
                secondOutcome = { client: second, exitCode: invocation.exitCode, stderr: invocation.stderr.trim(), parsed };
            }

            const conflictBody =
                second === 'theia' ? secondOutcome.pane?.body : secondOutcome.parsed?.body ?? (second === 'r' ? secondOutcome.parsed?.body : undefined);
            const expectedBytes = `# edit by ${first}\n` + fixtureBytes;
            const authoritative = conflictBody?.authoritative;
            const verification = {
                firstRecordedRevision: firstOutcome.parsed?.newRevision,
                firstResponseMatches: firstOutcome.exitCode === 0 && firstOutcome.parsed?.newRevision === 'rev-2' && firstOutcome.parsed?.baseRevision === 'rev-1',
                conflictStatus: second === 'theia' ? secondOutcome.pane?.status : secondOutcome.parsed?.status ?? (second === 'r' ? secondOutcome.parsed?.status : undefined),
                conflictCode: conflictBody?.code,
                conflictBaseRevision: conflictBody?.baseRevision,
                conflictHeadRevision: conflictBody?.headRevision,
                authoritativeRevision: authoritative?.revision,
                authoritativeBytesMatch: authoritative?.bytes === expectedBytes,
                authoritativeBytesHash: authoritative?.contentHash === sha256(expectedBytes),
                rejectedRequestUnchanged: JSON.stringify(conflictBody?.rejectedRequest) === JSON.stringify(secondRequest),
                secondClientExitNonZero: second === 'theia' ? undefined : secondOutcome.exitCode !== 0,
            };
            const passed =
                verification.firstResponseMatches &&
                verification.conflictStatus === 409 &&
                verification.conflictCode === 'revision_conflict' &&
                verification.conflictBaseRevision === 'rev-1' &&
                verification.conflictHeadRevision === 'rev-2' &&
                verification.authoritativeRevision === 'rev-2' &&
                verification.authoritativeBytesMatch &&
                verification.authoritativeBytesHash &&
                verification.rejectedRequestUnchanged &&
                (second === 'theia' || verification.secondClientExitNonZero);
            const record = {
                first,
                second,
                status: passed ? 'passed' : 'failed',
                requests: { first: firstRequest, second: secondRequest },
                keys: { first: firstKey, second: secondKey },
                firstEdit: firstOutcome,
                secondEdit: secondOutcome,
                conflictBody,
                verification,
            };
            writeJson(`conflicts/${first}--${second}.json`, record);
            results.push({ first, second, status: record.status });
            console.log(`${first} -> ${second}: ${record.status} (first ${verification.firstRecordedRevision ?? '?'}, conflict ${verification.conflictStatus ?? '?'})`);
        }
    }
    observations.conflicts = results;
    const passed = results.length === 12 && results.every(result => result.status === 'passed');
    return passed;
}

async function main() {
    const live = await service('/health/live', { method: 'GET' });
    const ready = await service('/health/ready', { method: 'GET' });
    if (live.status !== 200 || ready.status !== 200) {
        throw new Error(`canonical service not ready: live ${live.status}, ready ${ready.status}`);
    }
    writeJson('service/ready.json', ready.body);

    const { browser, page } = await launchWorkbench();
    try {
        const clientsPassed = await observeClients(page);
        console.log(`clients comparison: ${clientsPassed.status}`);
        const navigationPassed = await observeNavigation();
        console.log(`exact navigation: ${navigationPassed ? 'passed' : 'failed'}`);
        const conflictsPassed = await observeConflicts(page);
        console.log(`ordered conflicts: ${conflictsPassed ? '12/12 passed' : 'FAILED'}`);
        writeJson('observation-summary.json', {
            capturedAt: new Date().toISOString(),
            clients: clientsPassed,
            navigation: navigationPassed ? 'passed' : 'failed',
            conflicts: conflictsPassed ? 'passed' : 'failed',
        });
    } finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error(`live observation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
});
