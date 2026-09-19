// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// @ts-check
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = process.env.IVORY_V41_AUTHORITY_ROOT ?? REPO_ROOT;
const CONFIG_FILE = process.env.IVORY_V41_AUTHORITY_CONFIG ?? path.join(ROOT, 'configs', 'ivory-v4-1-authority.json');
const REQUIRED_HEADS = ['detached', 'pr1', 'dev'];
const REQUIRED_CONCEPTS = [
    'Source',
    'Fragment',
    'EvidenceLink',
    'Statement',
    'Artifact',
    'Activity',
    'ResearchProtocol',
    'Assessment',
    'Receipt',
    'CAS',
];
const REQUIRED_LESSONS = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7'];
const REQUIRED_GATES = ['DURABILITY', 'REPLAY', 'Q1', 'Q2', 'Q3', 'Q4'];
const SHA = /^[0-9a-f]{40}$/;

function setDifference(expected, actual) {
    const actualSet = new Set(actual);
    return expected.filter(value => !actualSet.has(value));
}

function duplicateValues(values) {
    const seen = new Set();
    const duplicates = new Set();
    for (const value of values) {
        if (seen.has(value)) duplicates.add(value);
        seen.add(value);
    }
    return [...duplicates];
}

function valueAt(object, dotPath) {
    let current = object;
    for (const key of dotPath.split('.')) {
        if (current === null || typeof current !== 'object' || !(key in current)) return undefined;
        current = current[key];
    }
    return current;
}

export function validateManifest(manifest) {
    const errors = [];
    if (manifest?.schema !== 'ivory-v4-1-authority/1') errors.push(`schema must be ivory-v4-1-authority/1`);
    if (manifest?.issue !== 'V41-P01') errors.push(`issue must be V41-P01`);
    if (manifest?.leafIssue !== 'IV41-001') errors.push(`leafIssue must be IV41-001`);
    if (manifest?.legacyLeafIssue !== 'V41-I01.1') errors.push(`legacyLeafIssue must be V41-I01.1`);

    const repository = manifest?.repositoryContext;
    if (repository?.fullName !== 'mberrys/ivory') errors.push('repository context must name mberrys/ivory');
    if (repository?.pullRequest !== 2) errors.push('repository context must name PR #2');
    if (repository?.workBranch !== 'v41-p01-authority-reconciliation') errors.push('repository context must name the PR #2 work branch');
    if (repository?.packageRoot !== 'packages') errors.push('repository package root must be packages');
    if (repository?.treeTraversal !== 'recursive') errors.push('repository tree traversal must be recursive');
    if (!repository?.inspectionSource) errors.push('repository context must name its inspection source');
    if (!repository?.runtimeQualification) errors.push('repository context must state its runtime qualification boundary');
    const pr1Context = repository?.pullRequest1;
    if (pr1Context?.number !== 1) errors.push('repository context must retain PR #1');
    if (pr1Context?.state !== 'closed') errors.push('PR #1 repository context must retain its closed state');
    if (pr1Context?.merged !== false) errors.push('PR #1 repository context must retain merged=false');
    if (!SHA.test(pr1Context?.headSha ?? '')) errors.push('PR #1 repository context must retain an exact head SHA');
    if (!SHA.test(pr1Context?.headTreeSha ?? '')) errors.push('PR #1 repository context must retain an exact head tree SHA');
    const branchObservations = Array.isArray(repository?.branchObservations) ? repository.branchObservations : [];
    if (branchObservations.length === 0) errors.push('repository context must retain at least one exact branch observation');
    for (const observation of branchObservations) {
        if (!observation?.ref) errors.push('branch observation must name a ref');
        if (!SHA.test(observation?.sha ?? '')) errors.push(`branch observation ${observation?.ref ?? 'unknown'} must retain an exact SHA`);
        if (!SHA.test(observation?.treeSha ?? '')) errors.push(`branch observation ${observation?.ref ?? 'unknown'} must retain an exact tree SHA`);
        const packages = Array.isArray(observation?.packages) ? observation.packages : [];
        const locations = Array.isArray(observation?.packageLocations) ? observation.packageLocations : [];
        if (JSON.stringify(locations) !== JSON.stringify(packages.map(name => `${repository?.packageRoot ?? 'packages'}/${name}`))) {
            errors.push(`branch observation ${observation?.ref ?? 'unknown'} package locations must exactly match its package inventory`);
        }
        if (observation?.treeListingTruncated !== false) errors.push(`branch observation ${observation?.ref ?? 'unknown'} exact-tree inventory must record a non-truncated tree listing`);
        if (!observation?.evidenceBoundary) errors.push(`branch observation ${observation?.ref ?? 'unknown'} must state its evidence boundary`);
        if (!observation?.classification) errors.push(`branch observation ${observation?.ref ?? 'unknown'} must state its classification`);
    }

    const heads = Array.isArray(manifest?.heads) ? manifest.heads : [];
    const headIds = heads.map(head => head?.id).filter(Boolean);
    for (const id of setDifference(REQUIRED_HEADS, headIds)) errors.push(`missing required head ${id}`);
    for (const id of duplicateValues(headIds)) errors.push(`duplicate head ${id}`);
    const unexpectedHeads = setDifference(headIds, REQUIRED_HEADS);
    for (const id of unexpectedHeads) errors.push(`unexpected authority head ${id}`);
    if (heads.length !== REQUIRED_HEADS.length) errors.push('authority manifest must contain exactly three heads');
    for (const head of heads) {
        if (!SHA.test(head?.sha ?? '')) errors.push(`${head?.id ?? 'head'} sha must be an exact 40-character commit id`);
        if (!SHA.test(head?.treeSha ?? '')) errors.push(`${head?.id ?? 'head'} treeSha must be an exact 40-character tree id`);
        const packages = Array.isArray(head?.packages) ? head.packages : [];
        const packageLocations = Array.isArray(head?.packageLocations) ? head.packageLocations : [];
        const surfaces = Array.isArray(head?.surfaces) ? head.surfaces : [];
        if (duplicateValues(packages).length > 0) errors.push(`${head?.id ?? 'head'} package inventory contains duplicates`);
        if (JSON.stringify(packages) !== JSON.stringify([...packages].sort())) errors.push(`${head?.id ?? 'head'} package inventory must be sorted`);
        const expectedPackageLocations = packages.map(name => `${repository?.packageRoot ?? 'packages'}/${name}`);
        if (JSON.stringify(packageLocations) !== JSON.stringify(expectedPackageLocations)) errors.push(`${head?.id ?? 'head'} package locations must exactly match its package inventory`);
        if (head?.treeListingTruncated !== false) errors.push(`${head?.id ?? 'head'} exact-tree inventory must record a non-truncated tree listing`);
        if (!head?.evidenceBoundary) errors.push(`${head?.id ?? 'head'} must state its evidence boundary`);
        if (duplicateValues(surfaces).length > 0) errors.push(`${head?.id ?? 'head'} retained surface inventory contains duplicates`);
        if (JSON.stringify(surfaces) !== JSON.stringify([...surfaces].sort())) errors.push(`${head?.id ?? 'head'} retained surface inventory must be sorted`);
        if (head?.packageInventoryMode !== 'exact-tree') errors.push(`${head?.id ?? 'head'} package inventory must be exact-tree`);
        if (head?.schemaInspectionMode !== 'exact-source-readback') errors.push(`${head?.id ?? 'head'} schema inspection must be exact-source-readback`);
        if (/latest|head/i.test(head?.ref ?? '')) errors.push(`${head?.id ?? 'head'} cannot use latest/HEAD substitution`);
    }
    const base = heads.find(head => head.id === manifest?.implementationBase);
    if (!base) errors.push(`implementationBase must name one retained head`);
    else if (base.classification !== 'implementation-base') errors.push(`implementationBase head must be classified implementation-base`);
    if (base && pr1Context?.headSha !== base.sha) errors.push('retained PR #1 head SHA must equal the exact implementation-base head');
    if (base && pr1Context?.headTreeSha !== base.treeSha) errors.push('retained PR #1 tree SHA must equal the exact implementation-base tree');
    if (base && pr1Context?.headRef !== base.ref) errors.push('retained PR #1 head ref must equal the implementation-base ref');
    for (const observation of branchObservations) {
        if (observation?.ref === base?.ref && observation?.relationshipToPr1Head === 'descendant') {
            if (!(Number.isInteger(observation?.aheadBy) && observation.aheadBy > 0)) errors.push('advanced PR #1 branch observation must record aheadBy > 0');
            if (observation?.behindBy !== 0) errors.push('advanced PR #1 branch observation must record behindBy = 0');
            if (observation?.sha === base.sha) errors.push('advanced PR #1 branch observation cannot replace the closed PR #1 head');
        }
    }

    if (manifest?.authorityPolicy?.headSelection !== 'exact-only') errors.push('head selection must be exact-only');
    if (manifest?.authorityPolicy?.latestHeadSubstitution !== 'forbidden') errors.push('latest-head substitution must be forbidden');
    if (manifest?.authorityPolicy?.packageInventory !== 'exact-tree-only') errors.push('package inventory policy must be exact-tree-only');
    if (manifest?.authorityPolicy?.planningStatusIsAuthority !== false) errors.push('planning status cannot be semantic authority');

    const headById = new Map(heads.map(head => [head.id, head]));
    for (const fact of manifest?.requiredPackageFacts ?? []) {
        const classified = [...(fact.presentAt ?? []), ...(fact.absentAt ?? [])];
        for (const id of duplicateValues(classified)) errors.push(`${fact.package} classifies head ${id} more than once`);
        if (classified.length !== REQUIRED_HEADS.length || setDifference(REQUIRED_HEADS, classified).length > 0) {
            errors.push(`${fact.package} must classify every exact head once`);
        }
        for (const id of fact.presentAt ?? []) {
            const head = headById.get(id);
            if (!head?.packages?.includes(fact.package)) errors.push(`${fact.package} must be present at ${id}`);
        }
        for (const id of fact.absentAt ?? []) {
            const head = headById.get(id);
            if (head?.packages?.includes(fact.package)) errors.push(`${fact.package} must be absent at ${id}`);
        }
    }

    for (const fact of manifest?.retainedSurfaceFacts ?? []) {
        for (const id of fact.presentAt ?? []) {
            const head = headById.get(id);
            if (!head?.surfaces?.includes(fact.path)) errors.push(`${fact.path} must be present at ${id}`);
        }
        for (const id of fact.absentAt ?? []) {
            const head = headById.get(id);
            if (head?.surfaces?.includes(fact.path)) errors.push(`${fact.path} must be absent at ${id}`);
        }
    }

    const owners = Array.isArray(manifest?.canonicalOwners) ? manifest.canonicalOwners : [];
    const concepts = owners.map(owner => owner?.concept).filter(Boolean);
    for (const concept of setDifference(REQUIRED_CONCEPTS, concepts)) errors.push(`missing canonical owner or owned gap for ${concept}`);
    for (const concept of duplicateValues(concepts)) errors.push(`duplicate canonical owner for ${concept}`);
    const forbidden = (manifest?.forbiddenAuthorities ?? []).map(value => String(value).toLowerCase());
    for (const owner of owners) {
        if (!['owned', 'owned-gap'].includes(owner?.state)) errors.push(`${owner?.concept ?? 'owner'} state must be owned or owned-gap`);
        if (owner?.state === 'owned' && (!owner.path || !owner.symbol || !owner.package || !owner.boundary)) {
            errors.push(`${owner?.concept ?? 'owner'} must name package, path, symbol and boundary`);
        }
        if (owner?.state === 'owned-gap' && (!owner.ownedBy || !owner.reason || !owner.trackingUrl)) {
            errors.push(`${owner?.concept ?? 'owner'} gap must name its owning issue, tracking URL and reason`);
        }
        const description = [owner?.concept, owner?.package, owner?.symbol].filter(Boolean).join(' ').toLowerCase();
        for (const blocked of forbidden) {
            if (description.includes(blocked)) errors.push(`${owner?.concept ?? 'owner'} introduces forbidden authority ${blocked}`);
        }
    }

    const lessons = Array.isArray(manifest?.lessonCarriers) ? manifest.lessonCarriers : [];
    const lessonIds = lessons.map(lesson => lesson?.id).filter(Boolean);
    for (const id of setDifference(REQUIRED_LESSONS, lessonIds)) errors.push(`missing lesson carrier ${id}`);
    for (const id of duplicateValues(lessonIds)) errors.push(`duplicate lesson carrier ${id}`);
    for (const lesson of lessons) {
        const hasCarrier = lesson?.carrier && lesson.carrier.path && lesson.carrier.symbol;
        const hasGap = lesson?.ownedGap && lesson.ownedGap.issue && lesson.ownedGap.reason;
        if (Boolean(hasCarrier) === Boolean(hasGap)) errors.push(`${lesson?.id ?? 'lesson'} must have exactly one carrier or owned gap`);
        for (const field of ['predicate', 'fixture', 'evidence', 'gate', 'scope']) {
            if (!lesson?.[field]) errors.push(`${lesson?.id ?? 'lesson'} must name ${field}`);
        }
        if (lesson?.gate !== lesson?.id) errors.push(`${lesson?.id ?? 'lesson'} must point to its matching N-gate`);
    }

    const harness = manifest?.harnessBoundary;
    if (harness?.semanticAuthority?.owner !== 'Core') errors.push('Core must remain the semantic authority');
    if (harness?.executionAuthority?.owner !== 'Harness') errors.push('Harness must own execution authority');
    if (harness?.executionAuthority?.mayAcceptInterpretation !== false) errors.push('Harness cannot accept interpretation');
    if (harness?.executionAuthority?.mayWriteCanonicalResearchState !== false) errors.push('Harness cannot write canonical research state');
    if (harness?.executionAuthority?.mustReturnThroughCore !== true) errors.push('Harness results must return through Core');
    if (harness?.clients?.owner !== 'Projection') errors.push('clients must remain projections');
    if (harness?.clients?.mayAcceptInterpretation !== false) errors.push('clients cannot accept interpretation');
    if (harness?.clients?.mayWriteCanonicalResearchState !== false) errors.push('clients cannot write canonical research state');
    if (harness?.clients?.maySelectLatestImplicitly !== false) errors.push('clients cannot select latest implicitly');
    if (harness?.recursiveImprovement?.replayableTraces !== true) errors.push('recursive improvement must retain replayable traces');
    if (harness?.recursiveImprovement?.canonicalEvidenceMutation !== 'forbidden') errors.push('recursive improvement cannot mutate canonical evidence');
    if (harness?.recursiveImprovement?.semanticEvaluatorBypass !== 'forbidden') errors.push('recursive improvement cannot bypass semantic evaluation');

    const gates = Array.isArray(manifest?.gates) ? manifest.gates : [];
    const gateIds = gates.map(gate => gate?.id).filter(Boolean);
    for (const id of setDifference(REQUIRED_GATES, gateIds)) errors.push(`missing gate ${id}`);
    for (const id of duplicateValues(gateIds)) errors.push(`duplicate gate ${id}`);
    for (const gate of gates) {
        if (gate?.status !== 'not-run') errors.push(`${gate?.id ?? 'gate'} must begin not-run; this contract cannot claim closure`);
        if (!gate?.owner) errors.push(`${gate?.id ?? 'gate'} must name an owner`);
        if (!gate?.machineEvidence?.path || !gate.machineEvidence?.predicate?.path || gate.machineEvidence?.predicate?.equals === undefined) {
            errors.push(`${gate?.id ?? 'gate'} must name machine evidence and predicate`);
        }
        if (!gate?.humanReceipt?.path || !gate.humanReceipt?.predicate?.path || gate.humanReceipt?.predicate?.equals === undefined) {
            errors.push(`${gate?.id ?? 'gate'} must name a human receipt and predicate`);
        }
        if (gate?.machineEvidence?.path === gate?.humanReceipt?.path) errors.push(`${gate?.id ?? 'gate'} cannot use one artifact as both machine and human evidence`);
        if (!Array.isArray(gate?.negativeCases) || gate.negativeCases.length === 0) errors.push(`${gate?.id ?? 'gate'} must retain negative cases`);
        if (!Array.isArray(gate?.stopConditions) || gate.stopConditions.length === 0) errors.push(`${gate?.id ?? 'gate'} must retain stop conditions`);
    }
    if ('aggregatePass' in (manifest ?? {}) || 'overallPass' in (manifest ?? {})) {
        errors.push('aggregate pass flags are forbidden');
    }
    return errors;
}

export function requiredSurfacePaths(manifest) {
    const paths = new Set(['configs/ivory-n-gates.json']);
    for (const owner of manifest.canonicalOwners ?? []) {
        if (owner.state === 'owned' && owner.path) paths.add(owner.path);
    }
    for (const lesson of manifest.lessonCarriers ?? []) {
        if (lesson.carrier?.path) paths.add(lesson.carrier.path);
        if (lesson.fixture) paths.add(lesson.fixture);
        if (lesson.evidence) paths.add(lesson.evidence);
    }
    return [...paths].sort();
}

export function validateRepositorySurfaces(manifest, options = {}) {
    const root = options.root ?? ROOT;
    const exists = options.exists ?? (relative => existsSync(path.join(root, relative)));
    return requiredSurfacePaths(manifest).filter(relative => !exists(relative)).map(relative => `missing retained surface ${relative}`);
}

export function manifestDigest(content) {
    return createHash('sha256').update(content).digest('hex');
}

function predicatePasses(record, predicate) {
    return valueAt(record, predicate.path) === predicate.equals;
}

export function evaluateGateRegistry(manifest, options = {}) {
    const root = options.root ?? ROOT;
    const exists = options.exists ?? (relative => existsSync(path.join(root, relative)));
    const readJson = options.readJson ?? (relative => JSON.parse(readFileSync(path.join(root, relative), 'utf8')));
    return manifest.gates.map(gate => {
        const missing = [];
        const failed = [];
        for (const [kind, evidence] of [['machine', gate.machineEvidence], ['human', gate.humanReceipt]]) {
            if (!exists(evidence.path)) {
                missing.push({ kind, path: evidence.path });
                continue;
            }
            const record = readJson(evidence.path);
            if (!predicatePasses(record, evidence.predicate)) {
                failed.push({
                    kind,
                    path: evidence.path,
                    observed: valueAt(record, evidence.predicate.path),
                    expected: evidence.predicate.equals,
                });
            }
        }
        let state = 'passed';
        if (missing.length === 2) state = 'not-run';
        else if (missing.length > 0) state = 'blocked';
        else if (failed.length > 0) state = 'failed';
        return { id: gate.id, owner: gate.owner, state, missing, failed };
    });
}

export function compareObservedHeads(manifest, observed) {
    const byId = new Map(manifest.heads.map(head => [head.id, head]));
    const errors = [];
    for (const [id, sha] of Object.entries(observed)) {
        const expected = byId.get(id);
        if (!expected) errors.push(`unknown observed head ${id}`);
        else if (expected.sha !== sha) errors.push(`head ${id} is ${sha}; expected ${expected.sha}`);
    }
    return errors;
}

export function formatReport(manifest, gates, digest) {
    const lines = [
        `${manifest.leafIssue} authority manifest (${manifest.issue} parent): ${manifest.implementationBase} is the implementation base`,
        `repository: ${manifest.repositoryContext.fullName} PR #${manifest.repositoryContext.pullRequest} (${manifest.repositoryContext.workBranch})`,
        `closed PR #1: ${manifest.repositoryContext.pullRequest1.headSha} / ${manifest.repositoryContext.pullRequest1.headTreeSha}`,
        `manifest sha256: ${digest}`,
        '',
        '| head | commit | tree | classification | packages |',
        '|---|---|---|---|---:|',
    ];
    for (const head of manifest.heads) lines.push(`| ${head.id} | ${head.sha} | ${head.treeSha} | ${head.classification} | ${head.packages.length} |`);
    lines.push('', '| gate | state | owner |', '|---|---|---|');
    for (const gate of gates) lines.push(`| ${gate.id} | ${gate.state} | ${gate.owner} |`);
    const passed = gates.filter(gate => gate.state === 'passed').length;
    const notRun = gates.filter(gate => gate.state === 'not-run').length;
    lines.push('', `${passed}/${gates.length} V4.1 gates passed; ${notRun} not-run.`);
    return lines.join('\n');
}

function valuesForArgument(name) {
    const values = [];
    for (let index = 0; index < process.argv.length; index += 1) {
        if (process.argv[index] === name && process.argv[index + 1] !== undefined) values.push(process.argv[index + 1]);
    }
    return values;
}

function parseObservedHeads(values) {
    return Object.fromEntries(values.map(value => {
        const separator = value.indexOf('=');
        if (separator < 1) return [value, ''];
        return [value.slice(0, separator), value.slice(separator + 1)];
    }));
}

function main() {
    if (!existsSync(CONFIG_FILE)) {
        process.stderr.write(`V4.1 authority manifest missing: ${CONFIG_FILE}\n`);
        process.exitCode = 2;
        return;
    }
    const configBytes = readFileSync(CONFIG_FILE);
    const manifest = JSON.parse(configBytes.toString('utf8'));
    const contractErrors = validateManifest(manifest);
    const headErrors = compareObservedHeads(manifest, parseObservedHeads(valuesForArgument('--observed-head')));
    const surfaceErrors = process.env.IVORY_V41_AUTHORITY_SKIP_SURFACE_CHECK === '1' ? [] : validateRepositorySurfaces(manifest);
    const gates = contractErrors.length === 0 ? evaluateGateRegistry(manifest) : [];
    const required = valuesForArgument('--require-gate').flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean);
    const gateById = new Map(gates.map(gate => [gate.id, gate]));
    const gateErrors = [];
    for (const id of required) {
        const gate = gateById.get(id);
        if (!gate) gateErrors.push(`unknown required gate ${id}`);
        else if (gate.state !== 'passed') gateErrors.push(`required gate ${id} is ${gate.state}`);
    }

    if (process.argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({
            manifest: {
                issue: manifest.issue,
                leafIssue: manifest.leafIssue,
                legacyLeafIssue: manifest.legacyLeafIssue,
                implementationBase: manifest.implementationBase,
                digest: manifestDigest(configBytes),
            },
            repository: manifest.repositoryContext,
            heads: manifest.heads.map(head => ({
                id: head.id,
                ref: head.ref,
                sha: head.sha,
                treeSha: head.treeSha,
                classification: head.classification,
                packageLocations: head.packageLocations,
                evidenceBoundary: head.evidenceBoundary,
            })),
            gates,
        }, null, 2)}\n`);
    } else if (contractErrors.length === 0) {
        process.stdout.write(`${formatReport(manifest, gates, manifestDigest(configBytes))}\n`);
    }
    for (const error of contractErrors) process.stderr.write(`CONTRACT: ${error}\n`);
    for (const error of headErrors) process.stderr.write(`HEAD MISMATCH: ${error}\n`);
    for (const error of surfaceErrors) process.stderr.write(`SURFACE: ${error}\n`);
    for (const error of gateErrors) process.stderr.write(`GATE: ${error}\n`);
    process.exitCode = contractErrors.length + headErrors.length + surfaceErrors.length + gateErrors.length === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main();
