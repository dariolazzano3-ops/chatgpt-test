ALTER TABLE items ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
