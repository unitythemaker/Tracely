package incident

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unitythemaker/tracely/internal/db"
)

// NextID gets the next incident ID from the database sequence
func (r *Repository) NextID(ctx context.Context) (string, error) {
	return r.q.NextIncidentID(ctx)
}

type Repository struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewRepository(pool *pgxpool.Pool, q *db.Queries) *Repository {
	return &Repository{pool: pool, q: q}
}

func (r *Repository) Get(ctx context.Context, id string) (*db.Incident, error) {
	inc, err := r.q.GetIncident(ctx, id)
	if err != nil {
		return nil, err
	}
	return &inc, nil
}

func (r *Repository) List(ctx context.Context, limit, offset int32) ([]db.Incident, error) {
	return r.q.ListIncidents(ctx, db.ListIncidentsParams{
		Limit:  limit,
		Offset: offset,
	})
}

func (r *Repository) ListByStatus(ctx context.Context, status db.IncidentStatus, limit, offset int32) ([]db.Incident, error) {
	return r.q.ListIncidentsByStatus(ctx, db.ListIncidentsByStatusParams{
		Status: status,
		Limit:  limit,
		Offset: offset,
	})
}

func (r *Repository) ListByService(ctx context.Context, serviceID string, limit, offset int32) ([]db.Incident, error) {
	return r.q.ListIncidentsByService(ctx, db.ListIncidentsByServiceParams{
		ServiceID: serviceID,
		Limit:     limit,
		Offset:    offset,
	})
}

func (r *Repository) ListOpen(ctx context.Context, limit, offset int32) ([]db.Incident, error) {
	return r.q.ListOpenIncidents(ctx, db.ListOpenIncidentsParams{
		Limit:  limit,
		Offset: offset,
	})
}

type ListFilteredParams struct {
	Status    *db.IncidentStatus
	Severity  *db.IncidentSeverity
	ServiceID *string
	Search    *string
	SortBy    string
	SortDir   string
	Limit     int32
	Offset    int32
}

func (r *Repository) ListFiltered(ctx context.Context, params ListFilteredParams) ([]db.Incident, int, error) {
	// Build filter params
	filterParams := db.ListIncidentsFilteredParams{
		LimitVal:  params.Limit,
		OffsetVal: params.Offset,
		SortBy:    params.SortBy,
		SortDir:   params.SortDir,
	}

	if params.Status != nil {
		filterParams.FilterStatus = db.NullIncidentStatus{
			IncidentStatus: *params.Status,
			Valid:          true,
		}
	}
	if params.Severity != nil {
		filterParams.FilterSeverity = db.NullIncidentSeverity{
			IncidentSeverity: *params.Severity,
			Valid:            true,
		}
	}
	if params.ServiceID != nil {
		filterParams.FilterServiceID = params.ServiceID
	}
	if params.Search != nil {
		filterParams.FilterSearch = params.Search
	}

	// Get incidents
	incidents, err := r.q.ListIncidentsFiltered(ctx, filterParams)
	if err != nil {
		return nil, 0, err
	}

	// Get total count with same filters
	countParams := db.CountIncidentsFilteredParams{
		FilterStatus:    filterParams.FilterStatus,
		FilterSeverity:  filterParams.FilterSeverity,
		FilterServiceID: filterParams.FilterServiceID,
		FilterSearch:    filterParams.FilterSearch,
	}
	total, err := r.q.CountIncidentsFiltered(ctx, countParams)
	if err != nil {
		return nil, 0, err
	}

	return incidents, int(total), nil
}

func (r *Repository) UpdateStatus(ctx context.Context, id string, status db.IncidentStatus) (*db.Incident, error) {
	inc, err := r.q.UpdateIncidentStatus(ctx, db.UpdateIncidentStatusParams{
		ID:     id,
		Status: status,
	})
	if err != nil {
		return nil, err
	}
	return &inc, nil
}

func (r *Repository) SetInProgress(ctx context.Context, id string) (*db.Incident, error) {
	inc, err := r.q.SetIncidentInProgress(ctx, id)
	if err != nil {
		return nil, err
	}
	return &inc, nil
}

func (r *Repository) Close(ctx context.Context, id string) (*db.Incident, error) {
	inc, err := r.q.CloseIncident(ctx, id)
	if err != nil {
		return nil, err
	}
	return &inc, nil
}

func (r *Repository) CountOpen(ctx context.Context) (int64, error) {
	return r.q.CountOpenIncidents(ctx)
}

// Comment methods
func (r *Repository) ListComments(ctx context.Context, incidentID string) ([]db.IncidentComment, error) {
	return r.q.ListIncidentComments(ctx, incidentID)
}

func (r *Repository) CreateComment(ctx context.Context, incidentID, author, content string) (*db.IncidentComment, error) {
	comment, err := r.q.CreateIncidentComment(ctx, db.CreateIncidentCommentParams{
		IncidentID: incidentID,
		Author:     author,
		Content:    content,
	})
	if err != nil {
		return nil, err
	}

	// Create event for the comment
	r.CreateEvent(ctx, incidentID, db.IncidentEventTypeCOMMENTADDED, author, nil, nil)

	return &comment, nil
}

func (r *Repository) DeleteComment(ctx context.Context, commentID uuid.UUID) error {
	return r.q.DeleteIncidentComment(ctx, commentID)
}

// Event methods
func (r *Repository) ListEvents(ctx context.Context, incidentID string) ([]db.IncidentEvent, error) {
	return r.q.ListIncidentEvents(ctx, incidentID)
}

func (r *Repository) CreateEvent(ctx context.Context, incidentID string, eventType db.IncidentEventType, actor string, oldValue, newValue *string) (*db.IncidentEvent, error) {
	event, err := r.q.CreateIncidentEvent(ctx, db.CreateIncidentEventParams{
		IncidentID: incidentID,
		EventType:  eventType,
		Actor:      &actor,
		OldValue:   oldValue,
		NewValue:   newValue,
		Metadata:   nil,
	})
	if err != nil {
		return nil, err
	}
	return &event, nil
}

// CreateWithOutbox creates an incident and an outbox event in a single transaction
func (r *Repository) CreateWithOutbox(ctx context.Context, serviceID, ruleID string, metricID uuid.UUID, severity db.IncidentSeverity, message string, departmentID *string) (*db.Incident, error) {
	var incident db.Incident

	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		qtx := r.q.WithTx(tx)

		// Get next ID from sequence
		id, err := qtx.NextIncidentID(ctx)
		if err != nil {
			return err
		}

		// Create incident
		inc, err := qtx.CreateIncident(ctx, db.CreateIncidentParams{
			ID:        id,
			ServiceID: serviceID,
			RuleID:    ruleID,
			MetricID:  metricID,
			Severity:  severity,
			Status:    db.IncidentStatusOPEN,
			Message:   &message,
			OpenedAt:  time.Now(),
		})
		if err != nil {
			return err
		}
		incident = inc

		// Create outbox event
		payloadMap := map[string]any{
			"id":         inc.ID,
			"service_id": inc.ServiceID,
			"rule_id":    inc.RuleID,
			"metric_id":  inc.MetricID.String(),
			"severity":   string(inc.Severity),
			"status":     string(inc.Status),
			"message":    message,
		}
		if departmentID != nil {
			payloadMap["department_id"] = *departmentID
		}

		payload, err := json.Marshal(payloadMap)
		if err != nil {
			return err
		}

		_, err = qtx.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
			EventType:     db.EventTypeINCIDENTCREATED,
			AggregateType: "incident",
			AggregateID:   inc.ID,
			Payload:       payload,
		})
		return err
	})

	if err != nil {
		return nil, err
	}
	return &incident, nil
}
