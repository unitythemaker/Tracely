-- name: CreateOutboxEvent :one
INSERT INTO outbox (event_type, aggregate_type, aggregate_id, payload)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetUnprocessedEvents :many
SELECT o.*
FROM outbox o
LEFT JOIN outbox_processing op ON o.id = op.outbox_id AND op.processor = $1
WHERE op.outbox_id IS NULL AND o.event_type = $2
ORDER BY o.created_at
LIMIT $3
FOR UPDATE OF o SKIP LOCKED;

-- name: GetUnprocessedIncidentEvents :many
SELECT o.*
FROM outbox o
LEFT JOIN outbox_processing op ON o.id = op.outbox_id AND op.processor = $1
WHERE op.outbox_id IS NULL AND o.event_type IN ('INCIDENT_CREATED', 'INCIDENT_UPDATED')
ORDER BY o.created_at
LIMIT $2
FOR UPDATE OF o SKIP LOCKED;

-- name: MarkEventProcessed :exec
INSERT INTO outbox_processing (outbox_id, processor)
VALUES ($1, $2)
ON CONFLICT (outbox_id, processor) DO NOTHING;

-- name: CleanupOldEvents :exec
DELETE FROM outbox
WHERE created_at < NOW() - INTERVAL '7 days'
AND NOT EXISTS (
    SELECT 1 FROM outbox o2
    LEFT JOIN outbox_processing op ON o2.id = op.outbox_id
    WHERE o2.id = outbox.id AND op.outbox_id IS NULL
);
