// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { Sha256Digest } from '@ivory/contracts';
import { canonicalDigest } from '@ivory/contracts/lib/node';
import type { DatabaseSync } from 'node:sqlite';
import { ChainProblem, ChainProblemReason, VerifyChainResult } from '../../common/store-protocol';
import { chainDigest, CommitRow, genesisDigest } from './commit-log';

/**
 * Recomputes every row's digest and prev link from genesis, and every receipt digest from its stored JSON.
 * Runs on the read connection, in one statement, so it sees one snapshot. This is not the full verify of slice 9.
 */
export function verifyChain(readDb: DatabaseSync, projectId: string): VerifyChainResult {
    const problems: ChainProblem[] = [];
    const problem = (seq: number, reason: ChainProblemReason): void => {
        problems.push({ seq, reason });
    };
    let expectedSeq = 1;
    let expectedPrev = genesisDigest(projectId);
    let headSeq = 0;
    let headDigest: Sha256Digest = expectedPrev;
    const rows = readDb.prepare(`SELECT seq, prev_digest, digest, receipt_digest, principal_key, idem_key, request_digest, library_build, receipt_json
        FROM commits ORDER BY seq`).iterate();
    for (const raw of rows) {
        const row = raw as unknown as CommitRow;
        if (row.seq !== expectedSeq) {
            problem(row.seq, 'seq-gap');
        }
        if (row.prev_digest !== expectedPrev) {
            problem(row.seq, 'prev-digest-mismatch');
        }
        if (row.digest !== chainDigest(row)) {
            problem(row.seq, 'digest-mismatch');
        }
        if (!receiptMatches(row)) {
            problem(row.seq, 'receipt-digest-mismatch');
        }
        // Each row is checked against the stored digest of the one before, so one tampered row does not blame its successors.
        expectedSeq = row.seq + 1;
        expectedPrev = row.digest;
        headSeq = row.seq;
        headDigest = row.digest;
    }
    return { ok: problems.length === 0, headSeq, headDigest, problems };
}

function receiptMatches(row: CommitRow): boolean {
    try {
        return canonicalDigest(JSON.parse(row.receipt_json)) === row.receipt_digest;
    } catch {
        return false;
    }
}
