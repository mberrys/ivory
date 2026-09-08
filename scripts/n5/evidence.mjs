import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function probe(command, args) {
    try {
        return {
            status: 'available',
            version: execFileSync(command, args, { cwd: root, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
        };
    } catch {
        return { status: 'blocked', reason: `${command} unavailable or version probe failed` };
    }
}
const clients = ['theia', 'cli', 'r', 'python'];
const blocked = reason => ({ status: 'blocked', reason });
function fingerprints(relative) {
    const absolute = path.join(root, relative);
    return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
        const name = `${relative}/${entry.name}`;
        if (entry.isDirectory()) {
            return ['node_modules', 'lib', 'plugins', 'src-gen', '__pycache__'].includes(entry.name) ? [] : fingerprints(name);
        }
        if (/tsbuildinfo$|^gen-|\.log$/.test(entry.name)) { return []; }
        return [{ path: name, sha256: createHash('sha256').update(readFileSync(path.join(root, name))).digest('hex') }];
    });
}
const contractReason =
    'Prerequisite project/citation/resolved RunSpec/revision-edit service contracts absent; no substitute service was implemented';
const report = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    workingTree: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
    platform: `${process.platform}/${process.arch}`,
    decision: 'blocked',
    sourceFingerprints: ['packages/ivory-n5-client', 'packages/ivory-n5-shell', 'examples/ivory-n5-browser', 'scripts/n5'].flatMap(fingerprints),
    serviceVersion: null,
    prerequisite: blocked(contractReason),
    clients: Object.fromEntries(
        clients.map(client => [
            client,
            Object.fromEntries(['project', 'citation', 'runSpec', 'semanticResult'].map(test => [test, blocked(contractReason)])),
        ]),
    ),
    orderedConflicts: clients.flatMap(first =>
        clients.filter(second => second !== first).map(second => ({ first, second, ...blocked(contractReason) })),
    ),
    restart: blocked('Requires canonical service and writer/process evidence; transport unit tests are not restart qualification'),
    exactNavigation: blocked(contractReason),
    languageWorkflows: blocked('Requires built application, activated extensions, and observed editor behaviors'),
    notebook: { status: 'conditional-not-tested', included: false, reason: 'No notebook/kernel extension included in mandatory candidate' },
    runtimes: {
        node: { status: 'available', version: process.version },
        python: probe(process.env.IVORY_N5_PYTHON || 'python', ['--version']),
        r: probe('Rscript', ['--version']),
        quarto: probe('quarto', ['--version']),
    },
    dependenciesInstalled: existsSync(path.join(root, 'node_modules/@theia/ext-scripts/bin/theia-ext.js')),
    extensions: JSON.parse(readFileSync(path.join(root, 'examples/ivory-n5-browser/extensions.lock.json'), 'utf8')),
};
const out = path.join(root, 'artifacts/n5');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`N5 decision: BLOCKED. Evidence: ${path.join(out, 'evidence.json')}`);
process.exitCode = 2;
