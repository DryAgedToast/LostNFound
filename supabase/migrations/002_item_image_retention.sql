-- Add retention metadata for item photos.
ALTER TABLE items
ADD COLUMN image_expires_at TIMESTAMPTZ
GENERATED ALWAYS AS (
  CASE
    WHEN image_url IS NULL THEN NULL
    ELSE created_at + INTERVAL '30 days'
  END
) STORED,
ADD COLUMN image_purge_status purge_status NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS items_image_retention_idx
ON items (image_expires_at)
WHERE image_url IS NOT NULL AND image_purge_status = 'active';
