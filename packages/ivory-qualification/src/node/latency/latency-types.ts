// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { RecoveryReport } from '@ivory/core';

export type LatencyRole = 'workbench' | 'cli' | 'mcp' | 'victim';

/** The times every role works to, in epoch milliseconds. All roles run on one machine, so they share a clock. */
export interface LatencySchedule {
    readonly t0: number;
    readonly measureStart: number;
    readonly endAt: number;
}

export interface LatencyRoleConfig {
    readonly holdMs: number;
}

/** A store open, with the time it took and what its recovery swept. */
export interface OpenRecord {
    readonly startedAt: number;
    readonly endedAt: number;
    readonly recovery: RecoveryReport;
}

/** A `recover()` call, with the times around it: a sweep can only have happened between them. */
export interface RecoveryRecord {
    readonly startedAt: number;
    readonly endedAt: number;
    readonly recovery: RecoveryReport;
}

export interface CommitRecord {
    readonly key: string;
    readonly principal: string;
    readonly startedAt: number;
    readonly ms: number;
    readonly measured: boolean;
    /** `committed`, a refusal code such as `writer-busy`, or `error`. */
    readonly result: string;
    readonly seq?: number;
    readonly digest?: string;
    readonly message?: string;
}

export interface ObservationRecord {
    readonly seq: number;
    readonly digest: string;
    readonly firstAt: number;
    readonly count: number;
}

export interface HistogramMs {
    readonly count: number;
    readonly min: number;
    readonly mean: number;
    readonly p50: number;
    readonly p90: number;
    readonly p99: number;
    readonly max: number;
}

export interface PercentilesMs {
    readonly count: number;
    readonly p50: number;
    readonly p99: number;
    readonly max: number;
}

export interface RoleReport {
    readonly type: 'report';
    readonly role: LatencyRole;
    readonly processId: string;
    readonly commits: readonly CommitRecord[];
    readonly observations: readonly ObservationRecord[];
    readonly observationErrors: number;
    readonly recoveries: readonly RecoveryRecord[];
    readonly histogram?: HistogramMs;
    readonly commitLatency?: PercentilesMs;
    readonly advances?: number;
}
