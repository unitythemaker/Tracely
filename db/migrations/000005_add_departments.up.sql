-- Departments table
CREATE TABLE departments (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departments_name ON departments(name);

-- Add department_id to quality_rules
ALTER TABLE quality_rules
ADD COLUMN department_id VARCHAR(50) REFERENCES departments(id);

CREATE INDEX idx_quality_rules_department_id ON quality_rules(department_id);

-- Add department_id to notifications
ALTER TABLE notifications
ADD COLUMN department_id VARCHAR(50) REFERENCES departments(id);

CREATE INDEX idx_notifications_department_id ON notifications(department_id);

-- Apply updated_at trigger to departments
CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some default departments
INSERT INTO departments (id, name, description) VALUES
    ('ops-team', 'OPS Team', 'Operations team responsible for monitoring and incident response'),
    ('network-team', 'Network Team', 'Network infrastructure team'),
    ('dev-team', 'Development Team', 'Software development team');
