import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile, cp, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { CasBlobAdmission } from './blob-admission.mjs';
import { DiskFullError, HeadConflictError } from './errors.mjs';
import { enospcWhere, maybeFault } from './fault.mjs';
import { acquireWriterLock } from './lock.mjs';
import { runMigrations } from './migrate.mjs';
import { projectLayout } from './paths.mjs';

const SPIKE_ROOT = join(fileURLToPath(new URL('..', import.meta.url)));
const MIGRATIONS = join(SPIKE_ROOT, 'sql');

export class DurableStore {
    constructor() {
        this.projectRoot = undefined;
        this.layout = undefined;
        this.pg = undefined;
        this.blobs = undefined;
        this.lock = undefined;
        this.pgTrgm = false;
    }

    async open(projectRoot) {
        this.projectRoot = projectRoot;
        this.layout = projectLayout(projectRoot);
        await mkdir(this.layout.local, { recursive: true });
        await mkdir(this.layout.staging, { recursive: true });
        await mkdir(this.layout.objects, { recursive: true });
        await mkdir(this.layout.published, { recursive: true });
        this.lock = await acquireWriterLock(this.layout.lock);
        try {
            this.pg = await openPglite(this.layout.store);
            await this.pg.waitReady;
            await runMigrations(this.pg, MIGRATIONS);
            this.pgTrgm = await detectPgTrgm(this.pg);
            this.blobs = new CasBlobAdmission(this.layout.objects, this.layout.staging);
        } catch (error) {
            this.lock.release();
            this.lock = undefined;
            throw error;
        }
    }

    async close() {
        if (this.pg !== undefined) {
            await this.pg.close();
            this.pg = undefined;
        }
        if (this.lock !== undefined) {
            this.lock.release();
            this.lock = undefined;
        }
    }

    async commit(command) {
        const existing = await this.pg.query('SELECT * FROM receipts WHERE idempotency_key = $1', [command.idempotencyKey]);
        if (existing.rows.length > 0) {
            return receiptFromRow(existing.rows[0]);
        }

        const admitted = [];
        for (const blob of command.blobs ?? []) {
            const result = blob.bytes !== undefined
                ? await this.blobs.admitBytes(blob.bytes, blob.digest)
                : await this.blobs.admitFile(blob.stagingPath, blob.digest);
            admitted.push(result);
        }

        await maybeFault('beforeDbCommit');
        if (enospcWhere() === 'db') {
            throw new DiskFullError('db');
        }

        const activityId = command.activity?.activityId ?? randomUUID();
        const receiptId = randomUUID();
        const created = [];

        await this.pg.transaction(async tx => {
            for (const expected of command.expectedHeads ?? []) {
                const head = await tx.query('SELECT revision_id FROM heads WHERE object_id = $1', [expected.objectId]);
                const actual = head.rows[0]?.revision_id;
                if ((expected.headRevisionId ?? undefined) !== actual) {
                    throw new HeadConflictError(expected.objectId, expected.headRevisionId, actual);
                }
            }

            await tx.query('INSERT INTO activities (activity_id, operation, actor) VALUES ($1, $2, $3)', [
                activityId,
                command.activity?.operation ?? 'commit',
                command.activity?.actor ?? 'researcher',
            ]);

            for (const blob of admitted) {
                await tx.query(
                    'INSERT INTO blob_refs (digest, byte_size) VALUES ($1, $2) ON CONFLICT (digest) DO NOTHING',
                    [blob.digest, blob.byteSize],
                );
            }

            for (const revision of command.revisions ?? []) {
                const revisionId = revision.revisionId ?? randomUUID();
                const objectId = revision.objectId;
                const payload = revision.payload ?? {};
                const contentDigest = sha256Json(payload);
                await tx.query(
                    'INSERT INTO objects (object_id, object_type) VALUES ($1, $2) ON CONFLICT (object_id) DO NOTHING',
                    [objectId, revision.objectType ?? 'document'],
                );
                await tx.query(
                    `INSERT INTO revisions (
                        revision_id, object_id, predecessor_id, schema_version, payload, content_digest, blob_digest, activity_id
                    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
                    [
                        revisionId,
                        objectId,
                        revision.predecessorId ?? null,
                        revision.schemaVersion ?? 1,
                        JSON.stringify(payload),
                        contentDigest,
                        revision.blobDigest ?? admitted[0]?.digest ?? null,
                        activityId,
                    ],
                );
                await tx.query(
                    `INSERT INTO heads (object_id, revision_id) VALUES ($1, $2)
                     ON CONFLICT (object_id) DO UPDATE SET revision_id = EXCLUDED.revision_id`,
                    [objectId, revisionId],
                );
                await tx.query(
                    'INSERT INTO edges (edge_id, activity_id, role, to_revision_id) VALUES ($1, $2, $3, $4)',
                    [randomUUID(), activityId, 'generated', revisionId],
                );
                created.push({ objectId, revisionId, contentDigest });
            }

            const seqRow = await tx.query(
                'UPDATE project_state SET project_seq = project_seq + 1 WHERE singleton = TRUE RETURNING project_seq',
            );
            const projectSeq = seqRow.rows[0].project_seq;
            await tx.query(
                'INSERT INTO receipts (receipt_id, idempotency_key, activity_id, project_seq) VALUES ($1, $2, $3, $4)',
                [receiptId, command.idempotencyKey, activityId, projectSeq],
            );
            await tx.query('INSERT INTO outbox (seq, payload, delivered) VALUES ($1, $2::jsonb, FALSE)', [
                projectSeq,
                JSON.stringify({ receiptId, activityId, revisions: created }),
            ]);
            command._projectSeq = projectSeq;
        });

        try {
            await this.pg.exec('CHECKPOINT');
        } catch {
            /* PGlite may no-op CHECKPOINT; kill tests are the durability proof */
        }
        await maybeFault('afterDbCommit');

        const projectSeq = command._projectSeq;
        await maybeFault('beforeOutboxDelivery');
        await this.pg.query('UPDATE outbox SET delivered = TRUE WHERE seq = $1', [projectSeq]);
        await maybeFault('afterOutboxDelivery');

        await maybeFault('beforeOutputPublish');
        await writeFile(
            join(this.layout.published, `${projectSeq}.json`),
            JSON.stringify({ projectSeq, receiptId, activityId }, null, 2),
            'utf8',
        );
        await maybeFault('afterOutputPublish');

        return {
            receiptId,
            activityId,
            projectSeq,
            idempotencyKey: command.idempotencyKey,
            revisions: created,
        };
    }

    async getVisible(objectId) {
        const result = await this.pg.query(
            `SELECT r.*
             FROM heads h
             JOIN revisions r ON r.revision_id = h.revision_id
             WHERE h.object_id = $1`,
            [objectId],
        );
        const row = result.rows[0];
        if (row === undefined) {
            return undefined;
        }
        if (row.blob_digest) {
            const ref = await this.pg.query('SELECT digest FROM blob_refs WHERE digest = $1', [row.blob_digest]);
            if (ref.rows.length === 0) {
                throw new Error(`Visible revision ${row.revision_id} references uninstalled blob ${row.blob_digest}.`);
            }
            await this.blobs.verifyInstalled(row.blob_digest);
        }
        return mapRevision(row);
    }

    async searchSources(query) {
        const result = await this.pg.query(
            `SELECT r.object_id, r.revision_id, payload->>'title' AS title, payload->>'text' AS text
             FROM heads h
             JOIN revisions r ON r.revision_id = h.revision_id
             JOIN objects o ON o.object_id = r.object_id
             WHERE o.object_type = 'document'
               AND (
                    lower(coalesce(payload->>'title', '')) LIKE lower($1)
                    OR lower(coalesce(payload->>'text', '')) LIKE lower($1)
               )
             LIMIT 50`,
            [`%${query}%`],
        );
        return result.rows;
    }

    async freezeUnchanged(atSeq) {
        const seq = atSeq ?? (await this.pg.query('SELECT project_seq FROM project_state')).rows[0].project_seq;
        const members = await this.pg.query(
            `SELECT r.revision_id, r.content_digest
             FROM heads h
             JOIN revisions r ON r.revision_id = h.revision_id
             ORDER BY h.object_id`,
        );
        const memberIds = members.rows.map(row => row.revision_id);
        const digest = sha256Json({ seq, memberIds, content: members.rows.map(row => row.content_digest) });
        const snapshotId = randomUUID();
        await this.pg.query(
            `INSERT INTO snapshots (snapshot_id, at_seq, member_revision_ids, member_revision_ids_text, digest)
             VALUES ($1, $2, '[]'::jsonb, $3, $4)`,
            [snapshotId, seq, JSON.stringify(memberIds), digest],
        );
        return { snapshotId, atSeq: seq, memberCount: memberIds.length, digest };
    }

    async exportSemantic(destDir) {
        const exportDir = destDir ?? this.layout.exportDir;
        await mkdir(join(exportDir, 'records'), { recursive: true });
        await mkdir(join(exportDir, 'provenance'), { recursive: true });
        await mkdir(join(exportDir, 'blobs'), { recursive: true });
        const seq = (await this.pg.query('SELECT project_seq FROM project_state')).rows[0].project_seq;
        const tables = ['objects', 'revisions', 'heads', 'activities', 'receipts', 'edges', 'blob_refs', 'snapshots'];
        const dump = {};
        for (const table of tables) {
            dump[table] = (await this.pg.query(`SELECT * FROM ${table}`)).rows
                .sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0);
        }
        await writeFile(join(exportDir, 'records', 'state.json'), JSON.stringify(dump, null, 2), 'utf8');
        const blobDigests = dump.blob_refs.map(row => row.digest);
        for (const digest of blobDigests) {
            const bytes = await this.blobs.get(join(digest.slice(0, 2), digest));
            await writeFile(join(exportDir, 'blobs', digest), bytes);
        }
        const manifest = {
            projectSeq: seq,
            blobs: blobDigests,
            hashes: Object.fromEntries(
                await Promise.all(blobDigests.map(async digest => [digest, createHash('sha256').update(await readFile(join(exportDir, 'blobs', digest))).digest('hex')])),
            ),
        };
        await writeFile(join(exportDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
        return { exportDir, projectSeq: seq, blobCount: blobDigests.length };
    }

    async importSemantic(exportDir, destRoot) {
        const dest = new DurableStore();
        await dest.open(destRoot);
        try {
            const dump = JSON.parse(await readFile(join(exportDir, 'records', 'state.json'), 'utf8'));
            const manifest = JSON.parse(await readFile(join(exportDir, 'manifest.json'), 'utf8'));
            for (const [digest, hash] of Object.entries(manifest.hashes)) {
                const bytes = await readFile(join(exportDir, 'blobs', digest));
                const actual = createHash('sha256').update(bytes).digest('hex');
                if (actual !== hash || actual !== digest) {
                    throw new Error(`Import hash mismatch for ${digest}`);
                }
                await dest.blobs.admitBytes(bytes, digest);
            }
            await dest.pg.transaction(async tx => {
                for (const row of dump.objects) {
                    await tx.query('INSERT INTO objects (object_id, object_type, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
                        row.object_id, row.object_type, row.created_at,
                    ]);
                }
                for (const row of dump.activities) {
                    await tx.query('INSERT INTO activities (activity_id, operation, actor, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [
                        row.activity_id, row.operation, row.actor, row.created_at,
                    ]);
                }
                for (const row of orderRevisions(dump.revisions)) {
                    await tx.query(
                        `INSERT INTO revisions (
                            revision_id, object_id, predecessor_id, schema_version, payload, content_digest, blob_digest, activity_id, created_at
                        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
                        [row.revision_id, row.object_id, row.predecessor_id, row.schema_version, JSON.stringify(row.payload), row.content_digest, row.blob_digest, row.activity_id, row.created_at],
                    );
                }
                for (const row of dump.heads) {
                    await tx.query('INSERT INTO heads (object_id, revision_id) VALUES ($1, $2) ON CONFLICT (object_id) DO UPDATE SET revision_id = EXCLUDED.revision_id', [
                        row.object_id, row.revision_id,
                    ]);
                }
                for (const row of dump.blob_refs) {
                    await tx.query('INSERT INTO blob_refs (digest, byte_size, installed_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
                        row.digest, row.byte_size, row.installed_at,
                    ]);
                }
                for (const row of dump.receipts) {
                    await tx.query(
                        'INSERT INTO receipts (receipt_id, idempotency_key, activity_id, project_seq, acknowledged_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
                        [row.receipt_id, row.idempotency_key, row.activity_id, row.project_seq, row.acknowledged_at],
                    );
                }
                for (const row of dump.edges ?? []) {
                    await tx.query(
                        'INSERT INTO edges (edge_id, activity_id, role, from_revision_id, to_revision_id) VALUES ($1, $2, $3, $4, $5)',
                        [row.edge_id, row.activity_id, row.role, row.from_revision_id, row.to_revision_id],
                    );
                }
                const maxSeq = dump.receipts.reduce((max, row) => Math.max(max, Number(row.project_seq)), 0);
                await tx.query('UPDATE project_state SET project_seq = $1 WHERE singleton = TRUE', [maxSeq]);
                for (const row of dump.snapshots ?? []) {
                    const memberIdsText = row.member_revision_ids_text ?? JSON.stringify(row.member_revision_ids ?? []);
                    await tx.query(
                        `INSERT INTO snapshots (
                            snapshot_id, at_seq, member_revision_ids, member_revision_ids_text, digest, created_at
                        ) VALUES ($1, $2, $3::jsonb, $4, $5, $6) ON CONFLICT DO NOTHING`,
                        [
                            row.snapshot_id,
                            row.at_seq,
                            JSON.stringify(row.member_revision_ids ?? []),
                            memberIdsText,
                            row.digest,
                            row.created_at,
                        ],
                    );
                }
            });
            await dest.close();
            return { destRoot, projectSeq: manifest.projectSeq, blobCount: manifest.blobs.length };
        } catch (error) {
            await dest.close();
            throw error;
        }
    }

    async backup(destDir) {
        await mkdir(destDir, { recursive: true });
        await this.pg.exec('CHECKPOINT');
        const dump = await this.pg.dumpDataDir();
        const bytes = dump instanceof Uint8Array
            ? dump
            : Buffer.from(await (dump.arrayBuffer?.() ?? Promise.resolve(dump)));
        await writeFile(join(destDir, 'pglite.tgz'), bytes);
        await cp(this.layout.objects, join(destDir, 'objects'), { recursive: true });
        const seq = (await this.pg.query('SELECT project_seq FROM project_state')).rows[0].project_seq;
        await writeFile(join(destDir, 'backup.json'), JSON.stringify({ projectSeq: seq }, null, 2), 'utf8');
        return { destDir, projectSeq: seq };
    }

    async restore(srcDir, destRoot) {
        await mkdir(destRoot, { recursive: true });
        const layout = projectLayout(destRoot);
        await mkdir(layout.store, { recursive: true });
        const tgz = await readFile(join(srcDir, 'pglite.tgz'));
        const pg = new PGlite(layout.store, { relaxedDurability: false, loadDataDir: new Blob([tgz]) });
        await pg.waitReady;
        await pg.close();
        await cp(join(srcDir, 'objects'), layout.objects, { recursive: true });
        const restored = new DurableStore();
        await restored.open(destRoot);
        const seq = (await restored.pg.query('SELECT project_seq FROM project_state')).rows[0].project_seq;
        await restored.close();
        return { destRoot, projectSeq: seq };
    }

    async invariantReport() {
        const dangling = await this.pg.query(
            `SELECT r.revision_id, r.blob_digest
             FROM revisions r
             LEFT JOIN blob_refs b ON b.digest = r.blob_digest
             WHERE r.blob_digest IS NOT NULL AND b.digest IS NULL`,
        );
        const receipts = (await this.pg.query('SELECT count(*)::int AS n FROM receipts')).rows[0].n;
        const blobs = (await this.pg.query('SELECT digest FROM blob_refs')).rows;
        for (const row of blobs) {
            await this.blobs.verifyInstalled(row.digest);
        }
        return {
            danglingVisibleBlobs: dangling.rows,
            receiptCount: receipts,
        };
    }
}

async function openPglite(dataDir) {
    await mkdir(dataDir, { recursive: true });
    try {
        return new PGlite(dataDir, { relaxedDurability: false });
    } catch (error) {
        if (String(error.message).includes('lock') || error.code === 'EEXIST') {
            await rm(join(dataDir, 'PGSQL.lock'), { force: true });
            await rm(join(dataDir, '.pglite.lock'), { force: true });
            return new PGlite(dataDir, { relaxedDurability: false });
        }
        throw error;
    }
}

async function detectPgTrgm(pg) {
    try {
        await pg.exec('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        return true;
    } catch {
        return false;
    }
}

function sha256Json(value) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

// Export order is canonical, not necessarily predecessor order.
function orderRevisions(rows) {
    const remaining = new Map(rows.map(row => [row.revision_id, row]));
    const ordered = [];
    const admitted = new Set();
    while (remaining.size) {
        const ready = [...remaining.values()].filter(row => !row.predecessor_id || admitted.has(row.predecessor_id));
        if (!ready.length) { throw new Error('Missing or cyclic revision predecessor'); }
        for (const row of ready) {
            ordered.push(row);
            admitted.add(row.revision_id);
            remaining.delete(row.revision_id);
        }
    }
    return ordered;
}

function receiptFromRow(row) {
    return {
        receiptId: row.receipt_id,
        activityId: row.activity_id,
        projectSeq: Number(row.project_seq),
        idempotencyKey: row.idempotency_key,
        replayed: true,
    };
}

function mapRevision(row) {
    return {
        revisionId: row.revision_id,
        objectId: row.object_id,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
        contentDigest: row.content_digest,
        blobDigest: row.blob_digest,
        activityId: row.activity_id,
    };
}

export { FAULT_POINTS } from './fault.mjs';
export { WriterContentionError, HeadConflictError, BlobIntegrityError, DiskFullError } from './errors.mjs';
