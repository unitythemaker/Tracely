package rule

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/internal/incident"
	"github.com/unitythemaker/tracely/internal/outbox"
)

const ProcessorName = "rule_worker"

type Worker struct {
	outboxRepo   *outbox.Repository
	ruleRepo     *Repository
	incidentRepo *incident.Repository
	interval     time.Duration
}

func NewWorker(outboxRepo *outbox.Repository, ruleRepo *Repository, incidentRepo *incident.Repository, interval time.Duration) *Worker {
	return &Worker{
		outboxRepo:   outboxRepo,
		ruleRepo:     ruleRepo,
		incidentRepo: incidentRepo,
		interval:     interval,
	}
}

func (w *Worker) Run(ctx context.Context) {
	slog.Info("RuleWorker started", "interval", w.interval)
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("RuleWorker stopped")
			return
		case <-ticker.C:
			w.processEvents(ctx)
		}
	}
}

func (w *Worker) processEvents(ctx context.Context) {
	events, err := w.outboxRepo.GetUnprocessedMetricEvents(ctx, ProcessorName, 100)
	if err != nil {
		slog.Error("RuleWorker: failed to get events", "error", err)
		return
	}

	for _, event := range events {
		if err := w.processEvent(ctx, event); err != nil {
			slog.Error("RuleWorker: failed to process event", "event_id", event.ID, "error", err)
			continue
		}

		if err := w.outboxRepo.MarkProcessed(ctx, event.ID, ProcessorName); err != nil {
			slog.Error("RuleWorker: failed to mark event processed", "event_id", event.ID, "error", err)
		}
	}
}

type MetricPayload struct {
	ID         string  `json:"id"`
	ServiceID  string  `json:"service_id"`
	MetricType string  `json:"metric_type"`
	Value      float64 `json:"value"`
	RecordedAt string  `json:"recorded_at"`
}

func (w *Worker) processEvent(ctx context.Context, event db.Outbox) error {
	var payload MetricPayload
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	// Get active rules for this metric type
	rules, err := w.ruleRepo.ListActiveByMetricType(ctx, db.MetricType(payload.MetricType))
	if err != nil {
		return fmt.Errorf("failed to get rules: %w", err)
	}

	metricID, err := uuid.Parse(payload.ID)
	if err != nil {
		return fmt.Errorf("failed to parse metric id: %w", err)
	}

	// Evaluate each rule
	for _, rule := range rules {
		if !Evaluate(&rule, payload.Value) {
			continue
		}

		// Rule violated - check action
		if rule.Action != db.RuleActionOPENINCIDENT {
			slog.Debug("RuleWorker: rule action not OPEN_INCIDENT, skipping", "rule_id", rule.ID, "action", rule.Action)
			continue
		}

		// Create incident
		message := fmt.Sprintf("%s threshold exceeded: %.2f (threshold: %.2f, operator: %s)",
			payload.MetricType, payload.Value, float64(rule.Threshold.Int.Int64())/100, rule.Operator)

		_, err := w.incidentRepo.CreateWithOutbox(ctx, payload.ServiceID, rule.ID, metricID, rule.Severity, message)
		if err != nil {
			slog.Error("RuleWorker: failed to create incident", "rule_id", rule.ID, "error", err)
			continue
		}

		slog.Info("RuleWorker: incident created",
			"rule_id", rule.ID,
			"service_id", payload.ServiceID,
			"metric_type", payload.MetricType,
			"value", payload.Value,
		)
	}

	return nil
}
