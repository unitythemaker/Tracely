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
SELECT
  r.*,
  COALESCE(tc.trigger_count, 0)::int AS trigger_count
FROM quality_rules r
LEFT JOIN (
  SELECT rule_id, COUNT(*)::int AS trigger_count
  FROM incidents
  GROUP BY rule_id
) tc ON r.id = tc.rule_id
WHERE
  (sqlc.narg(filter_metric_type)::metric_type IS NULL OR r.metric_type = sqlc.narg(filter_metric_type))
  AND (sqlc.narg(filter_severity)::incident_severity IS NULL OR r.severity = sqlc.narg(filter_severity))
  AND (sqlc.narg(filter_is_active)::boolean IS NULL OR r.is_active = sqlc.narg(filter_is_active))
  AND (sqlc.narg(filter_search)::text IS NULL OR (
    r.id ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR CAST(r.threshold AS TEXT) ILIKE '%' || sqlc.narg(filter_search) || '%'
  ))
ORDER BY
  CASE WHEN @sort_by::text = 'id' AND @sort_dir::text = 'asc' THEN r.id END ASC,
  CASE WHEN @sort_by::text = 'id' AND @sort_dir::text = 'desc' THEN r.id END DESC,
  CASE WHEN @sort_by::text = 'metric_type' AND @sort_dir::text = 'asc' THEN r.metric_type END ASC,
  CASE WHEN @sort_by::text = 'metric_type' AND @sort_dir::text = 'desc' THEN r.metric_type END DESC,
  CASE WHEN @sort_by::text = 'threshold' AND @sort_dir::text = 'asc' THEN r.threshold END ASC,
  CASE WHEN @sort_by::text = 'threshold' AND @sort_dir::text = 'desc' THEN r.threshold END DESC,
  CASE WHEN @sort_by::text = 'severity' AND @sort_dir::text = 'asc' THEN r.severity END ASC,
  CASE WHEN @sort_by::text = 'severity' AND @sort_dir::text = 'desc' THEN r.severity END DESC,
  CASE WHEN @sort_by::text = 'priority' AND @sort_dir::text = 'asc' THEN r.priority END ASC,
  CASE WHEN @sort_by::text = 'priority' AND @sort_dir::text = 'desc' THEN r.priority END DESC,
  CASE WHEN @sort_by::text = 'is_active' AND @sort_dir::text = 'asc' THEN r.is_active END ASC,
  CASE WHEN @sort_by::text = 'is_active' AND @sort_dir::text = 'desc' THEN r.is_active END DESC,
  CASE WHEN @sort_by::text = 'trigger_count' AND @sort_dir::text = 'asc' THEN COALESCE(tc.trigger_count, 0) END ASC,
  CASE WHEN @sort_by::text = 'trigger_count' AND @sort_dir::text = 'desc' THEN COALESCE(tc.trigger_count, 0) END DESC,
  r.priority ASC, r.id ASC
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
INSERT INTO quality_rules (id, metric_type, threshold, operator, action, priority, severity, is_active, department_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: UpdateRule :one
UPDATE quality_rules
SET metric_type = $2, threshold = $3, operator = $4, action = $5, priority = $6, severity = $7, is_active = $8, department_id = $9
WHERE id = $1
RETURNING *;

-- name: DeleteRule :exec
DELETE FROM quality_rules WHERE id = $1;

-- name: SetRuleActive :one
UPDATE quality_rules
SET is_active = $2
WHERE id = $1
RETURNING *;

-- name: GetTopTriggeredRules :many
SELECT
  r.id,
  r.metric_type,
  r.threshold,
  r.operator,
  r.action,
  r.priority,
  r.severity,
  r.is_active,
  r.department_id,
  r.created_at,
  r.updated_at,
  COUNT(i.id)::int AS trigger_count,
  MAX(i.opened_at) AS last_triggered_at
FROM quality_rules r
LEFT JOIN incidents i ON r.id = i.rule_id
GROUP BY r.id
ORDER BY COUNT(i.id) DESC, r.priority ASC
LIMIT $1;
