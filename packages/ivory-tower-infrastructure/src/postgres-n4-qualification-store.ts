// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { N4ProjectRecord, N4QualificationStore } from '@ivory-tower/adapters';
import { N4AnchorRecord, N4RepresentationRecord } from '@ivory-tower/contracts';
import { Pool } from 'pg';

interface RepresentationRow {
    id: string; source_version_id: string; artifact_id: string; content_hash: string; object_key: string;
    content_type: string; converter_ref: string; text: string; created_at: Date;
}
interface AnchorRow {
    id: string; project_id: string; representation_id: string; source_version_id: string; artifact_id: string;
    spans: N4AnchorRecord['spans']; quote: N4AnchorRecord['quote']; confidence: N4AnchorRecord['confidence']; created_at: Date;
}
const representation = (row: RepresentationRow): N4RepresentationRecord => ({
    id: row.id, sourceVersionId: row.source_version_id, artifactId: row.artifact_id, contentHash: row.content_hash,
    objectKey: row.object_key, contentType: row.content_type, converterRef: row.converter_ref, text: row.text, createdAt: row.created_at.toISOString(),
});
const anchor = (row: AnchorRow): N4AnchorRecord => ({
    id: row.id, projectId: row.project_id, representationId: row.representation_id, sourceVersionId: row.source_version_id,
    artifactId: row.artifact_id, spans: row.spans, quote: row.quote, confidence: row.confidence, createdAt: row.created_at.toISOString(),
});

/** PostgreSQL persistence for the reproducible N4 qualification run. */
export class PostgresN4QualificationStore implements N4QualificationStore {
    constructor(private readonly pool: Pool) {}
    async ensureProject(project: N4ProjectRecord): Promise<N4ProjectRecord> {
        const result = await this.pool.query<{ id: string; name: string; created_at: Date }>(
            `INSERT INTO ivory_n4_projects (id, name, created_at) VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET id = ivory_n4_projects.id RETURNING *`, [project.id, project.name, project.createdAt]);
        const row = result.rows[0]; if (!row) throw new Error(`N4 project was not persisted: ${project.id}`);
        return { id: row.id, name: row.name, createdAt: row.created_at.toISOString() };
    }
    async addSourceToProject(projectId: string, contentHash: string): Promise<void> {
        await this.pool.query(`INSERT INTO ivory_n4_project_sources (project_id, content_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [projectId, contentHash]);
    }
    async listProjectSourceHashes(projectId: string): Promise<readonly string[]> {
        const result = await this.pool.query<{ content_hash: string }>('SELECT content_hash FROM ivory_n4_project_sources WHERE project_id = $1 ORDER BY content_hash', [projectId]);
        return result.rows.map(row => row.content_hash);
    }
    async persistRepresentation(value: N4RepresentationRecord): Promise<N4RepresentationRecord> {
        const result = await this.pool.query<RepresentationRow>(
            `INSERT INTO ivory_n4_representations (id, source_version_id, artifact_id, content_hash, object_key, content_type, converter_ref, text, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET id = ivory_n4_representations.id RETURNING *`,
            [value.id, value.sourceVersionId, value.artifactId, value.contentHash, value.objectKey, value.contentType, value.converterRef, value.text, value.createdAt]);
        const row = result.rows[0]; if (!row) throw new Error(`N4 representation was not persisted: ${value.id}`); return representation(row);
    }
    async getRepresentation(id: string): Promise<N4RepresentationRecord | undefined> {
        const result = await this.pool.query<RepresentationRow>('SELECT * FROM ivory_n4_representations WHERE id = $1', [id]); return result.rows[0] ? representation(result.rows[0]) : undefined;
    }
    async saveAnchor(value: N4AnchorRecord): Promise<N4AnchorRecord> {
        const result = await this.pool.query<AnchorRow>(
            `INSERT INTO ivory_n4_anchors (id, project_id, representation_id, source_version_id, artifact_id, spans, quote, confidence, created_at)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9) ON CONFLICT (id) DO UPDATE SET id = ivory_n4_anchors.id RETURNING *`,
            [value.id, value.projectId, value.representationId, value.sourceVersionId, value.artifactId, JSON.stringify(value.spans), JSON.stringify(value.quote), value.confidence, value.createdAt]);
        const row = result.rows[0]; if (!row) throw new Error(`N4 anchor was not persisted: ${value.id}`); return anchor(row);
    }
    async listAnchors(projectId: string): Promise<readonly N4AnchorRecord[]> {
        const result = await this.pool.query<AnchorRow>('SELECT * FROM ivory_n4_anchors WHERE project_id = $1 ORDER BY id', [projectId]); return result.rows.map(anchor);
    }
    async recordTransfer(input: { sourceProjectId: string; targetProjectId: string; contentHash: string; allowed: boolean; reason: string; occurredAt: string }): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`INSERT INTO ivory_n4_transfer_audit (source_project_id, target_project_id, content_hash, allowed, reason, occurred_at) VALUES ($1,$2,$3,$4,$5,$6)`, [input.sourceProjectId, input.targetProjectId, input.contentHash, input.allowed, input.reason, input.occurredAt]);
            if (input.allowed) {
                const membership = await client.query('SELECT 1 FROM ivory_n4_project_sources WHERE project_id = $1 AND content_hash = $2', [input.sourceProjectId, input.contentHash]);
                if (membership.rowCount !== 1) throw new Error('N4 transfer source is not a project member.');
                await client.query(`INSERT INTO ivory_n4_project_sources (project_id, content_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [input.targetProjectId, input.contentHash]);
            }
            await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
}
