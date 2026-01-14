package metric

import (
	"time"

	"github.com/google/uuid"
	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/pkg/pgutil"
)

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
