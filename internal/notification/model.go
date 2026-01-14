package notification

import (
	"time"

	"github.com/unitythemaker/tracely/internal/db"
)

type NotificationResponse struct {
	ID         string    `json:"id"`
	IncidentID string    `json:"incident_id"`
	Target     string    `json:"target"`
	Message    string    `json:"message"`
	SentAt     time.Time `json:"sent_at"`
	CreatedAt  time.Time `json:"created_at"`
}

func ToResponse(n *db.Notification) NotificationResponse {
	return NotificationResponse{
		ID:         n.ID,
		IncidentID: n.IncidentID,
		Target:     n.Target,
		Message:    n.Message,
		SentAt:     n.SentAt,
		CreatedAt:  n.CreatedAt,
	}
}

func ToResponseList(notifications []db.Notification) []NotificationResponse {
	result := make([]NotificationResponse, len(notifications))
	for i, n := range notifications {
		result[i] = ToResponse(&n)
	}
	return result
}
