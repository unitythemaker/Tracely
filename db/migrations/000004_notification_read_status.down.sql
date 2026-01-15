-- Remove trigger
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;

-- Remove columns
ALTER TABLE notifications DROP COLUMN IF EXISTS updated_at;
ALTER TABLE notifications DROP COLUMN IF EXISTS is_read;

-- Remove index (will be automatically dropped with column)
