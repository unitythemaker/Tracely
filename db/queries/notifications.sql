-- name: GetNotification :one
SELECT * FROM notifications WHERE id = $1;

-- name: ListNotifications :many
SELECT * FROM notifications
ORDER BY sent_at DESC
LIMIT $1 OFFSET $2;

-- name: ListNotificationsByIncident :many
SELECT * FROM notifications
WHERE incident_id = $1
ORDER BY sent_at DESC;

-- name: CreateNotification :one
INSERT INTO notifications (id, incident_id, target, message, department_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: NextNotificationID :one
SELECT CAST('N-' || nextval('notification_id_seq')::TEXT AS VARCHAR) AS id;

-- name: ListNotificationsFiltered :many
SELECT * FROM notifications
WHERE
  (sqlc.narg(filter_is_read)::boolean IS NULL OR is_read = sqlc.narg(filter_is_read))
  AND (sqlc.narg(filter_incident_id)::text IS NULL OR incident_id = sqlc.narg(filter_incident_id))
  AND (sqlc.narg(filter_search)::text IS NULL OR (
    id ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR message ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR target ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR incident_id ILIKE '%' || sqlc.narg(filter_search) || '%'
  ))
ORDER BY
  CASE WHEN @sort_by::text = 'id' AND @sort_dir::text = 'asc' THEN id END ASC,
  CASE WHEN @sort_by::text = 'id' AND @sort_dir::text = 'desc' THEN id END DESC,
  CASE WHEN @sort_by::text = 'sent_at' AND @sort_dir::text = 'asc' THEN sent_at END ASC,
  CASE WHEN @sort_by::text = 'sent_at' AND @sort_dir::text = 'desc' THEN sent_at END DESC,
  CASE WHEN @sort_by::text = 'target' AND @sort_dir::text = 'asc' THEN target END ASC,
  CASE WHEN @sort_by::text = 'target' AND @sort_dir::text = 'desc' THEN target END DESC,
  CASE WHEN @sort_by::text = 'is_read' AND @sort_dir::text = 'asc' THEN is_read END ASC,
  CASE WHEN @sort_by::text = 'is_read' AND @sort_dir::text = 'desc' THEN is_read END DESC,
  sent_at DESC, id ASC
LIMIT @limit_val OFFSET @offset_val;

-- name: CountNotificationsFiltered :one
SELECT COUNT(*) FROM notifications
WHERE
  (sqlc.narg(filter_is_read)::boolean IS NULL OR is_read = sqlc.narg(filter_is_read))
  AND (sqlc.narg(filter_incident_id)::text IS NULL OR incident_id = sqlc.narg(filter_incident_id))
  AND (sqlc.narg(filter_search)::text IS NULL OR (
    id ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR message ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR target ILIKE '%' || sqlc.narg(filter_search) || '%'
    OR incident_id ILIKE '%' || sqlc.narg(filter_search) || '%'
  ));

-- name: MarkNotificationAsRead :one
UPDATE notifications
SET is_read = TRUE
WHERE id = $1
RETURNING *;

-- name: MarkNotificationAsUnread :one
UPDATE notifications
SET is_read = FALSE
WHERE id = $1
RETURNING *;

-- name: MarkAllNotificationsAsRead :exec
UPDATE notifications
SET is_read = TRUE
WHERE is_read = FALSE;

-- name: CountUnreadNotifications :one
SELECT COUNT(*) FROM notifications WHERE is_read = FALSE;
