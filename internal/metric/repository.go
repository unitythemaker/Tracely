package metric

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/pkg/pgutil"
)

type Repository struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewRepository(pool *pgxpool.Pool, q *db.Queries) *Repository {
	return &Repository{pool: pool, q: q}
}

func (r *Repository) Get(ctx context.Context, id uuid.UUID) (*db.Metric, error) {
	m, err := r.q.GetMetric(ctx, id)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, limit, offset int32) ([]db.Metric, error) {
	return r.q.ListMetrics(ctx, db.ListMetricsParams{
		Limit:  limit,
		Offset: offset,
	})
}

func (r *Repository) ListByService(ctx context.Context, serviceID string, limit, offset int32) ([]db.Metric, error) {
	return r.q.ListMetricsByService(ctx, db.ListMetricsByServiceParams{
		ServiceID: serviceID,
		Limit:     limit,
		Offset:    offset,
	})
}

// CreateWithOutbox creates a metric and an outbox event in a single transaction
func (r *Repository) CreateWithOutbox(ctx context.Context, req CreateMetricRequest) (*db.Metric, error) {
	var metric db.Metric

	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		qtx := r.q.WithTx(tx)

		// Create metric
		m, err := qtx.CreateMetric(ctx, db.CreateMetricParams{
			ServiceID:  req.ServiceID,
			MetricType: db.MetricType(req.MetricType),
			Value:      pgutil.Float64ToNumeric(req.Value),
			RecordedAt: req.RecordedAt,
		})
		if err != nil {
			return err
		}
		metric = m

		// Create outbox event
		payload, err := json.Marshal(map[string]any{
			"id":          m.ID.String(),
			"service_id":  m.ServiceID,
			"metric_type": string(m.MetricType),
			"value":       m.Value,
			"recorded_at": m.RecordedAt,
		})
		if err != nil {
			return err
		}

		_, err = qtx.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
			EventType:     db.EventTypeMETRICCREATED,
			AggregateType: "metric",
			AggregateID:   m.ID.String(),
			Payload:       payload,
		})
		return err
	})

	if err != nil {
		return nil, err
	}
	return &metric, nil
}
