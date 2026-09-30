// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ChildProcess, execFile, fork } from 'child_process';

/** Something went wrong with the harness itself rather than with a criterion. The command exits with 2. */
export class HarnessError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HarnessError';
    }
}

export type ChildMessage = Record<string, unknown> & { readonly type: string };

interface Waiter {
    readonly type: string;
    resolve(message: ChildMessage): void;
    reject(error: Error): void;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * A forked process that plays a host. The exit listener is registered at spawn so that an early exit is never missed,
 * and messages are buffered so that `next` cannot miss one that came early.
 */
export class ManagedChild {
    static readonly KILL_TIMEOUT_MS = 5000;

    readonly process: ChildProcess;
    readonly spawnedAt = Date.now();
    readonly exited: Promise<void>;
    readonly disconnected: Promise<void>;
    killIssuedAt: number | undefined;
    exitedAt: number | undefined;
    exitCode: number | null | undefined;
    exitSignal: NodeJS.Signals | null | undefined;

    protected readonly inbox: ChildMessage[] = [];
    protected readonly waiters: Waiter[] = [];
    protected readonly listeners: ((message: ChildMessage) => void)[] = [];

    constructor(readonly script: string, args: readonly string[]) {
        this.process = fork(script, [...args], { execArgv: [], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
        this.process.on('message', (message: ChildMessage) => this.deliver(message));
        this.exited = new Promise(resolve => this.process.once('exit', (code, signal) => {
            this.exitedAt = Date.now();
            this.exitCode = code;
            this.exitSignal = signal;
            for (const waiter of this.waiters.splice(0)) {
                waiter.reject(new HarnessError(`the child ${script} exited while the harness waited for ${waiter.type}`));
            }
            resolve();
        }));
        this.disconnected = new Promise(resolve => this.process.once('disconnect', () => resolve()));
        // A failed spawn is reported by the exit promise or by the wait for the first message.
        this.process.on('error', () => undefined);
    }

    get pid(): number {
        return this.process.pid ?? -1;
    }

    get hasExited(): boolean {
        return this.exitedAt !== undefined;
    }

    /** Called for every message, in order. */
    listen(listener: (message: ChildMessage) => void): void {
        this.listeners.push(listener);
    }

    next(type: string, timeoutMs = 30000): Promise<ChildMessage> {
        const buffered = this.inbox.findIndex(message => message.type === type);
        if (buffered >= 0) {
            return Promise.resolve(this.inbox.splice(buffered, 1)[0]);
        }
        if (this.hasExited) {
            return Promise.reject(new HarnessError(`the child ${this.script} has exited, it will not send ${type}`));
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new HarnessError(`no ${type} message from ${this.script} within ${timeoutMs} ms`)), timeoutMs);
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

    send(message: ChildMessage): void {
        if (this.process.connected) {
            this.process.send(message);
        }
    }

    /**
     * The backstop kill of the spike: `taskkill /F /T` on Windows, SIGKILL elsewhere. It is harmless for a child that is already
     * dead. A child that is still alive after the timeout is a harness error.
     */
    async kill(): Promise<void> {
        if (!this.hasExited) {
            this.killIssuedAt ??= Date.now();
            if (process.platform === 'win32') {
                await new Promise<void>(resolve => execFile('taskkill', ['/F', '/T', '/PID', String(this.pid)], () => resolve()));
            } else {
                try {
                    this.process.kill('SIGKILL');
                } catch {
                    // It is gone already.
                }
            }
        }
        await this.waitForExit(ManagedChild.KILL_TIMEOUT_MS);
    }

    async waitForExit(timeoutMs: number): Promise<void> {
        let timer: NodeJS.Timeout | undefined;
        const timedOut = new Promise<boolean>(resolve => {
            timer = setTimeout(() => resolve(true), timeoutMs);
        });
        const result = await Promise.race([this.exited.then(() => false), timedOut]);
        clearTimeout(timer);
        if (result) {
            throw new HarnessError(`the child ${this.script} (pid ${this.pid}) was still alive ${timeoutMs} ms after it was killed`);
        }
    }

    /** Waits until the IPC channel is closed, so that every message the child sent before it died has been delivered. */
    async drain(timeoutMs = 2000): Promise<void> {
        await Promise.race([this.disconnected, sleep(timeoutMs)]);
    }

    protected deliver(message: ChildMessage): void {
        for (const listener of this.listeners) {
            listener(message);
        }
        const index = this.waiters.findIndex(waiter => waiter.type === message.type);
        if (index >= 0) {
            this.waiters.splice(index, 1)[0].resolve(message);
        } else {
            this.inbox.push(message);
        }
    }
}

/** Kills the children that are left when a command ends, however it ends. */
export class ChildRegistry {
    protected readonly children = new Set<ManagedChild>();

    spawn(script: string, args: readonly string[]): ManagedChild {
        const child = new ManagedChild(script, args);
        this.children.add(child);
        return child;
    }

    async killAll(): Promise<void> {
        await Promise.all([...this.children].map(child => child.kill().catch(() => undefined)));
        this.children.clear();
    }
}
