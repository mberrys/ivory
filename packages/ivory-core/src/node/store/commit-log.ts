// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { canonicalJson, Sha256Digest } from '@ivory/contracts';
import { canonicalDigest } from '@ivory/contracts/lib/node';
import type { DatabaseSync } from 'node:sqlite';
import { CommitOutcome, IvoryStoreError, StoreRefusal } from '../../common/store-protocol';
import { ProjectLayout } from '../project-layout';
import { CommitHandler, CommitTransactionImpl } from './commit-handler';
import { failpoint } from './qualification/failpoint';
import { TransactionOutcome } from './write-queue';

/** A row of `commits`. The chain digest covers every field but `digest` and `receipt_json`. */
export interface CommitRow {
    readonly seq: number;
    readonly prev_digest: Sha256Digest;
    readonly digest: Sha256Digest;
    readonly receipt_digest: Sha256Digest;
    readonly principal_key: string;
    readonly idem_key: string;
    readonly request_digest: Sha256Digest;
    readonly library_build: string;
    readonly receipt_json: string;
}

export type ChainedFields = Omit<CommitRow, 'digest' | 'receipt_json'>;

/** What a commit needs beyond the handler. */
export interface CommitContext {
    readonly db: DatabaseSync;
    readonly layout: ProjectLayout;
    readonly projectId: string;
    readonly libraryBuild: string;
}

/** A request that passed the boundary parse. */
export interface ParsedCommit {
    readonly kind: string;
    readonly principal: string;
    readonly idempotencyKey: string;
    readonly requestDigest: Sha256Digest;
    readonly input: unknown;
}

/** The digest a commit chains from when the log is empty. It binds the chain to the project. */
export function genesisDigest(projectId: string): Sha256Digest {
    return canonicalDigest({ chain: 'ivory-commit-chain@1', projectId });
}

export function chainDigest(fields: ChainedFields): Sha256Digest {
    return canonicalDigest({
        seq: fields.seq,
        prev_digest: fields.prev_digest,
        principal_key: fields.principal_key,
        idem_key: fields.idem_key,
        request_digest: fields.request_digest,
        receipt_digest: fields.receipt_digest,
        library_build: fields.library_build
    });
}

/** The commit that an idempotency key produced, or `undefined` when the key has committed nothing. */
export function readReceipt(db: DatabaseSync, principal: string, idempotencyKey: string): { readonly seq: number; readonly digest: Sha256Digest } | undefined {
    const row = db.prepare('SELECT seq, digest FROM commits WHERE principal_key = ? AND idem_key = ?').get(principal, idempotencyKey);
    return row === undefined ? undefined : { seq: Number(row.seq), digest: row.digest as Sha256Digest };
}

export function readHeadSeq(db: DatabaseSync): number {
    return Number(db.prepare('SELECT coalesce(max(seq), 0) AS seq FROM commits').get()?.seq ?? 0);
}

/** The last commit's sequence number and chain digest, or `undefined` for an empty log. */
export function readHead(db: DatabaseSync): { readonly seq: number; readonly digest: Sha256Digest } | undefined {
    const row = db.prepare('SELECT seq, digest FROM commits ORDER BY seq DESC LIMIT 1').get();
    return row === undefined ? undefined : { seq: Number(row.seq), digest: row.digest as Sha256Digest };
}

/**
 * Everything a commit does between BEGIN and COMMIT. It is one synchronous function, and its result says whether to commit.
 */
export function applyCommit(context: CommitContext, handler: CommitHandler, request: ParsedCommit, parsedInput: unknown): TransactionOutcome<CommitOutcome> {
    const { db } = context;
    // Idempotency comes before anything else in the transaction.
    const existing = db.prepare('SELECT seq, digest, request_digest, receipt_json FROM commits WHERE principal_key = ? AND idem_key = ?')
        .get(request.principal, request.idempotencyKey);
    if (existing !== undefined) {
        if (existing.request_digest !== request.requestDigest) {
            return {
                commit: false,
                value: {
                    refusal: {
                        code: 'idempotency-conflict',
                        message: 'the idempotency key was already used for a different request',
                        seq: Number(existing.seq)
                    }
                }
            };
        }
        const replayed = JSON.parse(String(existing.receipt_json)) as { value: unknown };
        return {
            commit: false,
            value: { value: replayed.value, receipt: { seq: Number(existing.seq), digest: existing.digest as Sha256Digest }, replayed: true }
        };
    }

    const head = readHead(db);
    const prevDigest = head?.digest ?? genesisDigest(context.projectId);
    const seq = (head?.seq ?? 0) + 1;

    const tx = new CommitTransactionImpl(db, context.layout, seq);
    let value: unknown;
    try {
        value = handler.apply(tx, parsedInput);
    } catch (error) {
        if (StoreRefusal.is(error)) {
            return { commit: false, value: { refusal: error.toInfo() } };
        }
        throw error;
    } finally {
        tx.close();
    }
    if (isThenable(value)) {
        // The promise is abandoned, so a rejection must not become an unhandled one.
        value.then(undefined, () => undefined);
        throw new IvoryStoreError('handler-not-synchronous', `the handler for ${request.kind} returned a promise, but apply must be synchronous`);
    }
    if (!db.isTransaction) {
        throw new IvoryStoreError('handler-transaction-control', `the handler for ${request.kind} ended the transaction`);
    }

    // A handler with nothing to return leaves `value` out, since canonical JSON has no `undefined`.
    const receipt = value === undefined ? { seq, kind: request.kind } : { seq, kind: request.kind, value };
    const receiptJson = canonicalJson(receipt);
    const fields: ChainedFields = {
        seq,
        prev_digest: prevDigest,
        principal_key: request.principal,
        idem_key: request.idempotencyKey,
        request_digest: request.requestDigest,
        receipt_digest: canonicalDigest(receipt),
        library_build: context.libraryBuild
    };
    const digest = chainDigest(fields);
    db.prepare(`INSERT INTO commits(seq, prev_digest, digest, receipt_digest, principal_key, idem_key, request_digest, library_build, receipt_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        fields.seq, fields.prev_digest, digest, fields.receipt_digest, fields.principal_key, fields.idem_key, fields.request_digest,
        fields.library_build, receiptJson);
    const insertRef = db.prepare('INSERT INTO blob_refs(digest, commit_seq) VALUES (?, ?)');
    for (const blob of tx.requiredBlobs) {
        insertRef.run(blob, seq);
    }
    failpoint('beforeDbCommit');
    // The caller gets the value as the receipt stores it, which is also what a replay returns.
    const stored = JSON.parse(receiptJson) as { value: unknown };
    return { commit: true, value: { value: stored.value, receipt: { seq, digest }, replayed: false } };
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
    return (typeof value === 'object' || typeof value === 'function') && !!value && typeof (value as { then?: unknown }).then === 'function';
}
