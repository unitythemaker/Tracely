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

func (r *Repository) ListFiltered(ctx context.Context, params ListFilteredParams) ([]db.Notification, int, error) {
	filterParams := db.ListNotificationsFilteredParams{
		LimitVal:  params.Limit,
		OffsetVal: params.Offset,
		SortBy:    params.SortBy,
		SortDir:   params.SortDir,
	}

	if params.IsRead != nil {
		filterParams.FilterIsRead = params.IsRead
	}
	if params.IncidentID != nil {
		filterParams.FilterIncidentID = params.IncidentID
	}
	if params.Search != nil {
		filterParams.FilterSearch = params.Search
	}

	notifications, err := r.q.ListNotificationsFiltered(ctx, filterParams)
	if err != nil {
		return nil, 0, err
	}

	countParams := db.CountNotificationsFilteredParams{
		FilterIsRead:     filterParams.FilterIsRead,
		FilterIncidentID: filterParams.FilterIncidentID,
		FilterSearch:     filterParams.FilterSearch,
	}
	total, err := r.q.CountNotificationsFiltered(ctx, countParams)
	if err != nil {
		return nil, 0, err
	}

	return notifications, int(total), nil
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

func (r *Repository) MarkAsRead(ctx context.Context, id string) (*db.Notification, error) {
	n, err := r.q.MarkNotificationAsRead(ctx, id)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *Repository) MarkAsUnread(ctx context.Context, id string) (*db.Notification, error) {
	n, err := r.q.MarkNotificationAsUnread(ctx, id)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *Repository) MarkAllAsRead(ctx context.Context) error {
	return r.q.MarkAllNotificationsAsRead(ctx)
}

func (r *Repository) CountUnread(ctx context.Context) (int64, error) {
	return r.q.CountUnreadNotifications(ctx)
}
