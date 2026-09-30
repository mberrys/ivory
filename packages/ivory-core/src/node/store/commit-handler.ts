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
import { statSync } from 'fs';
import type { DatabaseSync } from 'node:sqlite';
import { IvoryStoreError, StoreRefusal } from '../../common/store-protocol';
import { ProjectLayout } from '../project-layout';
import { commitHandlers as builtInCommitHandlers } from './handlers';

export type SqlParam = string | number | bigint | Uint8Array;
export type SqlRow = Readonly<Record<string, unknown>>;

export interface SqlRunResult {
    readonly changes: number;
    readonly lastInsertRowid: number;
}

/**
 * What a handler may do inside its transaction: run SQL on the write connection and require blobs.
 * It stops working the moment `apply` returns, so a handler that awaits and then uses it fails.
 */
export interface CommitTransaction {
    /** The sequence number this commit will get. */
    readonly seq: number;
    run(sql: string, ...params: SqlParam[]): SqlRunResult;
    get(sql: string, ...params: SqlParam[]): SqlRow | undefined;
    all(sql: string, ...params: SqlParam[]): SqlRow[];
    /**
     * Checks that the blob is in the store and records the reference for the commit.
     * Throws a `blob-missing` refusal when it is not.
     */
    requireBlob(digest: Sha256Digest): void;
}

/**
 * A kind of commit. `apply` runs between BEGIN and COMMIT and must return its value synchronously.
 * Build one with {@link defineCommitHandler}.
 */
export interface CommitHandler<I = unknown, O = unknown> {
    readonly kind: string;
    /** Turns the untrusted input into the handler's own type, or throws to refuse it as `invalid-input`. */
    parse(input: unknown): I;
    apply(tx: CommitTransaction, input: I): O;
}

/** Turns the type of `apply` into `never` when it may return a promise, so the handler does not compile. */
export type SynchronousApply<O> = [Extract<O, PromiseLike<unknown>>] extends [never] ? unknown : { readonly apply: never };

/**
 * Declares a commit handler. An `apply` whose return type is a promise does not compile,
 * and the store rejects one that returns a promise at runtime anyway.
 */
export function defineCommitHandler<I, O>(handler: CommitHandler<I, O> & SynchronousApply<O>): CommitHandler<I, O> {
    return handler;
}

/** The `commitHandlers` export that a handler module has. */
export interface CommitHandlerModule {
    readonly commitHandlers: readonly CommitHandler[];
}

/**
 * Handlers are registered by kind from modules because a worker thread cannot receive functions.
 * The built-in module comes first. A duplicate kind is a startup error.
 */
export function loadCommitHandlers(modules: readonly string[]): Map<string, CommitHandler> {
    const handlers = new Map<string, CommitHandler>();
    const add = (source: string, list: unknown): void => {
        if (!Array.isArray(list)) {
            throw new IvoryStoreError('invalid-handler-module', `${source} must export a commitHandlers array`);
        }
        for (const handler of list as CommitHandler[]) {
            if (!handler || typeof handler.kind !== 'string' || !handler.kind || typeof handler.parse !== 'function' || typeof handler.apply !== 'function') {
                throw new IvoryStoreError('invalid-handler-module', `${source} exports a commit handler without kind, parse and apply`);
            }
            if (handlers.has(handler.kind)) {
                throw new IvoryStoreError('duplicate-handler', `the commit handler kind ${handler.kind} is registered twice, the second time by ${source}`);
            }
            handlers.set(handler.kind, handler);
        }
    };
    add('the built-in handlers', builtInCommitHandlers);
    for (const modulePath of modules) {
        // eslint-disable-next-line import/no-dynamic-require, @typescript-eslint/no-require-imports
        add(modulePath, (require(modulePath) as Partial<CommitHandlerModule>).commitHandlers);
    }
    return handlers;
}

/** The {@link CommitTransaction} of one commit. Collects the blob references it requires. */
export class CommitTransactionImpl implements CommitTransaction {
    protected open = true;
    protected readonly blobs = new Set<Sha256Digest>();

    constructor(protected readonly db: DatabaseSync, protected readonly layout: ProjectLayout, readonly seq: number) { }

    /** The blobs the handler required, for `blob_refs`. */
    get requiredBlobs(): readonly Sha256Digest[] {
        return [...this.blobs];
    }

    run(sql: string, ...params: SqlParam[]): SqlRunResult {
        this.assertOpen();
        const result = this.db.prepare(sql).run(...params);
        return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
    }

    get(sql: string, ...params: SqlParam[]): SqlRow | undefined {
        this.assertOpen();
        return this.db.prepare(sql).get(...params);
    }

    all(sql: string, ...params: SqlParam[]): SqlRow[] {
        this.assertOpen();
        return this.db.prepare(sql).all(...params);
    }

    requireBlob(digest: Sha256Digest): void {
        this.assertOpen();
        if (!Sha256Digest.is(digest)) {
            throw new StoreRefusal('invalid-input', 'a blob is referenced by its sha256 digest');
        }
        try {
            statSync(ProjectLayout.blobPath(this.layout, digest));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                throw new StoreRefusal('blob-missing', `the blob ${digest} is not in the store`, { digest });
            }
            throw error;
        }
        this.blobs.add(digest);
    }

    /** Called when `apply` returns or throws. */
    close(): void {
        this.open = false;
    }

    protected assertOpen(): void {
        if (!this.open) {
            throw new IvoryStoreError('handler-not-synchronous', 'a commit handler used its transaction after apply returned');
        }
    }
}
