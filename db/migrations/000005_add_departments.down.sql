-- Remove department_id from notifications
DROP INDEX IF EXISTS idx_notifications_department_id;
ALTER TABLE notifications DROP COLUMN IF EXISTS department_id;

-- Remove department_id from quality_rules
DROP INDEX IF EXISTS idx_quality_rules_department_id;
ALTER TABLE quality_rules DROP COLUMN IF EXISTS department_id;

-- Drop departments table
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
DROP INDEX IF EXISTS idx_departments_name;
DROP TABLE IF EXISTS departments;
