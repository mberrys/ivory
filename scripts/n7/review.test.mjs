// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

for (const decision of ['accept', 'decline', 'revoke']) {
    test(`trusted CLI ${decision} path requires both content previews`, async () => {
        const child = spawn(process.execPath, ['scripts/n7/review.mjs'], {
            cwd: fileURLToPath(new URL('../../', import.meta.url)), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
        });
        let buffer = ''; let output = ''; let errors = ''; let stage = 0;
        const timeout = setTimeout(() => child.kill(), 15000);
        child.stdout.on('data', chunk => {
            output += chunk.toString(); buffer += chunk.toString();
            if (stage === 0 && buffer.includes('or revoke/decline:')) {
                const digest = buffer.match(/"digest": "([a-f0-9]{64})"/)[1];
                stage = 1; buffer = ''; child.stdin.write(`${digest}\n`);
            } else if (stage === 1 && buffer.includes('or revoke/decline:')) {
                const digest = buffer.match(/"digest": "([a-f0-9]{64})"/)[1];
                stage = 2; buffer = ''; child.stdin.write(`${decision === 'accept' ? digest : decision}\n`);
            }
        });
        child.stderr.on('data', chunk => { errors += chunk.toString(); });
        try {
            const code = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
            assert.equal(code, 0, errors);
            assert.equal(stage, 2);
            assert.match(output, /"state": "pending"/);
            assert.equal(output.includes('requestDigest:'), decision === 'accept');
        } finally { clearTimeout(timeout); child.stdin.destroy(); }
    });
}
