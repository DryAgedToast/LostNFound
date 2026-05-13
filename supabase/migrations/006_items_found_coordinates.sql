-- Optional GPS for where an item was found (map + "Open in Maps").
ALTER TABLE items ADD COLUMN IF NOT EXISTS found_latitude DOUBLE PRECISION;
ALTER TABLE items ADD COLUMN IF NOT EXISTS found_longitude DOUBLE PRECISION;

COMMENT ON COLUMN items.found_latitude IS 'Optional WGS84 latitude where the poster found the item';
COMMENT ON COLUMN items.found_longitude IS 'Optional WGS84 longitude where the poster found the item';
