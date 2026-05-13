-- Retention metadata for item photos.
-- GENERATED ... STORED with (created_at + interval) fails with SQLSTATE 42P17
-- ("generation expression is not immutable") in PostgreSQL. Use a trigger instead.

ALTER TABLE items ADD COLUMN IF NOT EXISTS image_expires_at TIMESTAMPTZ;
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_purge_status purge_status NOT NULL DEFAULT 'active';

CREATE OR REPLACE FUNCTION items_set_image_expires_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.image_url IS NULL OR trim(NEW.image_url) = '' THEN
    NEW.image_expires_at := NULL;
  ELSE
    NEW.image_expires_at := NEW.created_at + INTERVAL '30 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS items_image_expires_at_biu ON items;
CREATE TRIGGER items_image_expires_at_biu
BEFORE INSERT OR UPDATE OF image_url, created_at ON items
FOR EACH ROW
EXECUTE PROCEDURE items_set_image_expires_at();

UPDATE items
SET image_expires_at = CASE
  WHEN image_url IS NULL OR trim(image_url) = '' THEN NULL
  ELSE created_at + INTERVAL '30 days'
END
WHERE image_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS items_image_retention_idx
ON items (image_expires_at)
WHERE image_url IS NOT NULL AND image_purge_status = 'active';
