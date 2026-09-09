import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export async function buildKernel(tests = false) {
    const entry = tests ? 'research-kernel.spec' : 'index';
    const outfile = resolve(root, `artifacts/n6/build/${entry}.cjs`);
    await build({
        absWorkingDir: root,
        entryPoints: [`packages/ivory-tower-research-kernel/src/node/${entry}.ts`],
        outfile, bundle: true, platform: 'node', format: 'cjs',
        alias: { '@theia/ivory-identity/lib/node/identity': resolve(root, 'packages/ivory-identity/src/node/identity.ts') },
        nodePaths: [resolve(root, 'spikes/n6-portable-reproduction/node_modules')],
    });
    return outfile;
}
