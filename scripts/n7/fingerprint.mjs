// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// @ts-check
/**
 * Implementation fingerprints shared by `verify.mjs` and `live-provider.mjs`.
 *
 * SHA-256 of UTF-8 text with LF line endings, one entry per file, so the same
 * map can bind a retained live-provider run to the exact implementation that
 * produced it. `lib/`, `node_modules/` and `*.tsbuildinfo` are build output.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export const IMPLEMENTATION_ROOTS = [
    'packages/ivory-identity/src',
    'packages/ivory-tower-research-kernel/src',
    'packages/ivory-tower-agent-experiment',
    'scripts/n7',
];

export function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

/** @param {string} root absolute repository root */
export function implementationFingerprints(root) {
    const files = [];
    const visit = path => {
        for (const entry of readdirSync(path, { withFileTypes: true })) {
            if (['lib', 'node_modules'].includes(entry.name)) continue;
            const full = join(path, entry.name);
            if (entry.isDirectory()) visit(full);
            else if (!entry.name.endsWith('.tsbuildinfo')) files.push(full);
        }
    };
    for (const folder of IMPLEMENTATION_ROOTS) visit(join(root, folder));
    files.push(join(root, 'package.json'), join(root, 'package-lock.json'));
    return Object.fromEntries(
        files.sort().map(path => [
            relative(root, path).replaceAll('\\', '/'),
            sha256(readFileSync(path, 'utf8').replaceAll('\r\n', '\n')),
        ]),
    );
}
