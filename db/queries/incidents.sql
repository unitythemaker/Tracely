-- name: GetIncident :one
SELECT * FROM incidents WHERE id = $1;

-- name: ListIncidents :many
SELECT * FROM incidents
ORDER BY opened_at DESC
LIMIT $1 OFFSET $2;

-- name: ListIncidentsByStatus :many
SELECT * FROM incidents
WHERE status = $1
ORDER BY opened_at DESC
LIMIT $2 OFFSET $3;

-- name: ListIncidentsByService :many
SELECT * FROM incidents
WHERE service_id = $1
ORDER BY opened_at DESC
LIMIT $2 OFFSET $3;

-- name: ListOpenIncidents :many
SELECT * FROM incidents
WHERE status != 'CLOSED'
ORDER BY severity, opened_at DESC
LIMIT $1 OFFSET $2;

-- name: ListIncidentsFiltered :many
SELECT * FROM incidents
WHERE
  (sqlc.narg(filter_status)::incident_status IS NULL OR status = sqlc.narg(filter_status))
  AND (sqlc.narg(filter_severity)::incident_severity IS NULL OR severity = sqlc.narg(filter_severity))
  AND (sqlc.narg(filter_service_id)::text IS NULL OR service_id = ANY(string_to_array(sqlc.narg(filter_service_id), ',')))
  AND (sqlc.narg(filter_search)::text IS NULL OR (
    id ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR COALESCE(message, '') ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR service_id ILIKE '%' || sqlc.narg(filter_search) || '%'
  ))
ORDER BY
  CASE WHEN @sort_by::text = 'id' AND @sort_dir::text = 'asc' THEN id END ASC,
  CASE WHEN @sort_by::text = 'id' AND @sort_dir::text = 'desc' THEN id END DESC,
  CASE WHEN @sort_by::text = 'status' AND @sort_dir::text = 'asc' THEN status END ASC,
  CASE WHEN @sort_by::text = 'status' AND @sort_dir::text = 'desc' THEN status END DESC,
  CASE WHEN @sort_by::text = 'severity' AND @sort_dir::text = 'asc' THEN severity END ASC,
  CASE WHEN @sort_by::text = 'severity' AND @sort_dir::text = 'desc' THEN severity END DESC,
  CASE WHEN @sort_by::text = 'service_id' AND @sort_dir::text = 'asc' THEN service_id END ASC,
  CASE WHEN @sort_by::text = 'service_id' AND @sort_dir::text = 'desc' THEN service_id END DESC,
  CASE WHEN @sort_by::text = 'opened_at' AND @sort_dir::text = 'asc' THEN opened_at END ASC,
  CASE WHEN @sort_by::text = 'opened_at' AND @sort_dir::text = 'desc' THEN opened_at END DESC,
  opened_at DESC
LIMIT @limit_val OFFSET @offset_val;

-- name: CountIncidentsFiltered :one
SELECT COUNT(*)::int FROM incidents
WHERE
  (sqlc.narg(filter_status)::incident_status IS NULL OR status = sqlc.narg(filter_status))
  AND (sqlc.narg(filter_severity)::incident_severity IS NULL OR severity = sqlc.narg(filter_severity))
  AND (sqlc.narg(filter_service_id)::text IS NULL OR service_id = ANY(string_to_array(sqlc.narg(filter_service_id), ',')))
  AND (sqlc.narg(filter_search)::text IS NULL OR (
    id ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR COALESCE(message, '') ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR service_id ILIKE '%' || sqlc.narg(filter_search) || '%'
  ));

-- name: CreateIncident :one
INSERT INTO incidents (id, service_id, rule_id, metric_id, severity, status, message, opened_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdateIncidentStatus :one
UPDATE incidents
SET status = $2
WHERE id = $1
RETURNING *;

-- name: SetIncidentInProgress :one
UPDATE incidents
SET status = 'IN_PROGRESS', in_progress_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CloseIncident :one
UPDATE incidents
SET status = 'CLOSED', closed_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CountOpenIncidents :one
SELECT COUNT(*) FROM incidents WHERE status != 'CLOSED';

-- name: CountOpenIncidentsByService :one
SELECT COUNT(*) FROM incidents
WHERE service_id = $1 AND status != 'CLOSED';

-- name: NextIncidentID :one
SELECT CAST('INC-' || nextval('incident_id_seq')::TEXT AS VARCHAR) AS id;
