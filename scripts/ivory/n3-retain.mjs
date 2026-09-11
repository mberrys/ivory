#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requiredAcceptanceFailures } from './n3-compute.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const N3_RETAIN_SCHEMA = 'ivory-n3-evidence/1';
export const N3_SUPPORT_MATRIX_PENDING = 'open-pending-onboarding';

function argumentValue(name) {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

/**
 * Replace machine-specific absolute paths with stable placeholders. Never
 * touches digests, versions or measurements.
 */
export function sanitize(value, { root = ROOT, home = os.homedir(), temp = os.tmpdir() } = {}) {
    const replacements = [
        [temp, '<tmp>'],
        [home, '<home>'],
        [root, '<repo>'],
    ].flatMap(([needle, placeholder]) => [[needle, placeholder], [needle.replaceAll('\\', '/'), placeholder]]);
    const scrub = text => {
        let current = text;
        for (const [needle, placeholder] of replacements) {
            if (needle.length > 0) {
                current = current.split(needle).join(placeholder);
            }
        }
        return current.replaceAll('\\', '/');
    };
    const walk = node => {
        if (typeof node === 'string') {
            return scrub(node);
        }
        if (Array.isArray(node)) {
            return node.map(walk);
        }
        if (node !== null && typeof node === 'object') {
            return Object.fromEntries(Object.entries(node).map(([key, entry]) => [key, walk(entry)]));
        }
        return node;
    };
    return walk(value);
}

export function qualificationSummary(evidence) {
    const failures = requiredAcceptanceFailures(evidence?.acceptance);
    const status = evidence?.runtime?.status === 'observed' && failures.length === 0
        ? 'runtime-qualified'
        : 'protocol-only';
    return { status, failures };
}

export function buildRecord({ python, r, onboarding, retainedAt = new Date().toISOString(), root = ROOT }) {
    const pythonSummary = qualificationSummary(python);
    const rSummary = qualificationSummary(r);
    const qualified = pythonSummary.status === 'runtime-qualified' && rSummary.status === 'runtime-qualified';
    return {
        schema: N3_RETAIN_SCHEMA,
        status: qualified ? 'runtime-qualified' : 'protocol-only',
        retainedAt,
        gitCommit: python?.gitCommit,
        platform: python?.platform,
        images: { python: python?.image, r: r?.image },
        qualification: {
            python: pythonSummary,
            r: rSummary,
            failures: [...pythonSummary.failures, ...rSummary.failures],
            languageNeutral: qualified && JSON.stringify(python?.runtime?.result) === JSON.stringify(r?.runtime?.result),
        },
        decision: {
            runtimeAdapter: qualified ? 'oci-container-probed' : 'open',
            supportMatrix: onboarding?.observed === true ? 'pilot-decided' : N3_SUPPORT_MATRIX_PENDING,
            publicationStateMachine: 'retained-semantic-protocol',
        },
        onboarding: onboarding ?? null,
        python: sanitize(python, { root }),
        r: sanitize(r, { root }),
    };
}

async function main() {
    const pythonPath = argumentValue('--python');
    const rPath = argumentValue('--r');
    const outPath = argumentValue('--out') ?? path.join(ROOT, 'docs', 'experiments', 'n3-evidence.json');
    if (pythonPath === undefined || rPath === undefined) {
        throw new Error('Usage: n3-retain.mjs --python <python evidence.json> --r <r evidence.json> [--out <path>]');
    }
    const python = JSON.parse(await fs.readFile(path.resolve(ROOT, pythonPath), 'utf8'));
    const r = JSON.parse(await fs.readFile(path.resolve(ROOT, rPath), 'utf8'));
    const record = buildRecord({ python, r });
    const target = path.resolve(ROOT, outPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`${record.status}: ${target}`);
    if (record.status !== 'runtime-qualified') {
        console.error(`N3 is not runtime-qualified; failed checks: ${record.qualification.failures.join(', ') || 'runtime evidence missing'}`);
        process.exitCode = 2;
    }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
