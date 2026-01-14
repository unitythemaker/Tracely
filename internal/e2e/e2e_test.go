package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/internal/incident"
	"github.com/unitythemaker/tracely/internal/metric"
	"github.com/unitythemaker/tracely/internal/outbox"
	"github.com/unitythemaker/tracely/internal/rule"
	"github.com/unitythemaker/tracely/internal/service"
	"github.com/unitythemaker/tracely/internal/testutil"
)

type TestServer struct {
	Mux            *http.ServeMux
	Pool           *pgxpool.Pool
	Queries        *db.Queries
	ServiceHandler *service.Handler
	MetricHandler  *metric.Handler
	IncidentHandler *incident.Handler
	RuleHandler    *rule.Handler
	OutboxRepo     *outbox.Repository
	RuleRepo       *rule.Repository
	IncidentRepo   *incident.Repository
}

func setupE2ETest(t *testing.T) (*TestServer, func()) {
	t.Helper()

	pool := testutil.GetTestPool(t)
	q := db.New(pool)

	testutil.CleanupTestData(t, pool)

	// Create repositories
	serviceRepo := service.NewRepository(q)
	metricRepo := metric.NewRepository(pool, q)
	incidentRepo := incident.NewRepository(pool, q)
	ruleRepo := rule.NewRepository(q)
	outboxRepo := outbox.NewRepository(q)

	// Create handlers
	serviceHandler := service.NewHandler(serviceRepo)
	metricHandler := metric.NewHandler(metricRepo)
	incidentHandler := incident.NewHandler(incidentRepo)
	ruleHandler := rule.NewHandler(ruleRepo)

	// Setup routes
	mux := http.NewServeMux()
	serviceHandler.RegisterRoutes(mux)
	metricHandler.RegisterRoutes(mux)
	incidentHandler.RegisterRoutes(mux)
	ruleHandler.RegisterRoutes(mux)

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	server := &TestServer{
		Mux:            mux,
		Pool:           pool,
		Queries:        q,
		ServiceHandler: serviceHandler,
		MetricHandler:  metricHandler,
		IncidentHandler: incidentHandler,
		RuleHandler:    ruleHandler,
		OutboxRepo:     outboxRepo,
		RuleRepo:       ruleRepo,
		IncidentRepo:   incidentRepo,
	}

	cleanup := func() {
		testutil.CleanupTestData(t, pool)
	}

	return server, cleanup
}

func TestE2E_HealthCheck(t *testing.T) {
	server, cleanup := setupE2ETest(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}
}

func TestE2E_MetricToIncidentFlow(t *testing.T) {
	server, cleanup := setupE2ETest(t)
	defer cleanup()

	ctx := context.Background()

	// Step 1: Create a service
	svc, err := server.Queries.CreateService(ctx, db.CreateServiceParams{
		ID:   "e2e-service",
		Name: "E2E Test Service",
	})
	if err != nil {
		t.Fatalf("Failed to create service: %v", err)
	}
	t.Logf("Created service: %s", svc.ID)

	// Step 2: Create a rule that triggers on high latency
	ruleBody := map[string]any{
		"id":          "high-latency-rule",
		"metric_type": "LATENCY_MS",
		"threshold":   100.0,
		"operator":    ">",
		"action":      "OPEN_INCIDENT",
		"priority":    1,
		"severity":    "CRITICAL",
		"is_active":   true,
	}
	ruleBodyBytes, _ := json.Marshal(ruleBody)

	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewReader(ruleBodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("Failed to create rule: %s", rr.Body.String())
	}
	t.Logf("Created rule: high-latency-rule")

	// Step 3: Create a metric that violates the rule
	metricBody := map[string]any{
		"service_id":  "e2e-service",
		"metric_type": "LATENCY_MS",
		"value":       150.0, // Above threshold
		"timestamp":   time.Now().Format(time.RFC3339),
	}
	metricBodyBytes, _ := json.Marshal(metricBody)

	req = httptest.NewRequest(http.MethodPost, "/api/metrics", bytes.NewReader(metricBodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("Failed to create metric: %s", rr.Body.String())
	}
	t.Logf("Created metric with value 150.0")

	// Step 4: Verify outbox event was created
	events, err := server.OutboxRepo.GetUnprocessedMetricEvents(ctx, "e2e_test", 10)
	if err != nil {
		t.Fatalf("Failed to get outbox events: %v", err)
	}
	if len(events) == 0 {
		t.Fatalf("Expected outbox event for metric, got none")
	}
	t.Logf("Found %d outbox events", len(events))

	// Step 5: Simulate rule worker processing
	for _, event := range events {
		// Parse event payload
		var payload struct {
			ID         string  `json:"id"`
			ServiceID  string  `json:"service_id"`
			MetricType string  `json:"metric_type"`
			Value      float64 `json:"value"`
		}
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			t.Fatalf("Failed to parse event payload: %v", err)
		}

		// Get active rules for this metric type
		rules, err := server.RuleRepo.ListActiveByMetricType(ctx, db.MetricType(payload.MetricType))
		if err != nil {
			t.Fatalf("Failed to get rules: %v", err)
		}

		// Evaluate rules
		for _, r := range rules {
			violated := rule.Evaluate(&r, payload.Value)
			if violated && r.Action == db.RuleActionOPENINCIDENT {
				t.Logf("Rule %s violated, creating incident", r.ID)
			}
		}
	}

	// Step 6: Verify the flow works end-to-end
	req = httptest.NewRequest(http.MethodGet, "/api/metrics", nil)
	rr = httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Failed to list metrics: %s", rr.Body.String())
	}

	var metricResponse struct {
		Data []metric.MetricResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &metricResponse)

	if len(metricResponse.Data) != 1 {
		t.Errorf("Expected 1 metric, got %d", len(metricResponse.Data))
	}
}

func TestE2E_IncidentLifecycle(t *testing.T) {
	server, cleanup := setupE2ETest(t)
	defer cleanup()

	ctx := context.Background()

	// Setup
	server.Queries.CreateService(ctx, db.CreateServiceParams{ID: "lifecycle-svc", Name: "Lifecycle Service"})
	testutil.TestRule(t, server.Queries, testutil.TestRuleParams{
		ID:         "lifecycle-rule",
		MetricType: db.MetricTypeLATENCYMS,
		Threshold:  100.0,
		IsActive:   true,
	})

	// Create incident directly
	inc := testutil.TestIncident(t, server.Queries, testutil.TestIncidentParams{
		ServiceID: "lifecycle-svc",
		RuleID:    "lifecycle-rule",
		Severity:  db.IncidentSeverityCRITICAL,
		Status:    db.IncidentStatusOPEN,
	})
	t.Logf("Created incident: %s", inc.ID)

	// Step 1: Get incident (OPEN)
	req := httptest.NewRequest(http.MethodGet, "/api/incidents/"+inc.ID, nil)
	req.SetPathValue("id", inc.ID)
	rr := httptest.NewRecorder()
	server.IncidentHandler.Get(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Failed to get incident: %s", rr.Body.String())
	}

	var getResponse struct {
		Data incident.IncidentResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &getResponse)

	if getResponse.Data.Status != "OPEN" {
		t.Errorf("Expected status OPEN, got %s", getResponse.Data.Status)
	}

	// Step 2: Update to IN_PROGRESS
	updateBody := map[string]string{"status": "IN_PROGRESS"}
	bodyBytes, _ := json.Marshal(updateBody)

	req = httptest.NewRequest(http.MethodPatch, "/api/incidents/"+inc.ID, bytes.NewReader(bodyBytes))
	req.SetPathValue("id", inc.ID)
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	server.IncidentHandler.Update(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Failed to update incident: %s", rr.Body.String())
	}

	var updateResponse struct {
		Data incident.IncidentResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &updateResponse)

	if updateResponse.Data.Status != "IN_PROGRESS" {
		t.Errorf("Expected status IN_PROGRESS, got %s", updateResponse.Data.Status)
	}
	t.Logf("Updated incident to IN_PROGRESS")

	// Step 3: Close the incident
	closeBody := map[string]string{"status": "CLOSED"}
	bodyBytes, _ = json.Marshal(closeBody)

	req = httptest.NewRequest(http.MethodPatch, "/api/incidents/"+inc.ID, bytes.NewReader(bodyBytes))
	req.SetPathValue("id", inc.ID)
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	server.IncidentHandler.Update(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Failed to close incident: %s", rr.Body.String())
	}

	json.Unmarshal(rr.Body.Bytes(), &updateResponse)

	if updateResponse.Data.Status != "CLOSED" {
		t.Errorf("Expected status CLOSED, got %s", updateResponse.Data.Status)
	}
	if updateResponse.Data.ClosedAt == nil {
		t.Errorf("Expected closed_at to be set")
	}
	t.Logf("Closed incident, closed_at: %v", updateResponse.Data.ClosedAt)
}

func TestE2E_RuleCRUD(t *testing.T) {
	server, cleanup := setupE2ETest(t)
	defer cleanup()

	// Create
	createBody := map[string]any{
		"id":          "crud-rule",
		"metric_type": "ERROR_RATE",
		"threshold":   5.0,
		"operator":    ">",
		"action":      "OPEN_INCIDENT",
		"priority":    2,
		"severity":    "HIGH",
		"is_active":   true,
	}
	bodyBytes, _ := json.Marshal(createBody)

	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("Failed to create rule: %s", rr.Body.String())
	}
	t.Log("Created rule")

	// Read
	req = httptest.NewRequest(http.MethodGet, "/api/rules/crud-rule", nil)
	rr = httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Failed to get rule: %s", rr.Body.String())
	}
	t.Log("Read rule")

	// Update
	updateBody := map[string]any{
		"metric_type": "ERROR_RATE",
		"threshold":   10.0,
		"operator":    ">=",
		"action":      "OPEN_INCIDENT",
		"priority":    1,
		"severity":    "CRITICAL",
		"is_active":   false,
	}
	bodyBytes, _ = json.Marshal(updateBody)

	req = httptest.NewRequest(http.MethodPatch, "/api/rules/crud-rule", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Failed to update rule: %s", rr.Body.String())
	}
	t.Log("Updated rule")

	// Verify update
	var updateResponse struct {
		Data rule.RuleResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &updateResponse)

	if updateResponse.Data.Threshold != 10.0 {
		t.Errorf("Expected threshold 10.0, got %f", updateResponse.Data.Threshold)
	}
	if updateResponse.Data.IsActive != false {
		t.Errorf("Expected is_active false")
	}

	// Delete
	req = httptest.NewRequest(http.MethodDelete, "/api/rules/crud-rule", nil)
	rr = httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("Failed to delete rule: %s", rr.Body.String())
	}
	t.Log("Deleted rule")

	// Verify deletion
	req = httptest.NewRequest(http.MethodGet, "/api/rules/crud-rule", nil)
	rr = httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("Expected 404 after deletion, got %d", rr.Code)
	}
}

func TestE2E_ServiceAndMetrics(t *testing.T) {
	server, cleanup := setupE2ETest(t)
	defer cleanup()

	ctx := context.Background()

	// Create service
	server.Queries.CreateService(ctx, db.CreateServiceParams{
		ID:   "metrics-svc",
		Name: "Metrics Service",
	})

	// Create multiple metrics
	metricTypes := []string{"LATENCY_MS", "ERROR_RATE", "PACKET_LOSS", "BUFFER_RATIO"}
	for i, mt := range metricTypes {
		body := map[string]any{
			"service_id":  "metrics-svc",
			"metric_type": mt,
			"value":       float64(i*10 + 50),
			"timestamp":   time.Now().Format(time.RFC3339),
		}
		bodyBytes, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPost, "/api/metrics", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		server.Mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusCreated {
			t.Fatalf("Failed to create %s metric: %s", mt, rr.Body.String())
		}
	}

	// List all metrics
	req := httptest.NewRequest(http.MethodGet, "/api/metrics", nil)
	rr := httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	var response struct {
		Data []metric.MetricResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 4 {
		t.Errorf("Expected 4 metrics, got %d", len(response.Data))
	}

	// Filter by service
	req = httptest.NewRequest(http.MethodGet, "/api/metrics?service_id=metrics-svc", nil)
	rr = httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 4 {
		t.Errorf("Expected 4 metrics for metrics-svc, got %d", len(response.Data))
	}

	// Filter by non-existent service
	req = httptest.NewRequest(http.MethodGet, "/api/metrics?service_id=non-existent", nil)
	rr = httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 0 {
		t.Errorf("Expected 0 metrics for non-existent service, got %d", len(response.Data))
	}
}

func TestE2E_MultipleIncidents(t *testing.T) {
	server, cleanup := setupE2ETest(t)
	defer cleanup()

	ctx := context.Background()

	// Setup
	server.Queries.CreateService(ctx, db.CreateServiceParams{ID: "multi-svc", Name: "Multi Service"})
	testutil.TestRule(t, server.Queries, testutil.TestRuleParams{ID: "multi-rule", IsActive: true})

	// Create multiple incidents with different statuses
	for i := 0; i < 3; i++ {
		testutil.TestIncident(t, server.Queries, testutil.TestIncidentParams{
			ServiceID: "multi-svc",
			RuleID:    "multi-rule",
			Status:    db.IncidentStatusOPEN,
		})
	}
	for i := 0; i < 2; i++ {
		testutil.TestIncident(t, server.Queries, testutil.TestIncidentParams{
			ServiceID: "multi-svc",
			RuleID:    "multi-rule",
			Status:    db.IncidentStatusINPROGRESS,
		})
	}
	testutil.TestIncident(t, server.Queries, testutil.TestIncidentParams{
		ServiceID: "multi-svc",
		RuleID:    "multi-rule",
		Status:    db.IncidentStatusCLOSED,
	})

	// List all incidents
	req := httptest.NewRequest(http.MethodGet, "/api/incidents", nil)
	rr := httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	var response struct {
		Data []incident.IncidentResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 6 {
		t.Errorf("Expected 6 incidents, got %d", len(response.Data))
	}

	// Filter by OPEN status
	req = httptest.NewRequest(http.MethodGet, "/api/incidents?status=OPEN", nil)
	rr = httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 3 {
		t.Errorf("Expected 3 OPEN incidents, got %d", len(response.Data))
	}

	// Filter by IN_PROGRESS status
	req = httptest.NewRequest(http.MethodGet, "/api/incidents?status=IN_PROGRESS", nil)
	rr = httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 2 {
		t.Errorf("Expected 2 IN_PROGRESS incidents, got %d", len(response.Data))
	}
}

func TestE2E_Pagination(t *testing.T) {
	server, cleanup := setupE2ETest(t)
	defer cleanup()

	ctx := context.Background()

	// Create service and many metrics
	server.Queries.CreateService(ctx, db.CreateServiceParams{ID: "page-svc", Name: "Pagination Service"})

	for i := 0; i < 25; i++ {
		body := map[string]any{
			"service_id":  "page-svc",
			"metric_type": "LATENCY_MS",
			"value":       float64(i),
			"timestamp":   time.Now().Format(time.RFC3339),
		}
		bodyBytes, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPost, "/api/metrics", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		server.Mux.ServeHTTP(rr, req)
	}

	// First page
	req := httptest.NewRequest(http.MethodGet, "/api/metrics?limit=10&offset=0", nil)
	rr := httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	var response struct {
		Data []metric.MetricResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 10 {
		t.Errorf("Expected 10 metrics on first page, got %d", len(response.Data))
	}

	// Second page
	req = httptest.NewRequest(http.MethodGet, "/api/metrics?limit=10&offset=10", nil)
	rr = httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 10 {
		t.Errorf("Expected 10 metrics on second page, got %d", len(response.Data))
	}

	// Third page (partial)
	req = httptest.NewRequest(http.MethodGet, "/api/metrics?limit=10&offset=20", nil)
	rr = httptest.NewRecorder()
	server.Mux.ServeHTTP(rr, req)

	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 5 {
		t.Errorf("Expected 5 metrics on third page, got %d", len(response.Data))
	}
}

func TestE2E_RuleEvaluation(t *testing.T) {
	server, cleanup := setupE2ETest(t)
	defer cleanup()

	// Test all operators
	testCases := []struct {
		operator  string
		threshold float64
		value     float64
		violated  bool
	}{
		{">", 100.0, 150.0, true},
		{">", 100.0, 50.0, false},
		{">=", 100.0, 100.0, true},
		{">=", 100.0, 99.0, false},
		{"<", 100.0, 50.0, true},
		{"<", 100.0, 150.0, false},
		{"<=", 100.0, 100.0, true},
		{"<=", 100.0, 101.0, false},
		{"==", 100.0, 100.0, true},
		{"==", 100.0, 99.0, false},
		{"!=", 100.0, 99.0, true},
		{"!=", 100.0, 100.0, false},
	}

	for _, tc := range testCases {
		t.Run(tc.operator, func(t *testing.T) {
			testutil.CleanupTestData(t, server.Pool)

			// Create rule with specific operator
			ruleBody := map[string]any{
				"id":          "op-rule",
				"metric_type": "LATENCY_MS",
				"threshold":   tc.threshold,
				"operator":    tc.operator,
				"action":      "OPEN_INCIDENT",
				"severity":    "HIGH",
				"is_active":   true,
			}
			bodyBytes, _ := json.Marshal(ruleBody)

			req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()
			server.Mux.ServeHTTP(rr, req)

			if rr.Code != http.StatusCreated {
				t.Fatalf("Failed to create rule: %s", rr.Body.String())
			}

			// Get rule and evaluate
			ctx := context.Background()
			r, err := server.Queries.GetRule(ctx, "op-rule")
			if err != nil {
				t.Fatalf("Failed to get rule: %v", err)
			}

			violated := rule.Evaluate(&r, tc.value)
			if violated != tc.violated {
				t.Errorf("Operator %s with threshold %.1f and value %.1f: expected %v, got %v",
					tc.operator, tc.threshold, tc.value, tc.violated, violated)
			}
		})
	}
}
