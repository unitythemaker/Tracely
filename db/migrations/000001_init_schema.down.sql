-- Drop triggers
DROP TRIGGER IF EXISTS update_incidents_updated_at ON incidents;
DROP TRIGGER IF EXISTS update_quality_rules_updated_at ON quality_rules;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables
DROP TABLE IF EXISTS outbox_processing;
DROP TABLE IF EXISTS outbox;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS incidents;
DROP TABLE IF EXISTS metrics;
DROP TABLE IF EXISTS quality_rules;
DROP TABLE IF EXISTS services;

-- Drop enum types
DROP TYPE IF EXISTS event_type;
DROP TYPE IF EXISTS incident_status;
DROP TYPE IF EXISTS incident_severity;
DROP TYPE IF EXISTS rule_action;
DROP TYPE IF EXISTS rule_operator;
DROP TYPE IF EXISTS metric_type;

-- Drop extensions
DROP EXTENSION IF EXISTS "uuid-ossp";
