package outbox

import (
	"context"

	"github.com/google/uuid"
	"github.com/unitythemaker/tracely/internal/db"
)

type Repository struct {
	q *db.Queries
}

func NewRepository(q *db.Queries) *Repository {
	return &Repository{q: q}
}

func (r *Repository) GetUnprocessedMetricEvents(ctx context.Context, processor string, limit int32) ([]db.Outbox, error) {
	return r.q.GetUnprocessedEvents(ctx, db.GetUnprocessedEventsParams{
		Processor: processor,
		EventType: db.EventTypeMETRICCREATED,
		Limit:     limit,
	})
}

func (r *Repository) GetUnprocessedIncidentEvents(ctx context.Context, processor string, limit int32) ([]db.Outbox, error) {
	return r.q.GetUnprocessedIncidentEvents(ctx, db.GetUnprocessedIncidentEventsParams{
		Processor: processor,
		Limit:     limit,
	})
}

func (r *Repository) MarkProcessed(ctx context.Context, outboxID uuid.UUID, processor string) error {
	return r.q.MarkEventProcessed(ctx, db.MarkEventProcessedParams{
		OutboxID:  outboxID,
		Processor: processor,
	})
}

func (r *Repository) Cleanup(ctx context.Context) error {
	return r.q.CleanupOldEvents(ctx)
}
