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
import { KillPoint } from './kill-types';

/** Everything one kill cycle observed. `failures` and `pass` are derived from the other fields by {@link evaluateKillRow}. */
export interface KillObservation {
    readonly cycle: number;
    readonly point: KillPoint;
    readonly crashPoint: string;
    readonly failpoint?: { readonly name: string; readonly afterHits: number };
    readonly childPid: number;
    readonly childProcessId: string;
    readonly exit: { readonly code: number | null | undefined; readonly signal: string | null | undefined };
    readonly markerSeen: boolean;
    /** The marker names the point and the child's pid. */
    readonly markerMatches: boolean;
    readonly killDelayMs?: number;
    /** The child was gone before the parent's backstop kill, without a marker. */
    readonly childExitedEarly: boolean;
    readonly refused?: unknown;
    readonly intents: number;
    readonly acked: number;
    readonly ackedSeqs?: { readonly first: number; readonly last: number };
    readonly inflightKey?: string;
    /** More than one intent had no ack, which the sequential workload cannot produce. */
    readonly intentAckMismatch: boolean;
    readonly stagingBefore: number;
    readonly leaseBefore: boolean;
    readonly openRecovery: RecoveryReport;
    readonly sweptChild: boolean;
    readonly sweptUnknown: readonly string[];
    readonly observerSwept: boolean;
    readonly observerSkipped: boolean;
    readonly stagingAfter: number;
    readonly leaseAfter: boolean;
    readonly committedBefore: number;
    readonly expectedHeadAtReopen: number;
    readonly headAtReopen: number;
    readonly lostAcknowledged: number;
    readonly lostKeys: readonly string[];
    readonly expectedDurable: boolean | 'either';
    readonly durableBeforeRetry?: boolean;
    /** The in-flight blob is on disk, whether or not a commit references it. */
    readonly inflightBlobOnDisk?: boolean;
    readonly retry?: { readonly replayed?: boolean; readonly refusal?: unknown; readonly seq?: number; readonly digest?: string };
    readonly receiptsForInflight?: number;
    readonly receiptStable?: boolean;
    readonly expectedHeadAfterRetry: number;
    readonly headAfterRetry: number;
    readonly blobsChecked: number;
    readonly blobProblems: readonly string[];
    readonly fullCheck: boolean;
    readonly chain?: { readonly ok: boolean; readonly problems: number; readonly keysChecked: number; readonly headSeq: number };
    readonly timingsMs: { readonly total: number; readonly ready: number; readonly kill: number; readonly reopen: number; readonly checks: number };
}

export interface KillRow extends KillObservation {
    readonly row: 'cycle';
    readonly failures: readonly string[];
    readonly pass: boolean;
}

/** The rules of the spec's steps 3 to 8, applied to what a cycle observed. */
export function evaluateKillRow(o: KillObservation): string[] {
    const failures: string[] = [];
    const isFailpoint = o.point !== 'random';
    if (o.refused !== undefined) {
        failures.push('child-commit-refused');
    }
    if (o.childExitedEarly) {
        failures.push('child-exited-early');
    }
    if (isFailpoint && !o.markerSeen) {
        failures.push('failpoint-not-reached');
    }
    if (o.markerSeen && !o.markerMatches) {
        failures.push('marker-mismatch');
    }
    if (o.intentAckMismatch) {
        failures.push('intent-ack-mismatch');
    }
    if (o.lostAcknowledged > 0) {
        failures.push('lost-acknowledged');
    }
    if (isFailpoint && o.inflightKey === undefined) {
        failures.push('no-inflight-key');
    }
    if (o.expectedDurable !== 'either' && o.durableBeforeRetry !== undefined && o.durableBeforeRetry !== o.expectedDurable) {
        failures.push('durable-expectation');
    }
    // C1 is only exercised if the kill left staging garbage for recovery to sweep.
    if ((o.point === 'duringBlobStage' || o.point === 'beforeBlobInstall') && o.stagingBefore === 0) {
        failures.push('c1-staging-missing');
    }
    if (o.point === 'afterBlobInstall' && (o.inflightBlobOnDisk !== true || o.durableBeforeRetry === true)) {
        failures.push('c2-orphan-missing');
    }
    if (!o.sweptChild) {
        failures.push('child-not-swept');
    }
    if (o.stagingAfter > 0 || o.leaseAfter) {
        failures.push('child-leftovers');
    }
    if (o.sweptUnknown.length > 0 || o.observerSwept) {
        failures.push('swept-a-live-lease');
    }
    if (o.headAtReopen !== o.expectedHeadAtReopen) {
        failures.push('head-mismatch-at-reopen');
    }
    if (o.inflightKey !== undefined) {
        if (o.retry === undefined || o.retry.refusal !== undefined) {
            failures.push('retry-refused');
        } else if (o.retry.replayed !== o.durableBeforeRetry) {
            failures.push('retry-replay-mismatch');
        }
        if (o.receiptsForInflight !== 1 || o.receiptStable === false) {
            failures.push('receipt-count');
        }
    }
    if (o.headAfterRetry !== o.expectedHeadAfterRetry) {
        failures.push('head-mismatch-after-retry');
    }
    if (o.blobProblems.length > 0) {
        failures.push('blob-problem');
    }
    if (o.fullCheck && o.chain?.ok !== true) {
        failures.push('chain-not-ok');
    }
    return failures;
}
