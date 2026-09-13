// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// @ts-check
/**
 * Roll-up of the N1..N7 spike gates (ADR-003 rule 6).
 * Run via: npm run verify:ivory-n-gates [-- --require-closed N1,N2] [--require-pass]
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG_FILE = path.join(ROOT, 'configs', 'ivory-n-gates.json');

function valueAt(object, dotPath) {
    let current = object;
    for (const key of dotPath.split('.')) {
        if (current === null || typeof current !== 'object' || !(key in current)) return undefined;
        current = current[key];
    }
    return current;
}

function statusLine(text, prefix) {
    const line = text
        .split(/\r?\n/)
        .map(candidate => candidate.trim())
        .find(candidate => candidate.startsWith(prefix));
    return line === undefined ? undefined : line.slice(prefix.length).trim();
}

/**
 * Gate ids that were required but are not declared by the manifest.
 * Pure so the CLI contract is testable without spawning a process.
 */
export function unknownGateIds(gates, ids) {
    const known = new Set(gates.map(gate => gate.id));
    const seen = new Set();
    return ids.filter(id => {
        if (known.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

export function evaluateGates(config, options = {}) {
    const root = options.root ?? ROOT;
    const readJson = options.readJson ?? (relative => JSON.parse(readFileSync(path.join(root, relative), 'utf8')));
    const readText = options.readText ?? (relative => readFileSync(path.join(root, relative), 'utf8'));
    const exists = options.exists ?? (relative => existsSync(path.join(root, relative)));

    return (config.gates ?? []).map(gate => {
        const record = {
            id: gate.id,
            title: gate.title,
            evidence: gate.evidence,
            observations: {},
            open: [],
            missing: [],
            mismatches: [],
        };

        if (gate.evidence === undefined) {
            record.closed = true;
        } else if (!exists(gate.evidence)) {
            record.missing.push(gate.evidence);
        } else {
            const evidence = readJson(gate.evidence);
            for (const [label, dotPath] of Object.entries(gate.observations ?? {})) {
                record.observations[label] = valueAt(evidence, dotPath);
            }
            for (const condition of gate.closedWhen ?? []) {
                const observed = valueAt(evidence, condition.path);
                if (observed !== condition.equals) {
                    record.open.push(`${condition.path} is ${JSON.stringify(observed)}, needs ${JSON.stringify(condition.equals)}`);
                }
            }
        }
        record.closed = record.missing.length === 0 && record.open.length === 0;

        if (record.closed && gate.document !== undefined) {
            if (!exists(gate.document)) {
                record.mismatches.push(`${gate.document} is missing`);
            } else {
                const prefix = gate.documentStatusPrefix ?? '**Status:**';
                const line = statusLine(readText(gate.document), prefix) ?? '';
                if (line === '') {
                    record.mismatches.push(`${gate.document} has no ${prefix} line`);
                } else if (gate.documentOpenPattern !== undefined && new RegExp(gate.documentOpenPattern, 'i').test(line)) {
                    record.mismatches.push(`${gate.document} still says open: ${line}`);
                } else if (gate.documentClosedPattern !== undefined && !new RegExp(gate.documentClosedPattern, 'i').test(line)) {
                    record.mismatches.push(`${gate.document} must say closed: ${line}`);
                }
            }
        }
        return record;
    });
}

export function formatGateTable(gates) {
    const lines = ['| gate | state | evidence | observations |', '|---|---|---|---|'];
    for (const gate of gates) {
        const state = gate.closed ? 'closed' : 'open';
        const detail = [
            ...gate.missing.map(name => `missing ${name}`),
            ...gate.open,
            ...gate.mismatches,
        ].join('; ');
        const observations = Object.entries(gate.observations)
            .map(([label, value]) => `${label}=${JSON.stringify(value)}`)
            .join(', ');
        lines.push(`| ${gate.id} | ${state} | ${gate.evidence ?? '—'} | ${observations}${detail === '' ? '' : ` — ${detail}`} |`);
    }
    return lines.join('\n');
}

function argumentValue(name) {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
}

function main() {
    if (!existsSync(CONFIG_FILE)) {
        process.stderr.write(`N-gate manifest missing: ${path.relative(ROOT, CONFIG_FILE)}\n`);
        process.exitCode = 2;
        return;
    }
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    const gates = evaluateGates(config);
    process.stdout.write(`${formatGateTable(gates)}\n`);

    const closedCount = gates.filter(gate => gate.closed).length;
    process.stdout.write(`${closedCount}/${gates.length} N-gates closed.\n`);

    const mismatches = gates.flatMap(gate => gate.mismatches);
    for (const mismatch of mismatches) process.stderr.write(`MISMATCH: ${mismatch}\n`);

    const required = (argumentValue('--require-closed') ?? '')
        .split(',')
        .map(id => id.trim())
        .filter(id => id !== '');
    const unknown = unknownGateIds(gates, required);
    for (const id of unknown) process.stderr.write(`UNKNOWN GATE: ${id}\n`);

    const requireAll = process.argv.includes('--require-pass');
    const notClosed = gates.filter(gate => (requireAll || required.includes(gate.id)) && !gate.closed);
    for (const gate of notClosed) process.stderr.write(`REQUIRED: gate ${gate.id} is not closed\n`);

    process.exitCode = mismatches.length > 0 || notClosed.length > 0 || unknown.length > 0 ? 1 : 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
