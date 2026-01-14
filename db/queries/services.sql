-- name: GetService :one
SELECT * FROM services WHERE id = $1;

-- name: ListServices :many
SELECT * FROM services ORDER BY name;

-- name: CreateService :one
INSERT INTO services (id, name)
VALUES ($1, $2)
RETURNING *;

-- name: DeleteService :exec
DELETE FROM services WHERE id = $1;
