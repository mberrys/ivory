CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS objects (
    object_id TEXT PRIMARY KEY,
    object_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revisions (
    revision_id TEXT PRIMARY KEY,
    object_id TEXT NOT NULL REFERENCES objects (object_id),
    predecessor_id TEXT REFERENCES revisions (revision_id),
    schema_version INTEGER NOT NULL,
    payload JSONB NOT NULL,
    content_digest TEXT NOT NULL,
    blob_digest TEXT,
    activity_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heads (
    object_id TEXT PRIMARY KEY REFERENCES objects (object_id),
    revision_id TEXT NOT NULL REFERENCES revisions (revision_id)
);

CREATE TABLE IF NOT EXISTS activities (
    activity_id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipts (
    receipt_id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    activity_id TEXT NOT NULL REFERENCES activities (activity_id),
    project_seq BIGINT NOT NULL,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edges (
    edge_id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activities (activity_id),
    role TEXT NOT NULL,
    from_revision_id TEXT,
    to_revision_id TEXT
);

CREATE TABLE IF NOT EXISTS blob_refs (
    digest TEXT PRIMARY KEY,
    byte_size BIGINT NOT NULL,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outbox (
    seq BIGINT PRIMARY KEY,
    payload JSONB NOT NULL,
    delivered BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS project_state (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    project_seq BIGINT NOT NULL DEFAULT 0
);

INSERT INTO project_state (singleton, project_seq)
VALUES (TRUE, 0)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS snapshots (
    snapshot_id TEXT PRIMARY KEY,
    at_seq BIGINT NOT NULL,
    member_revision_ids JSONB NOT NULL,
    member_revision_ids_text TEXT,
    digest TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS revisions_object_id_idx ON revisions (object_id);
CREATE INDEX IF NOT EXISTS revisions_blob_digest_idx ON revisions (blob_digest);
CREATE INDEX IF NOT EXISTS receipts_seq_idx ON receipts (project_seq);
