import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const manifest = JSON.parse(readFileSync(new URL('../../docs/reset/archive-source-manifest.json', import.meta.url), 'utf8'));
const archivePath = path.resolve(process.argv[2] ?? '.audit/archive');
const git = (...args) => execFileSync('git', ['-C', archivePath, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const actualHead = git('rev-parse', 'HEAD');
if (actualHead !== manifest.archive.selectedSourceCommit) throw Error('archive HEAD differs from manifest SHA');
const tree = git('rev-parse', 'HEAD^{tree}');
if (tree !== manifest.archive.selectedSourceTree) throw Error('archive tree SHA differs from manifest');
const entries = git('ls-tree', '-r', '--full-tree', 'HEAD').split('\n');
const map = new Map(entries.map(line => {
  const match = line.match(/^100[0-7]{3} blob ([a-f0-9]{40})\t(.+)$/);
  return match ? [match[2], match[1]] : null;
}).filter(Boolean));
for (const entry of manifest.sourceEntries) {
  if (entry.head !== actualHead || map.get(entry.path) !== entry.blob) {
    throw Error('source blob mismatch: ' + entry.path);
  }
  if (entry.promotionStatus !== 'not-promoted') throw Error('unexpected promotion: ' + entry.path);
}
console.log('Verified ' + manifest.sourceEntries.length + ' exact archive source blobs at ' + actualHead + '; no product promotion recorded.');
