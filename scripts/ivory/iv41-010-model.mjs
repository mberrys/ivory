// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// @ts-check
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readbackIdentity } from './v41-authority.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MODEL_PATH = 'configs/ivory-v41-canonical-model.json';
const OWNER_MAP_PATH = 'configs/ivory-v41-owner-map.json';
const PACKAGE_OWNERSHIP_PATH = 'configs/ivory-v41-package-ownership.json';
const EXACT_AUTHORITY_PATH = 'configs/ivory-v41-authority-heads.json';
const CARRIER_MATRIX_PATH = 'configs/ivory-v41-carrier-matrix.json';
const ADR_LINEAGE_PATH = 'configs/ivory-v41-adr-lineage.json';
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
const SHA256 = /^[a-f0-9]{64}$/;
const ADR_ID = /^ADR-\d{3}$/;
const EXACT_PR_HEAD_BEFORE_ISSUE = '1aba5b8625af377396b4c6dd362dcf8b49782c34';
/** The retained-readback convention shared with V41-I01.2 / V41-I01.3 / V41-I01.4: LF-normalized text. */
const READBACK_CONVENTION = [
    ['algorithm', 'sha256'],
    ['encoding', 'utf-8'],
    ['pathSeparator', '/'],
    ['lineEndingPolicy', 'normalize-lf'],
];
/** Convention failures are reported by name so a drifted record says which rule it broke. */
const READBACK_MESSAGES = {
    algorithm: '010: readback algorithm must be SHA-256',
    encoding: '010: readback encoding must be UTF-8 text',
    pathSeparator: '010: readback paths must use POSIX separators',
    lineEndingPolicy: '010: readback line endings must be normalized to LF so the readback is platform independent',
};
const ALLOWED_PERSISTENCE = new Set([
    'canonical-revision-and-content-bytes', 'canonical-revision-and-retained-output',
    'canonical-revision-and-representation-refs', 'canonical-revision', 'structural-contract-only',
    'canonical-append-only-activity', 'pending-noncanonical-until-Core-adoption',
    'Core-decision-activity-contract-pending', 'immutable-Core-receipt-contract',
    'immutable-frozen-closure', 'durable-store-port-admit-before-commit',
]);
const fail = (errors, condition, message) => { if (!condition) errors.push(message); };
const unique = array => new Set(array).size === array.length;
const sameSet = (a, b) => a.length === b.length && unique(a) && b.every(item => a.includes(item));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const readJson = (root, relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const splitCarrier = value => {
    const match = /^(.*)#([^#]+)$/.exec(typeof value === 'string' ? value : '');
    return match === null ? undefined : { file: match[1], symbol: match[2] };
};
const isRepoRelativePath = value => typeof value === 'string'
    && value.length > 0 && !value.includes('\\') && !path.posix.isAbsolute(value) && !/^[a-zA-Z]:/.test(value)
    && value.split('/').every(part => part.length > 0 && part !== '.' && part !== '..');
/** A carrier symbol must be declared in its carrier file, not merely mentioned. */
const declaresSymbol = (contents, symbol) => {
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const declaration = new RegExp(
        `\\b(?:export\\s+)?(?:abstract\\s+)?(?:interface|type|class|const|let|var|function|enum)\\s+${escaped}\\b`,
    );
    const member = new RegExp(`\\b${escaped}\\s*(?:\\(|:|=>)`);
    return declaration.test(contents) || member.test(contents);
};
const packageDirectories = heads => new Map(
    (heads?.packages ?? []).filter(item => nonempty(item?.name) && nonempty(item?.path))
        .map(item => [item.name, path.posix.dirname(item.path)]),
);
/** Every unit the carrier matrix already pins, as `{ owner, path }`, for cross-contract agreement. */
const carrierMatrixUnits = carriers => (carriers?.lessons ?? []).flatMap(lesson =>
    (lesson?.carrier?.units ?? []).map(unit => ({ owner: unit?.owner, path: unit?.path })));

/** Contract validator: all inputs are injectable so the adversarial suite is hermetic. */
export function validateCanonicalModel(model, owners, packageOwnership, heads, carriers, adrLineage, options = {}) {
    const errors = [];
    const root = options.root ?? ROOT;
    fail(errors, model.schema === 'ivory-v41-canonical-model/1', '010: schema version drift');
    fail(errors, model.issue === 'IV41-010', '010: wrong issue authority');
    fail(errors, sameSet(model.leaves ?? [], LEAVES), '010: all five ordered children must be present exactly once');
    fail(errors, JSON.stringify(model.leaves) === JSON.stringify(LEAVES), '010: child dependency order must be A through E');
    fail(errors, sameSet(model.dependsOn ?? [], ['IV41-003', 'IV41-004']), '010: prerequisite issue links are missing');
    fail(errors, model.ownerMap === OWNER_MAP_PATH, '010: use the existing owner map');
    fail(errors, model.packageOwnership === PACKAGE_OWNERSHIP_PATH, '010: use the existing package authority');
    fail(errors, model.exactAuthority === EXACT_AUTHORITY_PATH, '010: pin the existing authority manifest');
    fail(errors, model.carrierMatrix === CARRIER_MATRIX_PATH, '010: use the existing N1-N7 carrier matrix');
    fail(errors, model.adrLineage === ADR_LINEAGE_PATH, '010: use the existing ADR lineage manifest');

    const directories = packageDirectories(heads);
    const inventory = new Set((heads?.packages ?? []).map(item => item?.name));
    const matrixUnits = carrierMatrixUnits(carriers);
    const surfaceByKey = new Map((owners?.surfaces ?? []).map(surface => [surface?.canonicalKey, surface]));

    const authority = model.authority ?? {};
    for (const key of ['semanticWriter', 'researchAcceptance']) {
        fail(errors, authority[key] === '@ivory-tower/research-kernel', `010A: ${key} must remain Core-only`);
    }
    fail(errors, authority.durableImplementation === '@ivory-tower/infrastructure', '010A: infrastructure owns durable implementation');
    fail(errors, authority.clientAcceptance === false && authority.harnessSemanticAuthority === false, '010A: no client or harness acceptance');
    for (const key of ['semanticWriter', 'researchAcceptance', 'durableImplementation', 'proposalExecution']) {
        fail(
            errors,
            inventory.has(authority[key]),
            `010A: ${key} ${authority[key] ?? '(missing)'} is not a package in the exact-head inventory`,
        );
    }
    fail(errors, packageOwnership.canonicalAuthority?.researchStateWrite === authority.semanticWriter, '010A: schema authority must agree with package ownership');
    fail(errors, packageOwnership.canonicalAuthority?.researchAcceptance === authority.researchAcceptance, '010A: acceptance authority must agree with package ownership');
    fail(errors, packageOwnership.canonicalAuthority?.durableStorageImplementation === authority.durableImplementation, '010A: storage authority must agree with package ownership');

    const context = model.evidenceContext ?? {};
    const selected = (heads?.heads ?? []).find(head => head.role === 'selectedDev');
    fail(errors, context.repository === 'mberrys/ivory' && context.pullRequest === 5, '010: exact repository/PR context is required');
    fail(errors, context.branch === 'feat/v41-p02-fragment-context', '010: expected exact PR branch context');
    fail(errors, SHA40.test(context.headBeforeIssue ?? '') && context.headBeforeIssue === EXACT_PR_HEAD_BEFORE_ISSUE, '010: exact pre-issue PR commit SHA is required');
    fail(errors, context.selectedDev === selected?.sha, '010: selected dev SHA must match pinned historical basis');
    fail(errors, context.packageManager === 'npm@11.13.0' && context.nodeEngine === '>=24', '010: pinned toolchain mismatch');
    fail(errors, nonempty(context.operator) && nonempty(context.runtimeObservation) && (context.limits ?? []).length > 0, '010: evidence context/limitations missing');

    const concepts = model.concepts ?? [];
    fail(errors, sameSet(concepts.map(item => item.concept), CONCEPTS), '010A: canonical and derived concepts must be complete and unique');
    for (const concept of concepts) {
        const label = `010A: ${concept.concept ?? 'unknown'}`;
        const surface = surfaceByKey.get(concept.ownerSurface);
        fail(errors, Boolean(surface), `${label}: must map to a known canonical owner surface`);
        if (surface) {
            fail(errors, concept.canonicalWriter === '@ivory-tower/research-kernel', `${label}: cannot add a second semantic writer`);
        }
        fail(errors, nonempty(concept.identity) && nonempty(concept.revision) && nonempty(concept.persistence), `${label}: identity/revision/persistence required`);
        fail(errors, ALLOWED_PERSISTENCE.has(concept.persistence), `${label}: persistence must reuse a declared canonical contract mode`);
        fail(errors, !/\blatest\b/i.test(concept.identity ?? ''), `${label}: identity cannot silently use latest`);
        fail(errors, Array.isArray(concept.semanticRefs), `${label}: semantic references must be declared, even when empty`);
        fail(errors, nonempty(concept.carrier) && concept.carrier?.includes('#'), `${label}: existing structural carrier required`);
        fail(errors, nonempty(concept.evidenceStatus), `${label}: implementation status required`);

        const parts = splitCarrier(concept.carrier);
        const owner = concept.owner;
        fail(errors, nonempty(owner), `${label}: every canonical object needs an explicit owner`);
        fail(errors, inventory.has(owner), `${label}: owner ${owner ?? '(missing)'} is not a package in the exact-head inventory`);
        if (surface) {
            fail(
                errors,
                owner === surface.owner,
                `${label}: owner ${owner ?? '(missing)'} contradicts the owner map owner ${surface.owner ?? '(missing)'} for ${concept.ownerSurface}`,
            );
            if (concept.ownerSurface === 'Statement') {
                const synonym = surface.planningSynonym;
                fail(
                    errors,
                    synonym === undefined || String(concept.runtimeKey ?? '').toLowerCase() === String(synonym).toLowerCase(),
                    `${label}: runtime key ${concept.runtimeKey ?? '(missing)'} contradicts the owner-map planning synonym ${synonym ?? '(missing)'}`,
                );
            }
            if (parts !== undefined) {
                const isPrimary = surface.carrier === concept.carrier;
                const inMatrix = matrixUnits.some(unit => unit.path === concept.carrier);
                fail(
                    errors,
                    isPrimary || inMatrix,
                    `${label}: carrier ${concept.carrier} is neither the owner-map primary carrier nor a carrier-matrix unit`,
                );
            }
        }
        if (parts !== undefined) {
            const directory = directories.get(owner);
            if (directory === undefined) {
                // the inventory error above already names the owner; the carrier cannot be placed without a package
            } else {
                fail(
                    errors,
                    parts.file === directory || parts.file.startsWith(`${directory}/`),
                    `${label}: carrier ${concept.carrier} is not inside the package owned by ${owner}`,
                );
            }
            for (const unit of matrixUnits.filter(candidate => candidate.path === concept.carrier)) {
                fail(
                    errors,
                    unit.owner === owner,
                    `${label}: carrier ${concept.carrier} is owned by ${unit.owner ?? '(missing)'} in the carrier matrix, not ${owner ?? '(missing)'}`,
                );
            }
            if (options.verifyCarriers !== false) {
                const safe = parts.file.startsWith('packages/') && !parts.file.includes('..') && !path.isAbsolute(parts.file);
                fail(errors, safe, `${label}: unsafe carrier path`);
                if (safe) {
                    const target = path.join(root, parts.file);
                    fail(errors, existsSync(target), `${label}: carrier file absent: ${parts.file}`);
                    if (existsSync(target)) {
                        fail(
                            errors,
                            declaresSymbol(readFileSync(target, 'utf8'), parts.symbol),
                            `${label}: structural carrier symbol absent: ${parts.symbol}`,
                        );
                    }
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
    for (const variant of receiptVariants) {
        const label = `010A: ${variant?.name ?? 'unknown'} receipt`;
        fail(errors, inventory.has(variant?.owner), `${label}: owner ${variant?.owner ?? '(missing)'} is not a package in the exact-head inventory`);
        const surface = surfaceByKey.get(variant?.surface);
        fail(errors, Boolean(surface), `${label}: must map to a known canonical owner surface`);
        if (surface) {
            fail(
                errors,
                variant.owner === surface.owner,
                `${label}: owner ${variant?.owner ?? '(missing)'} contradicts the owner map owner ${surface.owner ?? '(missing)'}`,
            );
        }
        const parts = splitCarrier(variant?.carrier);
        fail(errors, parts !== undefined, `${label}: existing structural carrier required`);
        if (parts !== undefined) {
            const directory = directories.get(variant.owner);
            if (directory !== undefined) {
                fail(
                    errors,
                    parts.file === directory || parts.file.startsWith(`${directory}/`),
                    `${label}: carrier ${variant.carrier} is not inside the package owned by ${variant.owner}`,
                );
            }
            if (options.verifyCarriers !== false && parts.file.startsWith('packages/')) {
                const target = path.join(root, parts.file);
                fail(errors, existsSync(target), `${label}: carrier file absent: ${parts.file}`);
                if (existsSync(target)) {
                    fail(
                        errors,
                        declaresSymbol(readFileSync(target, 'utf8'), parts.symbol),
                        `${label}: structural carrier symbol absent: ${parts.symbol}`,
                    );
                }
            }
        }
    }

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
    const runnerParts = splitCarrier(migration.runner);
    if (runnerParts !== undefined && options.verifyCarriers !== false) {
        const target = path.join(root, runnerParts.file);
        fail(errors, existsSync(target), `010B: migration runner file absent: ${runnerParts.file}`);
        if (existsSync(target)) {
            fail(
                errors,
                declaresSymbol(readFileSync(target, 'utf8'), runnerParts.symbol),
                `010B: migration runner symbol absent: ${runnerParts.symbol}`,
            );
        }
    }

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
    for (const owner of owners?.surfaces ?? []) {
        for (const missing of owner.missingFields ?? []) {
            const matches = gaps.filter(gap => gap.surface === owner.canonicalKey && gap.missingField === missing);
            fail(errors, matches.length === 1 && /^IV41-\d+/.test(matches[0]?.issue ?? ''), `010E: untracked architecture gap ${owner.canonicalKey}:${missing}`);
        }
    }
    fail(errors, Object.keys(model.gates ?? {}).length === GATES.length && GATES.every(gate => model.gates?.[gate] === 'not-run'), '010E: contract cannot manufacture qualification gate closure');

    validateAuthorityRecords(model, adrLineage, root, options, errors);
    validateReadback(model, root, options, errors);
    return errors;
}

/**
 * The ADR lineage is the authority for schema/ADR supersession, the Statement naming, and the Claim Card
 * projection. The model points at the real ADR files and lineage decisions instead of restating them, and
 * every pointer must resolve against `configs/ivory-v41-adr-lineage.json`.
 */
function validateAuthorityRecords(model, lineage, root, options, errors) {
    const records = model.authorityRecords;
    fail(errors, typeof records === 'object' && records !== null && !Array.isArray(records), '010: the model must point at the ADR lineage authority');
    if (typeof records !== 'object' || records === null || Array.isArray(records)) return;
    fail(errors, records.adrLineage === ADR_LINEAGE_PATH && model.adrLineage === ADR_LINEAGE_PATH, '010: authority records must use the existing ADR lineage manifest');
    fail(errors, typeof lineage === 'object' && lineage !== null, 'IV41-004: the cited ADR lineage manifest could not be loaded');
    if (typeof lineage !== 'object' || lineage === null) return;
    const registry = new Map((lineage.registry ?? []).map(record => [record?.id, record]));
    const decisions = new Map((lineage.decisions ?? []).map(decision => [decision?.id, decision]));

    const citedAdrs = Array.isArray(records.adrs) ? records.adrs : [];
    fail(errors, citedAdrs.length > 0, '010: the model must cite the ADR files that carry its authority');
    for (const adr of citedAdrs) {
        const label = `010: ${adr?.id ?? 'unknown ADR'}`;
        fail(errors, ADR_ID.test(adr?.id ?? ''), `${label}: cited ADR must use ADR-### numbering`);
        const registered = registry.get(adr?.id);
        fail(errors, registered?.kind === 'adr', `${label}: cited ADR is not registered as an ADR in the ADR lineage`);
        if (registered?.kind === 'adr') {
            fail(
                errors,
                adr.path === registered.path,
                `${label}: cited path ${adr.path ?? '(missing)'} contradicts the ADR lineage path ${registered.path ?? '(missing)'}`,
            );
        }
        fail(errors, isRepoRelativePath(adr?.path), `${label}: cited ADR path must be a repository-relative POSIX path`);
        if (options.verifyCarriers !== false && isRepoRelativePath(adr?.path)) {
            fail(errors, existsSync(path.join(root, adr.path)), `${label}: cited ADR file is absent on disk: ${adr.path}`);
        }
    }
    const citedIds = new Set(citedAdrs.map(adr => adr?.id));
    const declared = Array.isArray(records.decisions) ? records.decisions : [];
    fail(errors, declared.length > 0, '010: the model must declare the ADR lineage decisions it relies on');
    fail(errors, unique(declared.map(row => row?.decision)), '010: the ADR lineage decision references repeat a decision');
    for (const row of declared) {
        const decision = decisions.get(row?.decision);
        fail(errors, Boolean(decision), `010: ${row?.decision ?? '(missing)'}: referenced ADR lineage decision does not exist`);
        if (decision === undefined) continue;
        const carrying = [decision.carriedBy, decision.amendedBy].filter(Boolean);
        for (const id of carrying) {
            fail(errors, citedIds.has(id), `010: ${row.decision}: the ADR that carries the lineage decision (${id}) must be cited by path`);
        }
        fail(
            errors,
            carrying.includes(row?.carriedBy),
            `010: ${row.decision}: declared carrier ${row?.carriedBy ?? '(missing)'} is neither the lineage carrier nor its amendment`,
        );
    }

    const referenced = new Set();
    const requireDeclared = (value, label) => {
        if (value === undefined) return;
        referenced.add(value);
        fail(
            errors,
            declared.some(row => row?.decision === value),
            `${label}: references ADR lineage decision ${value}, which the model does not declare`,
        );
    };
    requireDeclared(model.authority?.adrDecision, '010A: authority');
    for (const concept of model.concepts ?? []) requireDeclared(concept?.adrDecision, `010A: ${concept?.concept ?? 'unknown'}`);
    for (const alias of model.aliases ?? []) requireDeclared(alias?.adrDecision, `010D: ${alias?.term ?? 'unknown'}`);
    for (const row of declared) {
        fail(errors, referenced.has(row?.decision), `010: declared ADR lineage decision ${row?.decision ?? '(missing)'} is not referenced by any model row`);
    }
}

/** Every file the contract cites must be retained with its exact-head identity: no unbound or partly-hashed readback. */
function validateReadback(model, root, options, errors) {
    const readback = model.readback;
    fail(errors, typeof readback === 'object' && readback !== null && !Array.isArray(readback), '010: the model must retain its exact-head readback');
    if (typeof readback !== 'object' || readback === null || Array.isArray(readback)) return;
    for (const [key, expected] of READBACK_CONVENTION) {
        fail(errors, readback[key] === expected, READBACK_MESSAGES[key]);
    }
    const head = readback.auditedHead;
    fail(errors, typeof head === 'object' && head !== null, '010: readback must record the exact head it audited');
    if (typeof head === 'object' && head !== null) {
        fail(errors, SHA40.test(head.sha ?? ''), '010: readback must record the exact 40-character head SHA it audited');
        fail(errors, nonempty(head.ref) && !/latest|current/i.test(head.ref), '010: readback head ref must be an exact non-latest ref');
        fail(errors, head.mode === 'exact-working-tree', '010: readback must be an exact working-tree audit');
    }
    const files = readback.files;
    fail(errors, Array.isArray(files), '010: readback must list the contract and carrier files it hashed');
    if (!Array.isArray(files)) return;
    fail(errors, files.length > 0, '010: readback must hash the files the contract cites');
    const ids = files.map(file => file?.id);
    const paths = files.map(file => file?.path);
    fail(errors, unique(ids), '010: readback repeats a file id');
    fail(errors, unique(paths.filter(candidate => typeof candidate === 'string')), '010: readback repeats a file');
    for (const [index, file] of files.entries()) {
        const label = `010: readback files[${index}]`;
        fail(errors, typeof file === 'object' && file !== null, `${label} must be an object`);
        if (typeof file !== 'object' || file === null) continue;
        fail(errors, nonempty(file.id), `${label}.id is required`);
        fail(errors, isRepoRelativePath(file.path), `${label}.path must be a repository-relative POSIX path`);
        fail(errors, SHA256.test(file.sha256 ?? ''), `${label}.sha256 must be an exact SHA-256`);
        fail(errors, Number.isInteger(file.bytes) && file.bytes >= 0, `${label}.bytes must be a non-negative integer`);
    }
    const expected = new Set();
    for (const pointer of [model.ownerMap, model.packageOwnership, model.exactAuthority, model.carrierMatrix, model.adrLineage]) {
        if (nonempty(pointer)) expected.add(pointer);
    }
    for (const concept of model.concepts ?? []) {
        const parts = splitCarrier(concept?.carrier);
        if (parts !== undefined) expected.add(parts.file);
    }
    for (const variant of model.receiptVariants ?? []) {
        const parts = splitCarrier(variant?.carrier);
        if (parts !== undefined) expected.add(parts.file);
    }
    const runnerParts = splitCarrier(model.migration?.runner);
    if (runnerParts !== undefined) expected.add(runnerParts.file);
    for (const adr of Array.isArray(model.authorityRecords?.adrs) ? model.authorityRecords.adrs : []) {
        if (nonempty(adr?.path)) expected.add(adr.path);
    }
    fail(
        errors,
        sameSet(paths.filter(candidate => typeof candidate === 'string'), [...expected]),
        '010: readback must hash exactly the contract and carrier files the model cites',
    );

    if (options.verifyReadback === false) return;
    for (const [index, file] of files.entries()) {
        if (typeof file !== 'object' || file === null || !isRepoRelativePath(file.path)) continue;
        const label = `010: readback files[${index}]`;
        const full = path.join(root, file.path);
        fail(errors, existsSync(full), `${label} does not exist on disk: ${file.path}`);
        if (!existsSync(full)) continue;
        const observed = readbackIdentity(readFileSync(full));
        if (Number.isInteger(file.bytes) && file.bytes >= 0) {
            fail(errors, observed.bytes === file.bytes, `${label} byte count does not match the retained readback`);
        }
        if (SHA256.test(file.sha256 ?? '')) {
            fail(errors, observed.sha256 === file.sha256, `${label} SHA-256 does not match the retained readback`);
        }
    }
}

export function loadCanonicalBundle(root = ROOT) {
    return {
        model: readJson(root, MODEL_PATH),
        owners: readJson(root, OWNER_MAP_PATH),
        packageOwnership: readJson(root, PACKAGE_OWNERSHIP_PATH),
        heads: readJson(root, EXACT_AUTHORITY_PATH),
        carriers: readJson(root, CARRIER_MATRIX_PATH),
        adrLineage: readJson(root, ADR_LINEAGE_PATH),
    };
}

function main() {
    try {
        const { model, owners, packageOwnership, heads, carriers, adrLineage } = loadCanonicalBundle();
        const errors = validateCanonicalModel(model, owners, packageOwnership, heads, carriers, adrLineage);
        if (errors.length) {
            for (const error of errors) process.stderr.write(`BLOCKED: ${error}\n`);
            process.exitCode = 1;
            return;
        }
        const digest = readbackIdentity(readFileSync(path.join(ROOT, MODEL_PATH))).sha256;
        process.stdout.write(`IV41-010 canonical-model contract valid; SHA-256 ${digest} ${MODEL_PATH}\n`);
        process.stdout.write('IV41-010 evidence classification: structural contract only; durable Q1 and migration qualification not-run\n');
    } catch (error) {
        process.stderr.write(`IV41-010 contract validation unavailable: ${error.message}\n`);
        process.exitCode = 2;
    }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main();
