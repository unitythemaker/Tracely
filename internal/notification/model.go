package notification

import (
	"time"

	"github.com/unitythemaker/tracely/internal/db"
)

type NotificationResponse struct {
	ID           string    `json:"id"`
	IncidentID   string    `json:"incident_id"`
	Target       string    `json:"target"`
	Message      string    `json:"message"`
	DepartmentID *string   `json:"department_id,omitempty"`
	IsRead       bool      `json:"is_read"`
	SentAt       time.Time `json:"sent_at"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func ToResponse(n *db.Notification) NotificationResponse {
	return NotificationResponse{
		ID:           n.ID,
		IncidentID:   n.IncidentID,
		Target:       n.Target,
		Message:      n.Message,
		DepartmentID: n.DepartmentID,
		IsRead:       n.IsRead,
		SentAt:       n.SentAt,
		CreatedAt:    n.CreatedAt,
		UpdatedAt:    n.UpdatedAt,
	}
}

func ToResponseList(notifications []db.Notification) []NotificationResponse {
	result := make([]NotificationResponse, len(notifications))
	for i, n := range notifications {
		result[i] = ToResponse(&n)
	}
	return result
}

type ListFilteredParams struct {
	IsRead     *bool
	IncidentID *string
	Search     *string
	SortBy     string
	SortDir    string
	Limit      int32
	Offset     int32
}
