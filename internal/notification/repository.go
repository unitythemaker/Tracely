package notification

import (
	"context"

	"github.com/unitythemaker/tracely/internal/db"
)

type Repository struct {
	q *db.Queries
}

func NewRepository(q *db.Queries) *Repository {
	return &Repository{q: q}
}

func (r *Repository) Get(ctx context.Context, id string) (*db.Notification, error) {
	n, err := r.q.GetNotification(ctx, id)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *Repository) List(ctx context.Context, limit, offset int32) ([]db.Notification, error) {
	return r.q.ListNotifications(ctx, db.ListNotificationsParams{
		Limit:  limit,
		Offset: offset,
	})
}

func (r *Repository) ListByIncident(ctx context.Context, incidentID string) ([]db.Notification, error) {
	return r.q.ListNotificationsByIncident(ctx, incidentID)
}

func (r *Repository) Create(ctx context.Context, incidentID, target, message string) (*db.Notification, error) {
	// Get next ID from sequence
	id, err := r.q.NextNotificationID(ctx)
	if err != nil {
		return nil, err
	}

	n, err := r.q.CreateNotification(ctx, db.CreateNotificationParams{
		ID:         id,
		IncidentID: incidentID,
		Target:     target,
		Message:    message,
	})
	if err != nil {
		return nil, err
	}
	return &n, nil
}
