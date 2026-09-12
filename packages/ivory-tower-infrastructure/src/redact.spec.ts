// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { formatIvoryError, IVORY_REDACTED, logIvoryError, redactSecrets, redactText } from './redact';

describe('Ivory secret redaction', () => {
    it('redacts database URLs, MinIO local secrets, and Bearer tokens in objects', () => {
        const redacted = redactSecrets({
            DATABASE_URL: 'postgres://ivory:ivory@127.0.0.1:5432/ivory_tower',
            IVORY_S3_SECRET_ACCESS_KEY: 'ivory-development-only',
            authorization: 'Bearer secret-token',
            executionId: 'exec-1',
        }) as Record<string, string>;
        expect(redacted.DATABASE_URL).to.equal(IVORY_REDACTED);
        expect(redacted.IVORY_S3_SECRET_ACCESS_KEY).to.equal(IVORY_REDACTED);
        expect(redacted.authorization).to.equal(IVORY_REDACTED);
        expect(redacted.executionId).to.equal('exec-1');
    });

    it('redacts secrets inside Error messages used for process logs', () => {
        const formatted = formatIvoryError(new Error('connect postgres://ivory:supersecret@db/ivory failed'));
        expect(formatted).not.to.contain('supersecret');
        expect(formatted).to.contain('postgres://[Filtered]@');
        expect(redactText('MinIO password ivory-development-only')).to.equal(`MinIO password ${IVORY_REDACTED}`);
        expect(redactText('Authorization: Bearer abc.def')).to.contain('Bearer [Filtered]');
    });

    it('redacts audit-shaped payloads that carry source bytes or env URLs', () => {
        const redacted = redactSecrets({
            stage: 'admission',
            sourceBytes: Buffer.from('licensed full text').toString('utf8'),
            env: {
                DATABASE_URL: 'postgres://user:hunter2@db/ivory',
                DOCLING_ENDPOINT: 'http://127.0.0.1:5001',
            },
        }) as { stage: string; sourceBytes: string; env: Record<string, string> };
        expect(redacted.stage).to.equal('admission');
        expect(redacted.sourceBytes).to.equal(IVORY_REDACTED);
        expect(redacted.env.DATABASE_URL).to.equal(IVORY_REDACTED);
        expect(redacted.env.DOCLING_ENDPOINT).to.equal('http://127.0.0.1:5001');
    });

    it('does not write secrets through logIvoryError', () => {
        const lines: string[] = [];
        logIvoryError(new Error('postgres://user:hunter2@db/ivory'), message => lines.push(message));
        expect(lines).to.have.lengthOf(1);
        expect(lines[0]).not.to.contain('hunter2');
        expect(lines[0]).to.contain('postgres://[Filtered]@');
    });
});
