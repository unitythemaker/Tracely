-- name: GetIncidentEvent :one
SELECT * FROM incident_events WHERE id = $1;

-- name: ListIncidentEvents :many
SELECT * FROM incident_events
WHERE incident_id = $1
ORDER BY created_at ASC;

-- name: CreateIncidentEvent :one
INSERT INTO incident_events (incident_id, event_type, actor, old_value, new_value, metadata)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: CountIncidentEvents :one
SELECT COUNT(*)::int FROM incident_events WHERE incident_id = $1;
