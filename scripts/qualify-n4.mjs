// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = path.join(root, 'fixtures', 'n4');
const output = path.join(root, 'artifacts', 'n4');
const manifest = JSON.parse(readFileSync(path.join(corpus, 'manifest.json'), 'utf8'));
const converters = [
    { label: 'A', version: 'v1.21.0', image: 'quay.io/docling-project/docling-serve:v1.21.0@sha256:32b3de41f325f93c1dd35907cd9147fa35df9f7c5abc86eb2788b6bda7ce6d10', port: 5101 },
    { label: 'B', version: 'v1.22.0', image: 'quay.io/docling-project/docling-serve:v1.22.0@sha256:8880b8f5a511b1d93edb22a2e2e7380461657a0401febb4e43f7e41ef9d9661c', port: 5102 },
];

if (manifest.fixtures.length !== 20 || manifest.fixtures.filter(fixture => fixture.kind === 'scanned').length !== 2) {
    throw new Error('N4 qualification requires exactly 20 fixtures including exactly two scanned PDFs.');
}
for (const fixture of manifest.fixtures) {
    const digest = createHash('sha256').update(readFileSync(path.join(corpus, fixture.path))).digest('hex');
    if (digest !== fixture.sha256) throw new Error(`N4 fixture digest mismatch: ${fixture.path}`);
}

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function docker(args, options = {}) { return execFileSync('docker', args, { cwd: root, encoding: 'utf8', stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'] }).trim(); }

function ensureImage(converter) {
    docker(['pull', converter.image], { stdio: 'inherit' });
    const repoDigests = JSON.parse(docker(['image', 'inspect', converter.image, '--format', '{{json .RepoDigests}}']));
    const expected = converter.image.slice(converter.image.indexOf('@'));
    if (!repoDigests.some(digest => digest.endsWith(expected))) throw new Error(`${converter.label} image digest mismatch: ${repoDigests.join(', ')}`);
}

function startConverter(converter) {
    const name = `ivory-n4-${converter.label.toLowerCase()}-${process.pid}`;
    try { docker(['rm', '--force', name], { stdio: 'ignore' }); } catch { /* absent */ }
    docker(['run', '--pull=never', '--detach', '--name', name, '--publish', `${converter.port}:5001`, converter.image]);
    return { ...converter, name };
}
function stopConverter(converter) { try { docker(['rm', '--force', converter.name], { stdio: 'ignore' }); } catch { /* best effort */ } }

async function waitForConverter(converter) {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
        try { if ((await fetch(`http://127.0.0.1:${converter.port}/health`)).ok) return; } catch { /* model loading */ }
        await new Promise(resolve => setTimeout(resolve, 2_000));
    }
    throw new Error(`Timed out waiting for converter ${converter.label}`);
}

async function convert(converter, fixture, bytes) {
    const form = new FormData();
    form.append('files', new Blob([bytes], { type: fixture.path.endsWith('.csv') ? 'text/csv' : 'application/pdf' }), path.basename(fixture.path));
    form.append('to_formats', 'md');
    const response = await fetch(`http://127.0.0.1:${converter.port}/v1/convert/file`, { method: 'POST', body: form });
    const body = await response.json();
    if (!response.ok || body.status === 'failure') throw new Error(`${converter.label} conversion failed for ${fixture.path}: HTTP ${response.status}`);
    const text = body.document?.md_content ?? body.document?.text_content;
    if (typeof text !== 'string' || text.length === 0) throw new Error(`${converter.label} returned no text for ${fixture.path}`);
    return text;
}

function selectAnchors(text, fixturePath) {
    const result = []; const seen = new Set();
    for (const match of text.matchAll(/[^\n]{24,240}/gu)) {
        const exact = match[0].trim(); const start = match.index + match[0].indexOf(exact);
        if (exact.length < 24 || seen.has(exact)) continue;
        seen.add(exact); result.push({ start, end: start + exact.length, fixturePath });
        if (result.length === 5) break;
    }
    if (result.length < 5) throw new Error(`Only ${result.length} real anchor candidates found for ${fixturePath}`);
    return result;
}
function normalize(text) { return text.normalize('NFC').trim().replace(/\s+/gu, ' '); }

/** Independent oracle: it deliberately does not call the production remapper. */
function oracle(anchorText, nextText) {
    const exact = normalize(anchorText); const normalized = normalize(nextText); const hits = [];
    let from = 0;
    while (exact.length > 0) { const hit = normalized.indexOf(exact, from); if (hit < 0) break; hits.push(hit); from = hit + 1; }
    return hits.length === 0 ? 'unresolved' : hits.length === 1 ? 'exact' : 'ambiguous';
}
function increment(matrix, observed, truth) { matrix[observed][truth] += 1; }

async function main() {
    mkdirSync(output, { recursive: true });
    for (const converter of converters) ensureImage(converter);
    const running = converters.map(startConverter);
    try {
        await Promise.all(running.map(waitForConverter));
        const { createFragmentAnchor, remapFragmentAnchor } = await import('../packages/ivory-identity/lib/node/fragment-anchor.js');
        const matrix = { exact: { exact: 0, ambiguous: 0, unresolved: 0 }, ambiguous: { exact: 0, ambiguous: 0, unresolved: 0 }, unresolved: { exact: 0, ambiguous: 0, unresolved: 0 } };
        const records = []; const fixtures = []; const failures = [];
        for (const fixture of manifest.fixtures) {
            const bytes = readFileSync(path.join(corpus, fixture.path));
            let textA; let textB;
            try { textA = await convert(running[0], fixture, bytes); textB = await convert(running[1], fixture, bytes); }
            catch (error) {
                failures.push({ fixture: fixture.path, message: error instanceof Error ? error.message : String(error) });
                continue;
            }
            const previous = { sourceVersionId: `sv_${fixture.sha256}`, artifactId: `art_${sha256(textA)}`, text: textA, converterRef: running[0].image, contentHash: fixture.sha256 };
            const next = { sourceVersionId: `sv_${fixture.sha256}`, artifactId: `art_${sha256(textB)}`, text: textB, converterRef: running[1].image, contentHash: fixture.sha256 };
            let selected;
            try { selected = selectAnchors(textA, fixture.path); }
            catch (error) {
                failures.push({ fixture: fixture.path, message: error instanceof Error ? error.message : String(error) });
                continue;
            }
            const fixtureRecord = { path: fixture.path, sha256: fixture.sha256, representations: { A: { artifactId: previous.artifactId, textSha256: sha256(textA), converterRef: previous.converterRef, textLength: textA.length }, B: { artifactId: next.artifactId, textSha256: sha256(textB), converterRef: next.converterRef, textLength: textB.length } }, anchors: [] };
            for (const [index, span] of selected.entries()) {
                const anchor = createFragmentAnchor(previous, [span]);
                const anchorText = textA.slice(span.start, span.end);
                const observedResult = remapFragmentAnchor(anchor, previous, next);
                const observed = observedResult.outcome; const truth = oracle(anchorText, textB);
                increment(matrix, observed, truth);
                const record = { id: `${fixture.sha256.slice(0, 12)}-a${index + 1}`, fixture: fixture.path, anchorSpanA: span, observed, truth, candidateCountObserved: observedResult.candidates.length, falseExact: observed === 'exact' && truth !== 'exact', reviewStatus: observed === truth ? 'not-required' : 'required' };
                records.push(record); fixtureRecord.anchors.push(record);
            }
            fixtures.push(fixtureRecord);
        }
        const falseExact = matrix.exact.ambiguous + matrix.exact.unresolved;
        const ledger = { schemaVersion: 2, generatedAt: new Date().toISOString(), fixtures: manifest.fixtures.length, convertedFixtures: fixtures.length, anchors: records.length, converters: running.map(({ label, version, image, port }) => ({ label, version, image, port })), classification: { observedByRemapper: true, truthByIndependentOracle: true, reviewPolicy: 'review every disagreement and every ambiguous or unresolved result' }, matrix, falseExact, failures, status: falseExact === 0 && records.length >= 100 && failures.length === 0 ? 'qualified' : 'NO-GO', fixturesDetail: fixtures, reviewQueue: records.filter(record => record.reviewStatus === 'required') };
        writeFileSync(path.join(output, 'qualification-ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);
        if (ledger.status !== 'qualified') throw new Error(`N4 qualification ${ledger.status}: ${falseExact} false-exact classifications`);
        console.log(`N4 qualification passed: ${fixtures.length} fixtures, ${records.length} real anchors, false-exact=${falseExact}.`);
    } finally { running.forEach(stopConverter); }
}
main().catch(error => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
