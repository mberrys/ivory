// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import * as Sentry from '@sentry/node';
import type { Breadcrumb, ErrorEvent, Event, EventHint } from '@sentry/node';
import { readIvoryTowerEnvironment } from './environment';
import { IVORY_REDACTED, containsSensitiveValue, redactSecrets, redactText } from './redact';

export type IvorySentryService = 'ivory-api' | 'ivory-worker';

export interface IvorySentryConfig {
    readonly enabled: boolean;
    readonly dsn?: string;
    readonly environment: string;
    readonly release?: string;
    readonly tracesSampleRate: number;
    readonly service: IvorySentryService;
}

let initialized = false;

export function readSentryConfigFromEnvironment(service: IvorySentryService): IvorySentryConfig {
    const ivoryEnv = readIvoryTowerEnvironment();
    const dsn = process.env.SENTRY_DSN?.trim();
    const explicitEnabled = parseOptionalBoolean(process.env.SENTRY_ENABLED);
    const enabled = explicitEnabled ?? (dsn !== undefined && dsn.length > 0);
    const environment = process.env.SENTRY_ENVIRONMENT?.trim() || ivoryEnv.ivoryTowerEnv;
    const release = process.env.SENTRY_RELEASE?.trim();
    const tracesSampleRate = parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE);
    return {
        enabled,
        dsn: dsn && dsn.length > 0 ? dsn : undefined,
        environment,
        release: release && release.length > 0 ? release : undefined,
        tracesSampleRate,
        service,
    };
}

export function initIvorySentry(config: IvorySentryConfig): boolean {
    if (!config.enabled || config.dsn === undefined) {
        return false;
    }
    if (initialized) {
        return true;
    }

    Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        tracesSampleRate: config.tracesSampleRate,
        beforeSend: (event, hint) => scrubSentryErrorEvent(event, hint),
        beforeBreadcrumb: scrubSentryBreadcrumb,
        initialScope: scope => {
            scope.setTag('ivory.service', config.service);
            scope.setTag('ivory.tower_env', config.environment);
            return scope;
        },
    });

    registerProcessHandlers();
    initialized = true;
    return true;
}

export function isIvorySentryInitialized(): boolean {
    return initialized;
}

export function captureIvoryException(error: unknown, context?: Readonly<Record<string, unknown>>): void {
    if (!initialized) {
        return;
    }
    Sentry.withScope(scope => {
        if (context !== undefined) {
            const scrubbed = redactSecrets(context);
            // eslint-disable-next-line no-null/no-null
            if (scrubbed !== null && typeof scrubbed === 'object' && !Array.isArray(scrubbed)) {
                scope.setContext('ivory', scrubbed as Record<string, unknown>);
            }
            for (const [key, value] of Object.entries(scrubbed as Record<string, unknown>)) {
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    scope.setTag(`ivory.${key}`, String(value));
                }
            }
        }
        if (error instanceof Error) {
            const redacted = redactSecrets(error);
            Sentry.captureException(redacted instanceof Error ? redacted : new Error(IVORY_REDACTED));
            return;
        }
        Sentry.captureException(new Error(typeof error === 'string' ? redactText(error) : 'Unknown Ivory Tower error'));
    });
}

export async function flushIvorySentry(timeoutMs = 2_000): Promise<boolean> {
    if (!initialized) {
        return true;
    }
    return Sentry.flush(timeoutMs);
}

export function scrubSentryEvent(event: Event, _hint?: EventHint): Event | null {
    return scrubEventPayload(event);
}

export function scrubSentryErrorEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent | null {
    return scrubEventPayload(event, hint) as ErrorEvent | null;
}

function scrubEventPayload(event: Event, _hint?: EventHint): Event | null {
    if (event.request !== undefined) {
        event.request = scrubRequest(event.request);
    }
    if (event.breadcrumbs !== undefined) {
        event.breadcrumbs = event.breadcrumbs
            .map(scrubSentryBreadcrumb)
            // eslint-disable-next-line no-null/no-null
            .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null);
    }
    if (event.extra !== undefined) {
        event.extra = redactSecrets(event.extra) as Record<string, unknown>;
    }
    if (event.contexts !== undefined) {
        event.contexts = redactSecrets(event.contexts) as Record<string, Record<string, unknown>>;
    }
    if (event.user !== undefined) {
        event.user = redactSecrets(event.user) as Event['user'];
    }
    if (event.exception?.values !== undefined) {
        event.exception.values = event.exception.values.map(value => ({
            ...value,
            value: typeof value.value === 'string' ? redactText(value.value) : value.value,
        }));
    }
    return event;
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
    const scrubbed: Breadcrumb = { ...breadcrumb };
    if (scrubbed.data !== undefined) {
        scrubbed.data = redactSecrets(scrubbed.data) as Record<string, unknown>;
    }
    if (typeof scrubbed.message === 'string' && containsSensitiveValue(scrubbed.message)) {
        scrubbed.message = IVORY_REDACTED;
    }
    return scrubbed;
}

function registerProcessHandlers(): void {
    process.on('unhandledRejection', reason => {
        captureIvoryException(reason, { stage: 'unhandled_rejection' });
    });
    process.on('uncaughtException', error => {
        captureIvoryException(error, { stage: 'uncaught_exception' });
        flushIvorySentry().finally(() => process.exit(1));
    });
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
    if (value === undefined) {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
        return true;
    }
    if (normalized === 'false' || normalized === '0') {
        return false;
    }
    return undefined;
}

function parseSampleRate(value: string | undefined): number {
    if (value === undefined || value.trim().length === 0) {
        return 0;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        throw new Error(`Invalid SENTRY_TRACES_SAMPLE_RATE: ${value}`);
    }
    return parsed;
}

function scrubRequest(request: NonNullable<Event['request']>): NonNullable<Event['request']> {
    const scrubbed = { ...request };
    if (scrubbed.headers !== undefined) {
        scrubbed.headers = redactSecrets(scrubbed.headers) as Record<string, string>;
    }
    if (scrubbed.cookies !== undefined) {
        scrubbed.cookies = Object.fromEntries(Object.keys(scrubbed.cookies).map(key => [key, IVORY_REDACTED]));
    }
    if (scrubbed.data !== undefined) {
        scrubbed.data = IVORY_REDACTED;
    }
    if (scrubbed.query_string !== undefined) {
        scrubbed.query_string = IVORY_REDACTED;
    }
    return scrubbed;
}
