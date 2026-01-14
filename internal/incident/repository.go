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

func generateIncidentID() string {
	return "INC-" + uuid.New().String()[:8]
}

// CreateWithOutbox creates an incident and an outbox event in a single transaction
func (r *Repository) CreateWithOutbox(ctx context.Context, serviceID, ruleID string, metricID uuid.UUID, severity db.IncidentSeverity, message string) (*db.Incident, error) {
	var incident db.Incident

	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		qtx := r.q.WithTx(tx)

		id := generateIncidentID()

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
		payload, err := json.Marshal(map[string]any{
			"id":         inc.ID,
			"service_id": inc.ServiceID,
			"rule_id":    inc.RuleID,
			"metric_id":  inc.MetricID.String(),
			"severity":   string(inc.Severity),
			"status":     string(inc.Status),
			"message":    message,
		})
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
