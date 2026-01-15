-- name: GetIncidentComment :one
SELECT * FROM incident_comments WHERE id = $1;

-- name: ListIncidentComments :many
SELECT * FROM incident_comments
WHERE incident_id = $1
ORDER BY created_at ASC;

-- name: CreateIncidentComment :one
INSERT INTO incident_comments (incident_id, author, content)
VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdateIncidentComment :one
UPDATE incident_comments
SET content = $2
WHERE id = $1
RETURNING *;

-- name: DeleteIncidentComment :exec
DELETE FROM incident_comments WHERE id = $1;

-- name: CountIncidentComments :one
SELECT COUNT(*)::int FROM incident_comments WHERE incident_id = $1;
