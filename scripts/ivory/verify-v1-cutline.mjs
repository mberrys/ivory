#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    formatErrors,
    readManifest,
    validateManifest,
    verifyGeneratedMap,
    writeGeneratedMap,
} from './cutline-model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifestArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'));
const manifestPath = path.resolve(ROOT, manifestArgument || 'docs/generated/v1-cutline.json');
const write = process.argv.includes('--write');
const manifest = readManifest(manifestPath);
const validation = validateManifest(manifest, { repositoryRoot: ROOT });

if (validation.errors.length > 0) {
    console.error(formatErrors(validation.errors));
    process.exit(1);
}

const documentPath = path.join(ROOT, 'docs/v1-build-vs-open-source.md');
if (write) {
    writeGeneratedMap(documentPath, manifest);
    console.log(`WROTE  ${path.relative(ROOT, documentPath)}`);
} else {
    const generated = verifyGeneratedMap(documentPath, manifest);
    if (!generated.ok) {
        console.error('FAIL  generated V1 cutline reconciliation is stale or missing; run `npm run generate:ivory-cutline`');
        process.exit(1);
    }
}

console.log(`PASS  ${validation.computed.totalIssues} tracker issues validated`);
console.log(`PASS  ${validation.computed.releaseClassCounts.Required || 0} Required, ${validation.computed.releaseClassCounts.Conditional || 0} Conditional, ${validation.computed.releaseClassCounts.Experimental || 0} Experimental, ${validation.computed.releaseClassCounts['Post-V1'] || 0} Post-V1`);
