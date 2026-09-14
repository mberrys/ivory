#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    formatErrors,
    isV1Required,
    readManifest,
    validateManifest,
    V1_PHASES,
} from './cutline-model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifestArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'));
const manifestPath = path.resolve(ROOT, manifestArgument || 'docs/generated/v1-cutline.json');
const requirePass = process.argv.includes('--require-pass');
const manifest = readManifest(manifestPath);
const validation = validateManifest(manifest, { repositoryRoot: ROOT });

if (validation.errors.length > 0) {
    console.error(formatErrors(validation.errors));
    process.exit(1);
}

const results = [];
const structuralFailures = [];
for (const phase of V1_PHASES) {
    const gate = manifest.phaseGates.find(candidate => candidate.phase === phase);
    const requiredIssues = manifest.issues.filter(issue => issue.phase === phase && isV1Required(issue));
    const incompleteIssues = requiredIssues.filter(issue => issue.status !== 'Done').map(issue => `IV-${issue.id}`);
    const missingEvidence = gate.evidence
        .filter(reference => !fs.existsSync(path.resolve(ROOT, reference.uri)))
        .map(reference => reference.uri);
    if (missingEvidence.length > 0) {
        structuralFailures.push(`Phase ${phase}: missing evidence artifact(s): ${missingEvidence.join(', ')}`);
    }
    results.push({
        phase,
        status: incompleteIssues.length === 0 && missingEvidence.length === 0 ? 'PASS' : 'FAIL',
        incompleteIssues,
        evidence: gate.evidence,
        failures: missingEvidence.map(uri => `missing evidence artifact: ${uri}`),
    });
}

console.log(JSON.stringify(results, null, 2));
if (structuralFailures.length > 0 || requirePass && results.some(result => result.status === 'FAIL')) {
    if (structuralFailures.length > 0) console.error(formatErrors(structuralFailures));
    process.exit(1);
}
