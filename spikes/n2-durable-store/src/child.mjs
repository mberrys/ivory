#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { DurableStore } from './durable-store.mjs';

const argv = process.argv.slice(2);
const args = {};
for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
        continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
        args[key] = true;
    } else {
        args[key] = next;
        index += 1;
    }
}

const store = new DurableStore();
await store.open(args.project);
try {
    if (args.mode === 'probe-lock' || args.mode === 'migrate') {
        process.stdout.write(JSON.stringify({ opened: true }));
    } else {
        const command = JSON.parse(await readFile(args.command, 'utf8'));
        for (const blob of command.blobs ?? []) {
            if (blob.text !== undefined) {
                blob.bytes = Buffer.from(blob.text, 'utf8');
            }
            if (blob.base64 !== undefined) {
                blob.bytes = Buffer.from(blob.base64, 'base64');
            }
        }
        const receipt = await store.commit(command);
        process.stdout.write(JSON.stringify(receipt));
    }
} finally {
    await store.close();
}
