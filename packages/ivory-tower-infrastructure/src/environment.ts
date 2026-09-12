// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { DeploymentTopology } from '@ivory-tower/contracts';
import { validateIvoryDeploymentProfile } from './deployment-profiles';

export type IvoryTowerRole = 'library' | 'api' | 'worker' | 'browser';
export type IvoryTowerStorageMode = 'filesystem' | 's3';
export type IvoryTowerProviderMode = 'disabled' | 'allowlisted';

export interface IvoryTowerEnvironment {
    readonly nodeEnv: 'development' | 'production' | 'test';
    readonly ivoryTowerEnv: 'local' | 'staging' | 'production';
    readonly role: IvoryTowerRole;
    readonly port: number;
    readonly databaseUrl?: string;
    readonly storage: {
        readonly mode: IvoryTowerStorageMode;
        readonly objectStoreDir: string;
        readonly bucket?: string;
        readonly endpoint?: string;
        readonly region: string;
        readonly accessKeyId?: string;
        readonly secretAccessKey?: string;
        readonly forcePathStyle: boolean;
    };
    readonly queue: {
        readonly provider: 'graphile-worker';
        readonly databaseUrl?: string;
    };
    readonly provider: {
        readonly mode: IvoryTowerProviderMode;
        readonly allowedHosts: readonly string[];
    };
    readonly deploymentTopology: DeploymentTopology;
    readonly docling: {
        readonly endpoint: string;
        readonly imageRef: string;
    };
    readonly browser: {
        readonly apiBaseUrl: string;
    };
}

export const DEFAULT_DOCLING_IMAGE =
    'quay.io/docling-project/docling-serve:v1.21.0@sha256:32b3de41f325f93c1dd35907cd9147fa35df9f7c5abc86eb2788b6bda7ce6d10';

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function text(source: EnvironmentSource, key: string, fallback?: string): string | undefined {
    const value = source[key]?.trim();
    return value === undefined || value.length === 0 ? fallback : value;
}

function numberValue(source: EnvironmentSource, key: string, fallback: number): number {
    const value = Number(text(source, key, String(fallback)));
    return Number.isInteger(value) && value > 0 ? value : Number.NaN;
}

function booleanValue(source: EnvironmentSource, key: string, fallback: boolean): boolean {
    const value = text(source, key, String(fallback));
    return value === 'true' || (value !== 'false' && fallback);
}

export function readIvoryTowerEnvironment(
    role: IvoryTowerRole = 'library',
    source: EnvironmentSource = process.env,
): IvoryTowerEnvironment {
    const storageBucket = text(source, 'IVORY_S3_BUCKET');
    const allowedHosts = (text(source, 'IVORY_EGRESS_ALLOWED_HOSTS', '') ?? '')
        .split(',')
        .map(host => host.trim())
        .filter(host => host.length > 0);
    const databaseUrl = text(source, 'DATABASE_URL');
    const deploymentTopology = (text(source, 'IVORY_DEPLOYMENT_TOPOLOGY', 'vendorHosted') ?? 'vendorHosted') as DeploymentTopology;
    return {
        nodeEnv: (text(source, 'NODE_ENV', 'development') ?? 'development') as IvoryTowerEnvironment['nodeEnv'],
        ivoryTowerEnv: (text(source, 'IVORY_TOWER_ENV', 'local') ?? 'local') as IvoryTowerEnvironment['ivoryTowerEnv'],
        role,
        port: numberValue(source, 'PORT', 4100),
        databaseUrl,
        storage: {
            mode: storageBucket === undefined ? 'filesystem' : 's3',
            objectStoreDir: text(source, 'IVORY_OBJECT_STORE_DIR', '.ivory-tower/objects') ?? '.ivory-tower/objects',
            bucket: storageBucket,
            endpoint: text(source, 'IVORY_S3_ENDPOINT'),
            region: text(source, 'IVORY_S3_REGION', 'us-east-1') ?? 'us-east-1',
            accessKeyId: text(source, 'IVORY_S3_ACCESS_KEY_ID'),
            secretAccessKey: text(source, 'IVORY_S3_SECRET_ACCESS_KEY'),
            forcePathStyle: booleanValue(source, 'IVORY_S3_FORCE_PATH_STYLE', true),
        },
        queue: {
            provider: 'graphile-worker',
            databaseUrl,
        },
        provider: {
            mode: allowedHosts.length === 0 ? 'disabled' : 'allowlisted',
            allowedHosts,
        },
        deploymentTopology,
        docling: {
            endpoint: text(source, 'DOCLING_ENDPOINT', 'http://localhost:5001') ?? 'http://localhost:5001',
            imageRef: text(source, 'DOCLING_IMAGE', DEFAULT_DOCLING_IMAGE) ?? DEFAULT_DOCLING_IMAGE,
        },
        browser: {
            apiBaseUrl: text(source, 'IVORY_API_BASE_URL', 'http://localhost:4100') ?? 'http://localhost:4100',
        },
    };
}

export function validateIvoryTowerEnvironment(env: IvoryTowerEnvironment): void {
    const errors: string[] = [];
    if (!['development', 'production', 'test'].includes(env.nodeEnv)) {
        errors.push(`Invalid NODE_ENV: ${env.nodeEnv}`);
    }
    if (!['local', 'staging', 'production'].includes(env.ivoryTowerEnv)) {
        errors.push(`Invalid IVORY_TOWER_ENV: ${env.ivoryTowerEnv}`);
    }
    if (!['library', 'api', 'worker', 'browser'].includes(env.role)) {
        errors.push(`Invalid Ivory Tower role: ${env.role}`);
    }
    if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
        errors.push(`Invalid PORT: ${env.port}`);
    }
    if (env.role === 'api' || env.role === 'worker') {
        if (env.databaseUrl === undefined) {
            errors.push(`DATABASE_URL is required for the ${env.role} role.`);
        }
        if (env.queue.databaseUrl === undefined) {
            errors.push('The Graphile Worker queue must use the validated DATABASE_URL.');
        }
    }
    if (env.storage.mode === 'filesystem' && env.ivoryTowerEnv !== 'local') {
        errors.push('Filesystem object storage is only allowed in the local profile.');
    }
    validateIvoryDeploymentProfile(env, errors);
    if (env.storage.mode === 's3') {
        if (env.storage.bucket === undefined || env.storage.endpoint === undefined) {
            errors.push('S3 storage requires IVORY_S3_BUCKET and IVORY_S3_ENDPOINT.');
        }
        if (env.storage.accessKeyId === undefined || env.storage.secretAccessKey === undefined) {
            errors.push('S3 storage requires both access-key and secret-access-key secrets.');
        }
    }
    if (env.provider.mode === 'allowlisted' && env.provider.allowedHosts.length === 0) {
        errors.push('Allowlisted provider mode requires at least one approved host.');
    }
    if (!['vendorHosted', 'selfHosted'].includes(env.deploymentTopology)) {
        errors.push(`Invalid IVORY_DEPLOYMENT_TOPOLOGY: ${env.deploymentTopology}`);
    }
    if (env.role === 'worker' && !/^https?:\/\//u.test(env.docling.endpoint)) {
        errors.push('DOCLING_ENDPOINT must be an http(s) URL for the worker role.');
    }
    if (!/@sha256:[a-f0-9]{64}$/u.test(env.docling.imageRef)) {
        errors.push('DOCLING_IMAGE must be pinned by an immutable sha256 digest.');
    }
    try {
        const apiUrl = new URL(env.browser.apiBaseUrl);
        if (apiUrl.protocol !== 'http:' && apiUrl.protocol !== 'https:') {
            errors.push('IVORY_API_BASE_URL must use http or https.');
        }
    } catch {
        errors.push('IVORY_API_BASE_URL must be an absolute URL.');
    }
    if (errors.length > 0) {
        throw new Error(`Invalid Ivory Tower environment:\n- ${errors.join('\n- ')}`);
    }
}
