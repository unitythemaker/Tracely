package metric

import (
	"context"
	"encoding/json"
	"time"

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

type MetricListFilteredParams struct {
	ServiceID  *string
	MetricType *db.MetricType
	Search     *string
	SortBy     string
	SortDir    string
	Limit      int32
	Offset     int32
}

func (r *Repository) ListFiltered(ctx context.Context, params MetricListFilteredParams) ([]db.Metric, int, error) {
	filterParams := db.ListMetricsFilteredParams{
		LimitVal:  params.Limit,
		OffsetVal: params.Offset,
		SortBy:    params.SortBy,
		SortDir:   params.SortDir,
	}

	if params.ServiceID != nil {
		filterParams.FilterServiceID = params.ServiceID
	}
	if params.MetricType != nil {
		filterParams.FilterMetricType = db.NullMetricType{
			MetricType: *params.MetricType,
			Valid:      true,
		}
	}
	if params.Search != nil {
		filterParams.FilterSearch = params.Search
	}

	metrics, err := r.q.ListMetricsFiltered(ctx, filterParams)
	if err != nil {
		return nil, 0, err
	}

	countParams := db.CountMetricsFilteredParams{
		FilterServiceID:  filterParams.FilterServiceID,
		FilterMetricType: filterParams.FilterMetricType,
		FilterSearch:     filterParams.FilterSearch,
	}
	total, err := r.q.CountMetricsFiltered(ctx, countParams)
	if err != nil {
		return nil, 0, err
	}

	return metrics, int(total), nil
}

// ListInRange returns metrics within a time range
type MetricRangeParams struct {
	ServiceID  *string
	MetricType *db.MetricType
	From       time.Time
	To         time.Time
}

func (r *Repository) ListInRange(ctx context.Context, params MetricRangeParams) ([]db.Metric, error) {
	filterParams := db.ListMetricsInRangeParams{
		FromTime: params.From,
		ToTime:   params.To,
	}

	if params.ServiceID != nil {
		filterParams.FilterServiceID = params.ServiceID
	}
	if params.MetricType != nil {
		filterParams.FilterMetricType = db.NullMetricType{
			MetricType: *params.MetricType,
			Valid:      true,
		}
	}

	return r.q.ListMetricsInRange(ctx, filterParams)
}

// GetAggregated returns aggregated metrics for charting
type MetricAggregatedParams struct {
	ServiceID  *string
	MetricType *db.MetricType
	From       time.Time
	To         time.Time
	BucketSize string // 'minute', 'hour', 'day'
}

func (r *Repository) GetAggregated(ctx context.Context, params MetricAggregatedParams) ([]db.GetMetricsAggregatedRow, error) {
	filterParams := db.GetMetricsAggregatedParams{
		FromTime:   params.From,
		ToTime:     params.To,
		BucketSize: params.BucketSize,
	}

	if params.ServiceID != nil {
		filterParams.FilterServiceID = params.ServiceID
	}
	if params.MetricType != nil {
		filterParams.FilterMetricType = db.NullMetricType{
			MetricType: *params.MetricType,
			Valid:      true,
		}
	}

	return r.q.GetMetricsAggregated(ctx, filterParams)
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
