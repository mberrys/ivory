// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { createHash } from 'crypto';

/** A small seeded generator (mulberry32), so that a run's choices follow from its seed. */
export class SeededRandom {
    protected state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;
    }

    /** A number in [0, 1). */
    next(): number {
        this.state = (this.state + 0x6D2B79F5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** An integer in [0, bound). */
    below(bound: number): number {
        return Math.floor(this.next() * bound);
    }
}

const MIN_BLOB_BYTES = 1024;
const MAX_BLOB_BYTES = 64 * 1024;

/** 1 to 64 KiB of bytes that depend on `seed` and `key` only, so the parent can recompute what a killed child wrote. */
export function deterministicBytes(seed: number, key: string): Buffer {
    const material = createHash('sha256').update(`${seed}:${key}`).digest();
    const size = MIN_BLOB_BYTES + material.readUInt32BE(0) % (MAX_BLOB_BYTES - MIN_BLOB_BYTES + 1);
    const bytes = Buffer.allocUnsafe(size);
    let block = material;
    for (let offset = 0; offset < size; offset += block.length) {
        block = createHash('sha256').update(block).digest();
        block.copy(bytes, offset, 0, Math.min(block.length, size - offset));
    }
    return bytes;
}

/**
 * The key of workload step `index` in cycle `cycle`, and its bytes. Every 5th step reuses the bytes of the step three
 * before it in the same cycle, which exercises the dedup path of the blob store.
 */
export namespace Workload {
    export function key(cycle: number, index: number): string {
        return `c${cycle}-${index}`;
    }

    /** The step index of a key made by {@link key}. */
    export function indexOf(cycle: number, stepKey: string): number {
        return Number(stepKey.slice(`c${cycle}-`.length));
    }

    export function bytes(seed: number, cycle: number, index: number): Buffer {
        const source = index % 5 === 4 ? index - 3 : index;
        return deterministicBytes(seed, key(cycle, source));
    }
}
