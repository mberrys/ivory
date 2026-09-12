import os from 'node:os';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function recordHardware() {
    const cpus = os.cpus();
    let pgliteVersion = 'uninstalled';
    try {
        const pkgPath = fileURLToPath(new URL('../node_modules/@electric-sql/pglite/package.json', import.meta.url));
        pgliteVersion = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
    } catch {
        /* spike node_modules not present */
    }
    return {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpuModel: cpus[0]?.model,
        cpuCount: cpus.length,
        totalMemBytes: os.totalmem(),
        node: process.version,
        pgliteVersion,
        cwd: process.cwd(),
        recordedAt: new Date().toISOString(),
    };
}

export function memorySnapshot() {
    const usage = process.memoryUsage();
    return {
        rss: usage.rss,
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
    };
}
