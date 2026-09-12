CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ivory_executions (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'cancelling', 'succeeded', 'failed', 'cancelled')),
    contract_version INTEGER NOT NULL CHECK (contract_version > 0),
    idempotency_key TEXT NOT NULL UNIQUE,
    attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
    lease_token TEXT,
    lease_until TIMESTAMPTZ,
    progress DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
    next_event_sequence BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    result JSONB,
    failure JSONB
);

CREATE TABLE IF NOT EXISTS ivory_execution_events (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL REFERENCES ivory_executions(id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('status', 'progress', 'token', 'error', 'complete')),
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (execution_id, sequence)
);

CREATE TABLE IF NOT EXISTS ivory_sources (
    id TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL UNIQUE,
    object_key TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL,
    license TEXT NOT NULL,
    authorization_evidence TEXT NOT NULL,
    admission_policy_version TEXT NOT NULL,
    admitted_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ivory_execution_events_execution_sequence_idx
    ON ivory_execution_events (execution_id, sequence);
