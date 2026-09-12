// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

export const IVORY_REDACTED = '[Filtered]';

const SENSITIVE_KEY_PATTERN =
    // eslint-disable-next-line max-len
    /(?:pass(?:word)?|secret|token|api[_-]?key|authorization(?:evidence)?|credential|dsn|connection(?:string)?|access[_-]?key(?:id)?|secret[_-]?access[_-]?key|session|cookie|bearer|passage|content(?:hash)?|source(?:bytes|content)?|body|payload|prompt|license|evidence)$/i;

export function redactSecrets(value: unknown, depth = 0): unknown {
    if (depth > 8) {
        return IVORY_REDACTED;
    }
    // eslint-disable-next-line no-null/no-null
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'string') {
        return containsSensitiveValue(value) ? IVORY_REDACTED : value;
    }
    if (value instanceof Error) {
        const redacted = new Error(containsSensitiveValue(value.message) ? IVORY_REDACTED : value.message);
        redacted.name = value.name;
        if (typeof value.stack === 'string') {
            redacted.stack = redactText(value.stack);
        }
        return redacted;
    }
    if (typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(entry => redactSecrets(entry, depth + 1));
    }
    const record = value as Record<string, unknown>;
    const scrubbed: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
        if (isSensitiveKey(key)) {
            scrubbed[key] = IVORY_REDACTED;
            continue;
        }
        scrubbed[key] = redactSecrets(entry, depth + 1);
    }
    return scrubbed;
}

export function redactText(value: string): string {
    if (containsSensitiveValue(value)) {
        return value
            .replace(/postgres(?:ql)?:\/\/[^:\s]{1,256}:[^@\s]{1,256}@/gi, 'postgres://[Filtered]@')
            .replace(/https?:\/\/[^:@\s]{1,256}:[^@\s]{1,256}@/gi, 'https://[Filtered]@')
            .replace(/Bearer\s+\S+/gi, 'Bearer [Filtered]')
            .replace(/ivory-development-only/g, IVORY_REDACTED);
    }
    return value;
}

export function formatIvoryError(error: unknown): string {
    if (error instanceof Error) {
        const stack = error.stack === undefined ? `${error.name}: ${error.message}` : error.stack;
        return redactText(stack);
    }
    const redacted = redactSecrets(error);
    return typeof redacted === 'string' ? redacted : JSON.stringify(redacted);
}

export function logIvoryError(error: unknown, logger: (message: string) => void = console.error): void {
    logger(formatIvoryError(error));
}

export function isSensitiveKey(key: string): boolean {
    const normalized = key.replace(/[-\s]/g, '_');
    return SENSITIVE_KEY_PATTERN.test(normalized) || normalized.startsWith('x_source_');
}

export function containsSensitiveValue(value: string): boolean {
    if (/postgres(?:ql)?:\/\//i.test(value)) {
        return true;
    }
    if (/https?:\/\/[^:@\s]{1,256}:[^@\s]{1,256}@/i.test(value)) {
        return true;
    }
    if (/Bearer\s+/i.test(value)) {
        return true;
    }
    if (value.includes('ivory-development-only')) {
        return true;
    }
    return false;
}
