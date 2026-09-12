// @ts-check
'use strict';

/**
 * Enforces the Ivory Tower dependency, licensing, and pinning policy (IV-19).
 *
 * Run via: npm run dependency:policy
 *
 * The gate is fail-closed and offline. Every input — workspace manifests, `package-lock.json`,
 * and the Compose/runtime image references — is read from the working tree, so the result is
 * reproducible from a commit without an install, a registry, or an external scanner.
 *
 * Flags:
 *   --root <dir>   audit a different tree (used by the adversarial fixtures)
 *   --fixtures     run the adversarial fixture suite and assert each one still fails
 *   --quiet        suppress the success summary
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readLockfile, dependencyClosure, packageNameFromKey } from './ivory-lockfile.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(SCRIPT_DIR, '..');

const REQUIRED_INVENTORY_FIELDS = [
    'allowed', 'scope', 'purpose', 'owner', 'license', 'networkCapable',
    'dataBoundary', 'sourceContentCrossesBoundary', 'versionPolicy', 'replacementPath',
];
const REQUIRED_EXCEPTION_FIELDS = ['kind', 'subject', 'reason', 'owner', 'expires', 'compensatingControl'];
const IMAGE_SOURCE_FILES = [
    'infra/docker-compose.yml',
    '.env.example',
    'scripts/verify-ivory-runtime.mjs',
    'scripts/verify-ivory-session-04.mjs',
    'packages/ivory-tower-infrastructure/src/environment.ts',
];
const IMAGE_REFERENCE_PATTERN =
    /\b(?:[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)+:[A-Za-z0-9][A-Za-z0-9._-]*(?:@sha256:[a-f0-9]{64})?/g;
const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/u;
const RANGE_VERSION_PATTERN = /^[\^~]?\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/u;

/** @param {string} pattern */
function globToRegExp(pattern) {
    let source = '';
    for (let index = 0; index < pattern.length; index++) {
        const character = pattern[index];
        if (character === '{') {
            const close = pattern.indexOf('}', index);
            if (close !== -1) {
                const alternatives = pattern.slice(index + 1, close).split(',');
                source += `(?:${alternatives.map(alternative => alternative.replace(/[\\^$.|?*+()[\]{}]/gu, '\\$&')).join('|')})`;
                index = close;
                continue;
            }
            source += '\\{';
        } else if (character === '*') {
            if (pattern[index + 1] === '*') {
                source += '.*';
                index++;
                if (pattern[index + 1] === '/') {
                    index++;
                    source += '(?:/)?';
                }
            } else {
                source += '[^/]*';
            }
        } else if ('\\^$.|?+()[]{}'.includes(character)) {
            source += `\\${character}`;
        } else {
            source += character;
        }
    }
    return new RegExp(`^${source}$`, 'u');
}

/** @param {string} value @param {string} pattern */
function globMatches(value, pattern) {
    return globToRegExp(pattern).test(value);
}

/**
 * Classify an SPDX licence expression against the policy classes.
 * An `OR` expression passes if any operand is allowed; an `AND` expression requires all of them.
 *
 * @param {string | undefined} expression
 * @param {{ allowed: string[], reviewRequired: string[], prohibited: string[] }} classes
 * @returns {'allowed' | 'review-required' | 'prohibited' | 'unknown'}
 */
export function classifyLicense(expression, classes) {
    if (expression === undefined || expression === null || expression.trim() === '') {
        return 'unknown';
    }
    const normalized = expression.trim();
    // Exact match first: compound expressions such as Theia's dual licence are declared verbatim.
    if (classes.allowed.includes(normalized)) {
        return 'allowed';
    }
    if (classes.prohibited.includes(normalized)) {
        return 'prohibited';
    }
    if (classes.reviewRequired.includes(normalized)) {
        return 'review-required';
    }

    const unwrapped = normalized.replace(/^\((.*)\)$/su, '$1').trim();
    if (unwrapped !== normalized) {
        return classifyLicense(unwrapped, classes);
    }
    if (/\sOR\s/u.test(normalized)) {
        const operands = normalized.split(/\sOR\s/u).map(operand => classifyLicense(operand, classes));
        if (operands.includes('allowed')) {
            return 'allowed';
        }
        return operands.includes('review-required') ? 'review-required' : operands[0];
    }
    if (/\sAND\s/u.test(normalized)) {
        const operands = normalized.split(/\sAND\s/u).map(operand => classifyLicense(operand, classes));
        if (operands.every(operand => operand === 'allowed')) {
            return 'allowed';
        }
        if (operands.includes('prohibited')) {
            return 'prohibited';
        }
        return operands.includes('unknown') ? 'unknown' : 'review-required';
    }
    return 'unknown';
}

/** @param {string} root */
function readJsonIfPresent(root, relativePath) {
    const absolute = path.join(root, relativePath);
    return fs.existsSync(absolute) ? JSON.parse(fs.readFileSync(absolute, 'utf8')) : undefined;
}

/**
 * Discover Ivory-owned workspaces by manifest name rather than by directory prefix, so
 * `@theia/ivory-identity` is audited by the same gate as `@ivory-tower/*` (IV-19 step 2).
 *
 * @param {string} root
 * @param {string[]} namePatterns
 */
function discoverIvoryPackages(root, namePatterns) {
    const discovered = [];
    for (const container of ['packages', 'examples']) {
        const containerPath = path.join(root, container);
        if (!fs.existsSync(containerPath)) {
            continue;
        }
        for (const entry of fs.readdirSync(containerPath, { withFileTypes: true })) {
            if (!entry.isDirectory()) {
                continue;
            }
            const manifestPath = path.join(containerPath, entry.name, 'package.json');
            if (!fs.existsSync(manifestPath)) {
                continue;
            }
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (typeof manifest.name === 'string' && namePatterns.some(pattern => globMatches(manifest.name, pattern))) {
                discovered.push({
                    manifest,
                    manifestPath,
                    directory: `${container}/${entry.name}`,
                });
            }
        }
    }
    return discovered.sort((a, b) => a.directory.localeCompare(b.directory));
}

/**
 * @param {string} root
 * @returns {string[]}
 */
function auditTree(root) {
    /** @type {string[]} */
    const violations = [];
    const policy = readJsonIfPresent(root, 'configs/ivory-dependency-policy.json');
    if (!policy) {
        return ['configs/ivory-dependency-policy.json is missing; the dependency policy gate cannot run.'];
    }

    const classes = policy.licenseClasses;
    const namePatterns = policy.qualityScope?.packageNamePatterns ?? [];
    const inventory = policy.packages ?? {};
    const exceptions = policy.exceptions ?? [];
    const usedExceptions = new Set();
    const today = new Date().toISOString().slice(0, 10);

    /**
     * @param {string} kind
     * @param {string} subject
     */
    function findException(kind, subject) {
        const index = exceptions.findIndex(entry => entry.kind === kind && entry.subject === subject);
        if (index === -1) {
            return undefined;
        }
        usedExceptions.add(index);
        return exceptions[index];
    }

    // ---- 1. Ivory-owned packages -------------------------------------------------------------
    const ivoryPackages = discoverIvoryPackages(root, namePatterns);
    if (ivoryPackages.length === 0) {
        violations.push(`No Ivory-owned workspace matches ${namePatterns.join(', ')}; the audit scope is empty.`);
    }
    const ivoryNames = new Set(ivoryPackages.map(entry => entry.manifest.name));

    for (const { manifest, directory } of ivoryPackages) {
        if (classifyLicense(manifest.license, classes) !== 'allowed') {
            violations.push(`${directory}/package.json declares licence "${manifest.license ?? '<none>'}", which is not an allowed licence expression.`);
        }

        const declared = {
            ...manifest.dependencies,
            ...manifest.devDependencies,
            ...manifest.peerDependencies,
        };
        for (const [name, range] of Object.entries(declared)) {
            if (ivoryNames.has(name)) {
                if (!EXACT_VERSION_PATTERN.test(String(range))) {
                    violations.push(`${directory}/package.json must pin the first-party dependency ${name} exactly; found "${range}".`);
                }
                continue;
            }

            const record = inventory[name];
            if (!record) {
                violations.push(`${directory}/package.json depends on ${name}, which has no entry in the dependency inventory (configs/ivory-dependency-policy.json "packages"). Record purpose, owner, licence, data boundary, version policy, and replacement path before adding it.`);
                continue;
            }
            const missingFields = REQUIRED_INVENTORY_FIELDS.filter(field => record[field] === undefined);
            if (missingFields.length > 0) {
                violations.push(`Inventory entry for ${name} is missing required field(s): ${missingFields.join(', ')}.`);
            }
            if (record.allowed !== true) {
                violations.push(`${directory}/package.json depends on ${name}, which the dependency inventory does not allow.`);
            }
            const licenseClass = classifyLicense(record.license, classes);
            if (licenseClass === 'prohibited') {
                violations.push(`${directory}/package.json depends on ${name}, whose recorded licence "${record.license}" is a prohibited licence class.`);
            } else if (licenseClass !== 'allowed' && !findException('license-review', `${name}@${record.version ?? 'direct'}`)) {
                violations.push(`${directory}/package.json depends on ${name}, whose recorded licence "${record.license}" requires review and has no recorded exception.`);
            }
            if (record.versionPolicy === 'exact' && !EXACT_VERSION_PATTERN.test(String(range))) {
                violations.push(`${directory}/package.json must pin ${name} to an exact version (policy "exact"); found "${range}".`);
            }
            if (record.versionPolicy === 'range' && !RANGE_VERSION_PATTERN.test(String(range))) {
                violations.push(`${directory}/package.json declares ${name} as "${range}", which is not a reviewable version range.`);
            }
        }
    }

    // ---- 2. Quality scope --------------------------------------------------------------------
    const rootManifest = readJsonIfPresent(root, 'package.json');
    const requiredScripts = policy.qualityScope?.requiredScripts ?? [];
    if (rootManifest && requiredScripts.length > 0) {
        const scripts = rootManifest.scripts ?? {};
        for (const scriptName of requiredScripts) {
            const script = scripts[scriptName];
            if (typeof script !== 'string') {
                violations.push(`Root package.json is missing the required script "${scriptName}".`);
                continue;
            }
            if (scriptName === 'dependency:policy') {
                continue;
            }
            const scopePatterns = [...script.matchAll(/--scope\s+"?([^"\s]+)"?/gu)].map(match => match[1]);
            const globPatterns = [...script.matchAll(/"([^"]*\*[^"]*)"/gu)].map(match => match[1]);
            for (const { manifest, directory } of ivoryPackages) {
                const coveredByScope = scopePatterns.some(pattern => globMatches(manifest.name, pattern));
                const coveredByGlob = globPatterns.some(pattern =>
                    globMatches(`${directory}/src/probe.ts`, pattern)
                    || globMatches(`${directory}/src/nested/probe.tsx`, pattern)
                    || globMatches(`${directory}/probe.ts`, pattern));
                if (!coveredByScope && !coveredByGlob) {
                    violations.push(`${manifest.name} (${directory}) is outside the quality scope of "${scriptName}"; a defect there would not fail the required gate.`);
                }
            }
        }
    }

    // ---- 3. Transitive licence closure of every deployable -----------------------------------
    const lockfile = readLockfile(root);
    const deployables = policy.deployables ?? {};
    if (lockfile && Object.keys(deployables).length > 0) {
        const seenComponents = new Map();
        for (const [label, deployable] of Object.entries(deployables)) {
            if (!lockfile.packages[deployable.workspace]) {
                violations.push(`Deployable "${label}" points at ${deployable.workspace}, which is not present in package-lock.json.`);
                continue;
            }
            const closure = dependencyClosure(lockfile.packages, [deployable.workspace]);
            for (const unresolved of closure.unresolved) {
                violations.push(`Deployable "${label}" has an unresolved dependency edge: ${unresolved}.`);
            }
            for (const key of closure.thirdParty) {
                const entry = lockfile.packages[key];
                const component = `${packageNameFromKey(key)}@${entry.version}`;
                if (!seenComponents.has(component)) {
                    seenComponents.set(component, { license: entry.license, deployables: [] });
                }
                seenComponents.get(component).deployables.push(label);
            }
        }

        for (const [component, info] of [...seenComponents.entries()].sort()) {
            const licenseClass = classifyLicense(info.license, classes);
            if (licenseClass === 'allowed') {
                continue;
            }
            if (licenseClass === 'prohibited') {
                violations.push(`${component} carries the prohibited licence "${info.license}" and ships in ${info.deployables.join(', ')}. A prohibited licence has no exception path.`);
                continue;
            }
            const kind = licenseClass === 'unknown' ? 'license-unknown' : 'license-review';
            const exception = findException(kind, component);
            if (!exception) {
                const detail = licenseClass === 'unknown' ? 'declares no licence' : `carries the review-required licence "${info.license}"`;
                violations.push(`${component} ${detail} and ships in ${info.deployables.join(', ')}, with no recorded ${kind} exception.`);
            }
        }
    }

    // ---- 4. Image pinning --------------------------------------------------------------------
    const images = policy.images ?? {};
    const mutableTags = policy.mutableTagPatterns ?? [];
    const registeredRefs = new Map(Object.entries(images).map(([label, image]) => [image.ref, { label, ...image }]));
    for (const relativePath of IMAGE_SOURCE_FILES) {
        const absolute = path.join(root, relativePath);
        if (!fs.existsSync(absolute)) {
            continue;
        }
        const contents = fs.readFileSync(absolute, 'utf8');
        for (const match of contents.matchAll(IMAGE_REFERENCE_PATTERN)) {
            const reference = match[0];
            const tag = reference.split('@')[0].split(':').pop() ?? '';
            if (mutableTags.includes(tag)) {
                violations.push(`${relativePath} references the mutable image tag "${reference}". Production images must be digest-pinned; no mutable tag is admissible.`);
                continue;
            }
            const registered = registeredRefs.get(reference);
            if (!registered) {
                violations.push(`${relativePath} references the unregistered image "${reference}". Add it to configs/ivory-dependency-policy.json "images" with an owner and purpose.`);
                continue;
            }
            if (registered.digestRequired === true && !reference.includes('@sha256:')) {
                violations.push(`Image "${registered.label}" is declared for the ${registered.environment} environment and must be digest-pinned; ${relativePath} references "${reference}".`);
            }
            if (registered.digestRequired !== true) {
                for (const field of ['owner', 'reason', 'expires', 'compensatingControl']) {
                    if (registered[field] === undefined) {
                        violations.push(`Image "${registered.label}" is not digest-pinned and must record ${field}.`);
                    }
                }
                if (typeof registered.expires === 'string' && registered.expires < today) {
                    violations.push(`Image "${registered.label}" carries an expired pinning exception (expired ${registered.expires}).`);
                }
            }
        }
    }

    // ---- 5. Exception register ---------------------------------------------------------------
    exceptions.forEach((exception, index) => {
        const missing = REQUIRED_EXCEPTION_FIELDS.filter(field => typeof exception[field] !== 'string');
        if (missing.length > 0) {
            violations.push(`Exception #${index + 1} (${exception.subject ?? 'unnamed'}) is missing required field(s): ${missing.join(', ')}.`);
            return;
        }
        if (exception.expires < today) {
            violations.push(`Exception for ${exception.subject} expired on ${exception.expires} and must be re-reviewed or removed.`);
        }
        if (lockfile && !usedExceptions.has(index)) {
            violations.push(`Exception for ${exception.subject} (${exception.kind}) no longer matches anything in the tree; remove the stale record.`);
        }
    });

    for (const advisory of policy.advisoryExceptions ?? []) {
        const missing = ['package', 'advisory', 'reason', 'owner', 'expires'].filter(field => typeof advisory[field] !== 'string');
        if (missing.length > 0) {
            violations.push(`Every advisory exception requires package, advisory, reason, owner, and expires; missing ${missing.join(', ')}.`);
        }
    }

    return violations;
}

/** Run each adversarial fixture through this same script and require it to fail. */
function runFixtures() {
    const fixtureManifest = path.join(SCRIPT_DIR, 'ivory-dependency-policy-fixtures.json');
    const fixtures = JSON.parse(fs.readFileSync(fixtureManifest, 'utf8'));
    const failures = [];

    for (const fixture of fixtures) {
        const fixtureRoot = path.join(SCRIPT_DIR, 'fixtures', 'dependency-policy', fixture.name);
        if (!fs.existsSync(fixtureRoot)) {
            failures.push(`${fixture.name}: fixture directory is missing.`);
            continue;
        }
        const gateScript = fixture.gate === 'secret-scan' ? 'check-ivory-secrets.mjs' : 'check-ivory-dependency-policy.mjs';
        let output = '';
        let exitCode = 0;
        try {
            output = execFileSync(process.execPath, [path.join(SCRIPT_DIR, gateScript), '--root', fixtureRoot], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        } catch (error) {
            exitCode = typeof error.status === 'number' ? error.status : 1;
            output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
        }
        if (exitCode === 0) {
            failures.push(`${fixture.name}: the gate PASSED, but this fixture must be rejected (${fixture.description}).`);
        } else if (!output.includes(fixture.expect)) {
            failures.push(`${fixture.name}: the gate failed, but not for the expected reason. Expected text "${fixture.expect}" in:\n${output.trim()}`);
        }
    }

    return { failures, count: fixtures.length };
}

const argv = process.argv.slice(2);
const rootIndex = argv.indexOf('--root');
const auditRoot = rootIndex === -1 ? REPO_ROOT : path.resolve(argv[rootIndex + 1]);
const quiet = argv.includes('--quiet');

const violations = auditTree(auditRoot);
if (violations.length > 0) {
    console.error('Ivory Tower dependency policy violations:');
    for (const violation of violations) {
        console.error(`  - ${violation}`);
    }
    process.exit(1);
}

if (argv.includes('--fixtures')) {
    const { failures, count } = runFixtures();
    if (failures.length > 0) {
        console.error('Ivory Tower dependency policy fixture failures:');
        for (const failure of failures) {
            console.error(`  - ${failure}`);
        }
        process.exit(1);
    }
    if (!quiet) {
        console.log(`Ivory Tower dependency policy: tree clean; ${count} adversarial fixtures still rejected.`);
    }
} else if (!quiet) {
    console.log('Ivory Tower dependency policy: licences, inventory, quality scope, image pins, and exceptions OK.');
}
