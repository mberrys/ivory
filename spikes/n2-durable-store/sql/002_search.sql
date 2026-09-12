CREATE INDEX IF NOT EXISTS revisions_payload_gin_idx ON revisions USING GIN (payload);
CREATE INDEX IF NOT EXISTS revisions_text_lower_idx ON revisions ((lower(payload->>'text')));
