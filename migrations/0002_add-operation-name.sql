-- Add operation_name column to videos table to track Google Veo operation status
-- Note: This migration might have already been partially applied
-- SQLite doesn't support IF NOT EXISTS for columns, so we handle this at the application level

-- Create index for faster lookups when checking operation status
CREATE INDEX IF NOT EXISTS idx_videos_operation ON videos(operation_name);