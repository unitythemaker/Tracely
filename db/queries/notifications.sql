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
INSERT INTO notifications (id, incident_id, target, message)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: NextNotificationID :one
SELECT CAST('N-' || nextval('notification_id_seq')::TEXT AS VARCHAR) AS id;
