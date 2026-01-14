package rule

import (
	"time"

	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/pkg/pgutil"
)

type CreateRuleRequest struct {
	ID         string  `json:"id"`
	MetricType string  `json:"metric_type"`
	Threshold  float64 `json:"threshold"`
	Operator   string  `json:"operator"`
	Action     string  `json:"action"`
	Priority   int32   `json:"priority"`
	Severity   string  `json:"severity"`
	IsActive   bool    `json:"is_active"`
}

type UpdateRuleRequest struct {
	MetricType string  `json:"metric_type"`
	Threshold  float64 `json:"threshold"`
	Operator   string  `json:"operator"`
	Action     string  `json:"action"`
	Priority   int32   `json:"priority"`
	Severity   string  `json:"severity"`
	IsActive   bool    `json:"is_active"`
}

type RuleResponse struct {
	ID         string    `json:"id"`
	MetricType string    `json:"metric_type"`
	Threshold  float64   `json:"threshold"`
	Operator   string    `json:"operator"`
	Action     string    `json:"action"`
	Priority   int32     `json:"priority"`
	Severity   string    `json:"severity"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func ToResponse(r *db.QualityRule) RuleResponse {
	return RuleResponse{
		ID:         r.ID,
		MetricType: string(r.MetricType),
		Threshold:  pgutil.NumericToFloat64(r.Threshold),
		Operator:   string(r.Operator),
		Action:     string(r.Action),
		Priority:   r.Priority,
		Severity:   string(r.Severity),
		IsActive:   r.IsActive,
		CreatedAt:  r.CreatedAt,
		UpdatedAt:  r.UpdatedAt,
	}
}

func ToResponseList(rules []db.QualityRule) []RuleResponse {
	result := make([]RuleResponse, len(rules))
	for i, r := range rules {
		result[i] = ToResponse(&r)
	}
	return result
}
