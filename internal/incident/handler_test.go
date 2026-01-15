package incident

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/internal/testutil"
)

func setupIncidentTest(t *testing.T) (*Handler, *db.Queries, *pgxpool.Pool, func()) {
	t.Helper()

	pool := testutil.GetTestPool(t)
	q := db.New(pool)

	testutil.CleanupTestData(t, pool)

	// Create required test data (foreign keys)
	testutil.TestService(t, q, "test-service", "Test Service")
	testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:         "test-rule",
		MetricType: db.MetricTypeLATENCYMS,
		Threshold:  100.0,
		Operator:   db.RuleOperatorValue0,
		Action:     db.RuleActionOPENINCIDENT,
		Severity:   db.IncidentSeverityHIGH,
		IsActive:   true,
	})

	repo := NewRepository(pool, q)
	handler := NewHandler(repo)

	cleanup := func() {
		testutil.CleanupTestData(t, pool)
	}

	return handler, q, pool, cleanup
}

func TestIncidentHandler_List(t *testing.T) {
	handler, q, _, cleanup := setupIncidentTest(t)
	defer cleanup()

	// Create test incidents
	testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "test-service",
		RuleID:    "test-rule",
		Severity:  db.IncidentSeverityHIGH,
		Status:    db.IncidentStatusOPEN,
	})
	testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "test-service",
		RuleID:    "test-rule",
		Severity:  db.IncidentSeverityMEDIUM,
		Status:    db.IncidentStatusCLOSED,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/incidents", nil)
	rr := httptest.NewRecorder()

	handler.List(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, rr.Code, rr.Body.String())
	}

	var response struct {
		Data []IncidentResponse `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if len(response.Data) != 2 {
		t.Errorf("Expected 2 incidents, got %d", len(response.Data))
	}
}

func TestIncidentHandler_List_ByStatus(t *testing.T) {
	handler, q, _, cleanup := setupIncidentTest(t)
	defer cleanup()

	testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "test-service",
		RuleID:    "test-rule",
		Status:    db.IncidentStatusOPEN,
	})
	testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "test-service",
		RuleID:    "test-rule",
		Status:    db.IncidentStatusCLOSED,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/incidents?status=OPEN", nil)
	rr := httptest.NewRecorder()

	handler.List(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var response struct {
		Data []IncidentResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 1 {
		t.Errorf("Expected 1 open incident, got %d", len(response.Data))
	}

	if len(response.Data) > 0 && response.Data[0].Status != "OPEN" {
		t.Errorf("Expected status OPEN, got %s", response.Data[0].Status)
	}
}

func TestIncidentHandler_List_ByService(t *testing.T) {
	handler, q, _, cleanup := setupIncidentTest(t)
	defer cleanup()

	// Create another service
	testutil.TestService(t, q, "other-service", "Other Service")

	testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "test-service",
		RuleID:    "test-rule",
	})
	testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "other-service",
		RuleID:    "test-rule",
	})

	req := httptest.NewRequest(http.MethodGet, "/api/incidents?service_id=test-service", nil)
	rr := httptest.NewRecorder()

	handler.List(rr, req)

	var response struct {
		Data []IncidentResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 1 {
		t.Errorf("Expected 1 incident for test-service, got %d", len(response.Data))
	}
}

func TestIncidentHandler_Get(t *testing.T) {
	handler, q, _, cleanup := setupIncidentTest(t)
	defer cleanup()

	inc := testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "test-service",
		RuleID:    "test-rule",
		Severity:  db.IncidentSeverityCRITICAL,
		Message:   testutil.StringPtr("Test incident message"),
	})

	req := httptest.NewRequest(http.MethodGet, "/api/incidents/"+inc.ID, nil)
	req.SetPathValue("id", inc.ID)
	rr := httptest.NewRecorder()

	handler.Get(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var response struct {
		Data IncidentResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if response.Data.ID != inc.ID {
		t.Errorf("Expected ID %s, got %s", inc.ID, response.Data.ID)
	}
	if response.Data.Severity != "CRITICAL" {
		t.Errorf("Expected severity CRITICAL, got %s", response.Data.Severity)
	}
}

func TestIncidentHandler_Get_NotFound(t *testing.T) {
	handler, _, _, cleanup := setupIncidentTest(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/incidents/INC-999", nil)
	req.SetPathValue("id", "INC-999")
	rr := httptest.NewRecorder()

	handler.Get(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, rr.Code)
	}
}

func TestIncidentHandler_Get_MissingID(t *testing.T) {
	handler, _, _, cleanup := setupIncidentTest(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/incidents/", nil)
	rr := httptest.NewRecorder()

	handler.Get(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestIncidentHandler_Update_Status(t *testing.T) {
	handler, q, _, cleanup := setupIncidentTest(t)
	defer cleanup()

	inc := testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "test-service",
		RuleID:    "test-rule",
		Status:    db.IncidentStatusOPEN,
	})

	body := UpdateIncidentRequest{Status: "IN_PROGRESS"}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPatch, "/api/incidents/"+inc.ID, bytes.NewReader(bodyBytes))
	req.SetPathValue("id", inc.ID)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.Update(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, rr.Code, rr.Body.String())
	}

	var response struct {
		Data IncidentResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if response.Data.Status != "IN_PROGRESS" {
		t.Errorf("Expected status IN_PROGRESS, got %s", response.Data.Status)
	}
}

func TestIncidentHandler_Update_Close(t *testing.T) {
	handler, q, _, cleanup := setupIncidentTest(t)
	defer cleanup()

	inc := testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "test-service",
		RuleID:    "test-rule",
		Status:    db.IncidentStatusINPROGRESS,
	})

	body := UpdateIncidentRequest{Status: "CLOSED"}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPatch, "/api/incidents/"+inc.ID, bytes.NewReader(bodyBytes))
	req.SetPathValue("id", inc.ID)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.Update(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var response struct {
		Data IncidentResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if response.Data.Status != "CLOSED" {
		t.Errorf("Expected status CLOSED, got %s", response.Data.Status)
	}
	if response.Data.ClosedAt == nil {
		t.Errorf("Expected closed_at to be set")
	}
}

func TestIncidentHandler_Update_InvalidStatus(t *testing.T) {
	handler, q, _, cleanup := setupIncidentTest(t)
	defer cleanup()

	inc := testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "test-service",
		RuleID:    "test-rule",
	})

	body := UpdateIncidentRequest{Status: "INVALID"}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPatch, "/api/incidents/"+inc.ID, bytes.NewReader(bodyBytes))
	req.SetPathValue("id", inc.ID)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.Update(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestIncidentHandler_Update_InvalidJSON(t *testing.T) {
	handler, q, _, cleanup := setupIncidentTest(t)
	defer cleanup()

	inc := testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "test-service",
		RuleID:    "test-rule",
	})

	req := httptest.NewRequest(http.MethodPatch, "/api/incidents/"+inc.ID, bytes.NewReader([]byte("{invalid")))
	req.SetPathValue("id", inc.ID)
	rr := httptest.NewRecorder()

	handler.Update(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestIncidentHandler_Update_MissingID(t *testing.T) {
	handler, _, _, cleanup := setupIncidentTest(t)
	defer cleanup()

	body := UpdateIncidentRequest{Status: "CLOSED"}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPatch, "/api/incidents/", bytes.NewReader(bodyBytes))
	rr := httptest.NewRecorder()

	handler.Update(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestIncidentRepository_CreateWithOutbox(t *testing.T) {
	pool := testutil.GetTestPool(t)
	q := db.New(pool)
	testutil.CleanupTestData(t, pool)
	defer testutil.CleanupTestData(t, pool)

	// Setup required data
	testutil.TestService(t, q, "repo-service", "Repo Service")
	testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:         "repo-rule",
		MetricType: db.MetricTypeLATENCYMS,
		Threshold:  100.0,
		IsActive:   true,
	})

	// Create a metric for the foreign key constraint
	metric := testutil.TestMetric(t, q, testutil.TestMetricParams{
		ServiceID:  "repo-service",
		MetricType: db.MetricTypeLATENCYMS,
		Value:      150.0,
	})

	repo := NewRepository(pool, q)
	ctx := context.Background()

	inc, err := repo.CreateWithOutbox(ctx, "repo-service", "repo-rule", metric.ID, db.IncidentSeverityCRITICAL, "Test message", nil)
	if err != nil {
		t.Fatalf("Failed to create incident with outbox: %v", err)
	}

	if inc.ID == "" {
		t.Errorf("Expected non-empty ID")
	}
	if inc.ServiceID != "repo-service" {
		t.Errorf("Expected service_id 'repo-service', got %s", inc.ServiceID)
	}
	if inc.Status != db.IncidentStatusOPEN {
		t.Errorf("Expected status OPEN, got %s", inc.Status)
	}

	// Verify outbox event was created
	events, err := q.GetUnprocessedIncidentEvents(ctx, db.GetUnprocessedIncidentEventsParams{
		Processor: "test",
		Limit:     10,
	})
	if err != nil {
		t.Fatalf("Failed to get outbox events: %v", err)
	}

	if len(events) == 0 {
		t.Errorf("Expected outbox event to be created")
	}
}

func TestIncidentRepository_ListOpen(t *testing.T) {
	pool := testutil.GetTestPool(t)
	q := db.New(pool)
	testutil.CleanupTestData(t, pool)
	defer testutil.CleanupTestData(t, pool)

	testutil.TestService(t, q, "list-service", "List Service")
	testutil.TestRule(t, q, testutil.TestRuleParams{ID: "list-rule", IsActive: true})

	// Create open and closed incidents
	testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "list-service",
		RuleID:    "list-rule",
		Status:    db.IncidentStatusOPEN,
	})
	testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "list-service",
		RuleID:    "list-rule",
		Status:    db.IncidentStatusCLOSED,
	})

	repo := NewRepository(pool, q)
	ctx := context.Background()

	openIncidents, err := repo.ListOpen(ctx, 50, 0)
	if err != nil {
		t.Fatalf("Failed to list open incidents: %v", err)
	}

	if len(openIncidents) != 1 {
		t.Errorf("Expected 1 open incident, got %d", len(openIncidents))
	}
}

func TestIncidentRepository_CountOpen(t *testing.T) {
	pool := testutil.GetTestPool(t)
	q := db.New(pool)
	testutil.CleanupTestData(t, pool)
	defer testutil.CleanupTestData(t, pool)

	testutil.TestService(t, q, "count-service", "Count Service")
	testutil.TestRule(t, q, testutil.TestRuleParams{ID: "count-rule", IsActive: true})

	// Create open incidents
	testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "count-service",
		RuleID:    "count-rule",
		Status:    db.IncidentStatusOPEN,
	})
	testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "count-service",
		RuleID:    "count-rule",
		Status:    db.IncidentStatusOPEN,
	})
	testutil.TestIncident(t, q, testutil.TestIncidentParams{
		ServiceID: "count-service",
		RuleID:    "count-rule",
		Status:    db.IncidentStatusCLOSED,
	})

	repo := NewRepository(pool, q)
	ctx := context.Background()

	count, err := repo.CountOpen(ctx)
	if err != nil {
		t.Fatalf("Failed to count open incidents: %v", err)
	}

	if count != 2 {
		t.Errorf("Expected 2 open incidents, got %d", count)
	}
}

func TestIncidentModel_ToResponse(t *testing.T) {
	now := time.Now()
	message := "Test message"

	inc := &db.Incident{
		ID:        "INC-001",
		ServiceID: "test-svc",
		RuleID:    "test-rule",
		MetricID:  uuid.New(),
		Severity:  db.IncidentSeverityCRITICAL,
		Status:    db.IncidentStatusOPEN,
		Message:   &message,
		OpenedAt:  now,
		CreatedAt: now,
		UpdatedAt: now,
	}

	response := ToResponse(inc)

	if response.ID != "INC-001" {
		t.Errorf("Expected ID INC-001, got %s", response.ID)
	}
	if response.Severity != "CRITICAL" {
		t.Errorf("Expected severity CRITICAL, got %s", response.Severity)
	}
	if response.Status != "OPEN" {
		t.Errorf("Expected status OPEN, got %s", response.Status)
	}
	if response.ClosedAt != nil {
		t.Errorf("Expected closed_at to be nil")
	}
}

func TestIncidentHandler_RegisterRoutes(t *testing.T) {
	handler, _, _, cleanup := setupIncidentTest(t)
	defer cleanup()

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	routes := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/incidents"},
		{http.MethodGet, "/api/incidents/INC-001"},
		{http.MethodPatch, "/api/incidents/INC-001"},
	}

	for _, route := range routes {
		req := httptest.NewRequest(route.method, route.path, nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		if rr.Code == http.StatusNotFound && rr.Body.String() == "404 page not found\n" {
			t.Errorf("Route %s %s not registered", route.method, route.path)
		}
	}
}
