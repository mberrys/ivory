// @ts-check
'use strict';

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedPackage = path.join(root, 'dev-packages', 'private-ext-scripts', 'package.json');
const installedPackage = path.join(root, 'node_modules', '@theia', 'ext-scripts', 'package.json');
const installedBinary = path.join(root, 'node_modules', '@theia', 'ext-scripts', 'bin', 'theia-ext.js');
const toolchainConfig = path.join(root, 'configs', 'ivory-toolchain.json');

function readPackage(packagePath) {
    return JSON.parse(readFileSync(packagePath, 'utf8'));
}

function repairCommand() {
    return process.platform === 'win32' ? 'npm.cmd ci' : 'npm ci';
}

function fail(problem, remediation = `From the repository root, run \`${repairCommand()}\`, then rerun this check.`) {
    console.error(`Ivory Tower dependency bootstrap is incomplete: ${problem}`);
    console.error(remediation);
    console.error('Do not copy @theia/ext-scripts files into node_modules manually; npm must recreate the linked workspace package.');
    process.exitCode = 1;
}

function verifyToolchain() {
    const expected = readPackage(toolchainConfig);
    const actualNode = process.versions.node;
    const npmUserAgentVersion = /^npm\/([^\s]+)/u.exec(process.env.npm_config_user_agent ?? '')?.[1];
    const actualNpm =
        npmUserAgentVersion ??
        (process.platform === 'win32'
            ? execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd --version'], { encoding: 'utf8' }).trim()
            : execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim());
    if (actualNode !== expected.node || actualNpm !== expected.npm) {
        fail(
            `the required Node/npm toolchain is ${expected.node}/${expected.npm}, but this checkout is running ${actualNode}/${actualNpm}.`,
            'Install the exact Node and npm versions recorded in configs/ivory-toolchain.json, then rerun this check.',
        );
        return false;
    }
    return true;
}

function main() {
    if (!verifyToolchain()) {
        return;
    }
    if (!existsSync(expectedPackage)) {
        fail('the checked-in dev-packages/private-ext-scripts workspace package is missing.');
        return;
    }
    if (!existsSync(installedPackage)) {
        fail('node_modules/@theia/ext-scripts/package.json is missing.');
        return;
    }
    if (!existsSync(installedBinary)) {
        fail('node_modules/@theia/ext-scripts/bin/theia-ext.js is missing.');
        return;
    }

    const expected = readPackage(expectedPackage);
    const installed = readPackage(installedPackage);
    if (expected.name !== '@theia/ext-scripts' || installed.name !== expected.name) {
        fail('the installed @theia/ext-scripts package does not match the checked-in workspace package.');
        return;
    }
    if (installed.version !== expected.version) {
        fail(`the installed @theia/ext-scripts version (${installed.version}) does not match the workspace version (${expected.version}).`);
        return;
    }

    console.log(`Ivory Tower dependency bootstrap passed: ${installed.name}@${installed.version} with theia-ext.js available.`);
}

main();
