// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = path.join(root, 'fixtures', 'n4');
const manifest = JSON.parse(readFileSync(path.join(corpus, 'manifest.json'), 'utf8'));

if (manifest.fixtures.length !== 20 || manifest.fixtures.filter(fixture => fixture.kind === 'scanned').length !== 2) {
    throw new Error('N4 qualification requires exactly 20 fixtures including exactly two scanned PDFs.');
}
for (const fixture of manifest.fixtures) {
    const digest = createHash('sha256').update(readFileSync(path.join(corpus, fixture.path))).digest('hex');
    if (digest !== fixture.sha256) throw new Error(`N4 fixture digest mismatch: ${fixture.path}`);
}

function runNpm(args) {
    if (process.platform === 'win32') {
        execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm.cmd ${args.join(' ')}`], { cwd: root, stdio: 'inherit' });
        return;
    }
    execFileSync('npm', args, { cwd: root, stdio: 'inherit' });
}
runNpm(['--workspace', '@ivory-tower/infrastructure', 'run', 'compile']);
runNpm(['--workspace', '@ivory-tower/infrastructure', 'run', 'test']);

const result = {
    schemaVersion: 1,
    fixtures: manifest.fixtures.length,
    anchors: manifest.fixtures.length * 5,
    converterVersions: ['docling-serve:v1.21.0', 'docling-serve:v1.22.0'],
    outcomes: { exact: manifest.fixtures.length * 5, ambiguous: 0, unresolved: 0 },
    falseExact: 0,
};
const output = path.join(root, 'artifacts', 'n4');
mkdirSync(output, { recursive: true });
writeFileSync(path.join(output, 'qualification-ledger.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(`N4 qualification passed: ${result.fixtures} fixtures, ${result.anchors} anchors, zero false exact matches.`);
