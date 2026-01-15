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

-- name: ListRulesFiltered :many
SELECT * FROM quality_rules
WHERE
  (sqlc.narg(filter_metric_type)::metric_type IS NULL OR metric_type = sqlc.narg(filter_metric_type))
  AND (sqlc.narg(filter_severity)::incident_severity IS NULL OR severity = sqlc.narg(filter_severity))
  AND (sqlc.narg(filter_is_active)::boolean IS NULL OR is_active = sqlc.narg(filter_is_active))
  AND (sqlc.narg(filter_search)::text IS NULL OR (
    id ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR CAST(threshold AS TEXT) ILIKE '%' || sqlc.narg(filter_search) || '%'
  ))
ORDER BY
  CASE WHEN @sort_by::text = 'id' AND @sort_dir::text = 'asc' THEN id END ASC,
  CASE WHEN @sort_by::text = 'id' AND @sort_dir::text = 'desc' THEN id END DESC,
  CASE WHEN @sort_by::text = 'metric_type' AND @sort_dir::text = 'asc' THEN metric_type END ASC,
  CASE WHEN @sort_by::text = 'metric_type' AND @sort_dir::text = 'desc' THEN metric_type END DESC,
  CASE WHEN @sort_by::text = 'threshold' AND @sort_dir::text = 'asc' THEN threshold END ASC,
  CASE WHEN @sort_by::text = 'threshold' AND @sort_dir::text = 'desc' THEN threshold END DESC,
  CASE WHEN @sort_by::text = 'severity' AND @sort_dir::text = 'asc' THEN severity END ASC,
  CASE WHEN @sort_by::text = 'severity' AND @sort_dir::text = 'desc' THEN severity END DESC,
  CASE WHEN @sort_by::text = 'priority' AND @sort_dir::text = 'asc' THEN priority END ASC,
  CASE WHEN @sort_by::text = 'priority' AND @sort_dir::text = 'desc' THEN priority END DESC,
  CASE WHEN @sort_by::text = 'is_active' AND @sort_dir::text = 'asc' THEN is_active END ASC,
  CASE WHEN @sort_by::text = 'is_active' AND @sort_dir::text = 'desc' THEN is_active END DESC,
  priority ASC, id ASC
LIMIT @limit_val OFFSET @offset_val;

-- name: CountRulesFiltered :one
SELECT COUNT(*)::int FROM quality_rules
WHERE
  (sqlc.narg(filter_metric_type)::metric_type IS NULL OR metric_type = sqlc.narg(filter_metric_type))
  AND (sqlc.narg(filter_severity)::incident_severity IS NULL OR severity = sqlc.narg(filter_severity))
  AND (sqlc.narg(filter_is_active)::boolean IS NULL OR is_active = sqlc.narg(filter_is_active))
  AND (sqlc.narg(filter_search)::text IS NULL OR (
    id ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR CAST(threshold AS TEXT) ILIKE '%' || sqlc.narg(filter_search) || '%'
  ));

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
