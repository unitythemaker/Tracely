-- name: GetMetric :one
SELECT * FROM metrics WHERE id = $1;

-- name: ListMetrics :many
SELECT * FROM metrics
ORDER BY recorded_at DESC
LIMIT $1 OFFSET $2;

-- name: ListMetricsByService :many
SELECT * FROM metrics
WHERE service_id = $1
ORDER BY recorded_at DESC
LIMIT $2 OFFSET $3;

-- name: ListMetricsByServiceAndType :many
SELECT * FROM metrics
WHERE service_id = $1 AND metric_type = $2
ORDER BY recorded_at DESC
LIMIT $3 OFFSET $4;

-- name: CreateMetric :one
INSERT INTO metrics (service_id, metric_type, value, recorded_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetLatestMetricByServiceAndType :one
SELECT * FROM metrics
WHERE service_id = $1 AND metric_type = $2
ORDER BY recorded_at DESC
LIMIT 1;
