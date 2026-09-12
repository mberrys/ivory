// @ts-check
'use strict';

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const expected = JSON.parse(fs.readFileSync(path.join(root, 'configs', 'ivory-toolchain.json'), 'utf8'));
const nodeVersion = process.versions.node;
const npmVersion = process.platform === 'win32'
    ? execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd --version'], { encoding: 'utf8' }).trim()
    : execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
if (nodeVersion !== expected.node || npmVersion !== expected.npm) {
    console.error(`Ivory Tower requires Node ${expected.node} and npm ${expected.npm}; found Node ${nodeVersion} and npm ${npmVersion}.`);
    process.exit(1);
}
console.log(`Ivory Tower toolchain: Node ${nodeVersion}, npm ${npmVersion}`);
