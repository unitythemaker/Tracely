package notification

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/internal/outbox"
)

const ProcessorName = "notification_worker"

type Worker struct {
	outboxRepo *outbox.Repository
	notifRepo  *Repository
	interval   time.Duration
}

func NewWorker(outboxRepo *outbox.Repository, notifRepo *Repository, interval time.Duration) *Worker {
	return &Worker{
		outboxRepo: outboxRepo,
		notifRepo:  notifRepo,
		interval:   interval,
	}
}

func (w *Worker) Run(ctx context.Context) {
	slog.Info("NotificationWorker started", "interval", w.interval)
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("NotificationWorker stopped")
			return
		case <-ticker.C:
			w.processEvents(ctx)
		}
	}
}

func (w *Worker) processEvents(ctx context.Context) {
	events, err := w.outboxRepo.GetUnprocessedIncidentEvents(ctx, ProcessorName, 100)
	if err != nil {
		slog.Error("NotificationWorker: failed to get events", "error", err)
		return
	}

	for _, event := range events {
		if err := w.processEvent(ctx, event); err != nil {
			slog.Error("NotificationWorker: failed to process event", "event_id", event.ID, "error", err)
			continue
		}

		if err := w.outboxRepo.MarkProcessed(ctx, event.ID, ProcessorName); err != nil {
			slog.Error("NotificationWorker: failed to mark event processed", "event_id", event.ID, "error", err)
		}
	}
}

type IncidentPayload struct {
	ID        string `json:"id"`
	ServiceID string `json:"service_id"`
	RuleID    string `json:"rule_id"`
	Severity  string `json:"severity"`
	Status    string `json:"status"`
	Message   string `json:"message"`
}

func (w *Worker) processEvent(ctx context.Context, event db.Outbox) error {
	var payload IncidentPayload
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	// Create notification (mock - just log and store)
	target := "OPS_TEAM"
	message := fmt.Sprintf("[%s] Incident %s: %s (Service: %s)",
		payload.Severity, payload.ID, payload.Message, payload.ServiceID)

	// In a real system, this would send to Slack, email, SMS, etc.
	slog.Info("NotificationWorker: sending notification",
		"target", target,
		"incident_id", payload.ID,
		"severity", payload.Severity,
	)

	// Store notification record
	_, err := w.notifRepo.Create(ctx, payload.ID, target, message)
	if err != nil {
		return fmt.Errorf("failed to create notification: %w", err)
	}

	return nil
}
