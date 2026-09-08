CREATE TABLE IF NOT EXISTS ivory_n4_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ivory_n4_project_sources (
    project_id TEXT NOT NULL REFERENCES ivory_n4_projects(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL REFERENCES ivory_sources(content_hash),
    PRIMARY KEY (project_id, content_hash)
);

CREATE TABLE IF NOT EXISTS ivory_n4_representations (
    id TEXT PRIMARY KEY,
    source_version_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL UNIQUE,
    content_hash TEXT NOT NULL REFERENCES ivory_sources(content_hash),
    object_key TEXT NOT NULL,
    content_type TEXT NOT NULL,
    converter_ref TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ivory_n4_anchors (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES ivory_n4_projects(id) ON DELETE CASCADE,
    representation_id TEXT NOT NULL REFERENCES ivory_n4_representations(id),
    source_version_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    spans JSONB NOT NULL,
    quote JSONB NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('exact', 'approximate')),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ivory_n4_transfer_audit (
    id BIGSERIAL PRIMARY KEY,
    source_project_id TEXT NOT NULL REFERENCES ivory_n4_projects(id),
    target_project_id TEXT NOT NULL REFERENCES ivory_n4_projects(id),
    content_hash TEXT NOT NULL,
    allowed BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL
);
