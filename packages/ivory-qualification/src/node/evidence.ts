// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { canonicalDigest } from '@ivory/contracts/lib/node';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LedgerSummary } from './ledger';

export type QualificationKind = 'kill' | 'latency';

export interface EvidenceHead {
    readonly commit: string;
    readonly branch: string;
    readonly dirty: boolean;
}

export interface EvidenceEnvironment {
    readonly platform: string;
    readonly osVersion: string;
    readonly release: string;
    readonly arch: string;
    readonly cpuModel: string;
    readonly cpuCount: number;
    readonly memoryBytes: number;
    readonly node: string;
    readonly sqlite: string;
    readonly filesystem: string;
    readonly projectDir: string;
}

/** One exit criterion. Every boolean in it is derived from ledger rows or observations. */
export interface Criterion {
    readonly pass: boolean;
    /** False for a criterion that is recorded but does not decide the outcome. */
    readonly gated: boolean;
    readonly [detail: string]: unknown;
}

export interface EvidenceRecord {
    readonly record: 'ivory-qualification@1';
    readonly issue: 'IV5-6';
    readonly gates: readonly string[];
    readonly kind: QualificationKind;
    readonly head: EvidenceHead;
    readonly command: string;
    readonly startedAt: string;
    readonly finishedAt: string;
    readonly elapsedMs: number;
    readonly environment: EvidenceEnvironment;
    readonly config: Record<string, unknown>;
    readonly configDigest: string;
    readonly fixtures: { readonly harnessDigest: string; readonly coreDigest: string };
    readonly ledger: LedgerSummary;
    readonly criteria: Record<string, Criterion>;
    readonly outcome: 'pass' | 'fail';
    /** Why the outcome is `fail`: a failed gated criterion as `criterion:<name>`, or `dirty-tree`. */
    readonly failReasons: readonly string[];
    readonly limits: readonly string[];
}

export const LIMITS: readonly string[] = [
    'process kill only; power loss, OS crash and cloud-synced folders not claimed',
    'synchronous=OFF control: process kill leaves the OS page cache intact, so this harness cannot tell OFF from FULL',
    'the failpoints sit in the store code, so a crash between two failpoints is covered only by the random-timing cycles',
    'observers read through the store read connection only; a torn read outside the store host is not exercised'
];

export interface RecordInput {
    readonly kind: QualificationKind;
    readonly head: EvidenceHead;
    readonly command: string;
    readonly startedAt: number;
    readonly finishedAt: number;
    readonly environment: EvidenceEnvironment;
    readonly config: Record<string, unknown>;
    readonly harnessLib: string;
    readonly coreLib: string;
    readonly ledger: LedgerSummary;
    readonly criteria: Record<string, Criterion>;
}

export namespace Evidence {

    /** The commit, branch and dirtiness of the repository that holds this package. */
    export function head(cwd: string): EvidenceHead {
        const git = (...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        try {
            return { commit: git('rev-parse', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'), dirty: git('status', '--porcelain').length > 0 };
        } catch {
            return { commit: 'unknown', branch: 'unknown', dirty: true };
        }
    }

    export function environment(projectDir: string): EvidenceEnvironment {
        const cpus = os.cpus();
        return {
            platform: process.platform,
            osVersion: os.version(),
            release: os.release(),
            arch: os.arch(),
            cpuModel: cpus[0]?.model ?? 'unknown',
            cpuCount: cpus.length,
            memoryBytes: os.totalmem(),
            node: process.versions.node,
            sqlite: process.versions.sqlite ?? 'unknown',
            filesystem: filesystem(projectDir),
            projectDir
        };
    }

    /** `fsutil fsinfo volumeinfo` on Windows, or `Get-Volume` when that needs elevation, and `stat -f` elsewhere. */
    export function filesystem(directory: string): string {
        const run = (command: string, args: string[]): string => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        try {
            if (process.platform === 'win32') {
                const drive = path.parse(path.resolve(directory)).root.replace(/[\\/]+$/, '');
                try {
                    return /File System Name\s*:\s*(\S+)/i.exec(run('fsutil', ['fsinfo', 'volumeinfo', drive]))?.[1] ?? 'unknown';
                } catch {
                    return run('powershell', ['-NoProfile', '-Command', `(Get-Volume -DriveLetter ${drive[0]}).FileSystem`]).trim() || 'unknown';
                }
            }
            // A temporary project is already removed when the record is written, and its parent is on the same filesystem.
            let existing = path.resolve(directory);
            while (!existsSync(existing) && path.dirname(existing) !== existing) {
                existing = path.dirname(existing);
            }
            return run('stat', ['-f', '-c', '%T', existing]).trim();
        } catch (error) {
            return `unknown (${(error as Error).message.split('\n')[0]})`;
        }
    }

    /** SHA-256 over the compiled `.js` files below `directory`, without specs, sorted by path: each file's relative path and bytes. */
    export function digestCompiledFiles(directory: string): string {
        const hash = createHash('sha256');
        for (const file of listFiles(directory).filter(name => name.endsWith('.js') && !name.endsWith('.spec.js')).sort()) {
            hash.update(file).update('\0').update(readFileSync(path.join(directory, file))).update('\0');
        }
        return hash.digest('hex');
    }

    function listFiles(directory: string, prefix = ''): string[] {
        const files: string[] = [];
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                files.push(...listFiles(path.join(directory, entry.name), relative));
            } else {
                files.push(relative);
            }
        }
        return files;
    }

    /** The outcome follows from the gated criteria and the dirtiness of the tree, nothing else. */
    export function build(input: RecordInput): EvidenceRecord {
        const failReasons = Object.entries(input.criteria).filter(([, criterion]) => criterion.gated && !criterion.pass).map(([name]) => `criterion:${name}`);
        if (input.head.dirty) {
            failReasons.push('dirty-tree');
        }
        return {
            record: 'ivory-qualification@1',
            issue: 'IV5-6',
            gates: ['N2', 'J7'],
            kind: input.kind,
            head: input.head,
            command: input.command,
            startedAt: new Date(input.startedAt).toISOString(),
            finishedAt: new Date(input.finishedAt).toISOString(),
            elapsedMs: input.finishedAt - input.startedAt,
            environment: input.environment,
            config: input.config,
            configDigest: canonicalDigest(input.config),
            fixtures: { harnessDigest: digestCompiledFiles(input.harnessLib), coreDigest: digestCompiledFiles(input.coreLib) },
            ledger: input.ledger,
            criteria: input.criteria,
            outcome: failReasons.length === 0 ? 'pass' : 'fail',
            failReasons,
            limits: LIMITS
        };
    }

    /** `<kind>-<platform>-<synchronous>.json` in `outDir`, flushed to stable storage. */
    export function write(outDir: string, record: EvidenceRecord, synchronous: string): string {
        mkdirSync(outDir, { recursive: true });
        const file = path.join(outDir, recordFileName(record.kind, record.environment.platform, synchronous));
        writeFileSync(file, `${JSON.stringify(record, undefined, 2)}\n`);
        const fd = openSync(file, 'r+');
        try {
            fsyncSync(fd);
        } finally {
            closeSync(fd);
        }
        return file;
    }

    export function recordFileName(kind: QualificationKind, platform: string, synchronous: string): string {
        return `${kind}-${platform}-${synchronous}.json`;
    }

    export function ledgerFileName(kind: QualificationKind, platform: string, synchronous: string): string {
        return `${kind}-${platform}-${synchronous}.ledger.jsonl`;
    }
}
