// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ChildProcess, fork } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { initProject } from '../project-layout';
import { OpenProjectStoreOptions, openProjectStore, ProjectStore } from '../store-host';

/** Compiled handler modules for the store worker, which loads them by path. */
export const testHandlerModule = path.join(__dirname, 'test-handlers.js');
export const asyncHandlerModule = path.join(__dirname, 'async-handler-fixture.js');
/** Child-process fixtures live next to the SQL, in `store/test`. */
export const childScript = (name: string): string => path.join(__dirname, '..', 'store', 'test', `${name}.js`);

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Polls until `condition` holds. Fails the spec, rather than hanging it, when it does not within `timeoutMs`. */
export async function eventually(condition: () => boolean | Promise<boolean>, timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!await condition()) {
        if (Date.now() > deadline) {
            throw new Error(`the condition did not hold within ${timeoutMs} ms`);
        }
        await sleep(10);
    }
}

interface Waiter {
    readonly type: string;
    resolve(message: Record<string, unknown>): void;
    reject(error: Error): void;
}

/** A forked process that plays another host. Its messages are buffered, so `next` cannot miss one that came early. */
export class ChildFixture {
    readonly process: ChildProcess;
    readonly exited: Promise<void>;
    protected readonly inbox: Record<string, unknown>[] = [];
    protected readonly waiters: Waiter[] = [];
    protected hasExited = false;

    constructor(script: string, args: string[]) {
        this.process = fork(script, args, { execArgv: [], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
        this.process.on('message', (message: Record<string, unknown>) => {
            const index = this.waiters.findIndex(waiter => waiter.type === message.type);
            if (index >= 0) {
                this.waiters.splice(index, 1)[0].resolve(message);
            } else {
                this.inbox.push(message);
            }
        });
        this.exited = new Promise(resolve => this.process.once('exit', () => {
            this.hasExited = true;
            for (const waiter of this.waiters.splice(0)) {
                waiter.reject(new Error(`the child exited while the spec waited for ${waiter.type}`));
            }
            resolve();
        }));
    }

    next(type: string, timeoutMs = 20000): Promise<Record<string, unknown>> {
        const buffered = this.inbox.findIndex(message => message.type === type);
        if (buffered >= 0) {
            return Promise.resolve(this.inbox.splice(buffered, 1)[0]);
        }
        if (this.hasExited) {
            return Promise.reject(new Error(`the child has exited, it will not send ${type}`));
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`no ${type} message from the child within ${timeoutMs} ms`)), timeoutMs);
            this.waiters.push({
                type,
                resolve: message => {
                    clearTimeout(timer);
                    resolve(message);
                },
                reject: error => {
                    clearTimeout(timer);
                    reject(error);
                }
            });
        });
    }

    send(message: Record<string, unknown>): void {
        this.process.send(message);
    }

    /** SIGKILL on POSIX, and the equivalent hard kill on Windows: the child gets no chance to clean up. */
    async kill(): Promise<void> {
        if (!this.hasExited) {
            this.process.kill('SIGKILL');
        }
        await this.exited;
    }

    /** Lets the child finish normally. */
    async release(commit = false): Promise<void> {
        if (!this.hasExited) {
            this.send({ type: 'release', commit });
        }
        await this.exited;
    }
}

/** Owns everything a spec creates, and removes it afterwards: stores, child processes and temporary directories. */
export class SpecKit {
    protected readonly stores: ProjectStore[] = [];
    protected readonly children: ChildFixture[] = [];
    protected readonly directories: string[] = [];

    /** A fresh live project in a temporary directory. */
    async project(projectId = 'project-1'): Promise<string> {
        const directory = await this.tempDir();
        await initProject(directory, { projectId });
        return directory;
    }

    async tempDir(): Promise<string> {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ivory-core-'));
        this.directories.push(directory);
        return directory;
    }

    async open(projectDir: string, options: OpenProjectStoreOptions = {}): Promise<ProjectStore> {
        const store = await openProjectStore(projectDir, { handlerModules: [testHandlerModule], pollIntervalMs: 20, ...options });
        this.stores.push(store);
        return store;
    }

    child(script: string, ...args: string[]): ChildFixture {
        const child = new ChildFixture(script, args);
        this.children.push(child);
        return child;
    }

    async dispose(): Promise<void> {
        for (const child of this.children.splice(0)) {
            await child.kill();
        }
        for (const store of this.stores.splice(0)) {
            await store.close();
        }
        for (const directory of this.directories.splice(0)) {
            await fs.rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
        }
    }
}
