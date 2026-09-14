// @ts-check
'use strict';

/**
 * Generates CycloneDX 1.5 SBOMs for the Ivory Tower source tree and each deployable (IV-19 step 3).
 *
 * Built directly from `package-lock.json` rather than by shelling out to `npm sbom`.
 *
 * The obvious implementation was `npm sbom --sbom-format cyclonedx`, and that is what this script
 * did first. It cannot be used here: npm refuses to emit any document at all when the tree
 * contains an invalid dependency edge, and this tree has one —
 *
 *   invalid: yauzl@3.3.2, ^2.4.2 required by decompress-unzip@4.0.1
 *
 * — because upstream Theia's root `overrides` block pins `yauzl` to `~3.3.2` while
 * `decompress-unzip@4.0.1` declares `^2.4.2`. `decompress` reaches four upstream packages, the
 * override arrived in an upstream commit, and neither `--force` nor `--omit` bypasses the check,
 * so resolving it is upstream's dependency-resolution decision and not this generator's to make.
 * npm 11 rejects the source tree and the browser deployable outright; npm 10 happened not to,
 * which is its own reason not to depend on the behaviour.
 *
 * Reading the lockfile directly removes that coupling and matches how every other IV-19 gate
 * works: deterministic, offline, reproducible from a commit. The invalid edge is still reported —
 * under `dependencyTreeProblems` in the manifest — rather than silently absorbed.
 *
 * Flags:
 *   --out <dir>   write somewhere other than artifacts/sbom
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readLockfile, dependencyGraph, packageNameFromKey } from './ivory-lockfile.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(SCRIPT_DIR, '..');
const GENERATOR_VERSION = '1.0.0';

const argv = process.argv.slice(2);
const outIndex = argv.indexOf('--out');
const outputDirectory = outIndex === -1
    ? path.join(REPO_ROOT, 'artifacts', 'sbom')
    : path.resolve(argv[outIndex + 1]);

const policy = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'configs', 'ivory-dependency-policy.json'), 'utf8'));
const lockfile = readLockfile(REPO_ROOT);
if (!lockfile) {
    console.error('package-lock.json is missing; SBOMs cannot be generated.');
    process.exit(1);
}
const packages = lockfile.packages;

/** @param {string} value */
function digest(value) {
    return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function currentCommit() {
    try {
        return execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch {
        return 'unknown';
    }
}

/**
 * `@scope/name` -> `pkg:npm/%40scope/name@version`, matching npm's own purl encoding.
 * @param {string} name
 * @param {string} version
 */
function purlFor(name, version) {
    if (name.startsWith('@')) {
        const [scope, bare] = name.split('/');
        return `pkg:npm/${encodeURIComponent(scope)}/${bare}@${version}`;
    }
    return `pkg:npm/${name}@${version}`;
}

/**
 * `sha512-<base64>` -> a CycloneDX hash entry.
 * @param {string | undefined} integrity
 */
function hashesFor(integrity) {
    if (typeof integrity !== 'string' || !integrity.includes('-')) {
        return undefined;
    }
    const separator = integrity.indexOf('-');
    const algorithm = integrity.slice(0, separator);
    const encoded = integrity.slice(separator + 1);
    const algorithms = { sha512: 'SHA-512', sha256: 'SHA-256', sha1: 'SHA-1' };
    const alg = algorithms[algorithm];
    if (!alg) {
        return undefined;
    }
    try {
        return [{ alg, content: Buffer.from(encoded, 'base64').toString('hex') }];
    } catch {
        return undefined;
    }
}

/**
 * @param {string} lockKey
 * @param {'library' | 'application'} type
 */
function componentFor(lockKey, type) {
    const entry = packages[lockKey];
    const fullName = entry.name ?? packageNameFromKey(lockKey);
    const version = String(entry.version ?? '0.0.0');
    const purl = purlFor(fullName, version);
    /** @type {Record<string, unknown>} */
    const component = { 'bom-ref': purl, type, name: fullName, version, purl };
    if (fullName.startsWith('@')) {
        const [scope, bare] = fullName.split('/');
        component.group = scope;
        component.name = bare;
    }
    if (typeof entry.license === 'string' && entry.license.trim() !== '') {
        component.licenses = [{ expression: entry.license }];
    } else {
        // Recorded rather than omitted: an unresolved licence must stay visible in the SBOM.
        component.properties = [{ name: 'ivory:license:unresolved', value: 'true' }];
    }
    const hashes = hashesFor(entry.integrity);
    if (hashes) {
        component.hashes = hashes;
    }
    if (typeof entry.resolved === 'string') {
        component.externalReferences = [{ type: 'distribution', url: entry.resolved }];
    }
    return component;
}

/**
 * @param {string} label
 * @param {string[]} roots
 * @param {string} rootDescription
 */
function buildSbom(label, roots, rootDescription) {
    const graph = dependencyGraph(packages, roots);
    const rootKey = roots[0];
    const rootComponent = componentFor(rootKey, 'application');

    // The same name@version can appear at several lockfile paths (a hoisted copy plus nested
    // ones). CycloneDX requires bom-ref to be unique, so collapse them to one component.
    const dedupe = keys => {
        /** @type {Map<string, Record<string, unknown>>} */
        const byRef = new Map();
        for (const key of keys) {
            const component = componentFor(key, 'library');
            const ref = String(component['bom-ref']);
            if (!byRef.has(ref)) {
                byRef.set(ref, component);
            }
        }
        return [...byRef.values()].sort((a, b) => String(a['bom-ref']).localeCompare(String(b['bom-ref'])));
    };

    // Dedupe across both lists together: an npm alias resolves to the same purl as the package
    // it aliases, so a per-list dedupe would still leave a duplicate bom-ref.
    const allComponents = dedupe([...graph.workspaces.filter(key => key !== rootKey), ...graph.thirdParty])
        .filter(component => component['bom-ref'] !== rootComponent['bom-ref']);
    const thirdPartyComponents = allComponents.filter(component => !graph.workspaces.some(key => {
        const entry = packages[key];
        return purlFor(entry?.name ?? packageNameFromKey(key), String(entry?.version ?? '0.0.0')) === component['bom-ref'];
    }));
    const workspaceComponents = allComponents.filter(component => !thirdPartyComponents.includes(component));

    const refFor = new Map([rootKey, ...graph.workspaces, ...graph.thirdParty].map(key => {
        const entry = packages[key];
        const name = entry?.name ?? packageNameFromKey(key);
        return [key, purlFor(name, String(entry?.version ?? '0.0.0'))];
    }));

    /** @type {Map<string, Set<string>>} */
    const dependsOnByRef = new Map();
    for (const [key, targets] of graph.edges) {
        const ref = refFor.get(key);
        if (ref === undefined) {
            continue;
        }
        const existing = dependsOnByRef.get(ref) ?? new Set();
        for (const target of targets) {
            const targetRef = refFor.get(target);
            if (targetRef !== undefined && targetRef !== ref) {
                existing.add(targetRef);
            }
        }
        dependsOnByRef.set(ref, existing);
    }
    const dependencies = [...dependsOnByRef.entries()]
        .map(([ref, dependsOn]) => ({ ref, dependsOn: [...dependsOn].sort() }))
        .sort((a, b) => a.ref.localeCompare(b.ref));

    return {
        document: {
            $schema: 'http://cyclonedx.org/schema/bom-1.5.schema.json',
            bomFormat: 'CycloneDX',
            specVersion: '1.5',
            version: 1,
            metadata: {
                timestamp: new Date().toISOString(),
                lifecycles: [{ phase: 'build' }],
                tools: [{
                    vendor: 'Ivory Tower',
                    name: 'generate-ivory-sbom',
                    version: GENERATOR_VERSION,
                }],
                component: { ...rootComponent, description: rootDescription },
                properties: [
                    { name: 'ivory:sbom:source', value: 'package-lock.json' },
                    { name: 'ivory:sbom:scope', value: label },
                    { name: 'ivory:sbom:dependencies', value: 'runtime' },
                    { name: 'ivory:sbom:lockfileVersion', value: String(lockfile.lockfileVersion ?? 'unknown') },
                ],
            },
            components: allComponents,
            dependencies,
        },
        unresolved: graph.unresolved,
        counts: { thirdParty: thirdPartyComponents.length, workspaces: workspaceComponents.length },
    };
}

/**
 * Report root overrides that conflict with a declared range. These no longer stop generation —
 * that is the point of reading the lockfile directly — but they must stay visible in the evidence.
 */
function findDependencyTreeProblems() {
    const problems = [];
    const overrides = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).overrides ?? {};
    const majorOf = value => String(value).replace(/^[~^><= ]*/u, '').split('.')[0];
    for (const [key, entry] of Object.entries(packages)) {
        for (const [name, range] of Object.entries({ ...entry.dependencies, ...entry.optionalDependencies })) {
            const override = overrides[name];
            if (override === undefined) {
                continue;
            }
            const overriddenMajor = majorOf(override);
            const requiredMajor = majorOf(range);
            if (/^\d+$/u.test(overriddenMajor) && /^\d+$/u.test(requiredMajor) && overriddenMajor !== requiredMajor) {
                problems.push(`invalid: root override "${name}": "${override}" conflicts with "${range}" required by ${packageNameFromKey(key)}@${entry.version ?? '?'}`);
            }
        }
    }
    return [...new Set(problems)].sort();
}

fs.mkdirSync(outputDirectory, { recursive: true });

const deployables = Object.entries(policy.deployables ?? {});
const targets = [
    {
        label: 'source',
        file: 'sbom-source.cdx.json',
        roots: deployables.map(([, deployable]) => deployable.workspace),
        description: 'Ivory Tower source tree — the union of every deployable runtime closure.',
    },
    ...deployables.map(([label, deployable]) => ({
        label,
        file: `sbom-${label}.cdx.json`,
        roots: [deployable.workspace],
        description: `Ivory Tower deployable: ${deployable.package}`,
    })),
];

/** @type {{ label: string, file: string, components: number, sha256: string }[]} */
const generated = [];
/** @type {string[]} */
const unresolvedEdges = [];

for (const target of targets) {
    const missingRoot = target.roots.find(root => !packages[root]);
    if (missingRoot) {
        console.error(`Deployable "${target.label}" points at ${missingRoot}, which is not in package-lock.json.`);
        process.exit(1);
    }
    const { document, unresolved, counts } = buildSbom(target.label, target.roots, target.description);
    unresolvedEdges.push(...unresolved);
    const serialized = `${JSON.stringify(document, undefined, 2)}\n`;
    fs.writeFileSync(path.join(outputDirectory, target.file), serialized);
    generated.push({
        label: target.label,
        file: target.file,
        components: document.components.length,
        sha256: digest(serialized),
    });
    console.log(`  ${target.label.padEnd(14)} ${String(document.components.length).padStart(5)} components (${counts.thirdParty} third-party, ${counts.workspaces} workspace) -> ${target.file}`);
}

const manifest = {
    generatedAt: new Date().toISOString(),
    commit: currentCommit(),
    generator: { name: 'scripts/generate-ivory-sbom.mjs', version: GENERATOR_VERSION, source: 'package-lock.json' },
    generatorNote: 'Built from the lockfile rather than `npm sbom`, which refuses to emit any document while the tree contains an invalid dependency edge. See dependencyTreeProblems and docs/iv-19-dependency-governance.md.',
    scope: 'runtime dependencies of each deployable; build and test tooling excluded',
    toolchain: { node: process.versions.node },
    policyVersion: policy.policyVersion,
    format: 'CycloneDX 1.5',
    dependencyTreeProblems: findDependencyTreeProblems(),
    unresolvedEdges: [...new Set(unresolvedEdges)].sort(),
    files: generated,
};
fs.writeFileSync(path.join(outputDirectory, 'sbom-manifest.json'), `${JSON.stringify(manifest, undefined, 2)}\n`);

console.log(`Ivory Tower SBOM: ${generated.length} CycloneDX 1.5 documents in ${path.relative(REPO_ROOT, outputDirectory)} (commit ${manifest.commit.slice(0, 8)}).`);

if (manifest.unresolvedEdges.length > 0) {
    console.error('Unresolved dependency edges — package-lock.json is inconsistent:');
    for (const edge of manifest.unresolvedEdges) {
        console.error(`  - ${edge}`);
    }
    process.exit(1);
}
if (manifest.dependencyTreeProblems.length > 0) {
    console.warn('');
    console.warn('WARNING: the dependency tree contains an invalid edge, recorded in sbom-manifest.json:');
    for (const problem of manifest.dependencyTreeProblems) {
        console.warn(`  - ${problem}`);
    }
    console.warn('This predates IV-19 and comes from upstream Theia\'s root "overrides" block.');
    console.warn('Resolving it is an upstream dependency-resolution decision, not an SBOM fix.');
}
