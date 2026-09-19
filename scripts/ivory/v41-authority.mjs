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
    packageOwnership: 'configs/ivory-v41-package-ownership.json',
    carriers: 'configs/ivory-v41-carrier-matrix.json',
    gates: 'configs/ivory-v41-gates.json',
    qualification: 'configs/ivory-v41-qualification.json',
};
const SHA40 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const EXPECTED_HEAD_ROLES = ['detachedBaseline', 'foundationPr', 'selectedDev'];
const EXPECTED_N = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7'];
const EXPECTED_IVORY_PACKAGE_PATHS = [
    'packages/ivory-identity/package.json',
    'packages/ivory-tower-adapters/package.json',
    'packages/ivory-tower-agent-experiment/package.json',
    'packages/ivory-tower-api/package.json',
    'packages/ivory-tower-application/package.json',
    'packages/ivory-tower-content-policy/package.json',
    'packages/ivory-tower-contracts/package.json',
    'packages/ivory-tower-domain/package.json',
    'packages/ivory-tower-health/package.json',
    'packages/ivory-tower-infrastructure/package.json',
    'packages/ivory-tower-research-kernel/package.json',
    'packages/ivory-tower-worker/package.json',
];
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
const QUALIFICATION_STATUSES = ['not-run', 'qualified', 'no-go', 'inconclusive', 'blocked', 'deferred'];
const GAP_STATUSES = ['open', 'deferred', 'resolved'];
const REQUIRED_PACKAGE_RESPONSIBILITIES = [
    'identity',
    'domain',
    'application',
    'adapters',
    'storage',
    'researchProtocol',
    'evidence',
    'compute',
    'clients',
    'healthDiagnostics',
    'contentPolicy',
    'agentProposalHarness',
];

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

function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRepoRelativePath(value) {
    if (typeof value !== 'string' || value.length === 0 || value.includes('\\')) return false;
    if (path.posix.isAbsolute(value) || /^[a-zA-Z]:/.test(value)) return false;
    return value.split('/').every(part => part.length > 0 && part !== '.' && part !== '..');
}

function validateRepoRelativePath(value, label, errors) {
    push(isRepoRelativePath(value), errors, `${label} must be a repository-relative POSIX path`);
}

function verifyQualificationFile(root, relative, expectedSha, expectedBytes, label, options, errors) {
    if (options.verifyQualificationFiles === false) return;
    try {
        const bytes = readFileSync(path.join(root, relative));
        if (expectedBytes !== undefined) push(bytes.length === expectedBytes, errors, `${label} byte count does not match retained evidence`);
        const observedSha = createHash('sha256').update(bytes).digest('hex');
        push(observedSha === expectedSha, errors, `${label} SHA-256 does not match retained evidence`);
    } catch (error) {
        errors.push(`${label} cannot be read: ${error.message}`);
    }
}

function validateRunContext(context, selectedSha, root, options, errors) {
    const repository = isRecord(context?.repository) ? context.repository : {};
    push(typeof repository.remote === 'string' && repository.remote.length > 0, errors, 'IV41-005: runContext.repository.remote is required');
    push(typeof repository.ref === 'string' && repository.ref.length > 0 && !/latest|current/i.test(repository.ref), errors, 'IV41-005: runContext.repository.ref must be an exact non-latest ref');
    push(typeof repository.branch === 'string' && repository.branch.length > 0 && !/latest|current/i.test(repository.branch), errors, 'IV41-005: runContext.repository.branch must be an exact non-latest branch');
    push(SHA40.test(repository.headSha ?? ''), errors, 'IV41-005: runContext.repository.headSha must be an exact 40-character SHA');
    push(repository.headSha === selectedSha, errors, 'IV41-005: runContext.repository.headSha must match selected authority');
    push(SHA40.test(repository.treeSha ?? ''), errors, 'IV41-005: runContext.repository.treeSha must be an exact 40-character SHA');
    push(typeof repository.dirty === 'boolean', errors, 'IV41-005: runContext.repository.dirty is required');
    const authorityBasis = isRecord(repository.authorityBasis) ? repository.authorityBasis : {};
    push(authorityBasis.manifest === CONFIGS.heads, errors, 'IV41-005: runContext.repository.authorityBasis must name the exact-head manifest');
    push(authorityBasis.role === 'selectedDev', errors, 'IV41-005: runContext.repository.authorityBasis role must be selectedDev');
    push(authorityBasis.sha === selectedSha, errors, 'IV41-005: runContext.repository.authorityBasis SHA must match selected authority');
    push(authorityBasis.relation === 'equal', errors, 'IV41-005: runContext.repository.authorityBasis relation must be equal');

    const environment = isRecord(context?.environment) ? context.environment : {};
    const os = isRecord(environment.os) ? environment.os : {};
    const runtime = isRecord(environment.runtime) ? environment.runtime : {};
    const configuration = isRecord(environment.configuration) ? environment.configuration : {};
    push(typeof os.platform === 'string' && os.platform.length > 0, errors, 'IV41-005: runContext.environment.os.platform is required');
    push(typeof os.release === 'string' && os.release.length > 0, errors, 'IV41-005: runContext.environment.os.release is required');
    push(typeof os.arch === 'string' && os.arch.length > 0, errors, 'IV41-005: runContext.environment.os.arch is required');
    push(typeof runtime.node === 'string' && runtime.node.length > 0, errors, 'IV41-005: runContext.environment.runtime.node is required');
    push(typeof runtime.npm === 'string' && runtime.npm.length > 0, errors, 'IV41-005: runContext.environment.runtime.npm is required');
    push(typeof configuration.profile === 'string' && configuration.profile.length > 0, errors, 'IV41-005: runContext.environment.configuration.profile is required');
    push(configuration.secretValuesOmitted === true, errors, 'IV41-005: runContext.environment.configuration.secretValuesOmitted must be true');
    push(SHA256.test(configuration.lockfileSha256 ?? ''), errors, 'IV41-005: runContext.environment.configuration.lockfileSha256 must be an exact SHA-256');
    push(typeof environment.recordedAt === 'string' && !Number.isNaN(Date.parse(environment.recordedAt)), errors, 'IV41-005: runContext.environment.recordedAt must be a timestamp');

    const verifier = isRecord(context?.verifier) ? context.verifier : {};
    validateRepoRelativePath(verifier.module, 'IV41-005: runContext.verifier.module', errors);
    push(SHA256.test(verifier.moduleSha256 ?? ''), errors, 'IV41-005: runContext.verifier.moduleSha256 must be an exact SHA-256');
    push(typeof verifier.command === 'string' && verifier.command.length > 0, errors, 'IV41-005: runContext.verifier.command is required');
    push(typeof verifier.startedAt === 'string' && !Number.isNaN(Date.parse(verifier.startedAt)), errors, 'IV41-005: runContext.verifier.startedAt must be a timestamp');
    push(typeof verifier.finishedAt === 'string' && !Number.isNaN(Date.parse(verifier.finishedAt)), errors, 'IV41-005: runContext.verifier.finishedAt must be a timestamp');
    push(Number.isInteger(verifier.exitCode), errors, 'IV41-005: runContext.verifier.exitCode is required');
    if (isRepoRelativePath(verifier.module) && SHA256.test(verifier.moduleSha256 ?? '')) {
        verifyQualificationFile(root, verifier.module, verifier.moduleSha256, undefined, 'IV41-005: verifier module', options, errors);
    }
}

function validateQualificationFileRecord(record, label, root, options, errors, requireTracked) {
    push(isRecord(record), errors, `${label} must be an object`);
    if (!isRecord(record)) return;
    push(typeof record.id === 'string' && record.id.length > 0, errors, `${label}.id is required`);
    validateRepoRelativePath(record.path, `${label}.path`, errors);
    push(SHA256.test(record.sha256 ?? ''), errors, `${label}.sha256 must be an exact SHA-256`);
    push(Number.isInteger(record.bytes) && record.bytes >= 0, errors, `${label}.bytes must be a non-negative integer`);
    if (requireTracked) push(typeof record.tracked === 'boolean', errors, `${label}.tracked is required`);
    if (isRepoRelativePath(record.path) && SHA256.test(record.sha256 ?? '') && Number.isInteger(record.bytes) && record.bytes >= 0) {
        verifyQualificationFile(root, record.path, record.sha256, record.bytes, label, options, errors);
    }
}

function validateArchitecturalGap(gap, label, errors) {
    push(isRecord(gap), errors, `${label} must be an object`);
    if (!isRecord(gap)) return;
    push(/^IV41-\d+$/.test(gap.issue ?? ''), errors, `${label} must point to a tracked IV41 issue`);
    push(typeof gap.summary === 'string' && gap.summary.length > 0, errors, `${label}.summary is required`);
    push(GAP_STATUSES.includes(gap.status), errors, `${label}.status is invalid`);
    if (gap.surface !== undefined) push(typeof gap.surface === 'string' && gap.surface.length > 0, errors, `${label}.surface must be a non-empty string`);
    if (gap.missingField !== undefined) push(typeof gap.missingField === 'string' && gap.missingField.length > 0, errors, `${label}.missingField must be a non-empty string`);
}

function validateObservation(value, label, errors) {
    push(isRecord(value), errors, `${label} must be an object`);
    if (isRecord(value)) push(typeof value.status === 'string' && value.status.length > 0, errors, `${label}.status is required`);
}

function validateQualificationRecord(record, gateId, root, options, errors) {
    const label = `IV41-005 ${gateId}`;
    push(isRecord(record), errors, `${label}: record must be an object`);
    if (!isRecord(record)) return;
    push(record.schema === 'ivory-v41-qualification-record/1', errors, `${label}: unexpected record schema`);
    push(record.gate === gateId, errors, `${label}: record gate must match registry gate`);
    for (const field of ['aggregatePass', 'overallPass', 'overallStatus']) {
        push(record[field] === undefined, errors, `${label}: aggregate outcome field ${field} is forbidden`);
    }

    push(Array.isArray(record.fixtures), errors, `${label}: fixtures must be an array`);
    push(Array.isArray(record.evidence), errors, `${label}: evidence must be an array`);
    push(isRecord(record.observations), errors, `${label}: observations must be an object`);
    push(isRecord(record.decision), errors, `${label}: decision must be an object`);
    push(Array.isArray(record.limitations), errors, `${label}: limitations must be an array`);
    push(Array.isArray(record.architecturalGaps), errors, `${label}: architecturalGaps must be an array`);

    const fixtures = Array.isArray(record.fixtures) ? record.fixtures : [];
    const evidence = Array.isArray(record.evidence) ? record.evidence : [];
    const fixturePaths = fixtures.map(item => item?.path);
    const evidencePaths = evidence.map(item => item?.path);
    push(duplicates(fixturePaths).length === 0, errors, `${label}: duplicate fixture paths are forbidden`);
    push(duplicates(evidencePaths).length === 0, errors, `${label}: duplicate evidence paths are forbidden`);
    fixtures.forEach((item, index) => validateQualificationFileRecord(item, `${label}.fixtures[${index}]`, root, options, errors, false));
    evidence.forEach((item, index) => validateQualificationFileRecord(item, `${label}.evidence[${index}]`, root, options, errors, true));

    const observations = isRecord(record.observations) ? record.observations : {};
    validateObservation(observations.machine, `${label}.observations.machine`, errors);
    validateObservation(observations.human, `${label}.observations.human`, errors);
    const decision = isRecord(record.decision) ? record.decision : {};
    push(QUALIFICATION_STATUSES.includes(decision.status), errors, `${label}: decision.status is invalid`);
    push(typeof decision.rationale === 'string' && decision.rationale.length > 0, errors, `${label}: decision.rationale is required`);

    const limitations = Array.isArray(record.limitations) ? record.limitations : [];
    for (const [index, limitation] of limitations.entries()) {
        const limitationLabel = `${label}.limitations[${index}]`;
        push(isRecord(limitation), errors, `${limitationLabel} must be an object`);
        if (!isRecord(limitation)) continue;
        for (const field of ['id', 'kind', 'effect', 'statement']) {
            push(typeof limitation[field] === 'string' && limitation[field].length > 0, errors, `${limitationLabel}.${field} is required`);
        }
    }
    push(limitations.length > 0, errors, `${label}: at least one limitation is required`);

    const gaps = Array.isArray(record.architecturalGaps) ? record.architecturalGaps : [];
    for (const [index, gap] of gaps.entries()) validateArchitecturalGap(gap, `${label}.architecturalGaps[${index}]`, errors);

    if (decision.status === 'not-run') {
        push(fixtures.length === 0, errors, `${label}: not-run records cannot claim fixtures`);
        push(evidence.length === 0, errors, `${label}: not-run records cannot claim evidence`);
        push(observations.machine?.status === 'not-run', errors, `${label}: not-run machine observation is required`);
        push(observations.human?.status === 'not-run', errors, `${label}: not-run human observation is required`);
        return;
    }

    push(nonEmptyArray(fixtures), errors, `${label}: terminal records require retained fixtures`);
    push(nonEmptyArray(evidence), errors, `${label}: terminal records require retained evidence`);
    if (decision.status === 'qualified') {
        push(isRecord(options.runContext), errors, `${label}: qualified records require run context`);
        push(options.runContext?.repository?.dirty === false, errors, `${label}: qualified records require a clean worktree`);
        push(options.runContext?.verifier?.exitCode === 0, errors, `${label}: qualified records require a zero verifier exit code`);
        push(['human', 'joint'].includes(decision.authority), errors, `${label}: qualified decisions require human or joint authority`);
        push(typeof decision.qualificationLevel === 'string' && decision.qualificationLevel.length > 0, errors, `${label}: qualified decisions require a qualification level`);
        push(isRecord(decision.scope), errors, `${label}: qualified decisions require scope`);
        for (const field of ['fixtures', 'platforms', 'components']) {
            push(nonEmptyArray(decision.scope?.[field]), errors, `${label}: qualified decision scope requires ${field}`);
        }
        push(evidence.some(item => item?.tracked === true), errors, `${label}: qualified decisions require tracked evidence`);
    }
}

function validateQualification(qualification, bundle, options, errors) {
    push(isRecord(qualification), errors, 'IV41-005: qualification manifest must be an object');
    if (!isRecord(qualification)) return;
    push(qualification.schema === 'ivory-v41-qualification/1', errors, 'IV41-005: unexpected schema');
    push(qualification.issue === 'IV41-005', errors, 'IV41-005: issue id must be IV41-005');
    push(qualification.dependsOn === 'V41-I01.4', errors, 'IV41-005: dependency must remain V41-I01.4');
    push(qualification.recordSchema === 'ivory-v41-qualification-record/1', errors, 'IV41-005: unexpected record schema');
    push(qualification.basis?.heads === CONFIGS.heads, errors, 'IV41-005: basis must bind to the exact-head manifest');
    push(qualification.basis?.owners === CONFIGS.owners, errors, 'IV41-005: basis must bind to the owner map');
    push(qualification.basis?.packageOwnership === CONFIGS.packageOwnership, errors, 'IV41-005: basis must bind to package ownership');
    push(qualification.basis?.carriers === CONFIGS.carriers, errors, 'IV41-005: basis must bind to the carrier matrix');
    push(qualification.basis?.gates === CONFIGS.gates, errors, 'IV41-005: basis must bind to the gate registry');
    push(qualification.digestConvention?.algorithm === 'sha256', errors, 'IV41-005: digest algorithm must be SHA-256');
    push(qualification.digestConvention?.encoding === 'raw-bytes', errors, 'IV41-005: digest encoding must be raw bytes');
    push(qualification.digestConvention?.pathSeparator === '/', errors, 'IV41-005: digest paths must use POSIX separators');
    push(qualification.digestConvention?.lineEndingPolicy === 'preserve-bytes', errors, 'IV41-005: digest line-ending policy must preserve bytes');
    push(qualification.authorityBoundary?.role === 'qualification-records-only', errors, 'IV41-005: qualification authority boundary is invalid');
    push(qualification.authorityBoundary?.mayWriteCanonicalResearchState === false, errors, 'IV41-005: qualification records cannot write canonical research state');
    push(qualification.authorityBoundary?.mayDecideResearchAcceptance === false, errors, 'IV41-005: qualification records cannot decide research acceptance');
    for (const field of ['aggregatePass', 'overallPass', 'overallStatus']) {
        push(qualification[field] === undefined, errors, `IV41-005: aggregate outcome field ${field} is forbidden`);
    }

    const rows = Array.isArray(qualification.gates) ? qualification.gates : [];
    const ids = rows.map(row => row?.id);
    push(sameSet(ids, REQUIRED_GATES), errors, 'IV41-005: qualification records must cover every V4.1 gate exactly once');
    push(duplicates(ids).length === 0, errors, `IV41-005: duplicate qualification gates: ${duplicates(ids).join(', ')}`);
    const records = rows.map(row => row?.record);
    const statuses = records.map(record => record?.decision?.status);
    const allNotRun = ids.length === REQUIRED_GATES.length && statuses.every(status => status === 'not-run');
    if (allNotRun) {
        push(qualification.runContext === null, errors, 'IV41-005: not-run manifest must have a null runContext');
    } else {
        push(isRecord(qualification.runContext), errors, 'IV41-005: terminal records require runContext');
        if (isRecord(qualification.runContext)) {
            const selectedDev = (bundle.heads?.heads ?? []).find(head => head.role === 'selectedDev');
            validateRunContext(qualification.runContext, selectedDev?.sha, options.root, options, errors);
        }
    }
    for (const row of rows) {
        validateQualificationRecord(row?.record, row?.id, options.root, { ...options, runContext: qualification.runContext }, errors);
    }
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
    push(sameSet(packages.map(item => item.path), EXPECTED_IVORY_PACKAGE_PATHS), errors, 'I01.1: package inventory must exactly match the selected-dev Ivory package tree');
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

function validatePackageOwnership(packageOwnership, heads, owners, errors) {
    push(packageOwnership.schema === 'ivory-v41-package-ownership/1', errors, 'IV41-003: unexpected schema');
    push(packageOwnership.issue === 'IV41-003', errors, 'IV41-003: issue id must be IV41-003');
    push(packageOwnership.dependsOn === 'IV41-001', errors, 'IV41-003: dependency must remain IV41-001');
    push(packageOwnership.basisManifest === CONFIGS.heads, errors, 'IV41-003: package ownership must bind to the exact-head manifest');
    push(packageOwnership.basisOwnerMap === CONFIGS.owners, errors, 'IV41-003: package ownership must bind to the structural owner map');

    const context = packageOwnership.evidenceContext ?? {};
    const selectedDev = (heads.heads ?? []).find(head => head.role === 'selectedDev');
    push(context.repository === 'mberrys/ivory', errors, 'IV41-003: evidence context must identify mberrys/ivory');
    push(context.pullRequest === 3, errors, 'IV41-003: evidence context must identify PR #3');
    push(context.branch === 'feat/v41-p01-authority-carriers', errors, 'IV41-003: evidence context must identify the implementation branch');
    push(context.authorityBasis?.role === 'selectedDev', errors, 'IV41-003: evidence authority basis must be selectedDev');
    push(context.authorityBasis?.sha === selectedDev?.sha, errors, 'IV41-003: evidence authority SHA must match the exact selected-dev SHA');
    push(context.authorityBasis?.packageInventory === CONFIGS.heads, errors, 'IV41-003: evidence context must point to the exact package inventory');
    push(SHA40.test(context.implementationObservation?.headBeforeIssue ?? ''), errors, 'IV41-003: pre-issue PR head must be an exact 40-character SHA');
    push(typeof context.implementationObservation?.packageManager === 'string' && context.implementationObservation.packageManager.length > 0, errors, 'IV41-003: package-manager context is required');
    push(typeof context.implementationObservation?.nodeEngine === 'string' && context.implementationObservation.nodeEngine.length > 0, errors, 'IV41-003: Node engine context is required');

    const packages = packageOwnership.packages ?? [];
    const inventoryNames = (heads.packages ?? []).map(item => item.name);
    const names = packages.map(item => item.name);
    push(sameSet(names, inventoryNames), errors, 'IV41-003: package ownership must cover the exact selected-dev package inventory');
    push(duplicates(names).length === 0, errors, `IV41-003: duplicate package ownership entries: ${duplicates(names).join(', ')}`);

    const responsibilities = packages.flatMap(item => item.responsibilityIds ?? []);
    push(sameSet(responsibilities, REQUIRED_PACKAGE_RESPONSIBILITIES), errors, 'IV41-003: every V4.1 package responsibility must have exactly one canonical owner');
    push(duplicates(responsibilities).length === 0, errors, `IV41-003: duplicate canonical responsibility owners: ${duplicates(responsibilities).join(', ')}`);

    for (const item of packages) {
        push(nonEmptyArray(item.responsibilityIds), errors, `IV41-003: ${item.name ?? 'package'} must own at least one declared responsibility`);
        push(nonEmptyArray(item.owns), errors, `IV41-003: ${item.name ?? 'package'} must declare its owned scope`);
        push(nonEmptyArray(item.mustNotOwn), errors, `IV41-003: ${item.name ?? 'package'} must declare forbidden scope`);
        push(typeof item.authority === 'object' && item.authority !== null, errors, `IV41-003: ${item.name ?? 'package'} must declare authority flags`);
    }

    const acceptanceOwners = packages.filter(item => item.authority?.researchAcceptance === true).map(item => item.name);
    const writeOwners = packages.filter(item => item.authority?.researchStateWrite === true).map(item => item.name);
    const storageOwners = packages.filter(item => item.authority?.durableStorageImplementation === true).map(item => item.name);
    push(sameSet(acceptanceOwners, ['@ivory-tower/research-kernel']), errors, 'IV41-003: research acceptance must have exactly one owner: @ivory-tower/research-kernel');
    push(sameSet(writeOwners, ['@ivory-tower/research-kernel']), errors, 'IV41-003: canonical research-state writes must have exactly one owner: @ivory-tower/research-kernel');
    push(sameSet(storageOwners, ['@ivory-tower/infrastructure']), errors, 'IV41-003: durable storage implementation must have exactly one owner: @ivory-tower/infrastructure');
    push(packageOwnership.canonicalAuthority?.researchAcceptance === '@ivory-tower/research-kernel', errors, 'IV41-003: canonical acceptance owner must be research-kernel');
    push(packageOwnership.canonicalAuthority?.researchStateWrite === '@ivory-tower/research-kernel', errors, 'IV41-003: canonical research write owner must be research-kernel');
    push(packageOwnership.canonicalAuthority?.durableStorageImplementation === '@ivory-tower/infrastructure', errors, 'IV41-003: durable storage implementation owner must be infrastructure');

    const gapPolicy = packageOwnership.gapPolicy ?? {};
    push(gapPolicy.trackingRequired === true, errors, 'IV41-003: architectural gaps must require issue tracking');
    push(gapPolicy.sessionNotesAreAuthority === false, errors, 'IV41-003: session notes cannot be gap-tracking authority');
    push(gapPolicy.requiredIssuePrefix === 'IV41-', errors, 'IV41-003: gaps must use the IV41 issue namespace');
    push(Array.isArray(gapPolicy.discoveredGaps), errors, 'IV41-003: discovered gaps must be an explicit array');
    const trackedGapKeys = [];
    for (const gap of gapPolicy.discoveredGaps ?? []) {
        const label = `${gap.surface ?? 'unknown'}:${gap.missingField ?? 'unknown'}`;
        push(typeof gap.issue === 'string' && gap.issue.startsWith('IV41-'), errors, `IV41-003: architectural gap ${label} must point to a tracked IV41 issue`);
        push(typeof gap.summary === 'string' && gap.summary.length > 0, errors, `IV41-003: architectural gap ${label} needs a summary`);
        push(typeof gap.surface === 'string' && gap.surface.length > 0, errors, `IV41-003: architectural gap ${label} must name its owner-map surface`);
        push(typeof gap.missingField === 'string' && gap.missingField.length > 0, errors, `IV41-003: architectural gap ${label} must name the exact missing field`);
        trackedGapKeys.push(`${gap.surface}::${gap.missingField}`);
    }
    const expectedGapKeys = (owners.surfaces ?? []).flatMap(surface =>
        (surface.missingFields ?? []).map(missingField => `${surface.canonicalKey}::${missingField}`),
    );
    push(sameSet(trackedGapKeys, expectedGapKeys), errors, 'IV41-003: every discovered owner-map gap must be tracked by an IV41 issue');
    push(duplicates(trackedGapKeys).length === 0, errors, `IV41-003: duplicate tracked gap records: ${duplicates(trackedGapKeys).join(', ')}`);
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
    validatePackageOwnership(bundle.packageOwnership, bundle.heads, bundle.owners, errors);
    validateCarriers(bundle.carriers, errors);
    validateGates(bundle.gates, errors);
    validateQualification(bundle.qualification, bundle, { ...options, root }, errors);
    return errors;
}

export function loadBundle(root = ROOT) {
    return {
        heads: readJson(root, CONFIGS.heads),
        owners: readJson(root, CONFIGS.owners),
        packageOwnership: readJson(root, CONFIGS.packageOwnership),
        carriers: readJson(root, CONFIGS.carriers),
        gates: readJson(root, CONFIGS.gates),
        qualification: readJson(root, CONFIGS.qualification),
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
    process.stdout.write('V4.1 authority reconciliation: valid (V41-P01 4/4 leaves + IV41-003 package ownership + IV41-005 qualification manifest)\n');
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
