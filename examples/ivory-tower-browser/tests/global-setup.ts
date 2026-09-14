import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';

const port = process.env.IVORY_BROWSER_PORT ?? '3000';
const baseURL = process.env.IVORY_BROWSER_URL ?? `http://127.0.0.1:${port}`;
const browserDirectory = path.resolve(__dirname, '..');
const theiaCli = path.resolve(browserDirectory, '../../node_modules/@theia/cli/bin/theia.js');

async function waitForServer(child: ChildProcess): Promise<void> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`Ivory Tower browser backend exited before readiness with code ${child.exitCode}.`);
        }
        try {
            await fetch(baseURL);
            return;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 250));
        }
    }
    throw new Error(`Timed out waiting for the Ivory Tower browser backend at ${baseURL}.`);
}

async function stopServer(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.pid === undefined) {
        return;
    }
    if (process.platform === 'win32') {
        await new Promise<void>(resolve => {
            const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
            killer.once('exit', () => resolve());
            killer.once('error', () => resolve());
        });
        return;
    }
    child.kill('SIGTERM');
    await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 5_000);
        child.once('exit', () => {
            clearTimeout(timeout);
            resolve();
        });
    });
}

export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
    try {
        await fetch(baseURL);
        return async () => undefined;
    } catch {
        // Start the server below when no compatible endpoint is already running.
    }

    const child = spawn(process.execPath, [theiaCli, 'start', '--log-config=log-config.json', `--port=${port}`], {
        cwd: browserDirectory,
        env: process.env,
        stdio: 'ignore',
        windowsHide: true,
    });
    await waitForServer(child);
    return () => stopServer(child);
}
