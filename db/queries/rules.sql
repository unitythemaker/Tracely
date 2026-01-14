-- name: GetRule :one
SELECT * FROM quality_rules WHERE id = $1;

-- name: ListRules :many
SELECT * FROM quality_rules ORDER BY priority, id;

-- name: ListActiveRules :many
SELECT * FROM quality_rules
WHERE is_active = TRUE
ORDER BY priority, id;

-- name: ListActiveRulesByMetricType :many
SELECT * FROM quality_rules
WHERE is_active = TRUE AND metric_type = $1
ORDER BY priority, id;

-- name: CreateRule :one
INSERT INTO quality_rules (id, metric_type, threshold, operator, action, priority, severity, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdateRule :one
UPDATE quality_rules
SET metric_type = $2, threshold = $3, operator = $4, action = $5, priority = $6, severity = $7, is_active = $8
WHERE id = $1
RETURNING *;

-- name: DeleteRule :exec
DELETE FROM quality_rules WHERE id = $1;

-- name: SetRuleActive :one
UPDATE quality_rules
SET is_active = $2
WHERE id = $1
RETURNING *;
