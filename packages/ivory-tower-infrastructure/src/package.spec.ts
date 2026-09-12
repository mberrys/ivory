// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { DEFAULT_DOCLING_IMAGE, readIvoryTowerEnvironment, validateIvoryTowerEnvironment } from './environment';
import { SystemClockAdapter } from './system-clock-adapter';

describe('@ivory-tower/infrastructure', () => {
    it('reads default environment values', () => {
        const env = readIvoryTowerEnvironment();
        validateIvoryTowerEnvironment(env);
        expect(env.nodeEnv).to.equal('development');
        expect(env.ivoryTowerEnv).to.equal('local');
        expect(env.docling.imageRef).to.equal(DEFAULT_DOCLING_IMAGE);
    });

    it('rejects missing service secrets and mutable Docling image references before startup', () => {
        const env = readIvoryTowerEnvironment('api', {
            NODE_ENV: 'production',
            IVORY_TOWER_ENV: 'production',
            PORT: '4100',
            IVORY_API_BASE_URL: 'https://example.invalid',
            DOCLING_IMAGE: 'quay.io/docling-project/docling-serve:v1.21.0',
        });
        expect(() => validateIvoryTowerEnvironment(env)).to.throw('DATABASE_URL');
        expect(() =>
            validateIvoryTowerEnvironment({
                ...env,
                databaseUrl: 'postgres://ivory:secret@db/ivory',
                queue: { provider: 'graphile-worker', databaseUrl: 'postgres://ivory:secret@db/ivory' },
            }),
        ).to.throw('Filesystem object storage');
    });

    it('rejects a floating Docling image tag (IV-19 adversarial fixture)', () => {
        const env = readIvoryTowerEnvironment('library', {
            DOCLING_IMAGE: 'quay.io/docling-project/docling-serve:v1.21.0',
        });
        expect(() => validateIvoryTowerEnvironment(env)).to.throw('DOCLING_IMAGE must be pinned by an immutable sha256 digest.');
    });

    it('provides a system clock adapter', () => {
        const clock = new SystemClockAdapter();
        expect(clock.now()).to.be.instanceOf(Date);
    });
});
