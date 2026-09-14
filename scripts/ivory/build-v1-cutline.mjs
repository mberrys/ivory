#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REQUIRED_ARGS = ['--source', '--output', '--repository-commit', '--snapshot-at'];
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
    if (process.argv[index].startsWith('--')) args.set(process.argv[index], process.argv[index + 1]);
}
for (const argument of REQUIRED_ARGS) {
    if (!args.get(argument)) throw new Error(`missing ${argument}`);
}

const raw = JSON.parse(fs.readFileSync(path.resolve(args.get('--source')), 'utf8'));
const rows = Array.isArray(raw) ? raw : raw.results;
if (!Array.isArray(rows)) throw new Error('source must be a Notion view export array or { results: [] }');

const urlToId = new Map(rows.map(row => [String(row.url).replace(/\?.*$/, ''), Number(row['userDefined:ID'])]));
const issues = rows
    .filter(row => row.Type !== 'Template')
    .map(row => ({
        id: Number(row['userDefined:ID']),
        title: row.Issue,
        phase: Number(String(row.Phase).replace('Phase ', '')),
        status: row.Status,
        releaseClass: row['Release class'],
        estimate: Number(row.Estimate || 0),
        conditionalTriggered: false,
        blockers: JSON.parse(row['Blocked by'] || '[]').map(url => urlToId.get(String(url).replace(/\?.*$/, ''))).filter(Number.isInteger).sort((a, b) => a - b),
    }))
    .sort((a, b) => a.id - b.id);

const phaseEvidence = {
    1: ['docs/adr-001-application-platform.md', 'docs/adr-002-runtime-topology.md', 'scripts/ivory/verify-v1-cutline.mjs'],
    2: ['examples/ivory-tower-browser/package.json', 'packages/ivory-tower-health/src/package.spec.ts', 'scripts/check-ivory-boundaries.mjs'],
    3: ['packages/ivory-tower-infrastructure/migrations/001_runtime_topology.sql', 'packages/ivory-tower-infrastructure/src/docling-http-conversion-adapter.ts', 'packages/ivory-tower-contracts/src/source-contract.ts'],
    4: ['packages/ivory-identity/src/node/identity.ts', 'packages/ivory-tower-contracts/src/execution-contract.ts', 'packages/ivory-tower-infrastructure/src/schema-readiness.ts'],
    5: ['packages/ivory-tower-infrastructure/src/egress-policy.ts', 'packages/ivory-tower-application/src/execution-service.ts', 'packages/ivory-tower-infrastructure/src/graphile-worker-adapter.ts'],
    6: ['scripts/ivory/evaluate-phase-gates.mjs', '.github/workflows/ci-cd.yml', 'docs/v1-build-vs-open-source.md'],
};
const phaseExitEvidence = {
    1: 'Zero unclassified issues; product, runtime, authorization, provenance, and dependency boundaries are resolved.',
    2: 'Hosted shell, auth/project boundary, shared async states, and accessibility evidence pass.',
    3: 'Supported-content admission, immutable source identity, deterministic conversion diagnostics, and reload-safe anchors pass.',
    4: 'Migrations, provenance-preserving chunks, retrieval evaluation, citation validation, and data normalization pass.',
    5: 'Provider egress, result envelopes, adjudication lineage, protected human records, budgets, and resumable execution pass.',
    6: 'Golden benchmarks, deterministic E2E, security/privacy, accessibility, authorship/export, comprehension, and recovery evidence pass.',
};

const classificationMetadata = rows
    .filter(row => row['Release class'] === 'Conditional')
    .map(row => ({
        issueId: Number(row['userDefined:ID']),
        trigger: 'Product and accessibility review confirms the preference is required for the supported hosted V1 material contract before cutline freeze.',
        evidenceSource: 'IV-129 material-role contract, IV-131 web fallback verification, and hosted appearance-settings accessibility review.',
        decisionOwner: 'Ivory Tower product and design owners with engineering confirmation of the IV-23 adapter boundary.',
        evaluateBy: 'V1 cutline freeze and Phase 2 exit evidence.',
        ifTriggered: 'Reclassify to Required and reconcile IV-129, IV-131, and IV-23.',
        ifNotTriggered: 'Keep Conditional and use the IV-129 default plus IV-131 fallback.',
        downstreamIssuesAffected: ['IV-129', 'IV-131', 'IV-23'],
    }));

const counts = { totalIssues: issues.length, releaseClassCounts: {}, phaseCounts: {}, estimatePointsByClass: {}, estimatePointsByPhase: {} };
for (const issue of issues) {
    counts.releaseClassCounts[issue.releaseClass] = (counts.releaseClassCounts[issue.releaseClass] || 0) + 1;
    counts.phaseCounts[String(issue.phase)] = (counts.phaseCounts[String(issue.phase)] || 0) + 1;
    counts.estimatePointsByClass[issue.releaseClass] = (counts.estimatePointsByClass[issue.releaseClass] || 0) + issue.estimate;
    counts.estimatePointsByPhase[String(issue.phase)] = (counts.estimatePointsByPhase[String(issue.phase)] || 0) + issue.estimate;
}

const manifest = {
    schemaVersion: 1,
    trackerDataSource: 'collection://3af9cb07-9ddb-80fb-bc87-000bf2847490',
    trackerSnapshotAt: args.get('--snapshot-at'),
    repositoryCommit: args.get('--repository-commit'),
    issueIdRange: { min: Math.min(...issues.map(issue => issue.id)), max: Math.max(...issues.map(issue => issue.id)) },
    excludedIssueIds: [1, 2],
    counts,
    classificationMetadata,
    phaseGates: Object.entries(phaseEvidence).map(([phase, evidence]) => ({
        phase: Number(phase),
        exitEvidence: phaseExitEvidence[phase],
        evidence: evidence.map(uri => ({ kind: 'artifact', uri })),
    })),
    issues,
};

fs.mkdirSync(path.dirname(path.resolve(args.get('--output'))), { recursive: true });
fs.writeFileSync(path.resolve(args.get('--output')), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`WROTE  ${args.get('--output')}`);
