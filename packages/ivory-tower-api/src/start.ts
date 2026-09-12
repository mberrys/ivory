// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { Pool } from 'pg';
import { ExecutionService } from '@ivory-tower/application';
import {
    ContentAwareAllowlistedEgressPolicy,
    ContentRightsAdmissionPolicy,
    FailClosedEgressPolicy,
    FilesystemObjectStore,
    PostgresExecutionStore,
    S3CompatibleObjectStore,
    SystemClockAdapter,
    SystemExecutionIdAdapter,
    evaluateIvoryReadiness,
    flushIvorySentry,
    initIvorySentry,
    logIvoryError,
    readIvoryTowerEnvironment,
    readSentryConfigFromEnvironment,
    validateIvoryTowerEnvironment,
} from '@ivory-tower/infrastructure';
import { createApiServer } from './api-server';

export async function startApi(): Promise<void> {
    const environment = readIvoryTowerEnvironment('api');
    validateIvoryTowerEnvironment(environment);
    initIvorySentry(readSentryConfigFromEnvironment('ivory-api'));
    const connectionString = environment.databaseUrl;
    if (connectionString === undefined || connectionString.length === 0) {
        throw new Error('DATABASE_URL is required for ivory-api.');
    }
    const pool = new Pool({ connectionString });
    const clock = new SystemClockAdapter();
    const store = new PostgresExecutionStore(pool);
    const objectStore =
        environment.storage.mode === 'filesystem'
            ? new FilesystemObjectStore(environment.storage.objectStoreDir)
            : new S3CompatibleObjectStore(environment.storage.bucket!, {
                  endpoint: environment.storage.endpoint,
                  region: environment.storage.region,
                  accessKeyId: environment.storage.accessKeyId,
                  secretAccessKey: environment.storage.secretAccessKey,
                  forcePathStyle: environment.storage.forcePathStyle,
              });
    const allowedHosts = new Set(environment.provider.allowedHosts);
    const egress = allowedHosts.size > 0 ? new ContentAwareAllowlistedEgressPolicy(allowedHosts, store) : new FailClosedEgressPolicy();
    const server = createApiServer({
        executionService: new ExecutionService(store, store, new SystemExecutionIdAdapter(), clock),
        executionStore: store,
        sourceRecords: store,
        objectStore,
        admission: new ContentRightsAdmissionPolicy(environment.deploymentTopology),
        egress,
        ids: new SystemExecutionIdAdapter(),
        clock,
        readiness: async () =>
            evaluateIvoryReadiness({
                query: (sql, params) => pool.query(sql, params as unknown[] | undefined),
                probeObjectStore: () => objectStore.probe(),
                includeDocling: false,
            }),
    });
    const port = environment.port;
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '0.0.0.0', () => resolve());
    });
    const shutdown = async () => {
        await new Promise<void>(resolve => server.close(() => resolve()));
        await pool.end();
        await flushIvorySentry();
    };
    process.once('SIGTERM', () => {
        shutdown().catch(error => logIvoryError(error));
    });
    process.once('SIGINT', () => {
        shutdown().catch(error => logIvoryError(error));
    });
}

if (require.main === module) {
    startApi().catch(error => {
        logIvoryError(error);
        process.exitCode = 1;
    });
}
