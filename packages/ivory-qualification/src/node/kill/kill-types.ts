// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { StoreFailpoint, StoreFailpointConfig } from '@ivory/core';

/** The crash points of a kill run: the five failpoints, and a kill at a random time. */
export type KillPoint = StoreFailpoint | 'random';

export namespace KillPoint {
    export const ALL: readonly KillPoint[] = [...StoreFailpoint.ALL, 'random'];

    /** The crash point of V5 section 6 that a failpoint stands for. */
    export const CRASH_POINT: Readonly<Record<KillPoint, string>> = {
        duringBlobStage: 'C1',
        beforeBlobInstall: 'C1',
        afterBlobInstall: 'C2',
        beforeDbCommit: 'C3',
        afterDbCommit: 'C4',
        random: 'random'
    };

    /** Whether the in-flight key is durable when the parent reopens the store, or either. */
    export const EXPECTED_DURABLE: Readonly<Record<KillPoint, boolean | 'either'>> = {
        duringBlobStage: false,
        beforeBlobInstall: false,
        afterBlobInstall: false,
        beforeDbCommit: false,
        afterDbCommit: true,
        random: 'either'
    };
}

export interface KillChildConfig {
    readonly cycle: number;
    readonly seed: number;
    readonly synchronous: 'FULL' | 'OFF';
    readonly failpoint?: StoreFailpointConfig;
}

export interface KillAck {
    readonly key: string;
    readonly seq: number;
    readonly digest: string;
    readonly blob: string;
}

export interface Observation {
    readonly seq: number;
    readonly digest: string;
    readonly t: number;
}
