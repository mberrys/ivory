// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// @ts-check
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MODEL_PATH = 'configs/ivory-v41-canonical-model.json';
const SURFACES = [
    'Source', 'Artifact', 'Fragment', 'Statement', 'EvidenceLink', 'ResearchProtocol',
    'Activity', 'ResearchDecisionReceipt', 'Snapshot', 'Assessment', 'CAS',
];
const CONCEPTS = [
    'Source', 'Artifact', 'Fragment', 'Statement/Claim', 'EvidenceLink', 'ResearchProtocol',
    'Activity', 'Proposal', 'Adjudication', 'Receipt', 'Snapshot', 'Assessment', 'CAS',
];
const LEAVES = ['IV41-010A', 'IV41-010B', 'IV41-010C', 'IV41-010D', 'IV41-010E'];
const GATES = ['DURABILITY', 'Q1', 'Q2', 'REPLAY', 'Q3', 'Q4'];
const SHA40 = /^[a-f0-9]{40}$/;
const fail = (errors, condition, message) => { if (!condition) errors.push(message); };
const unique = array => new Set(array).size === array.length;
const sameSet = (a, b) => a.length === b.length && unique(a) && b.every(item => a.includes(item));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const readJson = (root, relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));

/** Contract validator: all inputs are injectable so the adversarial suite is hermetic. */
export function validateCanonicalModel(model, owners, packageOwnership, heads, options = {}) {
    const errors = [];
    const root = options.root ?? ROOT;
    fail(errors, model.schema === 'ivory-v41-canonical-model/1', '010: schema version drift');
    fail(errors, model.issue === 'IV41-010', '010: wrong issue authority');
    fail(errors, sameSet(model.leaves ?? [], LEAVES), '010: all five ordered children must be present exactly once');
    fail(errors, JSON.stringify(model.leaves) === JSON.stringify(LEAVES), '010: child dependency order must be A through E');
    fail(errors, sameSet(model.dependsOn ?? [], ['IV41-003', 'IV41-004']), '010: prerequisite issue links are missing');
    fail(errors, model.ownerMap === 'configs/ivory-v41-owner-map.json', '010: use the existing owner map');
    fail(errors, model.packageOwnership === 'configs/ivory-v41-package-ownership.json', '010: use the existing package authority');
    fail(errors, model.exactAuthority === 'configs/ivory-v41-authority-heads.json', '010: pin the existing authority manifest');

    const authority = model.authority ?? {};
    for (const key of ['semanticWriter', 'researchAcceptance']) {
        fail(errors, authority[key] === '@ivory-tower/research-kernel', `010A: ${key} must remain Core-only`);
    }
    fail(errors, authority.durableImplementation === '@ivory-tower/infrastructure', '010A: infrastructure owns durable implementation');
    fail(errors, authority.clientAcceptance === false && authority.harnessSemanticAuthority === false, '010A: no client or harness acceptance');
    fail(errors, packageOwnership.canonicalAuthority?.researchStateWrite === authority.semanticWriter, '010A: schema authority must agree with package ownership');
    fail(errors, packageOwnership.canonicalAuthority?.researchAcceptance === authority.researchAcceptance, '010A: acceptance authority must agree with package ownership');
    fail(errors, packageOwnership.canonicalAuthority?.durableStorageImplementation === authority.durableImplementation, '010A: storage authority must agree with package ownership');

    const context = model.evidenceContext ?? {};
    const selected = (heads.heads ?? []).find(head => head.role === 'selectedDev');
    fail(errors, context.repository === 'mberrys/ivory' && context.pullRequest === 5, '010: exact repository/PR context is required');
    fail(errors, context.branch === 'feat/v41-p02-fragment-context', '010: expected exact PR branch context');
    fail(errors, SHA40.test(context.headBeforeIssue ?? ''), '010: exact pre-issue PR commit SHA is required');
    fail(errors, context.selectedDev === selected?.sha, '010: selected dev SHA must match pinned historical basis');
    fail(errors, context.packageManager === 'npm@11.13.0' && context.nodeEngine === '>=24', '010: pinned toolchain mismatch');
    fail(errors, nonempty(context.operator) && nonempty(context.runtimeObservation) && (context.limits ?? []).length > 0, '010: evidence context/limitations missing');

    const concepts = model.concepts ?? [];
    fail(errors, sameSet(concepts.map(item => item.concept), CONCEPTS), '010A: canonical and derived concepts must be complete and unique');
    for (const concept of concepts) {
        const label = `010A: ${concept.concept ?? 'unknown'}`;
        const surface = (owners.surfaces ?? []).find(item => item.canonicalKey === concept.ownerSurface);
        fail(errors, Boolean(surface), `${label}: must map to a known canonical owner surface`);
        if (surface) {
            fail(errors, concept.canonicalWriter === '@ivory-tower/research-kernel', `${label}: cannot add a second semantic writer`);
        }
        fail(errors, nonempty(concept.identity) && nonempty(concept.revision) && nonempty(concept.persistence), `${label}: identity/revision/persistence required`);
        fail(errors, !/\blatest\b/i.test(concept.identity ?? ''), `${label}: identity cannot silently use latest`);
        fail(errors, Array.isArray(concept.semanticRefs), `${label}: semantic references must be declared, even when empty`);
        fail(errors, nonempty(concept.carrier) && concept.carrier?.includes('#'), `${label}: existing structural carrier required`);
        fail(errors, nonempty(concept.evidenceStatus), `${label}: implementation status required`);
        const [, file, symbol] = /^(.*)#([^#]+)$/.exec(concept.carrier ?? '') ?? [];
        if (file && symbol && options.verifyCarriers !== false) {
            const safe = file.startsWith('packages/') && !file.includes('..') && !path.isAbsolute(file);
            fail(errors, safe, `${label}: unsafe carrier path`);
            if (safe) {
                const target = path.join(root, file);
                fail(errors, existsSync(target), `${label}: carrier file absent: ${file}`);
                if (existsSync(target)) {
                    fail(errors, readFileSync(target, 'utf8').includes(symbol), `${label}: structural carrier symbol absent: ${symbol}`);
                }
            }
        }
        if (concept.evidenceStatus !== 'implemented-reference-kernel') {
            fail(errors, nonempty(concept.compatibility), `${label}: non-runtime contracts must declare a compatibility limit`);
        }
        if (concept.evidenceStatus === 'owned-gap') {
            fail(errors, /^IV41-\d+/.test(concept.trackingIssue ?? ''), `${label}: pending carrier requires a tracked issue`);
        }
    }
    const surfaceSet = new Set(concepts.map(item => item.ownerSurface));
    for (const surface of SURFACES) fail(errors, surfaceSet.has(surface), `010A: missing owner-map coverage: ${surface}`);

    const receiptVariants = model.receiptVariants ?? [];
    fail(errors, sameSet(receiptVariants.map(v => v.name), ['research', 'execution']), '010A: research/execution receipts must remain distinct');
    fail(errors, receiptVariants.find(v => v.name === 'research')?.owner === '@ivory-tower/research-kernel', '010A: research receipt owner drift');
    fail(errors, receiptVariants.find(v => v.name === 'execution')?.owner === '@ivory-tower/domain', '010A: execution receipt owner drift');
    fail(errors, receiptVariants.find(v => v.name === 'execution')?.semanticAcceptance === 'none', '010A: execution receipt may not accept research meaning');

    const refs = model.referencePolicy ?? {};
    fail(errors, sameSet(refs.shape ?? [], ['projectId', 'objectId', 'revisionId']), '010C: references must be exact project/object/revision triples');
    fail(errors, refs.latestForbidden === true && refs.projectBound === true && refs.crossTypeMustResolve === true, '010C: stale/cross-project/wrong-type references must fail closed');
    fail(errors, refs.carryForward === 'explicit-new-EvidenceLink', '010C: carry-forward must be a new EvidenceLink');
    fail(errors, refs.activityBackLinksAreSemanticDependencies === false, '010C: provenance back-links cannot change semantic closure');
    fail(errors, refs.unresolved === 'typed-blocked-no-write', '010C: unresolved evidence may not write state');
    fail(errors, refs.concurrency === 'expectedHead exact revision for all modifications', '010C: expectedHead fencing is mandatory');

    const digests = model.dependencyDigest ?? {};
    fail(errors, digests.revisionSchema === 'n1-revision/1' && digests.function === 'digestCanonical', '010C: preserve the revision digest algorithm');
    fail(errors, sameSet(digests.revisionFields ?? [], ['schemaVersion', 'objectId', 'predecessor', 'payload', 'exactRefs', 'activityId']), '010C: revision hash input fields drifted');
    fail(errors, digests.snapshotDigest === 'digestCanonical(manifest)', '010C: snapshot digest must bind exact manifest');
    fail(errors, sameSet(digests.snapshotMembers ?? [], ['ref', 'role', 'revisionDigest']), '010C: dependency member digests must remain explicit');
    fail(errors, digests.noLatestResolution === true && nonempty(digests.limitation), '010C: no latest substitution or invented transitive digest');

    const migration = model.migration ?? {};
    fail(errors, migration.owner === authority.durableImplementation, '010B: migration must remain infrastructure-owned');
    fail(errors, migration.runner === 'packages/ivory-tower-infrastructure/src/node/migrate.ts#runIvoryMigrations', '010B: migration must use existing runner');
    fail(errors, migration.mode === 'forward-only' && migration.migrationStrategy === 'additive-new-fields', '010B: only additive forward migrations');
    for (const field of ['before', 'apply', 'after', 'forbidden']) {
        fail(errors, Array.isArray(migration[field]) && migration[field].length >= 3, `010B: ${field} migration rules are incomplete`);
    }
    fail(errors, (migration.forbidden ?? []).some(value => /in-place rollback/i.test(value)), '010B: destructive rollback must be forbidden');
    fail(errors, (migration.forbidden ?? []).some(value => /guessed/i.test(value)), '010B: guessed backfills must be forbidden');
    fail(errors, (migration.after ?? []).some(value => /digests/i.test(value)), '010B: migration requires semantic/digest readback');

    const aliases = model.aliases ?? [];
    fail(errors, unique(aliases.map(item => item.term)), '010D: duplicate compatibility aliases');
    for (const alias of aliases) {
        fail(errors, nonempty(alias.term) && nonempty(alias.canonical) && nonempty(alias.mode), '010D: aliases require target/mode');
        if (['Paper Store', 'Claim Card', 'ResearchCase'].includes(alias.term)) {
            fail(errors, alias.mode === 'derived-view-only', '010D: planning synonyms cannot create writable stores');
        }
    }
    fail(errors, aliases.find(item => item.term === 'legacy Fragment context')?.mode === 'preserve-unresolved', '010D: legacy context must fail closed');
    fail(errors, aliases.find(item => item.term === 'Statement')?.mode === 'name-only', '010D: Statement/Claim must not split canonical identity');

    const gaps = packageOwnership.gapPolicy?.discoveredGaps ?? [];
    for (const owner of owners.surfaces ?? []) {
        for (const missing of owner.missingFields ?? []) {
            const matches = gaps.filter(gap => gap.surface === owner.canonicalKey && gap.missingField === missing);
            fail(errors, matches.length === 1 && /^IV41-\d+/.test(matches[0]?.issue ?? ''), `010E: untracked architecture gap ${owner.canonicalKey}:${missing}`);
        }
    }
    fail(errors, Object.keys(model.gates ?? {}).length === GATES.length && GATES.every(gate => model.gates?.[gate] === 'not-run'), '010E: contract cannot manufacture qualification gate closure');
    return errors;
}

export function loadCanonicalBundle(root = ROOT) {
    return {
        model: readJson(root, MODEL_PATH),
        owners: readJson(root, 'configs/ivory-v41-owner-map.json'),
        packageOwnership: readJson(root, 'configs/ivory-v41-package-ownership.json'),
        heads: readJson(root, 'configs/ivory-v41-authority-heads.json'),
    };
}

function main() {
    try {
        const { model, owners, packageOwnership, heads } = loadCanonicalBundle();
        const errors = validateCanonicalModel(model, owners, packageOwnership, heads);
        if (errors.length) {
            for (const error of errors) process.stderr.write(`BLOCKED: ${error}\n`);
            process.exitCode = 1;
            return;
        }
        const digest = createHash('sha256').update(readFileSync(path.join(ROOT, MODEL_PATH))).digest('hex');
        process.stdout.write(`IV41-010 canonical-model contract valid; SHA-256 ${digest} ${MODEL_PATH}\n`);
        process.stdout.write('IV41-010 evidence classification: structural contract only; durable Q1 and migration qualification not-run\n');
    } catch (error) {
        process.stderr.write(`IV41-010 contract validation unavailable: ${error.message}\n`);
        process.exitCode = 2;
    }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main();
