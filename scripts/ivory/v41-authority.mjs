// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// @ts-check
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIGS = {
    heads: 'configs/ivory-v41-authority-heads.json',
    owners: 'configs/ivory-v41-owner-map.json',
    carriers: 'configs/ivory-v41-carrier-matrix.json',
    gates: 'configs/ivory-v41-gates.json',
};
const SHA40 = /^[a-f0-9]{40}$/;
const EXPECTED_HEAD_ROLES = ['detachedBaseline', 'foundationPr', 'selectedDev'];
const EXPECTED_N = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7'];
const REQUIRED_SURFACES = [
    'Source',
    'Fragment',
    'EvidenceLink',
    'Statement',
    'Artifact',
    'Activity',
    'Snapshot',
    'ResearchProtocol',
    'Assessment',
    'ResearchDecisionReceipt',
    'ExecutionReceipt',
    'CAS',
];
const REQUIRED_GATES = ['DURABILITY', 'Q1', 'Q2', 'REPLAY', 'Q3', 'Q4'];

function readJson(root, relative) {
    return JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
}

function workingTreeGitBlobSha(root, relative) {
    const result = spawnSync('git', ['hash-object', `--path=${relative}`, relative], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`git hash-object failed for ${relative}: ${result.stderr.trim()}`);
    }
    return result.stdout.trim();
}

function sorted(values) {
    return [...values].sort();
}

function sameSet(actual, expected) {
    return JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected));
}

function duplicates(values) {
    const seen = new Set();
    const dupes = new Set();
    for (const value of values) {
        if (seen.has(value)) dupes.add(value);
        seen.add(value);
    }
    return [...dupes];
}

function nonEmptyArray(value) {
    return Array.isArray(value) && value.length > 0;
}

function push(condition, errors, message) {
    if (!condition) errors.push(message);
}

function validateHeads(heads, root, options, errors) {
    push(heads.schema === 'ivory-v41-authority-heads/1', errors, 'I01.1: unexpected schema');
    push(heads.issue === 'V41-I01.1', errors, 'I01.1: issue id must be V41-I01.1');
    const roles = (heads.heads ?? []).map(head => head.role);
    push(sameSet(roles, EXPECTED_HEAD_ROLES), errors, 'I01.1: manifest must contain exactly detachedBaseline, foundationPr, and selectedDev');
    push(duplicates(roles).length === 0, errors, `I01.1: duplicate head roles: ${duplicates(roles).join(', ')}`);
    const shas = (heads.heads ?? []).map(head => head.sha);
    for (const head of heads.heads ?? []) {
        push(SHA40.test(head.sha ?? ''), errors, `I01.1: ${head.role ?? 'unknown'} must use an exact 40-character SHA`);
        push(!/latest|current/i.test(head.identity ?? ''), errors, `I01.1: ${head.role ?? 'unknown'} identity must not use latest/current substitution`);
    }
    push(new Set(shas).size === shas.length, errors, 'I01.1: authority heads must be distinct');
    const selected = (heads.heads ?? []).find(head => head.role === heads.selectedAuthorityRole);
    push(heads.selectedAuthorityRole === 'selectedDev', errors, 'I01.1: selected authority must be selectedDev');
    push(selected?.selectable === true, errors, 'I01.1: selectedDev must be the only selectable head');
    push((heads.heads ?? []).filter(head => head.selectable === true).length === 1, errors, 'I01.1: exactly one head may be selectable');
    push(heads.packageInventorySource?.role === 'selectedDev', errors, 'I01.1: package inventory must be sourced from selectedDev');
    push(heads.packageInventorySource?.sha === selected?.sha, errors, 'I01.1: package inventory SHA must equal selectedDev SHA');
    push(heads.packageInventorySource?.mode === 'exact-tree', errors, 'I01.1: package inventory must be exact-tree, never inferred');

    const packages = heads.packages ?? [];
    push(packages.length > 0, errors, 'I01.1: package inventory is empty');
    push(duplicates(packages.map(item => item.name)).length === 0, errors, 'I01.1: package inventory contains duplicate names');
    push(duplicates(packages.map(item => item.path)).length === 0, errors, 'I01.1: package inventory contains duplicate paths');
    for (const item of packages) {
        push(typeof item.name === 'string' && item.name.length > 0, errors, 'I01.1: package entry is missing a name');
        push(typeof item.path === 'string' && item.path.endsWith('/package.json'), errors, `I01.1: ${item.name ?? 'package'} must point to package.json`);
        push(SHA40.test(item.packageJsonGitBlob ?? ''), errors, `I01.1: ${item.name ?? 'package'} must pin package.json git blob SHA`);
        if (options.verifyPackages !== false && typeof item.path === 'string') {
            const fullPath = path.join(root, item.path);
            push(existsSync(fullPath), errors, `I01.1: pinned package manifest is missing: ${item.path}`);
            if (existsSync(fullPath)) {
                const bytes = readFileSync(fullPath);
                let packageJson;
                try {
                    packageJson = JSON.parse(bytes.toString('utf8'));
                } catch {
                    errors.push(`I01.1: pinned package manifest is not valid JSON: ${item.path}`);
                    continue;
                }
                push(packageJson.name === item.name, errors, `I01.1: package name drift at ${item.path}: ${JSON.stringify(packageJson.name)} != ${JSON.stringify(item.name)}`);
                const resolveBlobSha = options.resolvePackageBlobSha ?? workingTreeGitBlobSha;
                let observedBlob;
                try {
                    observedBlob = resolveBlobSha(root, item.path);
                } catch (error) {
                    errors.push(`I01.1: cannot verify pinned package manifest ${item.path}: ${error.message}`);
                    continue;
                }
                push(observedBlob === item.packageJsonGitBlob, errors, `I01.1: package manifest drift at ${item.path}; exact selected-dev blob no longer matches`);
            }
        }
    }

    const nIds = (heads.nEvidence ?? []).map(item => item.id);
    push(sameSet(nIds, EXPECTED_N), errors, 'I01.1: N1-N7 evidence pointers must be complete');
    for (const item of heads.nEvidence ?? []) {
        push(['accepted', 'open', 'inapplicable'].includes(item.classification), errors, `I01.1: ${item.id} has invalid classification`);
        push(['present', 'missing'].includes(item.selectedDevAvailability), errors, `I01.1: ${item.id} must state selected-dev availability`);
        push(typeof item.limit === 'string' && item.limit.length > 0, errors, `I01.1: ${item.id} must record a limitation`);
    }
}

function validateOwners(owners, errors) {
    push(owners.schema === 'ivory-v41-owner-map/1', errors, 'I01.2: unexpected schema');
    push(owners.issue === 'V41-I01.2', errors, 'I01.2: issue id must be V41-I01.2');
    push(owners.dependsOn === 'V41-I01.1', errors, 'I01.2: dependency must remain V41-I01.1');
    push(owners.basisManifest === CONFIGS.heads, errors, 'I01.2: owner map must bind to the exact-head manifest');

    const boundaries = owners.authorityBoundaries ?? {};
    push(boundaries.core?.semanticAuthority === true, errors, 'I01.2: Core must remain the semantic authority');
    push(boundaries.harness?.semanticAuthority === false, errors, 'I01.2: harness cannot become a semantic authority');
    push(boundaries.clients?.semanticAuthority === false, errors, 'I01.2: clients cannot become a semantic authority');
    push(boundaries.recursiveImprovement?.semanticAuthority === false, errors, 'I01.2: recursive-improvement state cannot become a semantic authority');
    push(boundaries.recursiveImprovement?.researchStateSeparatedFromImprovementState === true, errors, 'I01.2: research state and improvement state must stay separate');
    push(boundaries.recursiveImprovement?.mayMutateCore === false, errors, 'I01.2: recursive improvement cannot mutate protected Core authority');

    const surfaces = owners.surfaces ?? [];
    const keys = surfaces.map(surface => surface.canonicalKey);
    push(sameSet(keys, REQUIRED_SURFACES), errors, 'I01.2: owner map must contain every required canonical surface exactly once');
    push(duplicates(keys).length === 0, errors, `I01.2: duplicate canonical surfaces: ${duplicates(keys).join(', ')}`);
    for (const surface of surfaces) {
        push(typeof surface.owner === 'string' && surface.owner.length > 0, errors, `I01.2: ${surface.canonicalKey ?? 'surface'} has no canonical owner`);
        push(typeof surface.carrier === 'string' && surface.carrier.length > 0, errors, `I01.2: ${surface.canonicalKey ?? 'surface'} has no structural carrier`);
        push(Array.isArray(surface.missingFields), errors, `I01.2: ${surface.canonicalKey ?? 'surface'} must explicitly list missing fields, even when empty`);
    }
    const forbidden = new Set(owners.forbiddenDuplicateAuthorities ?? []);
    for (const key of keys) {
        push(!forbidden.has(key), errors, `I01.2: forbidden duplicate authority surfaced as canonical: ${key}`);
    }
}

function validateCarriers(carriers, errors) {
    push(carriers.schema === 'ivory-v41-carrier-matrix/1', errors, 'I01.3: unexpected schema');
    push(carriers.issue === 'V41-I01.3', errors, 'I01.3: issue id must be V41-I01.3');
    push(carriers.dependsOn === 'V41-I01.2', errors, 'I01.3: dependency must remain V41-I01.2');
    const lessons = carriers.lessons ?? [];
    const ids = lessons.map(lesson => lesson.id);
    push(sameSet(ids, EXPECTED_N), errors, 'I01.3: carrier matrix must cover N1-N7 exactly once');
    push(duplicates(ids).length === 0, errors, `I01.3: duplicate lesson ids: ${duplicates(ids).join(', ')}`);
    for (const lesson of lessons) {
        const hasCarrier = lesson.carrier !== undefined;
        const hasGap = lesson.ownedGap !== undefined;
        push(hasCarrier !== hasGap, errors, `I01.3: ${lesson.id} must have exactly one structural carrier or owned gap`);
        push(typeof lesson.predicate === 'string' && lesson.predicate.length > 0, errors, `I01.3: ${lesson.id} is missing a predicate`);
        push(typeof lesson.fixture === 'string' && lesson.fixture.length > 0, errors, `I01.3: ${lesson.id} is missing a fixture pointer`);
        push(typeof lesson.gate === 'string' && lesson.gate.length > 0, errors, `I01.3: ${lesson.id} is missing a gate`);
        push(typeof lesson.limit === 'string' && lesson.limit.length > 0, errors, `I01.3: ${lesson.id} is missing a platform/operator/evidence limit`);
        if (hasCarrier) push(typeof lesson.carrier.owner === 'string' && lesson.carrier.owner.length > 0, errors, `I01.3: ${lesson.id} carrier has no owner`);
        if (hasGap) push(typeof lesson.ownedGap.issue === 'string' && lesson.ownedGap.issue.startsWith('V41-I'), errors, `I01.3: ${lesson.id} owned gap must point to an executable V41-I issue`);
    }
}

function validateGates(gates, errors) {
    push(gates.schema === 'ivory-v41-gates/1', errors, 'I01.4: unexpected schema');
    push(gates.issue === 'V41-I01.4', errors, 'I01.4: issue id must be V41-I01.4');
    push(gates.dependsOn === 'V41-I01.3', errors, 'I01.4: dependency must remain V41-I01.3');
    push(gates.initialState === 'not-run', errors, 'I01.4: registry must start at Not run');
    push(gates.aggregatePass === undefined, errors, 'I01.4: aggregate pass flags are forbidden');
    const rows = gates.gates ?? [];
    const ids = rows.map(gate => gate.id);
    push(sameSet(ids, REQUIRED_GATES), errors, 'I01.4: registry must contain Q1-Q4 plus DURABILITY and REPLAY');
    push(duplicates(ids).length === 0, errors, `I01.4: duplicate gate ids: ${duplicates(ids).join(', ')}`);
    for (const gate of rows) {
        push(gate.state === 'not-run', errors, `I01.4: ${gate.id} must remain not-run until executable retained proof exists`);
        push(gate.aggregatePass === undefined, errors, `I01.4: ${gate.id} cannot define an aggregate pass flag`);
        push(nonEmptyArray(gate.machineEvidence), errors, `I01.4: ${gate.id} is missing machine evidence requirements`);
        push(nonEmptyArray(gate.humanEvidence), errors, `I01.4: ${gate.id} is missing human receipt requirements`);
        push(nonEmptyArray(gate.negativeCases), errors, `I01.4: ${gate.id} is missing adversarial cases`);
        push(nonEmptyArray(gate.stopConditions), errors, `I01.4: ${gate.id} is missing stop conditions`);
        push(gate.humanOutcomeInferredFromMachine === false, errors, `I01.4: ${gate.id} must forbid inferring human outcome from machine evidence`);
    }
}

export function validateBundle(bundle, options = {}) {
    const errors = [];
    const root = options.root ?? ROOT;
    validateHeads(bundle.heads, root, options, errors);
    validateOwners(bundle.owners, errors);
    validateCarriers(bundle.carriers, errors);
    validateGates(bundle.gates, errors);
    return errors;
}

export function loadBundle(root = ROOT) {
    return {
        heads: readJson(root, CONFIGS.heads),
        owners: readJson(root, CONFIGS.owners),
        carriers: readJson(root, CONFIGS.carriers),
        gates: readJson(root, CONFIGS.gates),
    };
}

function sha256File(root, relative) {
    return createHash('sha256').update(readFileSync(path.join(root, relative))).digest('hex');
}

function main() {
    let bundle;
    try {
        bundle = loadBundle(ROOT);
    } catch (error) {
        process.stderr.write(`V41-P01 authority reconciliation could not load: ${error.message}\n`);
        process.exitCode = 2;
        return;
    }
    const errors = validateBundle(bundle, { root: ROOT, verifyPackages: true });
    if (errors.length > 0) {
        for (const error of errors) process.stderr.write(`BLOCKED: ${error}\n`);
        process.exitCode = 1;
        return;
    }
    for (const [leaf, relative] of Object.entries(CONFIGS)) {
        process.stdout.write(`${leaf} ${sha256File(ROOT, relative)} ${relative}\n`);
    }
    process.stdout.write('V41-P01 authority reconciliation: valid (4/4 leaf contracts)\n');
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
