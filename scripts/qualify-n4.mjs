// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpus, arch, platform, release, totalmem } from 'node:os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = path.join(root, 'fixtures', 'n4');
const output = path.join(root, 'artifacts', 'n4');
const rawOutput = path.join(output, 'raw');
const manifestPath = path.join(corpus, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const pullTimeoutMs = Number(process.env.N4_DOCKER_PULL_TIMEOUT_MS ?? 600_000);
const anchorCountPerFixture = 6;
const minimumAnchorsPerFixture = 5;
const n4PolicyVersion = 'iv-policy/n4-v2';
const converters = [
    {
        label: 'A',
        version: 'v1.21.0',
        image: 'quay.io/docling-project/docling-serve:v1.21.0@sha256:32b3de41f325f93c1dd35907cd9147fa35df9f7c5abc86eb2788b6bda7ce6d10',
        port: 5101,
    },
    {
        label: 'B',
        version: 'v1.22.0',
        image: 'quay.io/docling-project/docling-serve:v1.22.0@sha256:8880b8f5a511b1d93edb22a2e2e7380461657a0401febb4e43f7e41ef9d9661c',
        port: 5102,
    },
];

const manifestFixtures = manifest.fixtures.map(fixture => ({
    path: fixture.path,
    kind: fixture.kind,
    sha256: fixture.sha256,
}));

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function relativePath(value) {
    return path.relative(root, value).replaceAll('\\', '/');
}

function describeError(error) {
    if (error instanceof Error) {
        const code = typeof error.code === 'string' ? ' [' + error.code + ']' : '';
        return error.message + code;
    }
    return String(error);
}

function repositoryCommit() {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    } catch {
        return 'unknown';
    }
}

function docker(args, options = {}) {
    const result = execFileSync('docker', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        ...options,
    });
    return typeof result === 'string' ? result.trim() : result?.toString().trim() ?? '';
}

function safeDocker(args) {
    try {
        return docker(args);
    } catch (error) {
        return describeError(error);
    }
}

function validateManifest() {
    const errors = [];
    if (manifest.schemaVersion !== 1) errors.push('manifest schemaVersion must be 1');
    if (!Array.isArray(manifest.fixtures) || manifest.fixtures.length !== 20) {
        errors.push('manifest must contain exactly 20 fixtures');
    }
    if (manifest.fixtures.filter(fixture => fixture.kind === 'scanned').length !== 2) {
        errors.push('manifest must contain exactly two scanned PDFs');
    }
    for (const fixture of manifest.fixtures) {
        const fixturePath = path.join(corpus, fixture.path);
        if (!existsSync(fixturePath)) {
            errors.push('missing fixture: ' + fixture.path);
            continue;
        }
        const digest = sha256(readFileSync(fixturePath));
        if (digest !== fixture.sha256) errors.push('fixture digest mismatch: ' + fixture.path);
    }
    return errors;
}

function runtimeMetadata() {
    const cpu = cpus()[0];
    return {
        platform: {
            name: platform(),
            release: release(),
            arch: arch(),
            cpuModel: cpu?.model ?? 'unknown',
            cpuCount: cpus().length,
            totalMemoryBytes: totalmem(),
        },
        node: process.version,
        dockerServer: safeDocker(['version', '--format', '{{.Server.Version}}']),
        dockerInfo: safeDocker(['info', '--format', '{{json .}}']),
    };
}

function ensureImage(converter) {
    const startedAt = Date.now();
    try {
        docker(['pull', converter.image], { stdio: 'inherit', timeout: pullTimeoutMs });
        const repoDigests = JSON.parse(docker(['image', 'inspect', converter.image, '--format', '{{json .RepoDigests}}']));
        const expectedDigest = converter.image.slice(converter.image.indexOf('@'));
        if (!Array.isArray(repoDigests) || !repoDigests.some(digest => digest.endsWith(expectedDigest))) {
            throw new Error(converter.label + ' image digest mismatch: ' + (repoDigests ?? []).join(', '));
        }
        return {
            label: converter.label,
            version: converter.version,
            image: converter.image,
            status: 'ready',
            elapsedMs: Date.now() - startedAt,
        };
    } catch (error) {
        const timedOut = error && typeof error === 'object' && (error.code === 'ETIMEDOUT' || error.killed === true);
        return {
            label: converter.label,
            version: converter.version,
            image: converter.image,
            status: 'failed',
            elapsedMs: Date.now() - startedAt,
            error: timedOut
                ? 'docker pull timed out after ' + pullTimeoutMs + ' ms; the Docker daemon did not report a completed pinned image'
                : describeError(error),
            diagnostics: {
                imageInspect: safeDocker(['image', 'inspect', converter.image, '--format', '{{json .}}']),
                dockerDisk: safeDocker(['system', 'df']),
            },
        };
    }
}

function startConverter(converter) {
    const name = 'ivory-n4-' + converter.label.toLowerCase() + '-' + process.pid;
    try {
        docker(['rm', '--force', name], { stdio: 'ignore' });
    } catch {
        // The name is normally absent.
    }
    docker(['run', '--pull=never', '--detach', '--name', name, '--publish', converter.port + ':5001', converter.image]);
    return { ...converter, name };
}

function stopConverter(converter) {
    try {
        docker(['rm', '--force', converter.name], { stdio: 'ignore' });
    } catch {
        // Best-effort cleanup must not hide the qualification result.
    }
}

async function waitForConverter(converter) {
    const startedAt = Date.now();
    const deadline = startedAt + 180_000;
    while (Date.now() < deadline) {
        try {
            if ((await fetch('http://127.0.0.1:' + converter.port + '/health')).ok) {
                return { status: 'ready', elapsedMs: Date.now() - startedAt };
            }
        } catch {
            // Docling may still be loading its application.
        }
        await new Promise(resolve => setTimeout(resolve, 2_000));
    }
    return {
        status: 'failed',
        elapsedMs: Date.now() - startedAt,
        error: 'timed out waiting for converter health endpoint',
    };
}

class ConversionAttemptError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ConversionAttemptError';
        Object.assign(this, details);
    }
}

function safeRawName(fixture, converter) {
    return fixture.path.replaceAll(/[^\w.-]+/gu, '_') + '-' + converter.label.toLowerCase() + '.json';
}

function saveRawResponse(fixture, converter, rawBody) {
    mkdirSync(rawOutput, { recursive: true });
    const rawPath = path.join(rawOutput, safeRawName(fixture, converter));
    writeFileSync(rawPath, rawBody);
    return {
        path: relativePath(rawPath),
        sha256: sha256(rawBody),
        bytes: Buffer.byteLength(rawBody, 'utf8'),
    };
}

function saveMarkdownRepresentation(fixture, converter, text) {
    mkdirSync(rawOutput, { recursive: true });
    const markdownPath = path.join(rawOutput, safeRawName(fixture, converter).replace(/\.json$/u, '.md'));
    writeFileSync(markdownPath, text);
    return {
        path: relativePath(markdownPath),
        sha256: sha256(text),
        bytes: Buffer.byteLength(text, 'utf8'),
    };
}

function responseDocument(body) {
    return body && typeof body === 'object' && body.document && typeof body.document === 'object' ? body.document : {};
}

function parseJsonContent(value) {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}

async function convert(converter, fixture, bytes) {
    const startedAt = Date.now();
    const form = new FormData();
    const contentType = fixture.path.endsWith('.csv') ? 'text/csv' : 'application/pdf';
    form.append('files', new Blob([bytes], { type: contentType }), path.basename(fixture.path));
    form.append('to_formats', 'md');
    form.append('to_formats', 'json');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    let response;
    let rawBody = '';
    try {
        response = await fetch('http://127.0.0.1:' + converter.port + '/v1/convert/file', {
            method: 'POST',
            body: form,
            signal: controller.signal,
        });
        rawBody = await response.text();
        const rawArtifact = saveRawResponse(fixture, converter, rawBody);
        let body;
        try {
            body = JSON.parse(rawBody);
        } catch {
            throw new ConversionAttemptError(
                converter.label + ' returned a non-JSON response for ' + fixture.path,
                { status: response.status, rawArtifact },
            );
        }
        const document = responseDocument(body);
        const text = document.md_content ?? document.text_content;
        if (!response.ok || body.status === 'failure') {
            throw new ConversionAttemptError(
                converter.label + ' conversion failed for ' + fixture.path + ': HTTP ' + response.status,
                { status: response.status, body, rawArtifact },
            );
        }
        if (typeof text !== 'string' || text.length === 0) {
            throw new ConversionAttemptError(
                converter.label + ' returned no text for ' + fixture.path,
                { status: response.status, body, rawArtifact },
            );
        }
        return {
            text,
            jsonContent: parseJsonContent(document.json_content),
            rawArtifact,
            representationArtifact: saveMarkdownRepresentation(fixture, converter, text),
            processingTime: body.processing_time,
            timings: body.timings,
            responseErrors: body.errors,
            elapsedMs: Date.now() - startedAt,
        };
    } catch (error) {
        if (error instanceof ConversionAttemptError) throw error;
        throw new ConversionAttemptError(
            converter.label + ' request failed for ' + fixture.path + ': ' + describeError(error),
            { status: response?.status, body: undefined },
        );
    } finally {
        clearTimeout(timeout);
    }
}

function failureCode(fixture, error) {
    const message = (describeError(error) + ' ' + JSON.stringify(error.body ?? '')).toLowerCase();
    if (fixture.kind === 'scanned' && (message.includes('ocr') || message.includes('no text') || message.includes('image-only'))) {
        return 'ocr_required';
    }
    if (error.status === 415 || message.includes('unsupported')) return 'unsupported_format';
    if (error.status === 413 || message.includes('size')) return 'size_limit';
    if (message.includes('encoding')) return 'invalid_encoding';
    return 'converter_failed';
}

function extractionFailure(fixture, converter, error) {
    const code = failureCode(fixture, error);
    const message = describeError(error).toLowerCase();
    const retryable = code === 'converter_failed'
        && (error.status >= 500 || error.status === 429 || error.name === 'AbortError' || message.includes('abort') || message.includes('fetch failed'));
    const nextAction = code === 'ocr_required'
        ? 'provide_ocr'
        : code === 'unsupported_format'
            ? 'select_supported_converter'
            : retryable
                ? 'retry'
                : 'inspect_source';
    return {
        fixture: fixture.path,
        converter: converter.label,
        converterRef: converter.image,
        kind: fixture.kind,
        extractionFailure: {
            code,
            message: describeError(error),
            retryable,
            attempt: 1,
            nextAction,
        },
        rawArtifact: error.rawArtifact,
    };
}

function normalizeIndependent(text) {
    return text.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

/** Independent candidate oracle; it never imports or calls the production remapper. */
function independentOracle(anchorText, nextText) {
    const exact = normalizeIndependent(anchorText);
    const normalized = normalizeIndependent(nextText);
    const candidates = [];
    let from = 0;
    while (exact.length > 0) {
        const hit = normalized.indexOf(exact, from);
        if (hit < 0) break;
        candidates.push({ start: hit, end: hit + exact.length });
        from = hit + 1;
    }
    return {
        outcome: candidates.length === 0 ? 'unresolved' : candidates.length === 1 ? 'exact' : 'ambiguous',
        candidates,
    };
}

function selectAnchors(text, fixturePath) {
    const candidates = [];
    const seen = new Set();
    for (const match of text.matchAll(/[^\r\n]{24,240}/gu)) {
        const raw = match[0];
        const exact = raw.trim();
        const start = match.index + raw.indexOf(exact);
        const key = normalizeIndependent(exact);
        if (key.length < 24 || seen.has(key)) continue;
        seen.add(key);
        candidates.push({ start, end: start + exact.length, fixturePath });
        if (candidates.length === anchorCountPerFixture) break;
    }
    if (candidates.length < minimumAnchorsPerFixture) {
        throw new Error('Only ' + candidates.length + ' real anchor candidates found for ' + fixturePath);
    }
    return candidates;
}

function bboxValues(bbox) {
    if (!bbox || typeof bbox !== 'object') return undefined;
    const left = bbox.l ?? bbox.left ?? bbox.x0;
    const top = bbox.t ?? bbox.top ?? bbox.y0;
    const right = bbox.r ?? bbox.right ?? bbox.x1;
    const bottom = bbox.b ?? bbox.bottom ?? bbox.y1;
    if (![left, top, right, bottom].every(value => typeof value === 'number' && Number.isFinite(value))) return undefined;
    return { x: left, y: top, width: Math.abs(right - left), height: Math.abs(bottom - top) };
}

function coordinateHints(jsonContent) {
    const hints = [];
    const visited = new WeakSet();
    function visit(value) {
        if (!value || typeof value !== 'object') return;
        if (visited.has(value)) return;
        visited.add(value);
        if (!Array.isArray(value)) {
            const text = typeof value.text === 'string' ? value.text : typeof value.orig === 'string' ? value.orig : undefined;
            const provenance = Array.isArray(value.prov) ? value.prov : Array.isArray(value.provenance) ? value.provenance : [];
            if (text !== undefined) {
                const coordinates = provenance.flatMap(item => {
                    if (!item || typeof item !== 'object') return [];
                    const page = item.page_no ?? item.pageNo ?? item.page;
                    const box = bboxValues(item.bbox ?? item.bounding_box ?? item.bounds);
                    if (typeof page !== 'number' || box === undefined) return [];
                    return [{ page, ...box, unit: 'pt' }];
                });
                if (coordinates.length > 0) hints.push({ text, coordinates });
            }
            for (const child of Object.values(value)) visit(child);
            return;
        }
        for (const child of value) visit(child);
    }
    visit(jsonContent);
    return hints;
}

function coordinatesForQuote(quote, hints) {
    const target = normalizeIndependent(quote);
    const coordinates = [];
    const seen = new Set();
    for (const hint of hints) {
        const candidate = normalizeIndependent(hint.text);
        if (candidate.length === 0 || (!target.includes(candidate) && !candidate.includes(target))) continue;
        for (const coordinate of hint.coordinates) {
            const key = JSON.stringify(coordinate);
            if (!seen.has(key)) {
                seen.add(key);
                coordinates.push(coordinate);
            }
        }
    }
    return coordinates;
}

function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (character === '"') {
            if (quoted && text[index + 1] === '"') {
                field += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (character === ',' && !quoted) {
            row.push(field);
            field = '';
        } else if ((character === '\n' || character === '\r') && !quoted) {
            if (character === '\r' && text[index + 1] === '\n') index += 1;
            row.push(field);
            if (row.some(value => value.length > 0)) rows.push(row);
            row = [];
            field = '';
        } else {
            field += character;
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        if (row.some(value => value.length > 0)) rows.push(row);
    }
    if (quoted) throw new Error('unterminated quoted CSV field');
    return rows;
}

function typedCellValue(rawText) {
    if (/^-?(?:\d+\.?\d*|\.\d+)$/u.test(rawText)) return { kind: 'number', value: Number(rawText) };
    if (/^(?:true|yes)$/iu.test(rawText)) return { kind: 'boolean', value: true };
    if (/^(?:false|no)$/iu.test(rawText)) return { kind: 'boolean', value: false };
    return { kind: 'string', value: rawText };
}

function buildTableRepresentation(fixture, bytes, sourceVersionId, tableRepresentationSchema) {
    const rows = parseCsvRows(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const headers = rows[0] ?? [];
    const tableRows = rows.slice(1).map((values, rowIndex) => {
        const sourceRowNumber = rowIndex + 2;
        const normalizedValues = headers.map((_, columnIndex) => values[columnIndex] ?? '');
        const rowId = 'row-' + sourceRowNumber + '-' + sha256(JSON.stringify(normalizedValues)).slice(0, 12);
        return {
            rowId,
            sourceRowNumber,
            cells: headers.map((column, columnIndex) => {
                const rawText = normalizedValues[columnIndex];
                return rawText.length === 0
                    ? { column, missingness: 'missing', rawText }
                    : { column, missingness: 'present', value: typedCellValue(rawText), rawText };
            }),
        };
    });
    const table = {
        sourceVersionId,
        tableOrdinal: 0,
        headers,
        rows: tableRows,
        rawRepresentation: {
            sourceVersionId,
            contentHash: fixture.sha256,
            objectKey: 'sources/' + fixture.sha256 + '/raw/' + path.basename(fixture.path),
            contentType: 'text/csv',
            byteLength: bytes.byteLength,
        },
    };
    return tableRepresentationSchema.parse(table);
}

function hasNonAscii(value) {
    return /[^\x00-\x7F]/u.test(value);
}

function tableFidelityIsComplete(table) {
    const cells = table.rows.flatMap(row => row.cells);
    return table.rows.length > 0
        && cells.length === table.rows.length * table.headers.length
        && cells.every(cell => typeof cell.rawText === 'string' && cell.missingness !== undefined)
        && cells.some(cell => cell.missingness === 'missing')
        && cells.some(cell => cell.value?.kind === 'number' || cell.value?.kind === 'boolean' || cell.value?.kind === 'string')
        && table.rows.every(row => typeof row.rowId === 'string' && row.sourceRowNumber >= 2);
}

function increment(matrix, observed, oracle) {
    matrix[observed][oracle] += 1;
}

function sourceRecord(fixture, transferPermitted = true) {
    return {
        id: 'src_' + fixture.sha256.slice(0, 32),
        contentHash: fixture.sha256,
        objectKey: 'sources/' + fixture.sha256 + '/raw/' + path.basename(fixture.path),
        contentType: fixture.path.endsWith('.csv') ? 'text/csv' : 'application/pdf',
        license: 'MPL-2.0',
        authorizationEvidence: 'fixtures/n4/NOTICE.md and checked-in manifest',
        admissionPolicyVersion: 'iv-policy/n4-v2',
        admittedAt: '2026-09-08T00:00:00.000Z',
        contentClass: 'openLicensed',
        rightsBasisKind: 'openLicence',
        acquisitionRoute: 'openRepository',
        deploymentTopology: 'selfHostedAtResearchOrganization',
        ingestPermitted: true,
        transferPermitted,
        ingestReason: 'checked-in qualification fixture',
        transferReason: transferPermitted ? 'qualification fixture transfer permitted' : 'transfer policy probe denied',
    };
}

function deriveRepresentation(identity, bytes, fixture, converter, text) {
    const pipeline = identity.runPipeline({
        ...identity.BASELINE_INPUTS,
        bytes,
        parserVersion: converter.version,
        policyVersion: n4PolicyVersion,
    });
    const fingerprint = identity.deriveExecutionFingerprint({
        transformation: 'docling.convert',
        transformationVersion: converter.version,
        inputIds: [pipeline.sourceVersionId],
        parameters: {
            outputFormats: 'md,json',
            inputContentType: fixture.path.endsWith('.csv') ? 'text/csv' : 'application/pdf',
            layoutRetention: true,
        },
        policyVersion: n4PolicyVersion,
    });
    const artifact = identity.deriveArtifactId({
        fingerprint: fingerprint.id,
        outputRole: 'text-layout',
        determinism: 'observed',
        outputDigest: sha256(text),
    });
    return {
        sourceVersionId: pipeline.sourceVersionId,
        extractionFingerprint: fingerprint.id,
        artifactId: artifact.id,
        representationId: 'rep_' + sha256(fixture.sha256 + ':' + converter.label + ':' + text).slice(0, 32),
    };
}

function createBaseLedger(runtime) {
    return {
        schemaVersion: 3,
        experiment: 'N4 exact fragment anchors and ingestion fidelity',
        experimentVersion: 'n4-v2',
        generatedAt: undefined,
        startedAt: new Date().toISOString(),
        repositoryCommit: repositoryCommit(),
        command: process.env.N4_QUALIFICATION_COMMAND ?? 'npm run qualify:n4',
        configuration: {
            anchorCountPerFixture,
            minimumAnchorsPerFixture,
            pullTimeoutMs,
            conversionTimeoutMs: 180_000,
            policyVersion: n4PolicyVersion,
            independentOracle: 'unique normalized exact-quote occurrence; no production remapper calls',
            reviewPolicy: 'review every disagreement and every ambiguous or unresolved result',
        },
        runtime,
        fixtureManifest: manifestFixtures,
        converters: [],
        fixtureAttempts: [],
        fixturesDetail: [],
        anchors: [],
        matrix: {
            exact: { exact: 0, ambiguous: 0, unresolved: 0 },
            ambiguous: { exact: 0, ambiguous: 0, unresolved: 0 },
            unresolved: { exact: 0, ambiguous: 0, unresolved: 0 },
        },
        falseExact: 0,
        failures: [],
        anchorSelectionFailures: [],
        persistence: {
            store: 'InMemoryN4QualificationStore',
            baselineProjectId: 'n4-v2-baseline',
            transferProjectId: 'n4-v2-transfer',
            exactReopenChecks: 0,
            exactReopenFailures: [],
            afterTransferExactReopenChecks: 0,
            afterTransferReopenFailures: [],
        },
        transfer: {
            allowed: [],
            denied: undefined,
        },
        criteria: {},
        architectureDecision: undefined,
        reviewQueue: [],
        status: 'NO-GO',
    };
}

function makeArchitectureDecision(ledger) {
    const limitations = [
        'The independent oracle is intentionally conservative: disagreements remain review work and are not silently accepted.',
        'Scanned inputs are supported only when a converter returns text; otherwise the run records ocr_required with a next action.',
        'The transfer exercise covers source-membership visibility and immutable anchor reuse, not the later V1 user/role authorization boundary.',
        'Raw Docling responses are retained under the gitignored artifacts/n4/raw directory and are linked by digest.',
    ];
    const qualified = ledger.status === 'qualified';
    return {
        outcome: qualified ? 'use immutable raw representations with explicit remap review' : 'NO-GO; do not promote converter or selector profile',
        primaryConverter: qualified ? 'Docling v1.21.0 (A) as the pinned reference representation' : undefined,
        representationFormat: 'raw source bytes plus markdown/text and retained Docling JSON layout output',
        selectorProfile: 'exact quote plus prefix/suffix context; no ranking or silent fallback',
        supportedInputs: 'plain, multilingual, columns/tables/footnotes, CSV typed rows, and explicit scanned/OCR handling',
        unresolvedLimitations: limitations,
    };
}

async function main() {
    mkdirSync(output, { recursive: true });
    const ledger = createBaseLedger(runtimeMetadata());
    let running = [];
    let failedRun;
    try {
        const manifestErrors = validateManifest();
        if (manifestErrors.length > 0) throw new Error(manifestErrors.join('; '));

        const imageResults = converters.map(ensureImage);
        ledger.converters = imageResults;
        if (imageResults.some(result => result.status !== 'ready')) {
            throw new Error('one or more pinned Docling images could not be prepared');
        }

        running = [];
        for (const converter of converters) running.push(startConverter(converter));
        const healthResults = await Promise.all(running.map(waitForConverter));
        ledger.converters = ledger.converters.map((result, index) => ({
            ...result,
            health: healthResults[index],
        }));
        if (healthResults.some(result => result.status !== 'ready')) {
            throw new Error('one or more pinned Docling converters did not become healthy');
        }

        const identity = {
            ...(await import('../packages/ivory-identity/lib/node/identity.js')),
            ...(await import('../packages/ivory-identity/lib/node/test/identity-fixtures.js')),
        };
        const fragment = await import('../packages/ivory-identity/lib/node/fragment-anchor.js');
        const contracts = await import('../packages/ivory-tower-contracts/lib/index.js');
        const infrastructure = await import('../packages/ivory-tower-infrastructure/lib/index.js');
        const application = await import('../packages/ivory-tower-application/lib/index.js');
        const { createFragmentAnchor, remapFragmentAnchor } = fragment;
        const { extractionFailureSchema, tableRepresentationSchema } = contracts;
        const { InMemoryN4QualificationStore, InMemorySourceRecordStore } = infrastructure;
        const { N4TransferService } = application;
        const store = new InMemoryN4QualificationStore();
        const sourceStore = new InMemorySourceRecordStore();
        const transferService = new N4TransferService(sourceStore, store);
        const baselineProjectId = ledger.persistence.baselineProjectId;
        const transferProjectId = ledger.persistence.transferProjectId;
        await store.ensureProject({ id: baselineProjectId, name: 'N4 V2 baseline', createdAt: '2026-09-08T00:00:00.000Z' });
        await store.ensureProject({ id: transferProjectId, name: 'N4 V2 transferred project', createdAt: '2026-09-08T00:00:00.000Z' });

        for (const fixture of manifest.fixtures) {
            const source = sourceRecord(fixture);
            await sourceStore.persistSource(source);
            await store.addSourceToProject(baselineProjectId, fixture.sha256);
        }

        const matrix = ledger.matrix;
        for (const fixture of manifest.fixtures) {
            const bytes = readFileSync(path.join(corpus, fixture.path));
            const rawTableFidelity = fixture.path.endsWith('.csv')
                ? buildTableRepresentation(
                    fixture,
                    bytes,
                    identity.runPipeline({
                        ...identity.BASELINE_INPUTS,
                        bytes,
                        parserVersion: converters[0].version,
                        policyVersion: n4PolicyVersion,
                    }).sourceVersionId,
                    tableRepresentationSchema,
                )
                : undefined;
            const attempt = {
                path: fixture.path,
                kind: fixture.kind,
                sha256: fixture.sha256,
                converters: {},
            };
            const results = {};
            for (const converter of running) {
                try {
                    const result = await convert(converter, fixture, bytes);
                    results[converter.label] = result;
                    attempt.converters[converter.label] = {
                        status: 'succeeded',
                        elapsedMs: result.elapsedMs,
                        rawArtifact: result.rawArtifact,
                        representationArtifact: result.representationArtifact,
                        textSha256: sha256(result.text),
                        textLength: result.text.length,
                        coordinateHintCount: coordinateHints(result.jsonContent).length,
                        responseErrors: result.responseErrors,
                        processingTime: result.processingTime,
                        timings: result.timings,
                    };
                } catch (error) {
                    const failureRecord = extractionFailure(fixture, converter, error);
                    const failure = {
                        ...failureRecord,
                        extractionFailure: extractionFailureSchema.parse(failureRecord.extractionFailure),
                    };
                    ledger.failures.push(failure);
                    attempt.converters[converter.label] = {
                        status: 'failed',
                        failure: failure.extractionFailure,
                        rawArtifact: failure.rawArtifact,
                    };
                }
            }
            ledger.fixtureAttempts.push(attempt);

            const representationDetails = {};
            for (const converter of running) {
                const result = results[converter.label];
                if (result === undefined) continue;
                const derived = deriveRepresentation(identity, bytes, fixture, converter, result.text);
                const representation = {
                    id: derived.representationId,
                    sourceVersionId: derived.sourceVersionId,
                    artifactId: derived.artifactId,
                    contentHash: fixture.sha256,
                    objectKey: 'conversions/' + fixture.sha256 + '/' + converter.version + '.md',
                    contentType: 'text/markdown',
                    converterRef: converter.image,
                    text: result.text,
                    createdAt: '2026-09-08T00:00:00.000Z',
                };
                await store.persistRepresentation(representation);
                representationDetails[converter.label] = {
                    id: representation.id,
                    sourceVersionId: representation.sourceVersionId,
                    artifactId: representation.artifactId,
                    converterRef: representation.converterRef,
                    textSha256: sha256(result.text),
                    textLength: result.text.length,
                    rawArtifact: result.rawArtifact,
                    representationArtifact: result.representationArtifact,
                };
            }

            if (results.A === undefined || results.B === undefined) {
                ledger.fixturesDetail.push({ ...attempt, representations: representationDetails, anchors: [], tableFidelity: rawTableFidelity });
                continue;
            }

            const derivedA = deriveRepresentation(identity, bytes, fixture, converters[0], results.A.text);
            const derivedB = deriveRepresentation(identity, bytes, fixture, converters[1], results.B.text);
            if (derivedA.sourceVersionId !== derivedB.sourceVersionId) {
                throw new Error('converter representations changed source identity for ' + fixture.path);
            }
            let selected;
            try {
                selected = selectAnchors(results.A.text, fixture.path);
            } catch (error) {
                ledger.anchorSelectionFailures.push({
                    fixture: fixture.path,
                    message: describeError(error),
                });
                ledger.fixturesDetail.push({ ...attempt, representations: representationDetails, anchors: [], tableFidelity: rawTableFidelity });
                continue;
            }

            const hintsA = coordinateHints(results.A.jsonContent);
            const hintsB = coordinateHints(results.B.jsonContent);
            const fixtureAnchors = [];
            const previous = {
                sourceVersionId: derivedA.sourceVersionId,
                artifactId: derivedA.artifactId,
                text: results.A.text,
            };
            const next = {
                sourceVersionId: derivedB.sourceVersionId,
                artifactId: derivedB.artifactId,
                text: results.B.text,
            };
            for (const [index, span] of selected.entries()) {
                const anchorText = results.A.text.slice(span.start, span.end);
                const coordinatesA = fixture.kind === 'csv' ? [] : coordinatesForQuote(anchorText, hintsA);
                const coordinatesB = fixture.kind === 'csv' ? [] : coordinatesForQuote(anchorText, hintsB);
                const anchor = createFragmentAnchor(previous, [span], coordinatesA);
                const observedResult = remapFragmentAnchor(anchor, previous, next, coordinatesB);
                const oracleResult = independentOracle(anchorText, results.B.text);
                increment(matrix, observedResult.outcome, oracleResult.outcome);
                const anchorId = fixture.sha256.slice(0, 12) + '-a' + (index + 1);
                const storedAnchor = {
                    id: anchorId,
                    projectId: baselineProjectId,
                    representationId: derivedA.representationId,
                    sourceVersionId: anchor.sourceVersionId,
                    artifactId: anchor.artifactId,
                    spans: anchor.spans,
                    quote: anchor.quote,
                    coordinates: anchor.coordinates,
                    confidence: anchor.confidence,
                    createdAt: '2026-09-08T00:00:00.000Z',
                };
                await store.saveAnchor(storedAnchor);
                const record = {
                    id: anchorId,
                    fixture: fixture.path,
                    representationIdA: derivedA.representationId,
                    representationIdB: derivedB.representationId,
                    anchorSpanA: span,
                    anchorTextA: anchorText,
                    coordinatesA,
                    observed: observedResult.outcome,
                    oracle: oracleResult.outcome,
                    oracleCandidates: oracleResult.candidates,
                    candidateCountObserved: observedResult.candidates.length,
                    observedCandidateQuotes: observedResult.candidates.map(candidate => candidate.inspectable.exact),
                    falseExact: observedResult.outcome === 'exact' && oracleResult.outcome !== 'exact',
                    reviewStatus: observedResult.outcome === oracleResult.outcome && observedResult.outcome === 'exact'
                        ? 'not-required'
                        : 'required',
                };
                ledger.anchors.push(record);
                fixtureAnchors.push(record);
            }
            ledger.fixturesDetail.push({
                ...attempt,
                representations: representationDetails,
                anchors: fixtureAnchors,
                coordinateHintCount: { A: hintsA.length, B: hintsB.length },
                tableFidelity: rawTableFidelity,
            });
        }

        const reopenedAnchors = await store.listAnchors(baselineProjectId);
        const exactReopenFailures = [];
        for (const stored of reopenedAnchors) {
            const representation = await store.getRepresentation(stored.representationId);
            if (representation === undefined) {
                exactReopenFailures.push({ anchorId: stored.id, reason: 'representation was not returned after reopen' });
                continue;
            }
            const reopened = createFragmentAnchor(representation, stored.spans, stored.coordinates ?? []);
            const result = remapFragmentAnchor(reopened, representation, representation, stored.coordinates ?? []);
            if (result.outcome === 'exact' && JSON.stringify(reopened.quote) === JSON.stringify(stored.quote)) {
                ledger.persistence.exactReopenChecks += 1;
            } else {
                exactReopenFailures.push({ anchorId: stored.id, reason: result.reason ?? 'stored quote did not reopen exactly' });
            }
        }
        ledger.persistence.exactReopenFailures = exactReopenFailures;
        ledger.persistence.representationsPersisted = representationCount(ledger.fixturesDetail);
        ledger.persistence.anchorsPersisted = reopenedAnchors.length;

        const transferResults = [];
        for (const fixture of manifest.fixtures) {
            transferResults.push(await transferService.transfer({
                sourceProjectId: baselineProjectId,
                targetProjectId: transferProjectId,
                contentHash: fixture.sha256,
                occurredAt: '2026-09-08T00:00:00.000Z',
            }));
        }
        ledger.transfer.allowed = transferResults;
        const deniedHash = 'd'.repeat(64);
        const deniedSource = sourceRecord({ ...manifest.fixtures[0], sha256: deniedHash, path: 'policy-denied-fixture.pdf', kind: 'policy-probe' }, false);
        await sourceStore.persistSource(deniedSource);
        const beforeDenied = await store.listProjectSourceHashes(transferProjectId);
        const denied = await transferService.transfer({
            sourceProjectId: baselineProjectId,
            targetProjectId: transferProjectId,
            contentHash: deniedHash,
            occurredAt: '2026-09-08T00:00:00.000Z',
        });
        const afterDenied = await store.listProjectSourceHashes(transferProjectId);
        ledger.transfer.denied = {
            result: denied,
            targetMembershipUnchanged: JSON.stringify(beforeDenied) === JSON.stringify(afterDenied),
        };

        const transferredAnchors = await store.listAnchors(transferProjectId);
        const transferReopenFailures = [];
        for (const stored of transferredAnchors) {
            const representation = await store.getRepresentation(stored.representationId);
            if (representation === undefined) {
                transferReopenFailures.push({ anchorId: stored.id, reason: 'transferred representation missing' });
                continue;
            }
            const reopened = createFragmentAnchor(representation, stored.spans, stored.coordinates ?? []);
            const result = remapFragmentAnchor(reopened, representation, representation, stored.coordinates ?? []);
            if (result.outcome === 'exact') {
                ledger.persistence.afterTransferExactReopenChecks += 1;
            } else {
                transferReopenFailures.push({ anchorId: stored.id, reason: result.reason ?? 'transfer reopen was not exact' });
            }
        }
        ledger.persistence.afterTransferReopenFailures = transferReopenFailures;
        ledger.persistence.transferredAnchorRecords = transferredAnchors.length;
        ledger.persistence.transferSourceHashes = await store.listProjectSourceHashes(transferProjectId);

        ledger.falseExact = matrix.exact.ambiguous + matrix.exact.unresolved;
        const scannedFailures = ledger.failures.filter(failure => {
            const fixture = manifest.fixtures.find(candidate => candidate.path === failure.fixture);
            return fixture?.kind === 'scanned';
        });
        const unexpectedFailures = ledger.failures.filter(failure => !scannedFailures.includes(failure));
        const pdfAnchors = ledger.anchors.filter(anchor => !anchor.fixture.endsWith('.csv'));
        const pdfAnchorsWithoutCoordinates = pdfAnchors.filter(anchor => anchor.coordinatesA.length === 0);
        const csvDetails = ledger.fixturesDetail.filter(fixture => fixture.path.endsWith('.csv'));
        const tables = csvDetails.map(fixture => fixture.tableFidelity).filter(table => table !== undefined);
        const tableFidelityValid = tables.length === 2
            && tables.every(tableFidelityIsComplete)
            && tables.some(table => table.headers.some(hasNonAscii) || table.rows.some(row => row.cells.some(cell => hasNonAscii(cell.rawText))));
        ledger.criteria = {
            exactly20FixturesAttempted: ledger.fixtureAttempts.length === 20,
            twoGenuinelyPinnedConverters: ledger.converters.length === 2 && ledger.converters.every(converter => converter.status === 'ready' && converter.image.includes('@sha256:')),
            atLeast100RealAnchorsFromA: ledger.anchors.length >= 100,
            originalRepresentationsReopenExactly: ledger.persistence.exactReopenChecks === ledger.anchors.length && exactReopenFailures.length === 0,
            transferredAnchorsReopenExactly: ledger.persistence.afterTransferExactReopenChecks === ledger.anchors.length && transferReopenFailures.length === 0,
            pageCoordinatesAndQuotesInspectable: pdfAnchors.length > 0 && pdfAnchorsWithoutCoordinates.length === 0 && ledger.anchors.every(anchor => anchor.anchorTextA.length > 0),
            rawTypedCsvFidelityRetained: tableFidelityValid,
            extractionFailuresVisibleAndActionable: ledger.failures.every(failure => extractionFailureSchema.safeParse(failure.extractionFailure).success),
            onlyDeclaredScannedFailures: unexpectedFailures.length === 0,
            independentClassificationsAndMatrixRecorded: ledger.anchors.length > 0 && Object.values(matrix).every(row => Object.values(row).every(value => Number.isInteger(value))),
            zeroFalseExact: ledger.falseExact === 0,
        };
        ledger.status = Object.values(ledger.criteria).every(Boolean) ? 'qualified' : 'NO-GO';
        ledger.architectureDecision = makeArchitectureDecision(ledger);
        ledger.reviewQueue = ledger.anchors.filter(anchor => anchor.reviewStatus === 'required');
        if (ledger.status !== 'qualified') {
            throw new Error('N4 V2 qualification NO-GO: ' + ledger.falseExact + ' false-exact classifications or unmet criteria');
        }
    } catch (error) {
        failedRun = describeError(error);
        ledger.runFailure = failedRun;
        ledger.status = 'NO-GO';
        ledger.architectureDecision = makeArchitectureDecision(ledger);
    } finally {
        running.forEach(stopConverter);
        ledger.generatedAt = new Date().toISOString();
        ledger.timing = { totalMs: Date.now() - Date.parse(ledger.startedAt) };
        writeFileSync(path.join(output, 'qualification-ledger.json'), JSON.stringify(ledger, null, 2) + '\n');
    }

    if (ledger.status === 'qualified') {
        console.log('N4 V2 qualification passed: ' + ledger.anchors.length + ' real anchors, false-exact=' + ledger.falseExact + '.');
    } else {
        console.error('N4 V2 qualification NO-GO. Ledger: ' + relativePath(path.join(output, 'qualification-ledger.json')));
        if (failedRun !== undefined) console.error(failedRun);
        process.exitCode = 1;
    }
}

function representationCount(fixtures) {
    return fixtures.reduce((count, fixture) => count + Object.keys(fixture.representations ?? {}).length, 0);
}

main().catch(error => {
    console.error(describeError(error));
    process.exitCode = 1;
});
