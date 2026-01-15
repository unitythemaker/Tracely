package rule

import (
	"time"

	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/pkg/pgutil"
)

type CreateRuleRequest struct {
	ID           string  `json:"id"`
	MetricType   string  `json:"metric_type"`
	Threshold    float64 `json:"threshold"`
	Operator     string  `json:"operator"`
	Action       string  `json:"action"`
	Priority     int32   `json:"priority"`
	Severity     string  `json:"severity"`
	IsActive     bool    `json:"is_active"`
	DepartmentID *string `json:"department_id,omitempty"`
}

type UpdateRuleRequest struct {
	MetricType   string  `json:"metric_type"`
	Threshold    float64 `json:"threshold"`
	Operator     string  `json:"operator"`
	Action       string  `json:"action"`
	Priority     int32   `json:"priority"`
	Severity     string  `json:"severity"`
	IsActive     bool    `json:"is_active"`
	DepartmentID *string `json:"department_id,omitempty"`
}

type RuleResponse struct {
	ID           string    `json:"id"`
	MetricType   string    `json:"metric_type"`
	Threshold    float64   `json:"threshold"`
	Operator     string    `json:"operator"`
	Action       string    `json:"action"`
	Priority     int32     `json:"priority"`
	Severity     string    `json:"severity"`
	IsActive     bool      `json:"is_active"`
	DepartmentID *string   `json:"department_id,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	TriggerCount int32     `json:"trigger_count"`
}

func ToResponse(r *db.QualityRule) RuleResponse {
	return RuleResponse{
		ID:           r.ID,
		MetricType:   string(r.MetricType),
		Threshold:    pgutil.NumericToFloat64(r.Threshold),
		Operator:     string(r.Operator),
		Action:       string(r.Action),
		Priority:     r.Priority,
		Severity:     string(r.Severity),
		IsActive:     r.IsActive,
		DepartmentID: r.DepartmentID,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}

func ToResponseList(rules []db.QualityRule) []RuleResponse {
	result := make([]RuleResponse, len(rules))
	for i, r := range rules {
		result[i] = ToResponse(&r)
	}
	return result
}

// ToFilteredResponse converts a ListRulesFilteredRow (with trigger_count) to RuleResponse
func ToFilteredResponse(r *db.ListRulesFilteredRow) RuleResponse {
	return RuleResponse{
		ID:           r.ID,
		MetricType:   string(r.MetricType),
		Threshold:    pgutil.NumericToFloat64(r.Threshold),
		Operator:     string(r.Operator),
		Action:       string(r.Action),
		Priority:     r.Priority,
		Severity:     string(r.Severity),
		IsActive:     r.IsActive,
		DepartmentID: r.DepartmentID,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
		TriggerCount: r.TriggerCount,
	}
}

func ToFilteredResponseList(rows []db.ListRulesFilteredRow) []RuleResponse {
	result := make([]RuleResponse, len(rows))
	for i, r := range rows {
		result[i] = ToFilteredResponse(&r)
	}
	return result
}

// TopTriggeredRuleResponse includes trigger stats
type TopTriggeredRuleResponse struct {
	ID              string     `json:"id"`
	MetricType      string     `json:"metric_type"`
	Threshold       float64    `json:"threshold"`
	Operator        string     `json:"operator"`
	Action          string     `json:"action"`
	Priority        int32      `json:"priority"`
	Severity        string     `json:"severity"`
	IsActive        bool       `json:"is_active"`
	DepartmentID    *string    `json:"department_id,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	TriggerCount    int32      `json:"trigger_count"`
	LastTriggeredAt *time.Time `json:"last_triggered_at"`
}

func ToTopTriggeredResponse(r *db.GetTopTriggeredRulesRow) TopTriggeredRuleResponse {
	resp := TopTriggeredRuleResponse{
		ID:           r.ID,
		MetricType:   string(r.MetricType),
		Threshold:    pgutil.NumericToFloat64(r.Threshold),
		Operator:     string(r.Operator),
		Action:       string(r.Action),
		Priority:     r.Priority,
		Severity:     string(r.Severity),
		IsActive:     r.IsActive,
		DepartmentID: r.DepartmentID,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
		TriggerCount: r.TriggerCount,
	}

	// Handle LastTriggeredAt which is interface{} (can be nil or time.Time)
	if r.LastTriggeredAt != nil {
		if t, ok := r.LastTriggeredAt.(time.Time); ok {
			resp.LastTriggeredAt = &t
		}
	}

	return resp
}

func ToTopTriggeredResponseList(rows []db.GetTopTriggeredRulesRow) []TopTriggeredRuleResponse {
	result := make([]TopTriggeredRuleResponse, len(rows))
	for i, r := range rows {
		result[i] = ToTopTriggeredResponse(&r)
	}
	return result
}
