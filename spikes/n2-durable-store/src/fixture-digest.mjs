import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Deterministic manifest of the spike fixture. Paths keep the current committed shape. */
export async function collectFixtureFiles(directory, label = 'spikes/n2-durable-store') {
    const files = [];
    await walk(directory, label, files);
    return files;
}

async function walk(directory, prefix, files) {
    const entries = (await readdir(directory, { withFileTypes: true }))
        .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
        if (entry.name === 'node_modules') {
            continue;
        }
        const relativePath = `${prefix}/${entry.name}`;
        const absolutePath = join(directory, entry.name);
        if (entry.isDirectory()) {
            await walk(absolutePath, relativePath, files);
        } else if (entry.isFile()) {
            files.push({
                path: relativePath,
                sha256: createHash('sha256').update(await readFile(absolutePath)).digest('hex'),
            });
        }
    }
}

export function digestManifest(files) {
    return createHash('sha256')
        .update(files.map(file => `${file.path}\0${file.sha256}\n`).join(''))
        .digest('hex');
}
