// @ts-check
// *****************************************************************************
// Copyright (C) 2026 Berry Studio and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Verifies and regenerates §7 of `docs/iv-8-product-model.md`, the IV-8 traceability matrix.
 *
 * The matrix claims that every phased issue in the Notion tracker maps to a lifecycle stage,
 * its primary objects, and a release gate or an explicit post-v1 deferral. That claim is only
 * worth making if it is checked, so the table is generated from data and validated rather than
 * maintained by hand.
 *
 *   node scripts/verify-product-model.js            # verify; non-zero exit on drift or defect
 *   node scripts/verify-product-model.js --write    # regenerate the table in the document
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'product-model');
const DOCUMENT = path.join(ROOT, 'docs', 'iv-8-product-model.md');

const BEGIN = '<!-- BEGIN GENERATED: traceability -->';
const END = '<!-- END GENERATED: traceability -->';

/**
 * Ground truth observed from the Notion issue tracker (data source
 * `3af9cb07-9ddb-80fb-bc87-000bf2847490`) on 2026-08-02. Refresh deliberately, never to make a
 * failing check pass: a mismatch means the tracker moved and the matrix owes it a row.
 */
const TRACKER = {
    totalRows: 126,
    distinctIds: 126,
    minId: 1,
    maxId: 127,
    templateId: 1,
    absentId: 2,
    phasedTotal: 125,
    phaseCounts: { 1: 23, 2: 9, 3: 11, 4: 17, 5: 30, 6: 19, 7: 16 }
};

/** The seven stages of §3.1. `Foundation` is the non-researcher-facing engineering stage. */
const STAGES = ['Foundation', 'Discover', 'Validate', 'Organize', 'Analyze', 'Communicate', 'Publish'];

/** The sixteen core objects of §2.2. */
const CORE_OBJECTS = [
    'Project', 'Corpus', 'Source', 'SourceVersion', 'Passage', 'Entity', 'Event', 'Concept',
    'Claim', 'EvidenceLink', 'Contradiction', 'Interpretation', 'Citation', 'Execution',
    'Artifact', 'VisualizationSpec'
];

/** The object names contributed by the thirteen extended families of §2.3. */
const EXTENDED_OBJECTS = [
    'Protocol', 'Posture', 'Observation', 'ProtectedRecord', 'ModelContribution', 'Connection',
    'Warrant', 'ContestedAssertion', 'SurveyInstrument', 'Codebook', 'Dataset', 'AnalysisSpec',
    'AnalysisResult', 'Annotation', 'Adjudication', 'ExportSnapshot'
];

const VOCABULARY = new Set([...CORE_OBJECTS, ...EXTENDED_OBJECTS]);

/** Release gates, keyed by phase. Phase 7 is the explicit post-v1 deferral. */
const GATES = {
    1: 'G1 — product & architecture contract',
    2: 'G2 — application shell',
    3: 'G3 — source ingestion & inspection',
    4: 'G4 — corpus, retrieval & provenance',
    5: 'G5 — cited research workflow',
    6: 'G6 — visualization, verification & release evidence',
    7: 'Deferred — post-v1'
};

const write = process.argv.includes('--write');
const failures = [];

/**
 * @param {string} label
 * @param {boolean} ok
 * @param {string} [detail]
 */
function check(label, ok, detail) {
    if (!ok) {
        failures.push(label);
    }
    const suffix = !ok && detail ? ` — ${detail}` : '';
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${suffix}`);
}

const issues = JSON.parse(fs.readFileSync(path.join(DATA, 'issues.json'), 'utf8'))
    .map(([id, phase, title]) => ({ id, phase, title }));
const assignments = JSON.parse(fs.readFileSync(path.join(DATA, 'assignments.json'), 'utf8'));

// --- Coverage against the tracker ------------------------------------------------------------

check('row count equals the tracker\'s phased-issue count',
    issues.length === TRACKER.phasedTotal, `got ${issues.length}, expected ${TRACKER.phasedTotal}`);

const ids = issues.map(issue => issue.id);
check('no duplicate issue ids', new Set(ids).size === ids.length,
    `${ids.length - new Set(ids).size} duplicate(s)`);

check('the issue template is excluded', !ids.includes(TRACKER.templateId));
check(`IV-${TRACKER.absentId} is absent, matching the tracker`, !ids.includes(TRACKER.absentId));

const expectedIds = [];
for (let n = TRACKER.minId; n <= TRACKER.maxId; n++) {
    if (n !== TRACKER.templateId && n !== TRACKER.absentId) {
        expectedIds.push(n);
    }
}
const missing = expectedIds.filter(n => !ids.includes(n));
const unexpected = ids.filter(n => !expectedIds.includes(n));
check('no gaps against the tracker id range', missing.length === 0, `missing IV-${missing.join(', IV-')}`);
check('no ids outside the tracker', unexpected.length === 0, `unexpected IV-${unexpected.join(', IV-')}`);

const observedPhases = {};
for (const issue of issues) {
    observedPhases[issue.phase] = (observedPhases[issue.phase] || 0) + 1;
}
for (const [phase, expected] of Object.entries(TRACKER.phaseCounts)) {
    check(`phase ${phase} count matches the tracker`, observedPhases[phase] === expected,
        `got ${observedPhases[phase] || 0}, expected ${expected}`);
}

// --- Assignment integrity --------------------------------------------------------------------

const unassigned = issues.filter(issue => !assignments[String(issue.id)]);
check('every issue carries a stage and primary objects', unassigned.length === 0,
    `unassigned: IV-${unassigned.map(issue => issue.id).join(', IV-')}`);

const orphaned = Object.keys(assignments).filter(key => !ids.includes(Number(key)));
check('no assignment without a matching issue', orphaned.length === 0, `orphaned: IV-${orphaned.join(', IV-')}`);

const badStages = issues.filter(issue => !STAGES.includes((assignments[String(issue.id)] || [])[0]));
check('every stage is one of the seven defined in §3.1', badStages.length === 0,
    `IV-${badStages.map(issue => issue.id).join(', IV-')}`);

const undefinedObjects = [];
for (const issue of issues) {
    const cell = (assignments[String(issue.id)] || [])[1] || '';
    if (cell === 'all' || cell === '—') {
        continue;
    }
    for (const name of cell.split(',').map(part => part.trim()).filter(Boolean)) {
        if (!VOCABULARY.has(name)) {
            undefinedObjects.push(`IV-${issue.id}:${name}`);
        }
    }
}
check('every object named in §7 is defined in the §2 vocabulary', undefinedObjects.length === 0,
    undefinedObjects.join(', '));

check('the core vocabulary contains exactly 16 objects', CORE_OBJECTS.length === 16,
    `got ${CORE_OBJECTS.length}`);

// --- Render and compare ----------------------------------------------------------------------

const rows = issues.slice().sort((a, b) => a.id - b.id).map(issue => {
    const [stage, objects] = assignments[String(issue.id)];
    return `| IV-${issue.id} | ${issue.title} | ${stage} | ${objects === 'all' ? '*all*' : objects} | ${GATES[issue.phase]} |`;
});

const table = [
    BEGIN,
    '',
    '| Issue | Title | Stage | Primary objects | Gate |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    END
].join('\n');

const document = fs.readFileSync(DOCUMENT, 'utf8');
const start = document.indexOf(BEGIN);
const finish = document.indexOf(END);

if (start === -1 || finish === -1) {
    check('the document contains the generated-section markers', false, `expected ${BEGIN} … ${END}`);
} else {
    const current = document.slice(start, finish + END.length);
    if (write) {
        if (current !== table) {
            fs.writeFileSync(DOCUMENT, document.slice(0, start) + table + document.slice(finish + END.length));
            console.log('\nRewrote the traceability matrix in docs/iv-8-product-model.md');
        } else {
            console.log('\nTraceability matrix already up to date');
        }
    } else {
        check('the published matrix matches the data', current === table,
            'run `node scripts/verify-product-model.js --write` to regenerate');
    }
}

// --- Summary ---------------------------------------------------------------------------------

const byStage = {};
const byGate = {};
for (const issue of issues) {
    const stage = assignments[String(issue.id)][0];
    byStage[stage] = (byStage[stage] || 0) + 1;
    byGate[GATES[issue.phase]] = (byGate[GATES[issue.phase]] || 0) + 1;
}

console.log('\nBy stage:');
for (const stage of STAGES) {
    console.log(`  ${stage.padEnd(12)} ${byStage[stage] || 0}`);
}
console.log('\nBy gate:');
for (const gate of Object.values(GATES)) {
    console.log(`  ${gate.padEnd(52)} ${byGate[gate] || 0}`);
}
const deferred = byGate[GATES[7]] || 0;
console.log(`\nCommitted to v1: ${issues.length - deferred}    Deferred post-v1: ${deferred}`);

if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
}
console.log(`\nAll checks passed — ${rows.length} rows.`);
