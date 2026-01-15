-- Add is_read column to notifications table
ALTER TABLE notifications ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for filtering by read status
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Add updated_at column for tracking when notification was marked as read
ALTER TABLE notifications ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add trigger to update updated_at on changes
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
