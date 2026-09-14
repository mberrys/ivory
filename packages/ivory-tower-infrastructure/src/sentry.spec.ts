// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import type { Event } from '@sentry/node';
import { readSentryConfigFromEnvironment, scrubSentryBreadcrumb, scrubSentryEvent } from './sentry';

describe('ivory sentry adapter', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('disables sentry when no DSN is configured', () => {
        delete process.env.SENTRY_DSN;
        delete process.env.SENTRY_ENABLED;
        const config = readSentryConfigFromEnvironment('ivory-api');
        expect(config.enabled).to.equal(false);
        expect(config.dsn).to.equal(undefined);
    });

    it('enables sentry when a DSN is configured', () => {
        process.env.SENTRY_DSN = 'https://example@o0.ingest.sentry.io/0';
        process.env.SENTRY_ENVIRONMENT = 'staging';
        const config = readSentryConfigFromEnvironment('ivory-worker');
        expect(config.enabled).to.equal(true);
        expect(config.dsn).to.equal('https://example@o0.ingest.sentry.io/0');
        expect(config.environment).to.equal('staging');
        expect(config.service).to.equal('ivory-worker');
    });

    it('scrubs sensitive request and context fields before send', () => {
        const event: Event = {
            request: {
                headers: {
                    authorization: 'Bearer secret-token',
                    'x-source-authorization-evidence': 'licensed copy',
                },
                data: '{"passage":"quoted text"}',
            },
            extra: {
                DATABASE_URL: 'postgresql://user:pass@db.example/ivory',
                executionId: 'exec-1',
            },
            breadcrumbs: [
                {
                    category: 'http',
                    message: 'postgresql://user:pass@db.example/ivory',
                    data: {
                        authorizationEvidence: 'licensed copy',
                        stage: 'conversion',
                    },
                },
            ],
        };

        const scrubbed = scrubSentryEvent(event);
        expect(scrubbed?.request?.headers?.authorization).to.equal('[Filtered]');
        expect(scrubbed?.request?.headers?.['x-source-authorization-evidence']).to.equal('[Filtered]');
        expect(scrubbed?.request?.data).to.equal('[Filtered]');
        expect(scrubbed?.extra?.DATABASE_URL).to.equal('[Filtered]');
        expect(scrubbed?.extra?.executionId).to.equal('exec-1');
        expect(scrubbed?.breadcrumbs?.[0]?.data?.authorizationEvidence).to.equal('[Filtered]');
        expect(scrubbed?.breadcrumbs?.[0]?.data?.stage).to.equal('conversion');
        expect(scrubbed?.breadcrumbs?.[0]?.message).to.equal('[Filtered]');
    });

    it('scrubs sensitive breadcrumb payloads', () => {
        const breadcrumb = scrubSentryBreadcrumb({
            category: 'worker',
            data: {
                sourceContent: 'full text',
                kind: 'convert',
            },
        });
        expect(breadcrumb?.data?.sourceContent).to.equal('[Filtered]');
        expect(breadcrumb?.data?.kind).to.equal('convert');
    });
});
