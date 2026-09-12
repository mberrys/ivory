// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
for (const name of ['ivory-identity', 'ivory-tower-research-kernel', 'ivory-tower-agent-experiment']) {
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', `packages/${name}/tsconfig.json`, '--noEmitOnError'], {
        cwd: root, stdio: 'inherit', windowsHide: true,
    });
}
