// @ts-check
'use strict';

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Installed toolsets keep the Spectre-mitigated libraries at
// VC/Tools/MSVC/<version>/lib/spectre/<arch> and .../atlmfc/lib/spectre/<arch>.
// The stale `lib/<arch>/spectre` pattern (via `vswhere -find`) matched no real
// toolset and reported the component missing while it was installed.
export const SPECTRE_LIBRARY_RELATIVE_DIRECTORIES = ['lib/spectre', 'atlmfc/lib/spectre'];

function isDirectory(candidate) {
    try {
        return fs.statSync(candidate).isDirectory();
    } catch {
        return false;
    }
}

function containsLibraries(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).some(entry => entry.isFile() && entry.name.endsWith('.lib'));
}

/**
 * Directories holding Spectre-mitigated `.lib` files under one Visual Studio
 * installation root (e.g. `C:/Program Files/Microsoft Visual Studio/2022/BuildTools`).
 * A directory without a single `.lib` file is a placeholder, not an installed
 * component, and does not count.
 */
export function spectreLibraryDirectories(installRoot) {
    const msvcRoot = path.join(installRoot, 'VC', 'Tools', 'MSVC');
    if (!isDirectory(msvcRoot)) {
        return [];
    }
    const directories = [];
    for (const toolset of fs.readdirSync(msvcRoot, { withFileTypes: true })) {
        if (!toolset.isDirectory()) {
            continue;
        }
        for (const relative of SPECTRE_LIBRARY_RELATIVE_DIRECTORIES) {
            const libraryRoot = path.join(msvcRoot, toolset.name, ...relative.split('/'));
            if (!isDirectory(libraryRoot)) {
                continue;
            }
            for (const arch of fs.readdirSync(libraryRoot, { withFileTypes: true })) {
                if (!arch.isDirectory()) {
                    continue;
                }
                const candidate = path.join(libraryRoot, arch.name);
                if (containsLibraries(candidate)) {
                    directories.push(candidate);
                }
            }
        }
    }
    return directories.sort();
}

/** Classify the Spectre component for the given installation roots (empty = missing). */
export function evaluateSpectreComponent(installRoots) {
    const directories = installRoots.flatMap(spectreLibraryDirectories);
    return directories.length === 0 ? { status: 'missing', directories } : { status: 'installed', directories };
}

function installationRoots(vsWhere) {
    try {
        const output = execFileSync(vsWhere, ['-latest', '-products', '*', '-property', 'installationPath'], { encoding: 'utf8' });
        return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    } catch {
        return [];
    }
}

function runChecks() {
    const expected = JSON.parse(fs.readFileSync(path.join(root, 'configs', 'ivory-toolchain.json'), 'utf8'));
    const nodeVersion = process.versions.node;
    const npmVersion =
        process.platform === 'win32'
            ? execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd --version'], { encoding: 'utf8' }).trim()
            : execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
    if (nodeVersion !== expected.node || npmVersion !== expected.npm) {
        console.error(`Ivory Tower requires Node ${expected.node} and npm ${expected.npm}; found Node ${nodeVersion} and npm ${npmVersion}.`);
        process.exit(1);
    }
    if (process.platform === 'win32') {
        const vsWhere = 'C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe';
        if (process.env.IVORY_SKIP_SPECTRE_CHECK !== '1') {
            const { status, directories } = evaluateSpectreComponent(installationRoots(vsWhere));
            if (status === 'missing') {
                console.error('Ivory Tower Windows backend bundling requires the MSVC Spectre-mitigated libraries.');
                console.error(
                    'Install the component, e.g.: Visual Studio Installer > Modify > Individual components > "MSVC v143 - VS 2022 C++ x64/x86 Spectre-mitigated libraries", or see docs/n5-theia-client-equivalence.md.',
                );
                process.exit(1);
            }
            console.log(`Ivory Tower toolchain: Spectre-mitigated MSVC libraries (${directories.length} toolset directories)`);
        }
    }
    console.log(`Ivory Tower toolchain: Node ${nodeVersion}, npm ${npmVersion}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runChecks();
}
