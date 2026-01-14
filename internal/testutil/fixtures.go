package testutil

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/pkg/pgutil"
)

// TestService creates a test service
func TestService(t *testing.T, q *db.Queries, id, name string) db.Service {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	svc, err := q.CreateService(ctx, db.CreateServiceParams{
		ID:   id,
		Name: name,
	})
	if err != nil {
		t.Fatalf("Failed to create test service: %v", err)
	}
	return svc
}

// TestRule creates a test quality rule
func TestRule(t *testing.T, q *db.Queries, params TestRuleParams) db.QualityRule {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Set defaults
	if params.ID == "" {
		params.ID = "test-rule-" + uuid.NewString()[:8]
	}
	if params.MetricType == "" {
		params.MetricType = db.MetricTypeLATENCYMS
	}
	if params.Operator == "" {
		params.Operator = db.RuleOperatorValue0 // >
	}
	if params.Action == "" {
		params.Action = db.RuleActionOPENINCIDENT
	}
	if params.Severity == "" {
		params.Severity = db.IncidentSeverityMEDIUM
	}

	rule, err := q.CreateRule(ctx, db.CreateRuleParams{
		ID:         params.ID,
		MetricType: params.MetricType,
		Threshold:  pgutil.Float64ToNumeric(params.Threshold),
		Operator:   params.Operator,
		Action:     params.Action,
		Priority:   params.Priority,
		Severity:   params.Severity,
		IsActive:   params.IsActive,
	})
	if err != nil {
		t.Fatalf("Failed to create test rule: %v", err)
	}
	return rule
}

// TestRuleParams holds parameters for creating a test rule
type TestRuleParams struct {
	ID         string
	MetricType db.MetricType
	Threshold  float64
	Operator   db.RuleOperator
	Action     db.RuleAction
	Priority   int32
	Severity   db.IncidentSeverity
	IsActive   bool
}

// TestMetric creates a test metric
func TestMetric(t *testing.T, q *db.Queries, params TestMetricParams) db.Metric {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Set defaults
	if params.ServiceID == "" {
		params.ServiceID = "test-service"
	}
	if params.MetricType == "" {
		params.MetricType = db.MetricTypeLATENCYMS
	}
	if params.RecordedAt.IsZero() {
		params.RecordedAt = time.Now()
	}

	metric, err := q.CreateMetric(ctx, db.CreateMetricParams{
		ServiceID:  params.ServiceID,
		MetricType: params.MetricType,
		Value:      pgutil.Float64ToNumeric(params.Value),
		RecordedAt: params.RecordedAt,
	})
	if err != nil {
		t.Fatalf("Failed to create test metric: %v", err)
	}
	return metric
}

// TestMetricParams holds parameters for creating a test metric
type TestMetricParams struct {
	ServiceID  string
	MetricType db.MetricType
	Value      float64
	RecordedAt time.Time
}

// TestIncident creates a test incident
// Note: This will create a metric if MetricID is not provided
func TestIncident(t *testing.T, q *db.Queries, params TestIncidentParams) db.Incident {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Get next ID
	id, err := q.NextIncidentID(ctx)
	if err != nil {
		t.Fatalf("Failed to get next incident ID: %v", err)
	}

	// Set defaults
	if params.ServiceID == "" {
		params.ServiceID = "test-service"
	}
	if params.RuleID == "" {
		params.RuleID = "test-rule"
	}
	if params.Severity == "" {
		params.Severity = db.IncidentSeverityMEDIUM
	}
	if params.Status == "" {
		params.Status = db.IncidentStatusOPEN
	}
	if params.OpenedAt.IsZero() {
		params.OpenedAt = time.Now()
	}

	// If no MetricID provided, create a metric first (to satisfy foreign key)
	if params.MetricID == uuid.Nil {
		metric, err := q.CreateMetric(ctx, db.CreateMetricParams{
			ServiceID:  params.ServiceID,
			MetricType: db.MetricTypeLATENCYMS,
			Value:      pgutil.Float64ToNumeric(100.0),
			RecordedAt: time.Now(),
		})
		if err != nil {
			t.Fatalf("Failed to create test metric for incident: %v", err)
		}
		params.MetricID = metric.ID
	}

	incident, err := q.CreateIncident(ctx, db.CreateIncidentParams{
		ID:        id,
		ServiceID: params.ServiceID,
		RuleID:    params.RuleID,
		MetricID:  params.MetricID,
		Severity:  params.Severity,
		Status:    params.Status,
		Message:   params.Message,
		OpenedAt:  params.OpenedAt,
	})
	if err != nil {
		t.Fatalf("Failed to create test incident: %v", err)
	}
	return incident
}

// TestIncidentParams holds parameters for creating a test incident
type TestIncidentParams struct {
	ServiceID string
	RuleID    string
	MetricID  uuid.UUID
	Severity  db.IncidentSeverity
	Status    db.IncidentStatus
	Message   *string
	OpenedAt  time.Time
}

// TestOutboxEvent creates a test outbox event
func TestOutboxEvent(t *testing.T, q *db.Queries, params TestOutboxEventParams) db.Outbox {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Set defaults
	if params.EventType == "" {
		params.EventType = db.EventTypeMETRICCREATED
	}
	if params.AggregateType == "" {
		params.AggregateType = "metric"
	}
	if params.AggregateID == "" {
		params.AggregateID = uuid.NewString()
	}
	if params.Payload == nil {
		params.Payload = []byte("{}")
	}

	event, err := q.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
		EventType:     params.EventType,
		AggregateType: params.AggregateType,
		AggregateID:   params.AggregateID,
		Payload:       params.Payload,
	})
	if err != nil {
		t.Fatalf("Failed to create test outbox event: %v", err)
	}
	return event
}

// TestOutboxEventParams holds parameters for creating a test outbox event
type TestOutboxEventParams struct {
	EventType     db.EventType
	AggregateType string
	AggregateID   string
	Payload       []byte
}

// StringPtr returns a pointer to a string
func StringPtr(s string) *string {
	return &s
}
