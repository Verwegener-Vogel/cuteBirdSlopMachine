-- Add R2 storage and Google URL fields to videos table
ALTER TABLE videos ADD COLUMN google_url TEXT;
ALTER TABLE videos ADD COLUMN r2_key TEXT;
ALTER TABLE videos ADD COLUMN downloaded_at INTEGER;

-- Update status check constraint to include 'downloaded' status
-- Note: SQLite doesn't support modifying constraints directly,
-- so this would need to be handled during table recreation in production