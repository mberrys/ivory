// @ts-check
'use strict';

// N5 restart observation — protocol item 3. An accepted-but-undelivered receipt
// is produced against the canonical service: a documenting relay in front of the
// service holds the accepted response so the client never reads a body, the
// service process is killed after durable acceptance, the service is restarted,
// and the same body+key is re-submitted. The relay is transport, not a second
// service: it forwards the submit request to the canonical service and only
// withholds the response bytes after the service produced them.
//
// Usage:
//   node scripts/n5/restart-observation.mjs interrupt   # interrupt; then restart the service
//   node scripts/n5/restart-observation.mjs replay      # same-key resubmission, DB, workbench resume
//
// Requires the canonical service (IVORY_N5_SERVICE_URL) for both phases and the
// workbench shell (IVORY_N5_SHELL_URL) for the resume check.

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, 'artifacts', 'n5');
const restartDir = path.join(artifacts, 'restart');
mkdirSync(restartDir, { recursive: true });

const serviceUrl = (process.env.IVORY_N5_SERVICE_URL ?? 'http://127.0.0.1:4100').replace(/\/$/, '');
const shellUrl = (process.env.IVORY_N5_SHELL_URL ?? 'http://127.0.0.1:3107').replace(/\/$/, '');
const databaseUrl = process.env.IVORY_N5_DATABASE_URL ?? 'postgres://ivory:ivory@127.0.0.1:5432/ivory_tower';
const servicePort = Number(new URL(serviceUrl).port || 80);
const relayPort = Number(process.env.IVORY_N5_RELAY_PORT ?? 4110);
const retainedKey = 'RETAINED-KEY-N5';
const relayLog = path.join(restartDir, 'relay.log');
const executionFile = path.join(artifacts, 'requests', 'execution.json');

const record = (relative, value) => {
    writeFileSync(path.join(restartDir, relative), JSON.stringify(value, undefined, 2) + '\n');
    return path.join(restartDir, relative);
};
const logRelay = line => {
    const stamped = `${new Date().toISOString()} ${line}\n`;
    appendFileSync(relayLog, stamped);
    process.stdout.write(`relay: ${line}\n`);
};

function writeJson(relative, value) {
    const file = path.join(artifacts, relative);
    writeFileSync(file, JSON.stringify(value, undefined, 2) + '\n');
    return file;
}

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

function listenerPid(port) {
    const script = `Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess`;
    const result = spawnSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' });
    const pid = Number((result.stdout ?? '').trim());
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

function processInfo(pid) {
    const script = `Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object ProcessId, ParentProcessId, CommandLine, CreationDate | ConvertTo-Json -Compress`;
    const result = spawnSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' });
    try {
        return JSON.parse(result.stdout.trim());
    } catch {
        return { raw: result.stdout };
    }
}

function cli(command, args, environment) {
    const invocation = spawnSync(process.execPath, [path.join(root, 'packages/ivory-n5-client/src/cli.cjs'), command, ...args], {
        cwd: root,
        env: { ...process.env, ...environment },
        encoding: 'utf8',
    });
    return {
        command: `node packages/ivory-n5-client/src/cli.cjs ${command} ${args.join(' ')}`,
        exitCode: invocation.status,
        stdout: invocation.stdout ?? '',
        stderr: invocation.stderr ?? '',
    };
}

function pgClient() {
    const require = createRequire(path.join(root, 'packages/ivory-tower-api/package.json'));
    const { Client } = require('pg');
    return new Client({ connectionString: databaseUrl });
}

async function interrupt() {
    const live = await service('/health/live', { method: 'GET' });
    if (live.status !== 200) {
        throw new Error(`service not live (HTTP ${live.status}) — start the canonical service first`);
    }
    const pid = listenerPid(servicePort);
    if (pid === undefined) {
        throw new Error(`no listener found on ${servicePort}`);
    }
    const identity = { pid, port: servicePort, discoveredAt: new Date().toISOString(), process: processInfo(pid) };
    record('service-process.json', identity);
    console.log(`service pid ${pid}: ${identity.process?.CommandLine ?? '(unknown command line)'}`);

    // Documenting relay: forwards everything; holds the marked accepted response.
    let markedClient = undefined;
    let markedUpstream = undefined;
    let heldResponse = undefined;
    let resolveHeld;
    const held = new Promise(resolve => {
        resolveHeld = resolve;
    });
    const relay = net.createServer(clientSocket => {
        const upstream = net.connect(servicePort, '127.0.0.1');
        let request = '';
        let marked = false;
        let holding = false;
        clientSocket.on('data', chunk => {
            request += chunk.toString('latin1');
            if (!marked && /^POST \/v1\/executions /.test(request) && /idempotency-key: retained-key-n5/i.test(request)) {
                marked = true;
                markedClient = clientSocket;
                markedUpstream = upstream;
                logRelay(`marked submit request (${request.length} bytes forwarded upstream)`);
            }
            if (!holding) {
                upstream.write(chunk);
            }
        });
        clientSocket.on('error', () => upstream.destroy());
        upstream.on('data', chunk => {
            if (marked && !holding) {
                holding = true;
                heldResponse = Buffer.alloc(0);
                logRelay('holding upstream response (accepted receipt not delivered to client)');
            }
            if (holding) {
                heldResponse = Buffer.concat([heldResponse, chunk]);
                resolveHeld();
            } else {
                clientSocket.write(chunk);
            }
        });
        upstream.on('error', () => clientSocket.destroy());
        clientSocket.on('end', () => {
            if (!holding) {
                upstream.end();
            }
        });
    });
    await new Promise(resolve => relay.listen(relayPort, '127.0.0.1', resolve));
    logRelay(`relay listening on 127.0.0.1:${relayPort} -> 127.0.0.1:${servicePort}`);

    const client = spawn(process.execPath, [path.join(root, 'packages/ivory-n5-client/src/cli.cjs'), 'submit', executionFile, retainedKey], {
        cwd: root,
        env: { ...process.env, IVORY_N5_SERVICE_URL: `http://127.0.0.1:${relayPort}` },
    });
    let clientStdout = '';
    let clientStderr = '';
    client.stdout.on('data', chunk => (clientStdout += chunk));
    client.stderr.on('data', chunk => (clientStderr += chunk));
    const clientExited = new Promise(resolve => client.on('close', code => resolve(code)));

    await Promise.race([
        held,
        new Promise((_, reject) => setTimeout(() => reject(new Error('relay never observed the accepted response (30s)')), 30000)),
    ]);
    const text = heldResponse.toString('utf8');
    const separator = text.indexOf('\r\n\r\n');
    const head = separator === -1 ? text : text.slice(0, separator);
    const bodyText = separator === -1 ? '' : text.slice(separator + 4);
    const statusLine = head.split('\r\n')[0];
    let receipt;
    try {
        receipt = JSON.parse(bodyText);
    } catch {
        receipt = undefined;
    }
    logRelay(`held response: ${statusLine}`);
    writeFileSync(path.join(restartDir, 'receipt-first.json'), bodyText.trim() + '\n');
    writeJson('restart/held-response.json', { statusLine, head, receipt });

    // Kill the canonical service after durable acceptance, then abort the client read.
    const killedAt = new Date().toISOString();
    const kill = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8' });
    logRelay(`taskkill /PID ${pid} /T /F -> exit ${kill.status}`);
    let portClosed = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
        if (listenerPid(servicePort) === undefined) {
            portClosed = true;
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    record('kill.json', {
        killedAt,
        pid,
        taskkill: { exitCode: kill.status, stdout: kill.stdout?.trim(), stderr: kill.stderr?.trim() },
        portClosed,
    });

    if (markedClient !== undefined) {
        markedClient.destroy();
    }
    if (markedUpstream !== undefined) {
        markedUpstream.destroy();
    }
    logRelay('client connection aborted without delivering the held response');

    const clientCode = await clientExited;
    const interrupted = {
        command: `IVORY_N5_SERVICE_URL=http://127.0.0.1:${relayPort} node packages/ivory-n5-client/src/cli.cjs submit artifacts/n5/requests/execution.json ${retainedKey}`,
        exitCode: clientCode,
        stdout: clientStdout,
        stderr: clientStderr,
        endedWithoutBody: clientStdout.trim().length === 0,
        heldReceiptVisibleToClient: clientStdout.includes(retainedKey),
    };
    record('client-interrupted.json', interrupted);
    await new Promise(resolve => relay.close(resolve));
    logRelay('relay closed');

    console.log(`interrupted: client exit ${clientCode}, stdout ${JSON.stringify(clientStdout.trim())}, acceptance held=${statusLine}`);
    console.log('Now restart the canonical service, then run: node scripts/n5/restart-observation.mjs replay');
}

async function replay() {
    const live = await service('/health/live', { method: 'GET' });
    const ready = await service('/health/ready', { method: 'GET' });
    if (live.status !== 200 || ready.status !== 200) {
        throw new Error(`service not ready after restart: live ${live.status}, ready ${ready.status}`);
    }
    writeJson('service/ready-after-restart.json', ready.body);
    const kill = JSON.parse(readFileSync(path.join(restartDir, 'kill.json'), 'utf8'));
    const held = JSON.parse(readFileSync(path.join(restartDir, 'held-response.json'), 'utf8'));
    const heldId = held.receipt?.id;
    if (heldId === undefined) {
        throw new Error('held receipt has no id; run the interrupt phase first');
    }

    const replayFetch = await service('/v1/executions', { body: { kind: 'validate', input: {}, contractVersion: 1 }, key: retainedKey });
    const replayCli = cli('submit', [executionFile, retainedKey]);
    const getCli = cli('get', [heldId]);
    const eventsCli = cli('events', [heldId, '0']);

    const client = pgClient();
    await client.connect();
    let rowCount;
    let rows;
    let events;
    let jobs;
    try {
        rowCount = await client.query('SELECT COUNT(*)::int AS count FROM ivory_executions WHERE idempotency_key = $1', [retainedKey]);
        rows = await client.query('SELECT id, kind, status, idempotency_key, attempt, created_at FROM ivory_executions WHERE idempotency_key = $1', [retainedKey]);
        events = await client.query('SELECT execution_id, sequence, type, payload, occurred_at FROM ivory_execution_events WHERE execution_id = $1 ORDER BY sequence', [heldId]);
        jobs = await client.query('SELECT key, task_identifier, attempts, run_at FROM graphile_worker.jobs WHERE key = $1', [`execution:${heldId}`]);
    } finally {
        await client.end();
    }
    const row = rows.rows[0];
    const verification = {
        heldReceiptStatus: held.statusLine,
        heldReceiptId: heldId,
        replayFetchStatus: replayFetch.status,
        replayFetchSameId: replayFetch.body?.id === heldId,
        replayCliExitCode: replayCli.exitCode,
        replayCliSameId: JSON.parse(replayCli.stdout.trim())?.id === heldId,
        getCliSameRecord: JSON.parse(getCli.stdout.trim())?.id === heldId,
        singleRowForKey: rowCount.rows[0].count === 1,
        rowIdMatches: row?.id === heldId,
        acceptedBeforeKill: row !== undefined && new Date(row.created_at).getTime() < Date.parse(kill.killedAt),
        eventCount: events.rows.length,
        jobCountForKey: jobs.rows.length,
    };

    // Workbench resume: reload the tab and read the execution through the widget.
    let workbench = { status: 'not-observed' };
    try {
        const { chromium } = createRequire(path.join(root, 'examples/ivory-n5-browser/package.json'))('playwright');
        const browser = await chromium.launch({ channel: 'msedge', headless: true });
        const page = await browser.newPage();
        await page.goto(shellUrl, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'N5 research client', exact: true }).waitFor({ timeout: 180000 });
        await page.locator('label', { hasText: 'Execution ID' }).locator('input').fill(heldId);
        await page.getByRole('button', { name: 'Read status', exact: true }).click();
        await page.waitForFunction(id => document.body.textContent.includes(id), heldId, { timeout: 60000 });
        const pane = await page.evaluate(() => {
            const nodes = Array.from(document.querySelectorAll('pre[role="status"]'));
            const texts = nodes.map(node => node.textContent ?? '').filter(candidate => candidate.trim().length > 0);
            return texts.length === 0 ? null : texts[texts.length - 1];
        });
        const parsed = pane === null ? undefined : JSON.parse(pane);
        workbench = {
            status: parsed?.id === heldId ? 'resumed' : 'mismatch',
            executionId: parsed?.id,
            serviceUrl: serviceUrl,
            note: 'page reloaded; widget read the execution through the restarted service without launching another process',
        };
        await browser.close();
    } catch (error) {
        workbench = { status: 'not-observed', reason: String(error) };
    }

    const passed =
        held.statusLine.includes('202') &&
        replayFetch.status === 200 &&
        verification.replayFetchSameId &&
        replayCli.exitCode === 0 &&
        verification.replayCliSameId &&
        verification.getCliSameRecord &&
        verification.singleRowForKey &&
        verification.rowIdMatches &&
        verification.acceptedBeforeKill &&
        verification.eventCount >= 1 &&
        verification.jobCountForKey === 1 &&
        workbench.status === 'resumed';
    const summary = {
        status: passed ? 'passed' : 'failed',
        verification,
        replay: { fetch: replayFetch, cli: replayCli },
        get: { cli: getCli },
        events: { cli: eventsCli, rows: events.rows },
        jobs: jobs.rows,
        workbench,
    };
    record('replay.json', summary);
    writeJson('restart/summary.json', { status: summary.status });
    console.log(JSON.stringify(verification, undefined, 2));
    console.log(`restart observation: ${summary.status}`);
    if (!passed) {
        process.exitCode = 1;
    }
}

const mode = process.argv[2];
if (mode === 'interrupt') {
    await interrupt();
} else if (mode === 'replay') {
    await replay();
} else {
    console.error('Usage: node scripts/n5/restart-observation.mjs interrupt|replay');
    process.exitCode = 2;
}
