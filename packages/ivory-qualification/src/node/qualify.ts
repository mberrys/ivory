// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as path from 'path';
import { EvidenceRecord } from './evidence';
import { KillOptions, runKill } from './kill/kill-command';
import { KillPoint } from './kill/kill-types';
import { runLatency } from './latency/latency-command';
import { HarnessError } from './managed-child';

/** The command line was wrong. The command exits with 2 and prints the usage. */
export class UsageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UsageError';
    }
}

const USAGE = `usage:
  node lib/node/qualify.js kill --out <dir> [--points ${KillPoint.ALL.join(',')}] [--cycles 100] [--synchronous FULL|OFF]
                                [--project <dir>] [--seed 1] [--full-check-every 10] [--allow-dirty]
  node lib/node/qualify.js latency --out <dir> [--duration 300] [--project <dir>] [--seed 1] [--warmup 5] [--victim-interval 20] [--allow-dirty]

exit codes: 0 every gated criterion passed, 1 one did not (or --allow-dirty was needed), 2 the harness itself failed`;

const VALUE_FLAGS: Readonly<Record<string, readonly string[]>> = {
    kill: ['points', 'cycles', 'synchronous', 'project', 'out', 'seed', 'full-check-every'],
    latency: ['duration', 'project', 'out', 'seed', 'warmup', 'victim-interval']
};
const SWITCH_FLAGS = ['allow-dirty'];

function parseFlags(command: string, args: readonly string[]): Map<string, string> {
    const flags = new Map<string, string>();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith('--')) {
            throw new UsageError(`unexpected argument ${arg}`);
        }
        const name = arg.slice(2);
        if (SWITCH_FLAGS.includes(name)) {
            flags.set(name, 'true');
        } else if (VALUE_FLAGS[command].includes(name)) {
            const value = args[++i];
            if (value === undefined || value.startsWith('--')) {
                throw new UsageError(`--${name} needs a value`);
            }
            flags.set(name, value);
        } else {
            throw new UsageError(`unknown flag ${arg} for ${command}`);
        }
    }
    return flags;
}

function integer(flags: Map<string, string>, name: string, fallback: number, minimum: number): number {
    const text = flags.get(name);
    if (text === undefined) {
        return fallback;
    }
    const value = Number(text);
    if (!Number.isInteger(value) || value < minimum) {
        throw new UsageError(`--${name} must be an integer of at least ${minimum}`);
    }
    return value;
}

function required(flags: Map<string, string>, name: string): string {
    const value = flags.get(name);
    if (value === undefined) {
        throw new UsageError(`--${name} is required`);
    }
    return path.resolve(value);
}

function killOptions(flags: Map<string, string>, command: string): KillOptions {
    const points = (flags.get('points') ?? KillPoint.ALL.join(',')).split(',').map(point => point.trim());
    for (const point of points) {
        if (!KillPoint.ALL.includes(point as KillPoint)) {
            throw new UsageError(`unknown point ${point}, expected ${KillPoint.ALL.join(', ')}`);
        }
    }
    const synchronous = flags.get('synchronous') ?? 'FULL';
    if (synchronous !== 'FULL' && synchronous !== 'OFF') {
        throw new UsageError('--synchronous must be FULL or OFF');
    }
    return {
        points: points as KillPoint[],
        cycles: integer(flags, 'cycles', 100, 1),
        synchronous,
        project: flags.has('project') ? path.resolve(flags.get('project') as string) : undefined,
        out: required(flags, 'out'),
        seed: integer(flags, 'seed', 1, 0),
        fullCheckEvery: integer(flags, 'full-check-every', 10, 1),
        allowDirty: flags.has('allow-dirty'),
        command
    };
}

function summary(record: EvidenceRecord, file: string): string {
    const criteria = Object.entries(record.criteria).map(([name, criterion]) => `${name} ${criterion.pass ? 'pass' : 'FAIL'}${criterion.gated ? '' : ' (not gated)'}`);
    const because = record.failReasons.length ? ` because ${record.failReasons.join(', ')}` : '';
    return `${record.kind}: ${record.outcome} in ${Math.round(record.elapsedMs / 1000)} s [${criteria.join(', ')}]${because}\n${file}\n`;
}

/**
 * Runs one command and returns its exit code: 0 when every gated criterion passed, 1 when one did not, 2 when the harness itself
 * failed. A harness error is never reported as a pass, and writes no evidence record.
 */
export async function runCli(argv: readonly string[]): Promise<number> {
    const [command, ...args] = argv;
    const commandLine = argv.join(' ');
    try {
        if (command !== 'kill' && command !== 'latency') {
            throw new UsageError(command ? `unknown command ${command}` : 'a command is required');
        }
        const flags = parseFlags(command, args);
        const result = command === 'kill'
            ? await runKill(killOptions(flags, commandLine))
            : await runLatency({
                duration: integer(flags, 'duration', 300, 1),
                warmup: integer(flags, 'warmup', 5, 0),
                victimInterval: integer(flags, 'victim-interval', 20, 1),
                project: flags.has('project') ? path.resolve(flags.get('project') as string) : undefined,
                out: required(flags, 'out'),
                seed: integer(flags, 'seed', 1, 0),
                allowDirty: flags.has('allow-dirty'),
                command: commandLine
            });
        process.stdout.write(summary(result.record, result.recordFile));
        return result.record.outcome === 'pass' ? 0 : 1;
    } catch (error) {
        if (error instanceof UsageError) {
            process.stderr.write(`${error.message}\n${USAGE}\n`);
        } else if (error instanceof HarnessError) {
            process.stderr.write(`harness error: ${error.message}\n`);
        } else {
            process.stderr.write(`harness error: ${(error as Error).stack ?? String(error)}\n`);
        }
        return 2;
    }
}

if (require.main === module) {
    runCli(process.argv.slice(2)).then(code => process.exit(code), error => {
        process.stderr.write(`${String(error)}\n`);
        process.exit(2);
    });
}
