package incident

import (
	"time"

	"github.com/google/uuid"
	"github.com/unitythemaker/tracely/internal/db"
)

type UpdateIncidentRequest struct {
	Status string `json:"status"`
}

type IncidentResponse struct {
	ID        string     `json:"id"`
	ServiceID string     `json:"service_id"`
	RuleID    string     `json:"rule_id"`
	MetricID  uuid.UUID  `json:"metric_id"`
	Severity  string     `json:"severity"`
	Status    string     `json:"status"`
	Message   *string    `json:"message"`
	OpenedAt  time.Time  `json:"opened_at"`
	ClosedAt  *time.Time `json:"closed_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

func ToResponse(i *db.Incident) IncidentResponse {
	var closedAt *time.Time
	if i.ClosedAt.Valid {
		closedAt = &i.ClosedAt.Time
	}

	return IncidentResponse{
		ID:        i.ID,
		ServiceID: i.ServiceID,
		RuleID:    i.RuleID,
		MetricID:  i.MetricID,
		Severity:  string(i.Severity),
		Status:    string(i.Status),
		Message:   i.Message,
		OpenedAt:  i.OpenedAt,
		ClosedAt:  closedAt,
		CreatedAt: i.CreatedAt,
		UpdatedAt: i.UpdatedAt,
	}
}

func ToResponseList(incidents []db.Incident) []IncidentResponse {
	result := make([]IncidentResponse, len(incidents))
	for i, inc := range incidents {
		result[i] = ToResponse(&inc)
	}
	return result
}
