-- Add in_progress_at field to incidents
ALTER TABLE incidents ADD COLUMN in_progress_at TIMESTAMPTZ;

-- Incident event types
CREATE TYPE incident_event_type AS ENUM (
    'CREATED',
    'STATUS_CHANGED',
    'COMMENT_ADDED',
    'ASSIGNED',
    'SEVERITY_CHANGED'
);

-- Incident Events (Timeline)
CREATE TABLE incident_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id VARCHAR(50) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    event_type incident_event_type NOT NULL,
    actor VARCHAR(100), -- who performed the action (can be 'system' or user identifier)
    old_value TEXT,
    new_value TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incident_events_incident_id ON incident_events(incident_id);
CREATE INDEX idx_incident_events_created_at ON incident_events(created_at);

-- Incident Comments (Discussion)
CREATE TABLE incident_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id VARCHAR(50) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    author VARCHAR(100) NOT NULL DEFAULT 'anonymous',
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incident_comments_incident_id ON incident_comments(incident_id);
CREATE INDEX idx_incident_comments_created_at ON incident_comments(created_at);

-- Trigger for comment updated_at
CREATE TRIGGER update_incident_comments_updated_at
    BEFORE UPDATE ON incident_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
