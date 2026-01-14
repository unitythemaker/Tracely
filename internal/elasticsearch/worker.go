package elasticsearch

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/internal/outbox"
	"github.com/unitythemaker/tracely/internal/service"
)

const ProcessorName = "es_worker"

type Worker struct {
	outboxRepo  *outbox.Repository
	serviceRepo *service.Repository
	esClient    *Client
	interval    time.Duration
}

func NewWorker(outboxRepo *outbox.Repository, serviceRepo *service.Repository, esClient *Client, interval time.Duration) *Worker {
	return &Worker{
		outboxRepo:  outboxRepo,
		serviceRepo: serviceRepo,
		esClient:    esClient,
		interval:    interval,
	}
}

func (w *Worker) Run(ctx context.Context) {
	slog.Info("ESWorker started", "interval", w.interval)
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("ESWorker stopped")
			return
		case <-ticker.C:
			w.processEvents(ctx)
		}
	}
}

func (w *Worker) processEvents(ctx context.Context) {
	events, err := w.outboxRepo.GetUnprocessedMetricEvents(ctx, ProcessorName, 100)
	if err != nil {
		slog.Error("ESWorker: failed to get events", "error", err)
		return
	}

	for _, event := range events {
		if err := w.processEvent(ctx, event); err != nil {
			slog.Error("ESWorker: failed to process event", "event_id", event.ID, "error", err)
			continue
		}

		if err := w.outboxRepo.MarkProcessed(ctx, event.ID, ProcessorName); err != nil {
			slog.Error("ESWorker: failed to mark event processed", "event_id", event.ID, "error", err)
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

	// Get service name
	svc, err := w.serviceRepo.Get(ctx, payload.ServiceID)
	if err != nil {
		slog.Warn("ESWorker: service not found", "service_id", payload.ServiceID)
	}

	serviceName := payload.ServiceID
	if svc != nil {
		serviceName = svc.Name
	}

	doc := MetricDocument{
		ID:          payload.ID,
		ServiceID:   payload.ServiceID,
		ServiceName: serviceName,
		MetricType:  payload.MetricType,
		Value:       payload.Value,
		RecordedAt:  payload.RecordedAt,
		CreatedAt:   event.CreatedAt.Format(time.RFC3339),
	}

	if err := w.esClient.IndexMetric(ctx, doc); err != nil {
		return fmt.Errorf("failed to index metric: %w", err)
	}

	slog.Debug("ESWorker: metric indexed",
		"metric_id", payload.ID,
		"service_id", payload.ServiceID,
	)

	return nil
}
