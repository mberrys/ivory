// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// @ts-check
/**
 * N7 Task 8.5 — one deliberately bounded live-provider experiment.
 *
 * Runs the canonical proposal contract against a real, local OpenAI-compatible
 * endpoint (llama.cpp `llama-server`). Nothing leaves the machine: the endpoint
 * must be a loopback HTTP URL. The run retains the exact outgoing body, the raw
 * response, the response digest, the model identity, the endpoint kind, timings
 * and every observed predicate under docs/experiments/n7-live-provider/ — with
 * no credentials in the evidence.
 *
 * Usage:
 *   N7_ENDPOINT=http://127.0.0.1:8080/v1/chat/completions \
 *   N7_MODEL=<served-model-id> \
 *   node scripts/n7/live-provider.mjs [--endpoint URL] [--model ID] [--out DIR]
 *
 * Optional: N7_LIVE_LLAMA_LOG=<path to the llama-server log> lets the run also
 * read the server-side request window as independent egress evidence.
 * N7_LIVE_SERVER_DESC=<path to a JSON file> embeds the server/model provenance.
 *
 * Exit codes: 0 pass, 1 the live run did not satisfy the contract, 2 refused
 * configuration (non-loopback endpoint or missing model information).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, ProposalCore } from '../../packages/ivory-tower-agent-experiment/lib/core.js';
import { ProviderDispatcher, REQUEST_LIMIT, recordedCandidate } from '../../packages/ivory-tower-agent-experiment/lib/provider.js';
import { implementationFingerprints, sha256 } from './fingerprint.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const PRIVATE_CANARY = 'PRIVATE_CANARY_NOT_FOR_TRANSMISSION';
const CREDENTIAL_PATTERNS = [
    ['authorization-header', /authorization/i],
    ['bearer-token', /bearer\s/i],
    ['api-key', /api[_-]?key/i],
    ['password', /password/i],
    ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['openai-key', /\bsk-[A-Za-z0-9]{8,}/],
    ['github-token', /\bgh[pousr]_[A-Za-z0-9]{16,}/],
    ['env-var-name', /N7_API_KEY/],
];

function argumentValue(name) {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
}

const endpoint = argumentValue('--endpoint') ?? process.env.N7_ENDPOINT;
const modelOverride = argumentValue('--model') ?? process.env.N7_MODEL;
const output = argumentValue('--out') === undefined
    ? join(root, 'docs/experiments/n7-live-provider')
    : resolve(root, argumentValue('--out'));

if (!endpoint) {
    process.stderr.write('N7_ENDPOINT (or --endpoint) is required; nothing was transmitted.\n');
    process.exitCode = 2;
} else {
    await main();
}

async function main() {
    const url = new URL(endpoint);
    const loopback = url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
    if (!loopback || url.username || url.password || url.search || url.hash) {
        process.stderr.write(`refused: ${endpoint} is not a credential-free loopback HTTP endpoint; nothing was transmitted.\n`);
        process.exitCode = 2;
        return;
    }
    const serverDescription = (() => {
        const path = process.env.N7_LIVE_SERVER_DESC;
        if (!path) return null;
        return JSON.parse(readFileSync(path, 'utf8'));
    })();

    const observations = [];
    const observe = (name, passed, observed) => {
        observations.push({ name, passed: passed === true, observed });
        if (passed !== true) throw new Error(`observation_failed:${name}`);
    };

    // Independent wire observation: capture the exact request/response pair the
    // provider fetches, without changing the dispatcher.
    const wire = [];
    const realFetch = globalThis.fetch;
    const installCapture = () => {
        globalThis.fetch = async (input, init = {}) => {
            const headers = new Headers(init.headers);
            const request = {
                url: typeof input === 'string' ? input : input.url,
                method: init.method ?? 'GET',
                headerNames: [...headers.keys()].sort(),
                authorizationHeaderPresent: headers.has('authorization'),
                body: typeof init.body === 'string' ? init.body : null,
                redirect: init.redirect ?? 'follow',
            };
            const started = performance.now();
            const response = await realFetch(input, init);
            const bytes = Buffer.from(await response.clone().arrayBuffer());
            wire.push({ request, status: response.status, redirected: response.redirected, finalUrl: response.url, bytes, latencyMs: Math.round(performance.now() - started) });
            return response;
        };
    };
    const uninstallCapture = () => {
        globalThis.fetch = realFetch;
    };

    const started = performance.now();
    let failure;
    let record;
    let bodyPath;
    let responsePath;
    let responseBytes;
    let serverLog = null;

    try {
        // Model identity: ask the server which model it actually serves.
        const modelsUrl = new URL('/v1/models', url.origin).href;
        const modelsResponse = await realFetch(modelsUrl, { redirect: 'error' });
        if (!modelsResponse.ok) throw new Error(`models_endpoint_http_${modelsResponse.status}`);
        const modelsBytes = Buffer.from(await modelsResponse.arrayBuffer());
        const modelsParsed = JSON.parse(modelsBytes.toString('utf8'));
        const servedIds = Array.isArray(modelsParsed?.data) ? modelsParsed.data.map(entry => entry?.id).filter(id => typeof id === 'string') : [];
        const model = modelOverride ?? servedIds[0];
        if (!model) throw new Error('no_model_served');
        const modelIdentity = {
            served: model,
            requestedOverride: modelOverride ?? null,
            servedIds,
            modelsUrl,
            modelsDigest: sha256(modelsBytes),
            server: serverDescription,
        };

        const f = fixture();
        const core = new ProposalCore(f.kernel, [f.fragment], f.claim, endpoint, model);
        const dispatcher = new ProviderDispatcher(core, { endpoint, model });
        const excerpt = core.readExcerpt(f.fragment);

        installCapture();
        const previewStarted = performance.now();
        const transmission = dispatcher.preview(excerpt);
        const previewMs = Math.round(performance.now() - previewStarted);
        observe('preview-within-request-limit', Buffer.byteLength(transmission.body) <= REQUEST_LIMIT, { bytes: Buffer.byteLength(transmission.body), limit: REQUEST_LIMIT });
        observe('preview-excludes-private-canary', !transmission.body.includes(PRIVATE_CANARY), { canaryPresent: transmission.body.includes(PRIVATE_CANARY) });

        mkdirSync(output, { recursive: true });
        bodyPath = join(output, 'outgoing-body.txt');
        writeFileSync(bodyPath, Buffer.from(transmission.body, 'utf8'));

        // Approval is required before any dispatch; without it nothing is sent.
        let preApproval = 'dispatched';
        try {
            await dispatcher.dispatch(transmission.digest);
        } catch (error) {
            preApproval = error instanceof Error ? error.message : '';
        }
        observe('dispatch-refused-before-approval', preApproval === 'transmission_not_approved' && wire.length === 0, { error: preApproval, wireRequests: wire.length });

        dispatcher.approve(transmission.digest);
        const beforeSequence = f.kernel.sequence;
        const logPath = process.env.N7_LIVE_LLAMA_LOG;
        const logWindow = logPath && existsSync(logPath) ? { path: logPath, offset: statSync(logPath).size } : null;
        const dispatchStarted = performance.now();
        const candidate = await dispatcher.dispatch(transmission.digest);
        const dispatchMs = Math.round(performance.now() - dispatchStarted);

        const call = wire.at(-1);
        if (!call) throw new Error('no_wire_observation');
        responseBytes = call.bytes;
        responsePath = join(output, 'response-body.json');
        writeFileSync(responsePath, responseBytes);
        const responseText = responseBytes.toString('utf8');

        // Egress: one approved request, no redirect, no implicit retry, no credentials.
        observe('exactly-one-wire-request', wire.length === 1, { requests: wire.length });
        observe('approved-bytes-are-transmitted-bytes', call.request.body === transmission.body, {
            equal: call.request.body === transmission.body,
            previewDigest: transmission.digest,
            bodyDigest: sha256(Buffer.from(transmission.body, 'utf8')),
        });
        observe('content-type-only-headers', call.request.headerNames.join(',') === 'content-type' && call.request.authorizationHeaderPresent === false, { headerNames: call.request.headerNames, authorizationHeaderPresent: call.request.authorizationHeaderPresent, note: 'headers supplied by the dispatcher to fetch; transport headers are not part of this claim' });
        observe('no-redirect', call.redirected === false && call.finalUrl === transmission.endpoint && call.request.redirect === 'error', { redirected: call.redirected, finalUrl: call.finalUrl, redirectPolicy: call.request.redirect });
        observe('http-200', call.status === 200, { status: call.status });
        const parsedResponse = JSON.parse(responseText);
        const calls = parsedResponse?.choices?.[0]?.message?.tool_calls;
        observe('one-propose_claim-tool-call', parsedResponse?.choices?.length === 1 && calls?.length === 1 && calls[0]?.function?.name === 'propose_claim', { choices: parsedResponse?.choices?.length, toolCalls: calls?.length, tool: calls?.[0]?.function?.name });
        observe('response-excludes-private-canary', !responseText.includes(PRIVATE_CANARY), { canaryPresent: responseText.includes(PRIVATE_CANARY) });
        observe('dispatcher-observations-match-wire', dispatcher.observations().length === 1 && dispatcher.observations()[0].body === call.request.body, { observedTransmissions: dispatcher.observations().length });
        observe('candidate-strict-schema', JSON.stringify(Object.keys(candidate).sort()) === JSON.stringify(['excerptDigest', 'fragmentRef', 'rationale', 'role', 'text']), { argumentKeys: Object.keys(candidate).sort() });
        observe('no-accepted-state-from-dispatch', f.kernel.sequence === beforeSequence, { sequenceBefore: beforeSequence, sequenceAfter: f.kernel.sequence });

        // The model's output is only ever a pending proposal, bound to the
        // application-issued capability; a researcher identity supplied by the
        // source text cannot substitute for the acceptance caller.
        const proposal = core.propose(candidate);
        observe('proposal-is-pending', core.preview(proposal.id).state === 'pending', { state: core.preview(proposal.id).state, digest: proposal.digest });
        observe('proposal-bound-to-application-capability', proposal.envelope.capabilityId === core.capabilityId && proposal.envelope.provider === transmission.endpoint && proposal.envelope.model === model, { capabilityId: proposal.envelope.capabilityId, coreCapabilityId: core.capabilityId, provider: proposal.envelope.provider, model: proposal.envelope.model });
        observe('proposal-does-not-publish-state', f.kernel.sequence === beforeSequence, { sequence: f.kernel.sequence });
        let emptyResearcher = 'accepted';
        try {
            core.accept(proposal.id, proposal.digest, 'live-accept-key', '   ');
        } catch (error) {
            emptyResearcher = error instanceof Error ? error.message : '';
        }
        observe('acceptance-requires-researcher-identity', emptyResearcher === 'approval_mismatch' && f.kernel.sequence === beforeSequence, { error: emptyResearcher });
        const receipt = core.accept(proposal.id, proposal.digest, 'live-accept-key', 'local-researcher');
        observe('acceptance-publishes-model-claim-and-human-activity', f.kernel.sequence === beforeSequence + 2 && f.kernel.getRevision(receipt.claimRef).payload.authorType === 'model' && f.kernel.getActivity(receipt.activityId).actor === 'local-researcher', { sequence: f.kernel.sequence, claimAuthorType: f.kernel.getRevision(receipt.claimRef).payload.authorType, activityActor: f.kernel.getActivity(receipt.activityId).actor });

        // No implicit retry: the approved transmission is consumed on dispatch.
        let replayed = 'dispatched';
        try {
            await dispatcher.dispatch(transmission.digest);
        } catch (error) {
            replayed = error instanceof Error ? error.message : '';
        }
        observe('no-implicit-retry-after-dispatch', replayed === 'transmission_not_approved' && wire.length === 1, { error: replayed, wireRequests: wire.length });

        // The remaining semantics are asserted on the same contract using the
        // recorded candidate, so this experiment sends exactly one model request.
        const stale = fixture();
        const staleCore = new ProposalCore(stale.kernel, [stale.fragment], stale.claim, endpoint, model);
        const staleProposal = staleCore.propose(recordedCandidate(staleCore.readExcerpt(stale.fragment)));
        stale.kernel.reviseClaim({ claimRef: stale.claim, expectedHead: stale.claim.revisionId, text: 'Researcher changed the context.', actor: 'local-researcher' });
        let staleError = 'accepted';
        try {
            staleCore.accept(staleProposal.id, staleProposal.digest, 'stale-key', 'local-researcher');
        } catch (error) {
            staleError = error instanceof Error ? error.message : '';
        }
        observe('stale-head-fences-acceptance', staleError === 'stale_proposal', { error: staleError });

        const declined = fixture();
        const declinedCore = new ProposalCore(declined.kernel, [declined.fragment], declined.claim, endpoint, model);
        const declinedProposal = declinedCore.propose(recordedCandidate(declinedCore.readExcerpt(declined.fragment)));
        declinedCore.decline(declinedProposal.id);
        declinedCore.propose(recordedCandidate(declinedCore.readExcerpt(declined.fragment)));
        let declinedError = 'accepted';
        try {
            declinedCore.accept(declinedProposal.id, declinedProposal.digest, 'declined-key', 'local-researcher');
        } catch (error) {
            declinedError = error instanceof Error ? error.message : '';
        }
        observe('decline-preserves-state-and-is-not-reversible', declinedError === 'proposal_declined', { error: declinedError });

        // Revocation before dispatch must cause zero egress even live.
        const revoked = fixture();
        const revokedCore = new ProposalCore(revoked.kernel, [revoked.fragment], revoked.claim, endpoint, model);
        const revokedDispatcher = new ProviderDispatcher(revokedCore, { endpoint, model });
        const revokedTransmission = revokedDispatcher.preview(revokedCore.readExcerpt(revoked.fragment));
        revokedDispatcher.approve(revokedTransmission.digest);
        revokedCore.revoke();
        let revokedError = 'dispatched';
        try {
            await revokedDispatcher.dispatch(revokedTransmission.digest);
        } catch (error) {
            revokedError = error instanceof Error ? error.message : '';
        }
        observe('revocation-causes-zero-egress', revokedError === 'capability_revoked' && wire.length === 1, { error: revokedError, wireRequests: wire.length });

        // Server-side egress window, when the caller supplied the server log.
        // The log is supplementary evidence; the in-process wire capture above is
        // the primary single-request proof. Poll briefly for the server to flush.
        if (logWindow) {
            const requestLines = [];
            for (let attempt = 0; attempt < 25; attempt += 1) {
                const delta = readFileSync(logWindow.path).subarray(logWindow.offset).toString('utf8');
                requestLines.length = 0;
                requestLines.push(...delta.split(/\r?\n/).filter(line => line.includes('/v1/chat/completions')));
                if (requestLines.length > 0) break;
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            if (requestLines.length > 0) {
                const serverLogPath = join(output, 'server-request.log');
                writeFileSync(serverLogPath, requestLines.join('\n') + '\n');
                serverLog = { path: 'server-request.log', digest: sha256(readFileSync(serverLogPath)), lines: requestLines.length, excerpt: requestLines.join('\n') };
                observe('server-log-shows-one-request', requestLines.length === 1, { lines: requestLines.length });
            } else {
                serverLog = { path: null, digest: null, lines: null, note: 'the server did not flush a matching request line within the polling window; the wire capture is the egress proof' };
            }
        }

        // Credential-free retention: the outgoing body and the response are retained
        // only because they contain neither credentials nor the private canary.
        for (const [label, text] of [
            ['outgoing-body', transmission.body],
            ['response-body', responseText],
            ['server-log', serverLog?.excerpt ?? ''],
        ]) {
            const findings = CREDENTIAL_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
            observe(`credential-free:${label}`, findings.length === 0, { findings });
        }
        const apiKey = process.env.N7_API_KEY;
        observe('no-configured-credential-leaked', apiKey === undefined || (!transmission.body.includes(apiKey) && !responseText.includes(apiKey)), { credentialConfigured: apiKey !== undefined });

        uninstallCapture();
        record = {
            schema: 'ivory-n7-live-provider/1',
            experiment: 'N7',
            contractVersion: 'n7/1',
            observedAt: new Date().toISOString(),
            outcome: 'passed',
            decision: 'bounded-experiment-pass',
            endpoint: { kind: 'loopback-http', url: transmission.endpoint, host: url.hostname, port: url.port, loopback: true, tls: false, policy: 'this experiment transmits only to a loopback HTTP endpoint' },
            modelIdentity,
            transmission: { digest: transmission.digest, bytes: Buffer.byteLength(transmission.body), file: 'outgoing-body.txt', fileDigest: sha256(readFileSync(bodyPath)) },
            response: { status: call.status, redirected: call.redirected, finalUrl: call.finalUrl, bytes: responseBytes.length, digest: sha256(responseBytes), file: 'response-body.json', latencyMs: call.latencyMs, tool: { name: calls?.[0]?.function?.name, argumentKeys: Object.keys(candidate).sort() }, usage: parsedResponse?.usage ?? null },
            egress: { wireRequests: wire.length, dispatcherObservedTransmissions: dispatcher.observations().length, requestHeaders: call.request.headerNames, authorizationHeaderPresent: call.request.authorizationHeaderPresent, redirectPolicy: 'error', credentials: 'none-configured', serverLog },
            timings: { previewMs, dispatchMs, totalMs: Math.round(performance.now() - started) },
            observations,
            implementation: { encoding: 'SHA-256 of UTF-8 text with LF line endings', fingerprints: implementationFingerprints(root) },
            limitations: [
                'One bounded request to one local llama.cpp model; no hosted-provider or multi-provider claim.',
                'Revocation cannot recall bytes already transmitted; this run proves the pre-dispatch fence only.',
                'In-memory acceptance and receipts only; no restart or crash durability claim.',
                'The declared loopback endpoint is trusted to handle its received data; this experiment observes local egress only.',
            ],
        };
    } catch (error) {
        uninstallCapture();
        failure = error instanceof Error ? error.message : 'live_provider_failed';
        if (responsePath === undefined && wire.length > 0 && wire.at(-1).bytes !== undefined) {
            responseBytes = wire.at(-1).bytes;
            responsePath = join(output, 'response-body.json');
            writeFileSync(responsePath, responseBytes);
        }
        const retained = [];
        if (bodyPath !== undefined && existsSync(bodyPath)) retained.push({ file: 'outgoing-body.txt', digest: sha256(readFileSync(bodyPath)) });
        if (responsePath !== undefined && existsSync(responsePath)) retained.push({ file: 'response-body.json', digest: sha256(readFileSync(responsePath)) });
        record = {
            schema: 'ivory-n7-live-provider/1',
            experiment: 'N7',
            contractVersion: 'n7/1',
            observedAt: new Date().toISOString(),
            outcome: 'failed',
            decision: 'not-qualified',
            failure,
            endpoint: { kind: 'loopback-http', url: String(endpoint) },
            response: responseBytes === undefined ? null : {
                status: wire.at(-1)?.status ?? null, redirected: wire.at(-1)?.redirected ?? null, bytes: responseBytes.length,
                digest: sha256(responseBytes), file: 'response-body.json',
            },
            retained,
            observations,
            transmissionsObserved: wire.map(entry => ({ url: entry.request.url, status: entry.status, redirected: entry.redirected, bytes: entry.bytes.length })),
            implementation: { encoding: 'SHA-256 of UTF-8 text with LF line endings', fingerprints: implementationFingerprints(root) },
        };
    }

    if (existsSync(join(output, 'run.json')) && record.outcome === 'passed') {
        const previous = JSON.parse(readFileSync(join(output, 'run.json'), 'utf8'));
        if (previous.outcome === 'failed') {
            renameSync(join(output, 'run.json'), join(output, `run.attempt-${previous.observedAt.replaceAll(':', '-')}.json`));
        }
    }
    writeFileSync(join(output, 'run.json'), JSON.stringify(record, null, 2) + '\n');
    const failedPredicates = record.observations.filter(observation => !observation.passed).map(observation => observation.name);
    const retainedPath = join(output, 'run.json');
    const shownPath = relative(root, retainedPath).startsWith('..') ? retainedPath : relative(root, retainedPath).replaceAll('\\', '/');
    process.stdout.write(`N7 live provider: ${record.outcome}${failure ? ` (${failure})` : ''}; ${record.observations.length} observations, ${failedPredicates.length} failed; retained ${shownPath}\n`);
    if (record.outcome !== 'passed') process.exitCode = 1;
}
