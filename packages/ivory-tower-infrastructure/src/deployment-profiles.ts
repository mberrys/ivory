// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

export interface IvoryDeploymentProfileInput {
    readonly ivoryTowerEnv: string;
    readonly role: string;
    readonly databaseUrl?: string;
    readonly storage: {
        readonly mode: string;
        readonly accessKeyId?: string;
        readonly secretAccessKey?: string;
    };
}

export const IVORY_DEPLOYMENT_PROFILES = {
    local: {
        storage: ['filesystem', 's3'] as const,
        localSecretDefaultsAllowed: true,
        minio: 'local-dev-only-unreviewed-agpl',
    },
    staging: {
        storage: ['s3'] as const,
        localSecretDefaultsAllowed: false,
    },
    production: {
        storage: ['s3'] as const,
        localSecretDefaultsAllowed: false,
    },
} as const;

export const REJECTED_LOCAL_SECRET_DEFAULTS = {
    s3AccessKeyId: ['ivory'],
    s3SecretAccessKey: ['ivory-development-only'],
    databaseUrlPrefixes: ['postgres://ivory:ivory@', 'postgresql://ivory:ivory@'],
} as const;

export type IvoryDeploymentProfileName = keyof typeof IVORY_DEPLOYMENT_PROFILES;

export function validateIvoryDeploymentProfile(env: IvoryDeploymentProfileInput, errors: string[]): void {
    const profileName = env.ivoryTowerEnv;
    if (!isIvoryDeploymentProfileName(profileName)) {
        return;
    }
    const profile = IVORY_DEPLOYMENT_PROFILES[profileName];
    if (!isAllowedStorage(profile.storage, env.storage.mode)) {
        errors.push(`The ${profileName} profile does not allow ${env.storage.mode} object storage.`);
        return;
    }
    if (profile.localSecretDefaultsAllowed) {
        return;
    }
    if (env.role !== 'api' && env.role !== 'worker') {
        return;
    }
    if (usesRejectedLocalSecretDefaults(env)) {
        errors.push(`Local development secret defaults are not allowed in the ${profileName} profile.`);
    }
}

function isIvoryDeploymentProfileName(value: string): value is IvoryDeploymentProfileName {
    return value === 'local' || value === 'staging' || value === 'production';
}

function isAllowedStorage(allowed: readonly string[], mode: string): boolean {
    return allowed.includes(mode);
}

function usesRejectedLocalSecretDefaults(env: IvoryDeploymentProfileInput): boolean {
    const accessKeyId = env.storage.accessKeyId;
    if (accessKeyId !== undefined && (REJECTED_LOCAL_SECRET_DEFAULTS.s3AccessKeyId as readonly string[]).includes(accessKeyId)) {
        return true;
    }
    const secretAccessKey = env.storage.secretAccessKey;
    if (
        secretAccessKey !== undefined &&
        (REJECTED_LOCAL_SECRET_DEFAULTS.s3SecretAccessKey as readonly string[]).includes(secretAccessKey)
    ) {
        return true;
    }
    const databaseUrl = env.databaseUrl;
    if (databaseUrl === undefined) {
        return false;
    }
    return REJECTED_LOCAL_SECRET_DEFAULTS.databaseUrlPrefixes.some(prefix => databaseUrl.startsWith(prefix));
}
