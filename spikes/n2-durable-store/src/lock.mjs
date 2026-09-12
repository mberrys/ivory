import { openSync, writeFileSync, readFileSync, unlinkSync, closeSync, existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { WriterContentionError } from './errors.mjs';

function processAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

export async function acquireWriterLock(lockPath) {
    await mkdir(dirname(lockPath), { recursive: true });
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const fd = openSync(lockPath, 'wx');
            writeFileSync(fd, `${process.pid}\n`);
            return {
                lockPath,
                release() {
                    try {
                        closeSync(fd);
                    } catch {
                        /* already closed */
                    }
                    try {
                        unlinkSync(lockPath);
                    } catch {
                        /* crashed reopen may already have taken over */
                    }
                },
            };
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
            const raw = existsSync(lockPath) ? readFileSync(lockPath, 'utf8').trim() : '';
            const ownerPid = Number.parseInt(raw, 10);
            if (processAlive(ownerPid)) {
                throw new WriterContentionError(ownerPid);
            }
            try {
                unlinkSync(lockPath);
            } catch {
                /* raced with another recoverer */
            }
        }
    }
    throw new WriterContentionError(0);
}
