// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import { createInterface } from 'node:readline/promises';
import { randomUUID } from 'node:crypto';
import { connect } from './client.mjs';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

export async function review({ live = false } = {}) {
    const session = await connect({ live });
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const { fragment } = await session.control('bootstrap');
        await session.tool('read_excerpt', { ref: fragment });
        const transmission = await session.control('transmission', { ref: fragment });
        console.log(JSON.stringify(transmission, null, 2));
        const answer = await terminal.question(`Type the transmission digest to approve ${live ? 'sending' : 'replaying'} this exact request, or revoke/decline: `);
        if (answer === 'revoke') await session.control('revoke');
        else if (answer === transmission.digest) {
            await session.control('approve-transmission', { digest: answer });
            const candidate = await session.control('dispatch', { digest: answer });
            const proposal = await session.tool('propose_claim', candidate);
            console.log(JSON.stringify(await session.control('preview', { id: proposal.id }), null, 2));
            const decision = await terminal.question('Type the proposal digest to accept this exact content, or revoke/decline: ');
            if (decision === 'revoke') await session.control('revoke');
            else if (decision === proposal.digest) {
                const request = { id: proposal.id, digest: decision, idempotencyKey: randomUUID() };
                const before = await session.control('state');
                const receipt = await session.control('accept', request);
                assert.deepEqual(await session.control('accept', request), receipt);
                assert.equal((await session.control('state')).sequence, before.sequence + 2);
                console.log(receipt);
                return { status: 'passed', transmission, proposal, receipt, replay: 'same-receipt',
                    observations: await session.control('observations') };
            }
            else await session.control('decline', { id: proposal.id });
        }
        return { status: 'not-completed', reason: 'Researcher declined or revoked the request.' };
    } finally { terminal.close(); await session.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await review({ live: process.argv.includes('--live') });
}
