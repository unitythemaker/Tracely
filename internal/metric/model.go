package metric

import (
	"time"

	"github.com/google/uuid"
	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/pkg/pgutil"
)

// AggregatedMetricResponse represents a single aggregated time bucket
type AggregatedMetricResponse struct {
	Time       time.Time `json:"time"`
	MetricType string    `json:"metric_type"`
	Count      int       `json:"count"`
	Min        float64   `json:"min"`
	Max        float64   `json:"max"`
	Avg        float64   `json:"avg"`
	P50        float64   `json:"p50"`
	P95        float64   `json:"p95"`
	P99        float64   `json:"p99"`
}

func ToAggregatedResponse(row db.GetMetricsAggregatedRow) AggregatedMetricResponse {
	return AggregatedMetricResponse{
		Time:       row.BucketTime,
		MetricType: string(row.MetricType),
		Count:      int(row.Count),
		Min:        pgutil.NumericToFloat64(row.MinValue),
		Max:        pgutil.NumericToFloat64(row.MaxValue),
		Avg:        row.AvgValue,
		P50:        row.P50Value,
		P95:        row.P95Value,
		P99:        row.P99Value,
	}
}

func ToAggregatedResponseList(rows []db.GetMetricsAggregatedRow) []AggregatedMetricResponse {
	result := make([]AggregatedMetricResponse, len(rows))
	for i, r := range rows {
		result[i] = ToAggregatedResponse(r)
	}
	return result
}

type CreateMetricRequest struct {
	ServiceID  string    `json:"service_id"`
	MetricType string    `json:"metric_type"`
	Value      float64   `json:"value"`
	RecordedAt time.Time `json:"timestamp"`
}

type MetricResponse struct {
	ID         uuid.UUID `json:"id"`
	ServiceID  string    `json:"service_id"`
	MetricType string    `json:"metric_type"`
	Value      float64   `json:"value"`
	RecordedAt time.Time `json:"recorded_at"`
	CreatedAt  time.Time `json:"created_at"`
}

func ToResponse(m *db.Metric) MetricResponse {
	return MetricResponse{
		ID:         m.ID,
		ServiceID:  m.ServiceID,
		MetricType: string(m.MetricType),
		Value:      pgutil.NumericToFloat64(m.Value),
		RecordedAt: m.RecordedAt,
		CreatedAt:  m.CreatedAt,
	}
}

func ToResponseList(metrics []db.Metric) []MetricResponse {
	result := make([]MetricResponse, len(metrics))
	for i, m := range metrics {
		result[i] = ToResponse(&m)
	}
	return result
}
