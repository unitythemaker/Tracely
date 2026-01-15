package outbox

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/internal/testutil"
)

func setupOutboxTest(t *testing.T) (*Repository, *db.Queries, func()) {
	t.Helper()

	pool := testutil.GetTestPool(t)
	q := db.New(pool)

	testutil.CleanupTestData(t, pool)

	repo := NewRepository(q)

	cleanup := func() {
		testutil.CleanupTestData(t, pool)
	}

	return repo, q, cleanup
}

func TestOutboxRepository_GetUnprocessedMetricEvents(t *testing.T) {
	repo, q, cleanup := setupOutboxTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create metric events
	payload, _ := json.Marshal(map[string]any{"test": "data"})
	testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
		EventType:     db.EventTypeMETRICCREATED,
		AggregateType: "metric",
		AggregateID:   uuid.NewString(),
		Payload:       payload,
	})
	testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
		EventType:     db.EventTypeMETRICCREATED,
		AggregateType: "metric",
		AggregateID:   uuid.NewString(),
		Payload:       payload,
	})
	// Create non-metric event
	testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
		EventType:     db.EventTypeINCIDENTCREATED,
		AggregateType: "incident",
		AggregateID:   uuid.NewString(),
		Payload:       payload,
	})

	events, err := repo.GetUnprocessedMetricEvents(ctx, "test_processor", 10)
	if err != nil {
		t.Fatalf("Failed to get unprocessed metric events: %v", err)
	}

	if len(events) != 2 {
		t.Errorf("Expected 2 metric events, got %d", len(events))
	}

	for _, e := range events {
		if e.EventType != db.EventTypeMETRICCREATED {
			t.Errorf("Expected event type METRIC_CREATED, got %s", e.EventType)
		}
	}
}

func TestOutboxRepository_GetUnprocessedIncidentEvents(t *testing.T) {
	repo, q, cleanup := setupOutboxTest(t)
	defer cleanup()

	ctx := context.Background()

	payload, _ := json.Marshal(map[string]any{"test": "data"})
	// Create incident events
	testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
		EventType:     db.EventTypeINCIDENTCREATED,
		AggregateType: "incident",
		Payload:       payload,
	})
	testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
		EventType:     db.EventTypeINCIDENTUPDATED,
		AggregateType: "incident",
		Payload:       payload,
	})
	// Create non-incident event
	testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
		EventType:     db.EventTypeMETRICCREATED,
		AggregateType: "metric",
		Payload:       payload,
	})

	events, err := repo.GetUnprocessedIncidentEvents(ctx, "test_processor", 10)
	if err != nil {
		t.Fatalf("Failed to get unprocessed incident events: %v", err)
	}

	if len(events) != 2 {
		t.Errorf("Expected 2 incident events, got %d", len(events))
	}
}

func TestOutboxRepository_MarkProcessed(t *testing.T) {
	repo, q, cleanup := setupOutboxTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create an event
	event := testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
		EventType:     db.EventTypeMETRICCREATED,
		AggregateType: "metric",
		Payload:       []byte("{}"),
	})

	// Mark it as processed
	err := repo.MarkProcessed(ctx, event.ID, "test_processor")
	if err != nil {
		t.Fatalf("Failed to mark event processed: %v", err)
	}

	// Should not appear in unprocessed events for the same processor
	events, err := repo.GetUnprocessedMetricEvents(ctx, "test_processor", 10)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	for _, e := range events {
		if e.ID == event.ID {
			t.Errorf("Event should not appear in unprocessed list after being marked processed")
		}
	}
}

func TestOutboxRepository_MarkProcessed_MultipleProcessors(t *testing.T) {
	repo, q, cleanup := setupOutboxTest(t)
	defer cleanup()

	ctx := context.Background()

	event := testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
		EventType:     db.EventTypeMETRICCREATED,
		AggregateType: "metric",
		Payload:       []byte("{}"),
	})

	// Mark as processed by processor 1
	err := repo.MarkProcessed(ctx, event.ID, "processor_1")
	if err != nil {
		t.Fatalf("Failed to mark event processed: %v", err)
	}

	// Should still appear for processor 2
	events, err := repo.GetUnprocessedMetricEvents(ctx, "processor_2", 10)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	found := false
	for _, e := range events {
		if e.ID == event.ID {
			found = true
			break
		}
	}

	if !found {
		t.Errorf("Event should appear for different processor")
	}

	// Mark as processed by processor 2
	err = repo.MarkProcessed(ctx, event.ID, "processor_2")
	if err != nil {
		t.Fatalf("Failed to mark event processed: %v", err)
	}

	// Should not appear for processor 2 anymore
	events, err = repo.GetUnprocessedMetricEvents(ctx, "processor_2", 10)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	for _, e := range events {
		if e.ID == event.ID {
			t.Errorf("Event should not appear after being processed")
		}
	}
}

func TestOutboxRepository_GetUnprocessedMetricEvents_Limit(t *testing.T) {
	repo, q, cleanup := setupOutboxTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create multiple events
	for i := 0; i < 10; i++ {
		testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
			EventType:     db.EventTypeMETRICCREATED,
			AggregateType: "metric",
			Payload:       []byte("{}"),
		})
	}

	// Request only 5
	events, err := repo.GetUnprocessedMetricEvents(ctx, "test_processor", 5)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	if len(events) != 5 {
		t.Errorf("Expected 5 events (limit), got %d", len(events))
	}
}

func TestOutboxRepository_EventPayload(t *testing.T) {
	_, q, cleanup := setupOutboxTest(t)
	defer cleanup()

	payload := map[string]any{
		"id":          "test-id",
		"service_id":  "test-service",
		"metric_type": "LATENCY_MS",
		"value":       150.5,
	}
	payloadBytes, _ := json.Marshal(payload)

	event := testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
		EventType:     db.EventTypeMETRICCREATED,
		AggregateType: "metric",
		AggregateID:   "test-id",
		Payload:       payloadBytes,
	})

	// Verify payload can be unmarshaled
	var retrievedPayload map[string]any
	if err := json.Unmarshal(event.Payload, &retrievedPayload); err != nil {
		t.Fatalf("Failed to unmarshal payload: %v", err)
	}

	if retrievedPayload["service_id"] != "test-service" {
		t.Errorf("Expected service_id 'test-service', got %v", retrievedPayload["service_id"])
	}
}

func TestOutboxRepository_EventTypes(t *testing.T) {
	repo, q, cleanup := setupOutboxTest(t)
	defer cleanup()

	ctx := context.Background()

	// Test all event types
	eventTypes := []db.EventType{
		db.EventTypeMETRICCREATED,
		db.EventTypeINCIDENTCREATED,
		db.EventTypeINCIDENTUPDATED,
	}

	for _, et := range eventTypes {
		testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
			EventType:     et,
			AggregateType: "test",
			Payload:       []byte("{}"),
		})
	}

	// Get metric events
	metricEvents, _ := repo.GetUnprocessedMetricEvents(ctx, "test", 10)
	if len(metricEvents) != 1 {
		t.Errorf("Expected 1 metric event, got %d", len(metricEvents))
	}

	// Get incident events
	incidentEvents, _ := repo.GetUnprocessedIncidentEvents(ctx, "test", 10)
	if len(incidentEvents) != 2 {
		t.Errorf("Expected 2 incident events, got %d", len(incidentEvents))
	}
}

func TestOutboxRepository_Cleanup(t *testing.T) {
	repo, q, cleanup := setupOutboxTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create an event
	event := testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
		EventType:     db.EventTypeMETRICCREATED,
		AggregateType: "metric",
		Payload:       []byte("{}"),
	})

	// Mark it as processed by multiple processors
	repo.MarkProcessed(ctx, event.ID, "processor_1")
	repo.MarkProcessed(ctx, event.ID, "processor_2")

	// Cleanup should work without error
	err := repo.Cleanup(ctx)
	if err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}
}

func TestOutboxRepository_ConcurrentProcessing(t *testing.T) {
	repo, q, cleanup := setupOutboxTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create events
	for i := 0; i < 5; i++ {
		testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
			EventType:     db.EventTypeMETRICCREATED,
			AggregateType: "metric",
			Payload:       []byte("{}"),
		})
	}

	// Simulate concurrent processor access
	// Note: FOR UPDATE SKIP LOCKED only holds locks during query execution,
	// so both processors may see the same events. The MarkProcessed uses
	// ON CONFLICT DO NOTHING to handle this safely.
	type result struct {
		processor string
		count     int
		err       error
	}
	results := make(chan result, 2)

	go func() {
		events, err := repo.GetUnprocessedMetricEvents(ctx, "processor_a", 10)
		if err != nil {
			results <- result{"processor_a", 0, err}
			return
		}
		for _, e := range events {
			if err := repo.MarkProcessed(ctx, e.ID, "processor_a"); err != nil {
				results <- result{"processor_a", 0, err}
				return
			}
		}
		results <- result{"processor_a", len(events), nil}
	}()

	go func() {
		events, err := repo.GetUnprocessedMetricEvents(ctx, "processor_b", 10)
		if err != nil {
			results <- result{"processor_b", 0, err}
			return
		}
		for _, e := range events {
			if err := repo.MarkProcessed(ctx, e.ID, "processor_b"); err != nil {
				results <- result{"processor_b", 0, err}
				return
			}
		}
		results <- result{"processor_b", len(events), nil}
	}()

	// Wait for both to complete and check for errors
	var totalProcessed int
	for i := 0; i < 2; i++ {
		r := <-results
		if r.err != nil {
			t.Fatalf("Processor %s failed: %v", r.processor, r.err)
		}
		t.Logf("Processor %s processed %d events in concurrent phase", r.processor, r.count)
		totalProcessed += r.count
	}

	// With FOR UPDATE SKIP LOCKED, events are distributed between processors
	// Total should be at least 5 (all events processed by at least one processor)
	// Could be more if timing allows both to get some events
	if totalProcessed < 5 {
		t.Errorf("Expected at least 5 total events processed, got %d", totalProcessed)
	}

	// Now do a second pass to ensure both processors have marked all events
	// This simulates the real-world scenario where processors retry for missed events
	eventsA, _ := repo.GetUnprocessedMetricEvents(ctx, "processor_a", 10)
	for _, e := range eventsA {
		repo.MarkProcessed(ctx, e.ID, "processor_a")
	}
	t.Logf("Processor_a marked %d additional events in second pass", len(eventsA))

	eventsB, _ := repo.GetUnprocessedMetricEvents(ctx, "processor_b", 10)
	for _, e := range eventsB {
		repo.MarkProcessed(ctx, e.ID, "processor_b")
	}
	t.Logf("Processor_b marked %d additional events in second pass", len(eventsB))

	// After second pass, both processors should have processed all events
	finalA, err := repo.GetUnprocessedMetricEvents(ctx, "processor_a", 10)
	if err != nil {
		t.Fatalf("Failed to get final events for processor_a: %v", err)
	}
	finalB, err := repo.GetUnprocessedMetricEvents(ctx, "processor_b", 10)
	if err != nil {
		t.Fatalf("Failed to get final events for processor_b: %v", err)
	}

	if len(finalA) != 0 {
		t.Errorf("Expected 0 unprocessed events for processor_a after second pass, got %d", len(finalA))
	}
	if len(finalB) != 0 {
		t.Errorf("Expected 0 unprocessed events for processor_b after second pass, got %d", len(finalB))
	}
}

func TestOutboxRepository_NewRepository(t *testing.T) {
	pool := testutil.GetTestPool(t)
	q := db.New(pool)

	repo := NewRepository(q)
	if repo == nil {
		t.Errorf("NewRepository returned nil")
	}
	if repo.q != q {
		t.Errorf("Repository queries not set correctly")
	}
}

func TestOutboxRepository_GetUnprocessedMetricEvents_Empty(t *testing.T) {
	repo, _, cleanup := setupOutboxTest(t)
	defer cleanup()

	ctx := context.Background()

	events, err := repo.GetUnprocessedMetricEvents(ctx, "test", 10)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	if len(events) != 0 {
		t.Errorf("Expected 0 events, got %d", len(events))
	}
}

func TestOutboxRepository_EventOrdering(t *testing.T) {
	repo, q, cleanup := setupOutboxTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create events with small delays to ensure ordering
	for i := 0; i < 3; i++ {
		testutil.TestOutboxEvent(t, q, testutil.TestOutboxEventParams{
			EventType:     db.EventTypeMETRICCREATED,
			AggregateType: "metric",
			AggregateID:   uuid.NewString(),
			Payload:       []byte("{}"),
		})
		time.Sleep(10 * time.Millisecond)
	}

	events, _ := repo.GetUnprocessedMetricEvents(ctx, "test", 10)

	// Events should be ordered by created_at (oldest first)
	for i := 1; i < len(events); i++ {
		if events[i].CreatedAt.Before(events[i-1].CreatedAt) {
			t.Errorf("Events not ordered correctly by created_at")
		}
	}
}
