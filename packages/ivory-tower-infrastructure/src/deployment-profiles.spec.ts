// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IVORY_DEPLOYMENT_PROFILES, REJECTED_LOCAL_SECRET_DEFAULTS } from './deployment-profiles';
import { DEFAULT_DOCLING_IMAGE, readIvoryTowerEnvironment, validateIvoryTowerEnvironment } from './environment';

const profileManifest = JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'configs', 'ivory-deployment-profiles.json'), 'utf8'),
) as {
    profiles: typeof IVORY_DEPLOYMENT_PROFILES;
    rejectedLocalSecretDefaults: typeof REJECTED_LOCAL_SECRET_DEFAULTS;
};

describe('Ivory deployment profiles', () => {
    it('matches the checked-in profile manifest', () => {
        expect(profileManifest.profiles).to.deep.equal(IVORY_DEPLOYMENT_PROFILES);
        expect(profileManifest.rejectedLocalSecretDefaults).to.deep.equal(REJECTED_LOCAL_SECRET_DEFAULTS);
    });

    it('allows local filesystem storage and local secret defaults', () => {
        const filesystem = readIvoryTowerEnvironment('api', {
            IVORY_TOWER_ENV: 'local',
            DATABASE_URL: 'postgres://ivory:ivory@127.0.0.1:5432/ivory_tower',
            DOCLING_IMAGE: DEFAULT_DOCLING_IMAGE,
        });
        expect(filesystem.storage.mode).to.equal('filesystem');
        expect(() => validateIvoryTowerEnvironment(filesystem)).not.to.throw();

        const localS3 = readIvoryTowerEnvironment('api', {
            IVORY_TOWER_ENV: 'local',
            DATABASE_URL: 'postgres://ivory:ivory@127.0.0.1:5432/ivory_tower',
            IVORY_S3_BUCKET: 'ivory-tower',
            IVORY_S3_ENDPOINT: 'http://127.0.0.1:9000',
            IVORY_S3_ACCESS_KEY_ID: 'ivory',
            IVORY_S3_SECRET_ACCESS_KEY: 'ivory-development-only',
            DOCLING_IMAGE: DEFAULT_DOCLING_IMAGE,
        });
        expect(localS3.storage.mode).to.equal('s3');
        expect(() => validateIvoryTowerEnvironment(localS3)).not.to.throw();
    });

    it('rejects filesystem storage in staging and production', () => {
        const env = readIvoryTowerEnvironment('api', {
            NODE_ENV: 'production',
            IVORY_TOWER_ENV: 'staging',
            DATABASE_URL: 'postgres://app:not-local@db/ivory',
            IVORY_API_BASE_URL: 'https://example.invalid',
            DOCLING_IMAGE: DEFAULT_DOCLING_IMAGE,
        });
        expect(() => validateIvoryTowerEnvironment(env)).to.throw('Filesystem object storage');
    });

    it('rejects local development secret defaults in production', () => {
        const env = readIvoryTowerEnvironment('api', {
            NODE_ENV: 'production',
            IVORY_TOWER_ENV: 'production',
            DATABASE_URL: 'postgres://ivory:ivory@db/ivory',
            IVORY_S3_BUCKET: 'ivory-tower',
            IVORY_S3_ENDPOINT: 'https://objects.example.invalid',
            IVORY_S3_ACCESS_KEY_ID: 'ivory',
            IVORY_S3_SECRET_ACCESS_KEY: 'ivory-development-only',
            IVORY_API_BASE_URL: 'https://example.invalid',
            DOCLING_IMAGE: DEFAULT_DOCLING_IMAGE,
        });
        expect(() => validateIvoryTowerEnvironment(env)).to.throw(
            'Local development secret defaults are not allowed in the production profile.',
        );
    });

    it('accepts production S3 credentials that are not local defaults', () => {
        const env = readIvoryTowerEnvironment('api', {
            NODE_ENV: 'production',
            IVORY_TOWER_ENV: 'production',
            DATABASE_URL: 'postgres://app:not-local@db/ivory',
            IVORY_S3_BUCKET: 'ivory-prod',
            IVORY_S3_ENDPOINT: 'https://objects.example.invalid',
            IVORY_S3_ACCESS_KEY_ID: 'AKIAEXAMPLE',
            IVORY_S3_SECRET_ACCESS_KEY: 'production-secret',
            IVORY_API_BASE_URL: 'https://example.invalid',
            DOCLING_IMAGE: DEFAULT_DOCLING_IMAGE,
        });
        expect(() => validateIvoryTowerEnvironment(env)).not.to.throw();
    });
});
