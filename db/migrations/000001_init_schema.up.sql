-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum Types
CREATE TYPE metric_type AS ENUM (
    'LATENCY_MS',
    'PACKET_LOSS',
    'ERROR_RATE',
    'BUFFER_RATIO'
);

CREATE TYPE rule_operator AS ENUM (
    '>',
    '>=',
    '<',
    '<=',
    '==',
    '!='
);

CREATE TYPE rule_action AS ENUM (
    'OPEN_INCIDENT',
    'THROTTLE',
    'WEBHOOK'
);

CREATE TYPE incident_severity AS ENUM (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW'
);

CREATE TYPE incident_status AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'CLOSED'
);

CREATE TYPE event_type AS ENUM (
    'METRIC_CREATED',
    'INCIDENT_CREATED',
    'INCIDENT_UPDATED'
);

-- Services
CREATE TABLE services (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_name ON services(name);

-- Quality Rules
CREATE TABLE quality_rules (
    id VARCHAR(50) PRIMARY KEY,
    metric_type metric_type NOT NULL,
    threshold DECIMAL(10, 2) NOT NULL,
    operator rule_operator NOT NULL,
    action rule_action NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    severity incident_severity NOT NULL DEFAULT 'MEDIUM',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quality_rules_metric_type ON quality_rules(metric_type);
CREATE INDEX idx_quality_rules_is_active ON quality_rules(is_active);

-- Metrics
CREATE TABLE metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id VARCHAR(50) NOT NULL REFERENCES services(id),
    metric_type metric_type NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metrics_service_id ON metrics(service_id);
CREATE INDEX idx_metrics_metric_type ON metrics(metric_type);
CREATE INDEX idx_metrics_recorded_at ON metrics(recorded_at DESC);
CREATE INDEX idx_metrics_service_type_recorded ON metrics(service_id, metric_type, recorded_at DESC);

-- Incidents
CREATE TABLE incidents (
    id VARCHAR(50) PRIMARY KEY,
    service_id VARCHAR(50) NOT NULL REFERENCES services(id),
    rule_id VARCHAR(50) NOT NULL REFERENCES quality_rules(id),
    metric_id UUID NOT NULL REFERENCES metrics(id),
    severity incident_severity NOT NULL,
    status incident_status NOT NULL DEFAULT 'OPEN',
    message TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_service_id ON incidents(service_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_opened_at ON incidents(opened_at DESC);
CREATE INDEX idx_incidents_service_status ON incidents(service_id, status);

-- Notifications
CREATE TABLE notifications (
    id VARCHAR(50) PRIMARY KEY,
    incident_id VARCHAR(50) NOT NULL REFERENCES incidents(id),
    target VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_incident_id ON notifications(incident_id);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at DESC);

-- Outbox
CREATE TABLE outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type event_type NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_created_at ON outbox(created_at);
CREATE INDEX idx_outbox_event_type ON outbox(event_type);

-- Outbox Processing
CREATE TABLE outbox_processing (
    outbox_id UUID NOT NULL REFERENCES outbox(id) ON DELETE CASCADE,
    processor VARCHAR(50) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (outbox_id, processor)
);

CREATE INDEX idx_outbox_processing_processor ON outbox_processing(processor);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_quality_rules_updated_at
    BEFORE UPDATE ON quality_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
