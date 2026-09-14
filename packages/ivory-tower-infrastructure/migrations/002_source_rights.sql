ALTER TABLE ivory_sources
    ADD COLUMN IF NOT EXISTS content_class TEXT NOT NULL DEFAULT 'unknownProvenance',
    ADD COLUMN IF NOT EXISTS rights_basis_kind TEXT NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS acquisition_route TEXT NOT NULL DEFAULT 'upload',
    ADD COLUMN IF NOT EXISTS deployment_topology TEXT NOT NULL DEFAULT 'vendorHosted',
    ADD COLUMN IF NOT EXISTS ingest_permitted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS transfer_permitted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ingest_reason TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS transfer_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE ivory_sources ALTER COLUMN content_class DROP DEFAULT;
ALTER TABLE ivory_sources ALTER COLUMN rights_basis_kind DROP DEFAULT;
ALTER TABLE ivory_sources ALTER COLUMN acquisition_route DROP DEFAULT;
ALTER TABLE ivory_sources ALTER COLUMN deployment_topology DROP DEFAULT;
ALTER TABLE ivory_sources ALTER COLUMN ingest_permitted DROP DEFAULT;
ALTER TABLE ivory_sources ALTER COLUMN transfer_permitted DROP DEFAULT;
ALTER TABLE ivory_sources ALTER COLUMN ingest_reason DROP DEFAULT;
ALTER TABLE ivory_sources ALTER COLUMN transfer_reason DROP DEFAULT;
