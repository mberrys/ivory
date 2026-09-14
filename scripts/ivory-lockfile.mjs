// @ts-check
'use strict';

/**
 * Shared npm lockfile resolution for the Ivory Tower governance gates (IV-19).
 *
 * `package-lock.json` (lockfileVersion 3) records a `license` field for every published
 * package, so the licence closure of a deployable can be computed deterministically and
 * offline — no install, no registry, and no external scanner.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {{ version?: string, resolved?: string, license?: string, link?: boolean, name?: string,
 *   dependencies?: Record<string, string>, devDependencies?: Record<string, string>,
 *   optionalDependencies?: Record<string, string>, peerDependencies?: Record<string, string> }} LockEntry
 */

/**
 * @param {string} root
 * @returns {{ packages: Record<string, LockEntry> } | undefined}
 */
export function readLockfile(root) {
    const lockPath = path.join(root, 'package-lock.json');
    if (!fs.existsSync(lockPath)) {
        return undefined;
    }
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
}

/**
 * Resolve `name` as required from the package stored at `fromPath`, following npm's
 * node_modules lookup: nearest `node_modules` first, then each ancestor directory.
 *
 * @param {Record<string, LockEntry>} packages
 * @param {string} fromPath
 * @param {string} name
 */
export function resolveDependency(packages, fromPath, name) {
    const segments = fromPath === '' ? [] : fromPath.split('/');
    for (let depth = segments.length; depth >= 0; depth--) {
        const candidate = [...segments.slice(0, depth), 'node_modules', name].join('/');
        if (packages[candidate]) {
            return candidate;
        }
    }
    return undefined;
}

/**
 * Walk the dependency closure of one or more workspace paths.
 *
 * Workspace links are followed to the workspace they resolve to, so first-party packages
 * contribute their own dependencies without appearing as third-party components.
 *
 * @param {Record<string, LockEntry>} packages
 * @param {string[]} roots workspace-relative paths, e.g. `packages/ivory-tower-api`
 * @param {{ includeDev?: boolean }} [options]
 * @returns {{ thirdParty: string[], workspaces: string[], unresolved: string[] }}
 */
export function dependencyClosure(packages, roots, options = {}) {
    const includeDev = options.includeDev === true;
    const visited = new Set();
    const unresolved = new Set();
    const stack = [...roots];

    while (stack.length > 0) {
        const key = /** @type {string} */ (stack.pop());
        if (visited.has(key)) {
            continue;
        }
        visited.add(key);
        const entry = packages[key];
        if (!entry) {
            continue;
        }
        if (entry.link === true) {
            if (entry.resolved) {
                stack.push(entry.resolved);
            }
            continue;
        }
        // Dev dependencies only apply to the roots themselves; a published package's dev
        // dependencies are never installed for consumers.
        const isRoot = roots.includes(key);
        const dependencies = {
            ...entry.dependencies,
            ...entry.optionalDependencies,
            ...(includeDev && isRoot ? entry.devDependencies : {}),
        };
        for (const name of Object.keys(dependencies)) {
            const target = resolveDependency(packages, key, name);
            if (target) {
                stack.push(target);
            } else {
                unresolved.add(`${name} (required by ${key || 'the workspace root'})`);
            }
        }
    }

    const thirdParty = [];
    const workspaces = [];
    for (const key of visited) {
        const entry = packages[key];
        if (!entry || entry.link === true) {
            continue;
        }
        // Classify by lockfile path, not by the presence of a `name` field: npm *aliases*
        // (`node_modules/strip-ansi-cjs` -> name `strip-ansi`) also carry `name`, and treating
        // those as first-party silently excluded them from the licence closure.
        if (key.includes('node_modules/')) {
            thirdParty.push(key);
        } else {
            workspaces.push(key);
        }
    }

    return {
        thirdParty: thirdParty.sort(),
        workspaces: workspaces.sort(),
        unresolved: [...unresolved].sort(),
    };
}

/**
 * Like {@link dependencyClosure}, but also returns the resolved edges so a caller can emit a
 * dependency graph rather than a flat component list.
 *
 * @param {Record<string, LockEntry>} packages
 * @param {string[]} roots
 * @returns {{ thirdParty: string[], workspaces: string[], unresolved: string[], edges: Map<string, string[]> }}
 */
export function dependencyGraph(packages, roots) {
    const result = dependencyClosure(packages, roots);
    /** @type {Map<string, string[]>} */
    const edges = new Map();
    for (const key of [...result.thirdParty, ...result.workspaces, ...roots]) {
        const entry = packages[key];
        if (!entry || entry.link === true) {
            continue;
        }
        const isRoot = roots.includes(key);
        const dependencies = {
            ...entry.dependencies,
            ...entry.optionalDependencies,
            ...(isRoot ? {} : {}),
        };
        /** @type {string[]} */
        const resolved = [];
        for (const name of Object.keys(dependencies)) {
            let target = resolveDependency(packages, key, name);
            // Follow workspace links to the workspace they point at.
            while (target && packages[target]?.link === true && packages[target]?.resolved) {
                target = /** @type {string} */ (packages[target].resolved);
            }
            if (target) {
                resolved.push(target);
            }
        }
        edges.set(key, [...new Set(resolved)].sort());
    }
    return { ...result, edges };
}

/**
 * `node_modules/@scope/name` -> `@scope/name`
 * @param {string} lockKey
 */
export function packageNameFromKey(lockKey) {
    const marker = 'node_modules/';
    const index = lockKey.lastIndexOf(marker);
    return index === -1 ? lockKey : lockKey.slice(index + marker.length);
}
