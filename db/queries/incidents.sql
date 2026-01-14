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

-- name: CreateIncident :one
INSERT INTO incidents (id, service_id, rule_id, metric_id, severity, status, message, opened_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdateIncidentStatus :one
UPDATE incidents
SET status = $2
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
