import { join } from 'node:path';

export function projectLayout(projectRoot) {
    const ivory = join(projectRoot, '.ivory');
    return {
        ivory,
        store: join(ivory, 'store'),
        objects: join(ivory, 'objects', 'sha256'),
        staging: join(ivory, 'staging'),
        local: join(ivory, 'local'),
        published: join(ivory, 'published'),
        lock: join(ivory, 'local', 'writer.lock'),
        exportDir: join(projectRoot, 'research-export'),
    };
}

export function casPath(objectsRoot, digest) {
    return join(objectsRoot, digest.slice(0, 2), digest);
}
