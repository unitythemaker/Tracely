# Database Mimarisi - PostgreSQL

## ER Diagram

```
┌──────────────────┐
│     services     │
├──────────────────┤
│ id (PK)          │
│ name             │
│ created_at       │
└────────┬─────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐      ┌──────────────────┐
│     metrics      │      │   quality_rules  │
├──────────────────┤      ├──────────────────┤
│ id (PK)          │      │ id (PK)          │
│ service_id (FK)  │      │ metric_type      │
│ metric_type      │      │ threshold        │
│ value            │      │ operator         │
│ recorded_at      │      │ action           │
│ created_at       │      │ priority         │
└────────┬─────────┘      │ severity         │
         │                │ is_active        │
         │                │ created_at       │
         │                │ updated_at       │
         │                └────────┬─────────┘
         │                         │
         │         ┌───────────────┘
         │         │
         ▼         ▼
┌──────────────────────────┐
│        incidents         │
├──────────────────────────┤
│ id (PK)                  │
│ service_id (FK)          │
│ rule_id (FK)             │
│ metric_id (FK)           │
│ severity                 │
│ status                   │
│ message                  │
│ opened_at                │
│ closed_at                │
│ created_at               │
│ updated_at               │
└────────┬─────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐
│  notifications   │
├──────────────────┤
│ id (PK)          │
│ incident_id (FK) │
│ target           │
│ message          │
│ sent_at          │
│ created_at       │
└──────────────────┘

┌──────────────────┐      ┌──────────────────────┐
│      outbox      │      │  outbox_processing   │
├──────────────────┤      ├──────────────────────┤
│ id (PK)          │◄────▶│ outbox_id (PK, FK)   │
│ event_type       │      │ processor (PK)       │
│ aggregate_type   │      │ processed_at         │
│ aggregate_id     │      └──────────────────────┘
│ payload          │
│ created_at       │
└──────────────────┘
```

## Schema Definition

```sql
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
```

## Outbox Query Patterns

### Unprocessed Events for Worker

```sql
-- RuleWorker: Get unprocessed METRIC_CREATED events
SELECT o.*
FROM outbox o
LEFT JOIN outbox_processing op ON o.id = op.outbox_id AND op.processor = 'rule_worker'
WHERE op.outbox_id IS NULL
  AND o.event_type = 'METRIC_CREATED'
ORDER BY o.created_at
LIMIT 100;

-- ESWorker: Get unprocessed METRIC_CREATED events
SELECT o.*
FROM outbox o
LEFT JOIN outbox_processing op ON o.id = op.outbox_id AND op.processor = 'es_worker'
WHERE op.outbox_id IS NULL
  AND o.event_type = 'METRIC_CREATED'
ORDER BY o.created_at
LIMIT 100;

-- NotificationWorker: Get unprocessed INCIDENT events
SELECT o.*
FROM outbox o
LEFT JOIN outbox_processing op ON o.id = op.outbox_id AND op.processor = 'notification_worker'
WHERE op.outbox_id IS NULL
  AND o.event_type IN ('INCIDENT_CREATED', 'INCIDENT_UPDATED')
ORDER BY o.created_at
LIMIT 100;
```

### Mark Event as Processed

```sql
INSERT INTO outbox_processing (outbox_id, processor, processed_at)
VALUES ($1, $2, NOW());
```

### Cleanup Old Events

```sql
-- Delete events older than 7 days that all workers have processed
DELETE FROM outbox
WHERE created_at < NOW() - INTERVAL '7 days'
  AND id IN (
    SELECT o.id FROM outbox o
    WHERE NOT EXISTS (
      SELECT 1 FROM outbox o2
      LEFT JOIN outbox_processing op ON o2.id = op.outbox_id
      WHERE o2.id = o.id
        AND op.outbox_id IS NULL
    )
  );
```

## Seed Data

```sql
-- Services
INSERT INTO services (id, name) VALUES
    ('S1', 'Superonline'),
    ('S2', 'TV+'),
    ('S3', 'Paycell');

-- Quality Rules (v1: sadece OPEN_INCIDENT aktif)
INSERT INTO quality_rules (id, metric_type, threshold, operator, action, priority, severity, is_active) VALUES
    ('QR-01', 'LATENCY_MS', 150.0, '>', 'OPEN_INCIDENT', 1, 'HIGH', TRUE),
    ('QR-02', 'PACKET_LOSS', 1.5, '>', 'OPEN_INCIDENT', 2, 'MEDIUM', TRUE),
    ('QR-03', 'BUFFER_RATIO', 6.0, '>', 'OPEN_INCIDENT', 2, 'MEDIUM', TRUE),
    ('QR-04', 'ERROR_RATE', 5.0, '>', 'OPEN_INCIDENT', 1, 'CRITICAL', TRUE);
```
