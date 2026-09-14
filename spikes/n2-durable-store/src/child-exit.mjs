import { spawn } from 'node:child_process';

export async function killProcess(pid) {
    if (pid === undefined || pid === null) {
        return;
    }
    if (process.platform === 'win32') {
        await new Promise(resolve => {
            const killer = spawn('taskkill', ['/F', '/PID', String(pid), '/T'], { stdio: 'ignore' });
            const timer = setTimeout(resolve, 5000);
            killer.once('exit', () => {
                clearTimeout(timer);
                resolve();
            });
            killer.once('error', () => {
                clearTimeout(timer);
                resolve();
            });
        });
        return;
    }
    try {
        process.kill(pid, 'SIGKILL');
    } catch {
        /* already gone */
    }
}

/**
 * Wait until `child` has actually exited. A timeout while the process is still
 * alive is a harness failure — callers must not reopen the store as if the
 * interrupt completed.
 */
export function waitForChildExit(child, timeoutMs = 5000) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return Promise.resolve({ exitCode: child.exitCode, signalCode: child.signalCode });
    }
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            const alive = child.exitCode === null && child.signalCode === null;
            if (alive) {
                reject(new Error(
                    `interrupt wait timed out after ${timeoutMs}ms with child pid ${child.pid} still alive`,
                ));
                return;
            }
            resolve({ exitCode: child.exitCode, signalCode: child.signalCode });
        }, timeoutMs);
        child.once('exit', (exitCode, signalCode) => {
            clearTimeout(timer);
            resolve({ exitCode, signalCode });
        });
    });
}
