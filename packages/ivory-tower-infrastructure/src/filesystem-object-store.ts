// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { ObjectStorePort } from '@ivory-tower/adapters';

export class FilesystemObjectStore implements ObjectStorePort {
    private readonly root: string;

    constructor(rootDirectory: string) {
        this.root = resolve(rootDirectory);
    }

    async probe(): Promise<void> {
        await mkdir(this.root, { recursive: true });
        await stat(this.root);
    }

    async putImmutable(key: string, content: Uint8Array, _contentType: string): Promise<{ key: string; etag: string }> {
        const target = this.resolveKey(key);
        await mkdir(dirname(target), { recursive: true });
        try {
            const existing = await readFile(target);
            const existingEtag = createHash('sha256').update(existing).digest('hex');
            const nextEtag = createHash('sha256').update(content).digest('hex');
            if (existingEtag !== nextEtag) {
                throw new Error(`Immutable object already exists with different content: ${key}`);
            }
            return { key, etag: existingEtag };
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
            await writeFile(target, content, { flag: 'wx' });
            return { key, etag: createHash('sha256').update(content).digest('hex') };
        }
    }

    get(key: string): Promise<Uint8Array> {
        return readFile(this.resolveKey(key));
    }

    private resolveKey(key: string): string {
        const target = resolve(join(this.root, key));
        if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) {
            throw new Error('Object key escapes the configured object-store root.');
        }
        return target;
    }
}
