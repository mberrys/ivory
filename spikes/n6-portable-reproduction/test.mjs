import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { root, buildKernel } from './build.mjs';

const spec = await buildKernel(true);
for (const args of [
    [resolve(root, 'spikes/n6-portable-reproduction/node_modules/mocha/bin/mocha.js'), spec],
    ['--test', resolve(root, 'spikes/n6-portable-reproduction/test/portable.spec.mjs')],
]) {
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
    if (result.status !== 0) { process.exit(result.status ?? 1); }
}
