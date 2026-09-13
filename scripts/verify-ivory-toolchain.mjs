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
if (process.platform === 'win32') {
    const vsWhere = 'C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe';
    const spectreDirectories = () => {
        try {
            const output = execFileSync(vsWhere, ['-latest', '-products', '*', '-find', 'VC/Tools/MSVC/*/lib/*/spectre'], { encoding: 'utf8' });
            return output.split(/\r?\n/).filter(Boolean);
        } catch {
            return [];
        }
    };
    if (process.env.IVORY_SKIP_SPECTRE_CHECK !== '1') {
        const directories = spectreDirectories();
        if (directories.length === 0) {
            console.error('Ivory Tower Windows backend bundling requires the MSVC Spectre-mitigated libraries.');
            console.error('Install the component, e.g.: Visual Studio Installer > Modify > Individual components > "MSVC v143 - VS 2022 C++ x64/x86 Spectre-mitigated libraries", or see docs/n5-theia-client-equivalence.md.');
            process.exit(1);
        }
        console.log(`Ivory Tower toolchain: Spectre-mitigated MSVC libraries (${directories.length} toolset directories)`);
    }
}
console.log(`Ivory Tower toolchain: Node ${nodeVersion}, npm ${npmVersion}`);
