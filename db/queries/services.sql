-- name: GetService :one
SELECT * FROM services WHERE id = $1;

-- name: ListServices :many
SELECT * FROM services ORDER BY name;

-- name: ListServicesFiltered :many
SELECT * FROM services
WHERE
  ($1::text IS NULL OR (
    id ILIKE '%' || $1 || '%'
    OR name ILIKE '%' || $1 || '%'
  ))
ORDER BY
  CASE WHEN $2 = 'id' AND $3 = 'asc' THEN id END ASC,
  CASE WHEN $2 = 'id' AND $3 = 'desc' THEN id END DESC,
  CASE WHEN $2 = 'name' AND $3 = 'asc' THEN name END ASC,
  CASE WHEN $2 = 'name' AND $3 = 'desc' THEN name END DESC,
  CASE WHEN $2 = 'created_at' AND $3 = 'asc' THEN created_at END ASC,
  CASE WHEN $2 = 'created_at' AND $3 = 'desc' THEN created_at END DESC,
  name ASC
LIMIT $4 OFFSET $5;

-- name: CountServicesFiltered :one
SELECT COUNT(*)::int FROM services
WHERE
  ($1::text IS NULL OR (
    id ILIKE '%' || $1 || '%'
    OR name ILIKE '%' || $1 || '%'
  ));

-- name: CreateService :one
INSERT INTO services (id, name)
VALUES ($1, $2)
RETURNING *;

-- name: DeleteService :exec
DELETE FROM services WHERE id = $1;
