// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { Pool } from 'pg';
import { ExecutionHandlerRegistry, ExecutionProcessor } from './execution-processor';
import {
    DoclingHttpConversionAdapter,
    FilesystemObjectStore,
    PostgresExecutionStore,
    S3CompatibleObjectStore,
    assertIvoryRuntimeReady,
    flushIvorySentry,
    initIvorySentry,
    logIvoryError,
    readIvoryTowerEnvironment,
    readSentryConfigFromEnvironment,
    startGraphileWorker,
    validateIvoryTowerEnvironment,
} from '@ivory-tower/infrastructure';
import { createRuntimeExecutionHandlers } from './runtime-handlers';

export async function startWorker(handlers: ExecutionHandlerRegistry = new Map()): Promise<void> {
    const environment = readIvoryTowerEnvironment('worker');
    validateIvoryTowerEnvironment(environment);
    initIvorySentry(readSentryConfigFromEnvironment('ivory-worker'));
    const connectionString = environment.databaseUrl;
    if (connectionString === undefined || connectionString.length === 0) {
        throw new Error('DATABASE_URL is required for ivory-worker.');
    }
    const pool = new Pool({ connectionString });
    await assertIvoryRuntimeReady(pool);
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
    const runtimeHandlers = createRuntimeExecutionHandlers(
        objectStore,
        new DoclingHttpConversionAdapter({ endpoint: environment.docling.endpoint }),
    );
    const configuredHandlers = new Map([...runtimeHandlers, ...handlers]);
    const runner = await startGraphileWorker(connectionString, new ExecutionProcessor(store, configuredHandlers));
    const shutdown = async () => {
        await runner.stop();
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
    startWorker().catch(error => {
        logIvoryError(error);
        process.exitCode = 1;
    });
}
