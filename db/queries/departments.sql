-- name: CreateDepartment :one
INSERT INTO departments (id, name, description)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetDepartment :one
SELECT * FROM departments
WHERE id = $1 LIMIT 1;

-- name: ListDepartments :many
SELECT * FROM departments
ORDER BY name ASC;

-- name: UpdateDepartment :one
UPDATE departments
SET name = $2, description = $3
WHERE id = $1
RETURNING *;

-- name: DeleteDepartment :exec
DELETE FROM departments
WHERE id = $1;
