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

-- name: ListMetricsFiltered :many
SELECT * FROM metrics
WHERE
  (sqlc.narg(filter_service_id)::text IS NULL OR service_id = ANY(string_to_array(sqlc.narg(filter_service_id), ',')))
  AND (sqlc.narg(filter_metric_type)::metric_type IS NULL OR metric_type = sqlc.narg(filter_metric_type))
  AND (sqlc.narg(filter_search)::text IS NULL OR (
    service_id ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR CAST(value AS TEXT) ILIKE '%' || sqlc.narg(filter_search) || '%'
  ))
ORDER BY
  CASE WHEN @sort_by::text = 'service_id' AND @sort_dir::text = 'asc' THEN service_id END ASC,
  CASE WHEN @sort_by::text = 'service_id' AND @sort_dir::text = 'desc' THEN service_id END DESC,
  CASE WHEN @sort_by::text = 'metric_type' AND @sort_dir::text = 'asc' THEN metric_type END ASC,
  CASE WHEN @sort_by::text = 'metric_type' AND @sort_dir::text = 'desc' THEN metric_type END DESC,
  CASE WHEN @sort_by::text = 'value' AND @sort_dir::text = 'asc' THEN value END ASC,
  CASE WHEN @sort_by::text = 'value' AND @sort_dir::text = 'desc' THEN value END DESC,
  CASE WHEN @sort_by::text = 'recorded_at' AND @sort_dir::text = 'asc' THEN recorded_at END ASC,
  CASE WHEN @sort_by::text = 'recorded_at' AND @sort_dir::text = 'desc' THEN recorded_at END DESC,
  recorded_at DESC
LIMIT @limit_val OFFSET @offset_val;

-- name: CountMetricsFiltered :one
SELECT COUNT(*)::int FROM metrics
WHERE
  (sqlc.narg(filter_service_id)::text IS NULL OR service_id = ANY(string_to_array(sqlc.narg(filter_service_id), ',')))
  AND (sqlc.narg(filter_metric_type)::metric_type IS NULL OR metric_type = sqlc.narg(filter_metric_type))
  AND (sqlc.narg(filter_search)::text IS NULL OR (
    service_id ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR CAST(value AS TEXT) ILIKE '%' || sqlc.narg(filter_search) || '%'
  ));

-- name: CreateMetric :one
INSERT INTO metrics (service_id, metric_type, value, recorded_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetLatestMetricByServiceAndType :one
SELECT * FROM metrics
WHERE service_id = $1 AND metric_type = $2
ORDER BY recorded_at DESC
LIMIT 1;

-- name: ListMetricsInRange :many
SELECT * FROM metrics
WHERE
  (sqlc.narg(filter_service_id)::text IS NULL OR service_id = ANY(string_to_array(sqlc.narg(filter_service_id), ',')))
  AND (sqlc.narg(filter_metric_type)::metric_type IS NULL OR metric_type = sqlc.narg(filter_metric_type))
  AND recorded_at >= @from_time
  AND recorded_at <= @to_time
ORDER BY recorded_at ASC;

-- name: GetMetricsAggregated :many
-- Aggregates metrics into time buckets for chart display
-- Returns min, max, avg, p50, p95, p99 for each bucket
WITH time_buckets AS (
  SELECT
    date_trunc(@bucket_size::text, recorded_at)::timestamptz AS bucket_time,
    metric_type,
    service_id,
    value::numeric AS value
  FROM metrics
  WHERE
    (sqlc.narg(filter_service_id)::text IS NULL OR service_id = ANY(string_to_array(sqlc.narg(filter_service_id), ',')))
    AND (sqlc.narg(filter_metric_type)::metric_type IS NULL OR metric_type = sqlc.narg(filter_metric_type))
    AND recorded_at >= @from_time
    AND recorded_at <= @to_time
)
SELECT
  bucket_time::timestamptz AS bucket_time,
  metric_type::metric_type AS metric_type,
  COUNT(*)::int AS count,
  MIN(value)::numeric AS min_value,
  MAX(value)::numeric AS max_value,
  AVG(value)::float8 AS avg_value,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value)::float8 AS p50_value,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value)::float8 AS p95_value,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value)::float8 AS p99_value
FROM time_buckets
GROUP BY bucket_time, metric_type
ORDER BY bucket_time ASC, metric_type ASC;
