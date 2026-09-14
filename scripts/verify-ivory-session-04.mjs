// @ts-check
'use strict';

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = path.join(root, 'infra', 'docker-compose.yml');
const compose = ['compose', '-f', composeFile];
const dockerCommand = process.platform === 'win32' ? 'docker.exe' : 'docker';
const keep = process.argv.includes('--keep');
const stateDirectory = path.join(root, '.ivory-tower');
const artifactDirectory = path.join(root, 'artifacts', 'session-04');
const primaryDatabase = 'ivory_tower';
const restoredDatabase = 'ivory_tower_session04_restore';
const backupPath = '/tmp/ivory-session-04-n-minus-one.dump';
let localRuntimePrepared = false;
const runtimeEnv = {
    ...process.env,
    IVORY_TOWER_ENV: 'local',
    IVORY_DEPLOYMENT_TOPOLOGY: 'vendorHosted',
    DATABASE_URL: `postgres://ivory:ivory@127.0.0.1:5432/${primaryDatabase}`,
    IVORY_S3_BUCKET: 'ivory-tower',
    IVORY_S3_ENDPOINT: 'http://127.0.0.1:9000',
    IVORY_S3_REGION: 'us-east-1',
    IVORY_S3_ACCESS_KEY_ID: 'ivory',
    IVORY_S3_SECRET_ACCESS_KEY: 'ivory-development-only',
    DOCLING_ENDPOINT: 'http://127.0.0.1:5001',
    DOCLING_IMAGE: 'quay.io/docling-project/docling-serve:v1.21.0@sha256:32b3de41f325f93c1dd35907cd9147fa35df9f7c5abc86eb2788b6bda7ce6d10',
    PORT: '4100',
};

function databaseUrl(database) {
    return `postgres://ivory:ivory@127.0.0.1:5432/${database}`;
}

function quoteCommandArgument(value) {
    return /[\s"]/u.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
}

function npmInvocation(args) {
    if (process.platform !== 'win32') {
        return { command: 'npm', args };
    }
    return {
        command: process.env.ComSpec ?? 'cmd.exe',
        args: ['/d', '/s', '/c', `npm.cmd ${args.map(quoteCommandArgument).join(' ')}`],
    };
}

function runDocker(args, options = {}) {
    return execFileSync(dockerCommand, args, { cwd: root, stdio: 'inherit', ...options });
}

function runNpm(args, env = runtimeEnv) {
    const invocation = npmInvocation(args);
    return execFileSync(invocation.command, invocation.args, { cwd: root, env, stdio: 'inherit' });
}

function queryDatabase(database, query) {
    return runDocker(
        [
            ...compose,
            'exec',
            '-T',
            'postgres',
            'psql',
            '-U',
            'ivory',
            '-d',
            database,
            '-v',
            'ON_ERROR_STOP=1',
            '-At',
            '-F',
            '|',
            '-c',
            query,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    ).trim();
}

async function waitFor(label, check, timeoutMs = 180_000) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        try {
            if (await check()) {
                return;
            }
        } catch (error) {
            lastError = error;
        }
        await new Promise(resolve => setTimeout(resolve, 1_000));
    }
    throw new Error(`${label} did not become ready.${lastError instanceof Error ? ` Last error: ${lastError.message}` : ''}`);
}

function createObjectClient() {
    return new S3Client({
        endpoint: runtimeEnv.IVORY_S3_ENDPOINT,
        region: runtimeEnv.IVORY_S3_REGION,
        forcePathStyle: true,
        credentials: {
            accessKeyId: runtimeEnv.IVORY_S3_ACCESS_KEY_ID,
            secretAccessKey: runtimeEnv.IVORY_S3_SECRET_ACCESS_KEY,
        },
    });
}

function assertSessionStateDirectory() {
    if (path.resolve(stateDirectory) !== path.resolve(root, '.ivory-tower')) {
        throw new Error(`Refusing to remove unexpected Session 04 state directory: ${stateDirectory}`);
    }
}

async function pinnedPostgresImage() {
    const composeText = await readFile(composeFile, 'utf8');
    const match = composeText.match(/^ {4}image: (pgvector\/pgvector:pg16@sha256:[a-f0-9]{64})$/m);
    if (match?.[1] === undefined) {
        throw new Error('Unable to read the digest-pinned Postgres image from infra/docker-compose.yml.');
    }
    return match[1];
}

async function directoryExists(directory) {
    try {
        return (await stat(directory)).isDirectory();
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

async function removeCheckoutLocalStateDirectory() {
    assertSessionStateDirectory();
    if (!(await directoryExists(stateDirectory))) {
        return;
    }
    // Postgres and MinIO write bind-mount files as root. Delete those children
    // through the already digest-pinned Postgres image so teardown never runs
    // host `rm` against another path and does not require sudo.
    runDocker([
        'run',
        '--rm',
        '--volume',
        `${stateDirectory}:/ivory-tower-state`,
        await pinnedPostgresImage(),
        'bash',
        '-lc',
        'find /ivory-tower-state -mindepth 1 -maxdepth 1 -exec rm -rf {} +',
    ]);
    await rm(stateDirectory, { recursive: true, force: true });
}

async function cleanLocalState() {
    assertSessionStateDirectory();
    runDocker([...compose, 'down', '--remove-orphans']);
    await removeCheckoutLocalStateDirectory();
}

async function writeEvidence(name, value) {
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(path.join(artifactDirectory, name), `${JSON.stringify(value, undefined, 2)}\n`);
}

async function collectDiagnostics() {
    try {
        const output = runDocker([...compose, 'logs', '--no-color'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        const sanitized = output
            .replaceAll(runtimeEnv.IVORY_S3_SECRET_ACCESS_KEY, '[REDACTED]')
            .replace(/postgres:\/\/[^:\s]+:[^@\s]+@/g, 'postgres://[REDACTED]@');
        await mkdir(artifactDirectory, { recursive: true });
        await writeFile(path.join(artifactDirectory, 'compose.log'), sanitized);
    } catch (error) {
        console.error(`Unable to collect sanitized Compose diagnostics: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function listMigrations() {
    const migrationsDirectory = path.join(root, 'packages', 'ivory-tower-infrastructure', 'migrations');
    return (await readdir(migrationsDirectory)).filter(file => file.endsWith('.sql')).sort();
}

function migrate(database, upperBoundary, compile) {
    const env = {
        ...runtimeEnv,
        DATABASE_URL: databaseUrl(database),
        ...(upperBoundary === undefined ? {} : { IVORY_MIGRATIONS_UP_TO: upperBoundary }),
    };
    if (compile) {
        runNpm(['run', 'migrate:ivory'], env);
    } else {
        runNpm(['--workspace', '@ivory-tower/infrastructure', 'run', 'migrate'], env);
    }
}

function seedNMinusOneSource(database, source) {
    const values = [
        source.id,
        source.contentHash,
        source.objectKey,
        'text/plain',
        'CC-BY-4.0',
        'session-04-fixture-public-reuse',
        'session-04',
        '2026-08-20T00:00:00Z',
    ].map(value => `'${value.replaceAll("'", "''")}'`);
    queryDatabase(
        database,
        `INSERT INTO ivory_sources (id, content_hash, object_key, content_type, license, authorization_evidence, admission_policy_version, admitted_at) VALUES (${values.join(', ')});`,
    );
}

async function seedAndVerifyObjectStore(source) {
    const client = createObjectClient();
    await waitFor('object-store bucket', async () => {
        await client.send(new HeadBucketCommand({ Bucket: runtimeEnv.IVORY_S3_BUCKET }));
        return true;
    });
    await client.send(
        new PutObjectCommand({
            Bucket: runtimeEnv.IVORY_S3_BUCKET,
            Key: source.objectKey,
            Body: source.content,
            ContentType: 'text/plain',
            Metadata: { 'content-sha256': source.contentHash },
        }),
    );
    const object = await client.send(new HeadObjectCommand({ Bucket: runtimeEnv.IVORY_S3_BUCKET, Key: source.objectKey }));
    if (object.Metadata?.['content-sha256'] !== source.contentHash) {
        throw new Error('Object-store reconciliation failed: seeded object hash metadata does not match the deterministic source.');
    }
}

async function assertSourceReconciles(database, source) {
    const value = queryDatabase(database, `SELECT content_hash, object_key FROM ivory_sources WHERE id = '${source.id}';`);
    if (value !== `${source.contentHash}|${source.objectKey}`) {
        throw new Error(`Database reconciliation failed for ${database}: expected the seeded source identity, received '${value}'.`);
    }
    const object = await createObjectClient().send(new HeadObjectCommand({ Bucket: runtimeEnv.IVORY_S3_BUCKET, Key: source.objectKey }));
    if (object.Metadata?.['content-sha256'] !== source.contentHash) {
        throw new Error(`Object-store reconciliation failed for ${database}: source object is missing or has changed.`);
    }
}

function assertLatestMigrations(database, migrations) {
    const applied = queryDatabase(database, 'SELECT version FROM ivory_schema_migrations ORDER BY version;').split(/\r?\n/).filter(Boolean);
    if (JSON.stringify(applied) !== JSON.stringify(migrations)) {
        throw new Error(`Migration ledger mismatch for ${database}: expected ${migrations.join(', ')}, received ${applied.join(', ')}.`);
    }
}

function assertRightsBackfill(database, targetMigration) {
    if (targetMigration !== '002_source_rights.sql') {
        return;
    }
    const values = queryDatabase(
        database,
        "SELECT content_class, rights_basis_kind, acquisition_route, deployment_topology, ingest_permitted, transfer_permitted, ingest_reason, transfer_reason FROM ivory_sources WHERE id = 'session-04-n-minus-one-source';",
    );
    const expected = 'unknownProvenance|none|upload|vendorHosted|f|f||';
    if (values !== expected) {
        throw new Error(`Source-rights backfill failed for ${database}: expected '${expected}', received '${values}'.`);
    }
}

function snapshotAndRestoreNMinusOne() {
    runDocker([...compose, 'exec', '-T', 'postgres', 'pg_dump', '-U', 'ivory', '-d', primaryDatabase, '-Fc', '-f', backupPath]);
    runDocker([...compose, 'exec', '-T', 'postgres', 'createdb', '-U', 'ivory', restoredDatabase]);
    runDocker([...compose, 'exec', '-T', 'postgres', 'pg_restore', '-U', 'ivory', '-d', restoredDatabase, backupPath]);
}

async function main() {
    runNpm(['run', '-s', 'check:ivory-install']);
    try {
        runDocker(['info'], { stdio: 'ignore' });
    } catch {
        throw new Error('Docker daemon is unavailable; Session 04 runtime and migration verification requires Docker Compose.');
    }

    const migrations = await listMigrations();
    if (migrations.length < 2) {
        throw new Error('Session 04 requires at least two Ivory migration files to prove an immediate N-1 upgrade.');
    }
    const nMinusOne = migrations.at(-2);
    const latest = migrations.at(-1);
    if (nMinusOne === undefined || latest === undefined) {
        throw new Error('Unable to determine the immediate N-1 migration boundary.');
    }
    const content = Buffer.from('Session 04 deterministic N-1 migration fixture.\n');
    const source = {
        id: 'session-04-n-minus-one-source',
        content: new Uint8Array(content),
        contentHash: createHash('sha256').update(content).digest('hex'),
        objectKey: 'session-04/n-minus-one-source.txt',
    };

    await rm(artifactDirectory, { recursive: true, force: true });
    await cleanLocalState();
    localRuntimePrepared = true;
    await mkdir(stateDirectory, { recursive: true });
    runDocker([...compose, 'up', '-d', '--wait', 'postgres', 'object-store', 'docling']);
    runDocker([...compose, 'up', '-d', 'object-store-init']);

    migrate(primaryDatabase, nMinusOne, true);
    seedNMinusOneSource(primaryDatabase, source);
    await seedAndVerifyObjectStore(source);
    await assertSourceReconciles(primaryDatabase, source);
    snapshotAndRestoreNMinusOne();

    migrate(primaryDatabase, undefined, false);
    migrate(restoredDatabase, undefined, false);
    assertLatestMigrations(primaryDatabase, migrations);
    assertLatestMigrations(restoredDatabase, migrations);
    await assertSourceReconciles(primaryDatabase, source);
    await assertSourceReconciles(restoredDatabase, source);
    assertRightsBackfill(primaryDatabase, latest);
    assertRightsBackfill(restoredDatabase, latest);

    runNpm(['run', 'verify:ivory-runtime', '--', '--keep']);
    await writeEvidence('result.json', {
        session: '04',
        status: 'passed',
        nMinusOne,
        latest,
        source: { id: source.id, contentHash: source.contentHash, objectKey: source.objectKey },
        databases: [primaryDatabase, restoredDatabase],
    });
    console.log(`Session 04 verification passed: ${nMinusOne} snapshot restored and migrated through ${latest}.`);
}

main()
    .catch(async error => {
        console.error(error);
        if (localRuntimePrepared) {
            await collectDiagnostics();
        }
        process.exitCode = 1;
    })
    .finally(async () => {
        if (localRuntimePrepared && !keep) {
            try {
                await cleanLocalState();
            } catch (error) {
                console.error(`Unable to remove Session 04 local state: ${error instanceof Error ? error.message : String(error)}`);
                process.exitCode = 1;
            }
        }
    });
