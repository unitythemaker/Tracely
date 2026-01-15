DROP TRIGGER IF EXISTS update_incident_comments_updated_at ON incident_comments;
DROP TABLE IF EXISTS incident_comments;
DROP TABLE IF EXISTS incident_events;
DROP TYPE IF EXISTS incident_event_type;
ALTER TABLE incidents DROP COLUMN IF EXISTS in_progress_at;
