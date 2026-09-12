ALTER TABLE ivory_n4_anchors
    ADD COLUMN IF NOT EXISTS coordinates JSONB NOT NULL DEFAULT '[]'::jsonb;
