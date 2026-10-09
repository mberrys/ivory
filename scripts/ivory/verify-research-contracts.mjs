// Copyright (C) 2026 Michael Berry and others.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { arch, hostname, platform, release, version } from 'node:os';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '../..');
const contracts = require(resolve(root, 'packages/ivory-contracts/lib/node'));
const fixtures = require(resolve(root, 'packages/ivory-contracts/lib/node/test/n1-fixture'));
const { claimBasis, createRevision, freezeSnapshotBody, IvoryContractError, parseRevision, readResearchGraph, revisionRef,
    validateRevisionTransition, verifyFragment } = contracts;
const { base, buildN1Trace, n1Input } = fixtures;
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--output') {
    throw new Error('usage: node scripts/ivory/verify-research-contracts.mjs --output <new-record.json>');
}
const output = resolve(args[1]);
const ledgerFile = output.replace(/\.json$/, '') + '.ledger.json';
const fixture = buildN1Trace();
const graph = fixture.trace.graph();
const criteria = {};
const ledger = [];
const check = (name, expected, observe) => {
    let observed;
    try {
        observed = observe();
    } catch (error) {
        observed = { error: error.message };
    }
    const pass = contracts.canonicalJson(observed) === contracts.canonicalJson(expected);
    criteria[name] = { pass, gated: true, expected, observed };
    ledger.push({ criterion: name, expected, observed, pass });
};
const refusal = action => {
    try {
        action();
        return 'accepted';
    } catch (error) {
        if (!(error instanceof IvoryContractError)) { throw error; }
        return error.code;
    }
};
const snapshotInput = snapshot => ({ graph, selected: snapshot.body.selected, asOfSeq: snapshot.body.asOfSeq });
const first = claimBasis(snapshotInput(fixture.snapshot1));
const second = claimBasis(snapshotInput(fixture.snapshot2));
check('statement-only-golden-counts', [12, 17], () => [first.members.length, second.members.length]);
check('explicit-link-finding-decision-basis', 4, () => first.basis.length);
check('source-correction-preserves-exact-citation', n1Input.transcript1, () =>
    verifyFragment({ graph, fragment: revisionRef(fixture.fragment1), bytes: Buffer.from(n1Input.transcript1) }).quote);
check('earlier-snapshot-unchanged', fixture.snapshot1.body, () => freezeSnapshotBody({ ...snapshotInput(fixture.snapshot1), label: 'S1' }));
check('explicit-carry-forward-attribution', ['Jordan', 'Maya', 'carried-forward'], () =>
    [fixture.carried.author.id, fixture.carried.initiatedBy.id, fixture.carried.origin.kind]);
check('predecessors-and-corrected-head-excluded', false, () => second.members.some(ref =>
    [fixture.claim1, fixture.challenge1, fixture.replacement, fixture.unrelated].some(revision => contracts.ExactRef.equals(ref, revisionRef(revision)))));
check('refuse-wrong-project', 'cross-project-ref', () => refusal(() => graph.ref({ ...revisionRef(fixture.fragment1), projectId: 'other' }, 'fragment')));
check('refuse-wrong-type', 'wrong-type', () => refusal(() => graph.ref(revisionRef(fixture.fragment1), 'source')));
check('refuse-dangling-ref', 'dangling-ref', () => refusal(() => graph.ref({ ...revisionRef(fixture.fragment1), objectId: 'missing' }, 'fragment')));
check('refuse-latest-exact-ref', 'invalid-exact-ref', () => refusal(() => graph.ref({ ...revisionRef(fixture.fragment1), revisionId: 'latest' }, 'fragment')));
check('refuse-digest-mismatch', 'digest-mismatch', () => refusal(() => parseRevision({ ...fixture.claim1,
    body: { ...fixture.claim1.body, wording: 'Changed under an old revision id.' } })));
const invalidFragment = createRevision({ ...base('bad-selector'), kind: 'fragment', schema: 'fragment@1', body: {
    ...fixture.fragment1.body, selector: { ...fixture.fragment1.body.selector, quote: 'A different quotation.' } } });
const invalidGraph = readResearchGraph(graph.projectId, [...fixture.trace.entries, { seq: 31, revision: invalidFragment }]);
check('refuse-selector-mismatch', 'selector-mismatch', () => refusal(() => verifyFragment({ graph: invalidGraph,
    fragment: revisionRef(invalidFragment), bytes: Buffer.from(n1Input.transcript1) })));
check('refuse-stale-expected-head', 'expected-head-conflict', () => refusal(() => validateRevisionTransition({ revision: fixture.claim2,
    expectedHead: revisionRef(fixture.claim1), currentHead: fixture.claim2 })));
check('returned-revisions-immutable', true, () => Object.isFrozen(fixture.fragment1) && Object.isFrozen(fixture.fragment1.body.selector));
const after = buildN1Trace();
const late = after.trace.append({ ...base('late-link'), kind: 'evidence-link', schema: 'evidence-link@1', body: {
    ...after.support.body, role: 'qualifies', rationale: 'Recorded after the snapshot.' } });
check('post-freeze-link-excluded', false, () => claimBasis({ graph: after.trace.graph(), selected: after.snapshot2.body.selected,
    asOfSeq: after.snapshot2.body.asOfSeq }).members.some(ref => contracts.ExactRef.equals(ref, revisionRef(late))));

const fileDigest = file => 'sha256:' + createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');
const fixtureFiles = [
    'packages/ivory-contracts/test-resources/n1-research-fixture.json',
    'packages/ivory-contracts/test-resources/research-revision-vectors.json',
    'packages/ivory-contracts/test-resources/canonical-json-vectors.json',
    'packages/ivory-contracts/src/node/test/n1-fixture.ts',
    'scripts/ivory/verify-research-contracts.mjs',
    'docs/archive-evidence/adr-004-n1-exact-reference-contract.md',
    'docs/architecture/adr-009-v5-topology.md',
    'docs/architecture/adr-010-v5-typed-decision-seam.md'
];
const git = (...gitArgs) => {
    const result = spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) { throw new Error(`git ${gitArgs[0]} failed`); }
    return result.stdout.trim();
};
const dirty = git('status', '--porcelain').length > 0;
const failReasons = Object.entries(criteria).filter(([, criterion]) => !criterion.pass).map(([name]) => name);
if (dirty) { failReasons.push('dirty-tree'); }
const ledgerText = JSON.stringify(ledger, null, 2) + '\n';
const record = {
    record: 'ivory-research-contracts@1', issue: 'mberrys/ivory-issues#3', gates: ['N1'],
    head: { commit: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'), dirty },
    command: ['node', relative(root, resolve(process.argv[1])).replaceAll('\\', '/'), ...args].join(' '),
    environment: { platform: platform(), osVersion: version(), kernel: release(), arch: arch(), node: process.version,
        python: spawnSync('python', ['--version'], { encoding: 'utf8' }).stdout?.trim() || 'unavailable',
        sqlite: 'not-exercised', filesystem: process.env.GITHUB_ACTIONS ? 'runner workspace; not durability-qualified' : 'NTFS',
        machine: process.env.ImageOS || hostname() },
    fixtures: Object.fromEntries(fixtureFiles.map(file => [file, fileDigest(file)])),
    sources: { fixture: JSON.parse(readFileSync(resolve(root, fixtureFiles[0]), 'utf8')).source },
    criteria, outcome: failReasons.length === 0 ? 'pass' : 'fail', failReasons,
    limits: [
        'P2 pure identity/domain/closure contract only; no authenticated Core command or accepted SQL mutation is exercised.',
        'The archived N1 trace is adapted to V5 representations, findings, decisions and statement-only claim-basis@1 selection.',
        'Selectors cover retained UTF-8 byte spans only; converter, PDF/OCR, remap and contextual-citation qualification remain P5.',
        'Python verifies canonical identities, not domain acceptance, permission checks or researcher presence.',
        'This is not durability, hosted-client parity, capsule import/export or new human interpretation evidence.'
    ],
    ledger: { file: relative(dirname(output), ledgerFile).replaceAll('\\', '/'), rows: ledger.length,
        sha256: 'sha256:' + createHash('sha256').update(ledgerText).digest('hex') }
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(ledgerFile, ledgerText, { flag: 'wx' });
writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ head: record.head, outcome: record.outcome, criteria: ledger.length, failReasons }) + '\n');
process.exitCode = failReasons.length === 0 ? 0 : 1;
