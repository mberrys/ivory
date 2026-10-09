// Copyright (C) 2026 Michael Berry and others.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const destination = 'ec9e41f2b6991865345069d77791c7cb6422ab1f';
const manifestPath = 'docs/reset/archive-source-manifest.json';
const registerPath = 'docs/architecture/archive-carriers.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const blob = id => execFileSync('git', ['cat-file', 'blob', id], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
const treeCache = new Map();
function tree(commit) {
    if (!treeCache.has(commit)) {
        treeCache.set(commit, new Map(git('ls-tree', '-r', '-z', commit).split('\0').filter(Boolean).map(line => {
            const [, mode, type, id, name] = line.match(/^(\d+) (\w+) ([a-f0-9]{40})\t([\s\S]+)$/);
            assert.equal(type, 'blob', `unexpected ${type}: ${name}`);
            return [name, { blob: id, mode }];
        })));
    }
    return treeCache.get(commit);
}

const manifestBlob = tree(destination).get(manifestPath).blob;
const manifestBytes = blob(manifestBlob);
const manifest = JSON.parse(manifestBytes);
assert.deepEqual(JSON.parse(readFileSync(path.join(root, manifestPath))), manifest, 'historical source manifest changed');
const dev = manifest.archive.selectedSourceCommit;

// A rewrite selects an obligation and its owner, never permission to copy a package.
const policies = [
    ['packages/ivory-tower-research-kernel/', 'rewrite', '@ivory/core', 'Reimplement exact revisions and closure under ADR-009; reject the in-memory acceptance store.'],
    ['packages/ivory-identity/', 'rewrite', '@ivory/contracts', 'Use exact identity and fragment rules as input; replace delimiter preimages with the V5 canonical contract.'],
    ['packages/ivory-tower-contracts/', 'rewrite', '@ivory/contracts', 'Define V5 records and commands without the archived domain dependency or Zod schema graph.'],
    ['packages/ivory-tower-domain/', 'rewrite', '@ivory/core', 'One Core owns research state; do not restore a second domain authority.'],
    ['packages/ivory-tower-content-policy/', 'rewrite', '@ivory/core', 'Enforce effective rights at the Core boundary; do not import a parallel policy service.'],
    ['packages/ivory-tower-infrastructure/', 'rewrite', '@ivory/core', 'Keep CAS ordering and recovery obligations; reject PostgreSQL, S3, Graphile and hosted service wiring for V5.0.'],
    ['packages/ivory-tower-api/', 'rewrite', '@ivory/workbench', 'Replace the archived service with the ADR-009 catalog facade over the embedded Core.'],
    ['packages/ivory-tower-application/', 'rewrite', '@ivory/core', 'Keep captured RunSpec obligations inside Core; remove the archived application authority.'],
    ['packages/ivory-tower-adapters/', 'rewrite', '@ivory/core', 'Use governed execution obligations; do not recreate hosted adapter or pass-through packages.'],
    ['packages/ivory-tower-health/', 'reject', 'mberrys', 'The old health widget and example are outside the V5 workbench.'],
    ['.github/workflows/ivory-tower.yml', 'reject', 'mberrys', 'The archived workflow builds and deploys an obsolete package graph.'],
    ['packages/ivory-tower-worker/', 'reference', '@ivory/core', 'N3 execution and fencing evidence only; V5 execution uses the ADR-009 OCI provider.'],
    ['packages/ivory-tower-agent-experiment/', 'reference', '@ivory/cli', 'N7 negative cases only; its transient proposal acceptance and provider dispatcher are excluded.'],
    ['packages/ivory-n5-client/', 'reference', '@ivory/cli', 'N5 parity inputs only; clients embed the same Core rather than the old HTTP service.'],
    ['packages/ivory-n5-shell/', 'reference', '@ivory/workbench', 'N5 shell evidence only; plugin-host rebinding is excluded by ADR-009.'],
    ['examples/ivory-n5-browser/', 'reference', '@ivory/workbench', 'Historical browser assembly only; the V5 app has a separate dependency allow-list.'],
    ['examples/ivory-tower-browser/', 'reference', '@ivory/workbench', 'Historical deployment only; do not import the archived app.'],
    ['spikes/n2-durable-store/', 'reference', '@ivory/core', 'PGlite process-kill evidence only; the selected engine is Node SQLite.'],
    ['spikes/n6-portable-reproduction/', 'reference', '@ivory/cli', 'Capsule and reproduction cases only; no archived spike is a product dependency.'],
    ['scripts/n5/', 'reference', '@ivory/workbench', 'Retain N5 comparison cases externally; independently qualify the V5 clients.'],
    ['scripts/n7/', 'reference', '@ivory/cli', 'Historical N7 cases only; provider bodies are not copied into V5.'],
    ['scripts/ivory/', 'reference', 'mberrys', 'Historical verification only; archived gates cannot certify V5.'],
    ['docs/', 'reference', 'mberrys', 'Historical research evidence and decisions retain their original claim limits.']
];
const branchReasons = {
    'N5-architecture-proof': 'This divergent snapshot predates the dev fetch receiver and early proxy middleware fixes; V5 excludes its plugin-host and HTTP-service assembly.',
    'cursor-n7-proposal-integrity-aeda': 'This older evidence writer can replace retained live-provider observations; keep both historical records without selecting this writer.',
    'v2-n1-experiment': 'This older kernel omits later fragment/context behavior; its human validation does not qualify the V5 Core.'
};
const mappings = {
    'packages/ivory-tower-research-kernel/src/node/types.ts': ['packages/ivory-contracts/src/common/exact-ref.ts'],
    'packages/ivory-tower-research-kernel/src/node/kernel.ts': ['packages/ivory-contracts/src/common/semantic-closure.ts'],
    'packages/ivory-tower-research-kernel/src/node/canonical.ts': ['packages/ivory-contracts/src/common/canonical-json.ts', 'packages/ivory-contracts/src/node/canonical-digest.ts'],
    'spikes/n2-durable-store/src/blob-admission.mjs': ['packages/ivory-core/src/node/store/cas.ts'],
    'spikes/n2-durable-store/src/durable-store.mjs': ['packages/ivory-core/src/node/store/commit-log.ts'],
    'spikes/n2-durable-store/src/lock.mjs': ['packages/ivory-core/src/node/store/process-lease.ts']
};
const packageRecords = new Map();
function packageFor(head, name) {
    const area = name.match(/^(packages|examples|spikes)\/[^/]+\//)?.[0];
    if (!area) return null;
    const packagePath = area + 'package.json';
    const id = tree(head).get(packagePath)?.blob;
    if (!id) return null;
    const key = head + ':' + packagePath;
    if (!packageRecords.has(key)) {
        const pkg = JSON.parse(blob(id));
        packageRecords.set(key, {
            head, path: packagePath, blob: id, name: pkg.name, license: pkg.license ?? null,
            dependencies: pkg.dependencies ?? {}, devDependencies: pkg.devDependencies ?? {},
            optionalDependencies: pkg.optionalDependencies ?? {}, peerDependencies: pkg.peerDependencies ?? {},
            disposition: 'excluded; no dependency or install script is admitted by this register'
        });
    }
    return key;
}

function carrier(ref, head, entry, branch = false) {
    assert.equal(tree(head).get(entry.path)?.blob, entry.blob, `source identity: ${ref}:${entry.path}`);
    const bytes = blob(entry.blob);
    if (entry.bytes !== undefined) assert.equal(bytes.length, entry.bytes, `source size: ${entry.path}`);
    const header = bytes.toString('utf8', 0, Math.min(bytes.length, 4096));
    const spdx = header.match(/SPDX-License-Identifier:\s*([^\r\n]+)/)?.[1].replace(/\s*\*\/\s*$/, '').trim() ?? null;
    const copyrights = [...header.matchAll(/Copyright[^\r\n]+/gi)].map(match => match[0].replace(/\s*\*\/\s*$/, '').trim());
    const packageKey = packageFor(head, entry.path);
    const packageLicense = packageRecords.get(packageKey)?.license ?? null;
    const [prefix, initialDecision, owner, initialReason] = policies.find(([prefix]) => entry.path.startsWith(prefix)) ??
        ['', 'reference', 'mberrys', 'Not selected for product extraction.'];
    let disposition = initialDecision;
    let reason = initialReason;
    const destinations = [];
    const evidencePath = entry.path.startsWith('docs/') ? entry.path.replace(/^docs\//, 'docs/archive-evidence/') : undefined;
    if (!branch && evidencePath && tree(destination).get(evidencePath)?.blob === entry.blob) {
        disposition = 'reuse';
        reason = 'Already retained verbatim as historical evidence by P0; no runtime or qualification transfer.';
        destinations.push({ path: evidencePath, blob: entry.blob, role: 'historical-evidence' });
    } else if (!branch && mappings[entry.path]) {
        for (const name of mappings[entry.path]) {
            destinations.push({ path: name, blob: tree(destination).get(name).blob, role: 'independent-rewrite' });
        }
        reason += ' The mapped destination implements the obligation independently; the blobs are not copies.';
    }
    if (branch) {
        disposition = /\.(?:spec|test)\.|^docs\//.test(entry.path) ? 'reference' : 'reject';
        reason = branchReasons[ref];
    }
    return {
        ref, head, path: entry.path, blob: entry.blob, sha256: sha256(bytes),
        normalizedTextSha256: /\.(?:[cm]?[jt]sx?|py|sql)$/.test(entry.path) ? sha256(bytes.toString('utf8').replace(/\r\n/g, '\n')) : null,
        owner, provenance: 'Ivory archive addition; copyright remains with the recorded authors',
        disposition, reason, devBlob: branch ? entry.devBlob : entry.blob,
        license: {
            spdx, copyrights, package: packageKey,
            disposition: spdx ? 'retain-file-header-and-applicable-root-notices' : packageLicense ?
                'package-declaration-only; no source copy selected' : 'no-file-or-package-declaration; reference only, no source copy selected'
        },
        destination: { commit: destination, files: destinations, status: destinations.length ? 'recorded-at-P1-baseline' : 'not-imported' },
        productCopyPermitted: false
    };
}

const heads = manifest.archive.heads.map(head => {
    assert.equal(git('rev-parse', head.commit + '^{tree}'), head.tree, `head tree: ${head.ref}`);
    assert.equal(git('rev-parse', 'refs/tags/archive/ivory-archive/' + head.ref + '^{}'), head.commit, `retrieval tag: ${head.ref}`);
    const [behind, ahead] = git('rev-list', '--left-right', '--count', dev + '...' + head.commit).split(/\s+/).map(Number);
    return { ref: head.ref, commit: head.commit, tree: head.tree, retrievalTag: 'archive/ivory-archive/' + head.ref, aheadOfDev: ahead, behindDev: behind };
});
const carriers = manifest.sourceEntries.map(entry => carrier('dev', dev, entry));
for (const branch of manifest.branchOnly) {
    for (const entry of branch.distinctRelevantFiles) {
        assert.equal(tree(dev).get(entry.path)?.blob ?? null, entry.devBlob, `dev comparison: ${entry.path}`);
        carriers.push(carrier(branch.name, branch.head, entry, true));
    }
}
const upstreamBase = manifest.archive.heads.find(head => head.ref === 'master').commit;
const otherChanges = manifest.changedNonIvoryPaths.map(entry => {
    assert.equal(tree(dev).get(entry.path)?.blob ?? null, entry.devBlob, `other source: ${entry.path}`);
    assert.equal(tree(upstreamBase).get(entry.path)?.blob ?? null, entry.baselineBlob, `upstream source: ${entry.path}`);
    const upstream = entry.baselineBlob !== null || /^(?:packages|dev-packages)\//.test(entry.path);
    return {
        path: entry.path, sourceBlob: entry.devBlob, upstreamBlob: entry.baselineBlob,
        provenance: upstream ? 'upstream Theia path or extension; not Ivory-owned by namespace' :
            entry.path.startsWith('fixtures/') ? 'fixture; third-party rights may apply' : 'archive project metadata or Ivory support material',
        owner: upstream ? 'Eclipse Theia and recorded contributors' : 'mberrys',
        disposition: 'reject', destinationBlob: null,
        reason: 'Excluded from selective runtime extraction; upstream work comes through the Theia sync, fixtures need a separate rights review.'
    };
});
const licenseFiles = manifest.archive.licenseFiles.map(name => {
    const id = tree(dev).get(name).blob;
    return { path: name, blob: id, sha256: sha256(blob(id)), disposition: 'preserve applicable notices; no relicensing inferred' };
});
const register = {
    schemaVersion: 1, issue: 'https://github.com/mberrys/ivory-issues/issues/2',
    sourceManifest: { commit: destination, path: manifestPath, blob: manifestBlob, sha256: sha256(manifestBytes) },
    retrieval: { repository: 'mberrys/ivory', refreshedOn: '2026-10-08', originalRepository: manifest.archive.repo },
    destinationBaseline: { commit: destination, tree: git('rev-parse', destination + '^{tree}') },
    heads, licenseFiles, packages: [...packageRecords.values()], carriers, otherChanges
};
const registerFile = path.join(root, registerPath);
if (process.argv.includes('--write')) {
    writeFileSync(registerFile, JSON.stringify(register, null, 2) + '\n');
} else {
    assert.deepEqual(JSON.parse(readFileSync(registerFile)), register, 'archive register differs; inspect the change before regenerating with --write');
}
console.log(`Verified ${heads.length} head trees, ${carriers.length} carriers (335 dev + 72 branch-only), ${otherChanges.length} excluded changes and ${licenseFiles.length} license/notice blobs.`);
