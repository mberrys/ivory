ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS member_revision_ids_text TEXT;

UPDATE snapshots
SET member_revision_ids_text = member_revision_ids::text
WHERE member_revision_ids_text IS NULL;
