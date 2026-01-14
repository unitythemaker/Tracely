package rule

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/internal/testutil"
)

func setupRuleTest(t *testing.T) (*Handler, *db.Queries, func()) {
	t.Helper()

	pool := testutil.GetTestPool(t)
	q := db.New(pool)

	testutil.CleanupTestData(t, pool)

	repo := NewRepository(q)
	handler := NewHandler(repo)

	cleanup := func() {
		testutil.CleanupTestData(t, pool)
	}

	return handler, q, cleanup
}

func TestRuleHandler_List(t *testing.T) {
	handler, q, cleanup := setupRuleTest(t)
	defer cleanup()

	// Create test rules
	testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:         "rule-1",
		MetricType: db.MetricTypeLATENCYMS,
		Threshold:  100.0,
		Operator:   db.RuleOperatorValue0,
		IsActive:   true,
	})
	testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:         "rule-2",
		MetricType: db.MetricTypeERRORRATE,
		Threshold:  5.0,
		Operator:   db.RuleOperatorValue0,
		IsActive:   false,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/rules", nil)
	rr := httptest.NewRecorder()

	handler.List(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, rr.Code, rr.Body.String())
	}

	var response struct {
		Data []RuleResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 2 {
		t.Errorf("Expected 2 rules, got %d", len(response.Data))
	}
}

func TestRuleHandler_Get(t *testing.T) {
	handler, q, cleanup := setupRuleTest(t)
	defer cleanup()

	rule := testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:         "get-rule",
		MetricType: db.MetricTypeLATENCYMS,
		Threshold:  150.0,
		Operator:   db.RuleOperatorValue1,
		Severity:   db.IncidentSeverityCRITICAL,
		IsActive:   true,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/rules/get-rule", nil)
	req.SetPathValue("id", "get-rule")
	rr := httptest.NewRecorder()

	handler.Get(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var response struct {
		Data RuleResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if response.Data.ID != rule.ID {
		t.Errorf("Expected ID %s, got %s", rule.ID, response.Data.ID)
	}
	if response.Data.Threshold != 150.0 {
		t.Errorf("Expected threshold 150.0, got %f", response.Data.Threshold)
	}
}

func TestRuleHandler_Get_NotFound(t *testing.T) {
	handler, _, cleanup := setupRuleTest(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/rules/non-existent", nil)
	req.SetPathValue("id", "non-existent")
	rr := httptest.NewRecorder()

	handler.Get(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, rr.Code)
	}
}

func TestRuleHandler_Get_MissingID(t *testing.T) {
	handler, _, cleanup := setupRuleTest(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/rules/", nil)
	rr := httptest.NewRecorder()

	handler.Get(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestRuleHandler_Create(t *testing.T) {
	handler, _, cleanup := setupRuleTest(t)
	defer cleanup()

	body := CreateRuleRequest{
		ID:         "new-rule",
		MetricType: "LATENCY_MS",
		Threshold:  200.0,
		Operator:   ">",
		Action:     "OPEN_INCIDENT",
		Priority:   1,
		Severity:   "HIGH",
		IsActive:   true,
	}

	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.Create(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, rr.Code, rr.Body.String())
	}

	var response struct {
		Data RuleResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if response.Data.ID != "new-rule" {
		t.Errorf("Expected ID 'new-rule', got %s", response.Data.ID)
	}
	if response.Data.Threshold != 200.0 {
		t.Errorf("Expected threshold 200.0, got %f", response.Data.Threshold)
	}
}

func TestRuleHandler_Create_MissingID(t *testing.T) {
	handler, _, cleanup := setupRuleTest(t)
	defer cleanup()

	body := map[string]any{
		"metric_type": "LATENCY_MS",
		"threshold":   100.0,
		"operator":    ">",
		"action":      "OPEN_INCIDENT",
	}

	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewReader(bodyBytes))
	rr := httptest.NewRecorder()

	handler.Create(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestRuleHandler_Create_MissingMetricType(t *testing.T) {
	handler, _, cleanup := setupRuleTest(t)
	defer cleanup()

	body := map[string]any{
		"id":        "test-rule",
		"threshold": 100.0,
		"operator":  ">",
	}

	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewReader(bodyBytes))
	rr := httptest.NewRecorder()

	handler.Create(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestRuleHandler_Create_Duplicate(t *testing.T) {
	handler, q, cleanup := setupRuleTest(t)
	defer cleanup()

	// Create existing rule
	testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:         "existing-rule",
		MetricType: db.MetricTypeLATENCYMS,
		Threshold:  100.0,
		IsActive:   true,
	})

	body := CreateRuleRequest{
		ID:         "existing-rule",
		MetricType: "LATENCY_MS",
		Threshold:  200.0,
		Operator:   ">",
		Action:     "OPEN_INCIDENT",
		Severity:   "HIGH",
		IsActive:   true,
	}

	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewReader(bodyBytes))
	rr := httptest.NewRecorder()

	handler.Create(rr, req)

	if rr.Code != http.StatusConflict {
		t.Errorf("Expected status %d, got %d", http.StatusConflict, rr.Code)
	}
}

func TestRuleHandler_Create_InvalidJSON(t *testing.T) {
	handler, _, cleanup := setupRuleTest(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewReader([]byte("{invalid")))
	rr := httptest.NewRecorder()

	handler.Create(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestRuleHandler_Update(t *testing.T) {
	handler, q, cleanup := setupRuleTest(t)
	defer cleanup()

	testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:         "update-rule",
		MetricType: db.MetricTypeLATENCYMS,
		Threshold:  100.0,
		Operator:   db.RuleOperatorValue0,
		Action:     db.RuleActionOPENINCIDENT,
		Severity:   db.IncidentSeverityMEDIUM,
		IsActive:   true,
	})

	body := UpdateRuleRequest{
		MetricType: "LATENCY_MS",
		Threshold:  250.0,
		Operator:   ">=",
		Action:     "OPEN_INCIDENT",
		Priority:   2,
		Severity:   "CRITICAL",
		IsActive:   false,
	}

	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPatch, "/api/rules/update-rule", bytes.NewReader(bodyBytes))
	req.SetPathValue("id", "update-rule")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.Update(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, rr.Code, rr.Body.String())
	}

	var response struct {
		Data RuleResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if response.Data.Threshold != 250.0 {
		t.Errorf("Expected threshold 250.0, got %f", response.Data.Threshold)
	}
	if response.Data.Severity != "CRITICAL" {
		t.Errorf("Expected severity CRITICAL, got %s", response.Data.Severity)
	}
	if response.Data.IsActive != false {
		t.Errorf("Expected is_active false, got true")
	}
}

func TestRuleHandler_Update_MissingID(t *testing.T) {
	handler, _, cleanup := setupRuleTest(t)
	defer cleanup()

	body := UpdateRuleRequest{Threshold: 100.0}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPatch, "/api/rules/", bytes.NewReader(bodyBytes))
	rr := httptest.NewRecorder()

	handler.Update(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestRuleHandler_Update_InvalidJSON(t *testing.T) {
	handler, q, cleanup := setupRuleTest(t)
	defer cleanup()

	testutil.TestRule(t, q, testutil.TestRuleParams{ID: "json-rule", IsActive: true})

	req := httptest.NewRequest(http.MethodPatch, "/api/rules/json-rule", bytes.NewReader([]byte("{invalid")))
	req.SetPathValue("id", "json-rule")
	rr := httptest.NewRecorder()

	handler.Update(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestRuleHandler_Delete(t *testing.T) {
	handler, q, cleanup := setupRuleTest(t)
	defer cleanup()

	testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:       "delete-rule",
		IsActive: true,
	})

	req := httptest.NewRequest(http.MethodDelete, "/api/rules/delete-rule", nil)
	req.SetPathValue("id", "delete-rule")
	rr := httptest.NewRecorder()

	handler.Delete(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Errorf("Expected status %d, got %d", http.StatusNoContent, rr.Code)
	}

	// Verify deletion
	ctx := context.Background()
	_, err := q.GetRule(ctx, "delete-rule")
	if err == nil {
		t.Errorf("Expected rule to be deleted")
	}
}

func TestRuleHandler_Delete_NotFound(t *testing.T) {
	handler, _, cleanup := setupRuleTest(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodDelete, "/api/rules/non-existent", nil)
	req.SetPathValue("id", "non-existent")
	rr := httptest.NewRecorder()

	handler.Delete(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, rr.Code)
	}
}

func TestRuleHandler_Delete_MissingID(t *testing.T) {
	handler, _, cleanup := setupRuleTest(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodDelete, "/api/rules/", nil)
	rr := httptest.NewRecorder()

	handler.Delete(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestRuleRepository_ListActive(t *testing.T) {
	pool := testutil.GetTestPool(t)
	q := db.New(pool)
	testutil.CleanupTestData(t, pool)
	defer testutil.CleanupTestData(t, pool)

	// Create active and inactive rules
	testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:       "active-rule",
		IsActive: true,
	})
	testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:       "inactive-rule",
		IsActive: false,
	})

	repo := NewRepository(q)
	ctx := context.Background()

	activeRules, err := repo.ListActive(ctx)
	if err != nil {
		t.Fatalf("Failed to list active rules: %v", err)
	}

	if len(activeRules) != 1 {
		t.Errorf("Expected 1 active rule, got %d", len(activeRules))
	}
}

func TestRuleRepository_ListActiveByMetricType(t *testing.T) {
	pool := testutil.GetTestPool(t)
	q := db.New(pool)
	testutil.CleanupTestData(t, pool)
	defer testutil.CleanupTestData(t, pool)

	// Create rules for different metric types
	testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:         "latency-rule",
		MetricType: db.MetricTypeLATENCYMS,
		IsActive:   true,
	})
	testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:         "error-rule",
		MetricType: db.MetricTypeERRORRATE,
		IsActive:   true,
	})

	repo := NewRepository(q)
	ctx := context.Background()

	latencyRules, err := repo.ListActiveByMetricType(ctx, db.MetricTypeLATENCYMS)
	if err != nil {
		t.Fatalf("Failed to list rules by metric type: %v", err)
	}

	if len(latencyRules) != 1 {
		t.Errorf("Expected 1 latency rule, got %d", len(latencyRules))
	}
}

func TestRuleRepository_SetActive(t *testing.T) {
	pool := testutil.GetTestPool(t)
	q := db.New(pool)
	testutil.CleanupTestData(t, pool)
	defer testutil.CleanupTestData(t, pool)

	testutil.TestRule(t, q, testutil.TestRuleParams{
		ID:       "toggle-rule",
		IsActive: true,
	})

	repo := NewRepository(q)
	ctx := context.Background()

	// Deactivate
	rule, err := repo.SetActive(ctx, "toggle-rule", false)
	if err != nil {
		t.Fatalf("Failed to set active: %v", err)
	}

	if rule.IsActive != false {
		t.Errorf("Expected is_active false, got true")
	}

	// Reactivate
	rule, err = repo.SetActive(ctx, "toggle-rule", true)
	if err != nil {
		t.Fatalf("Failed to set active: %v", err)
	}

	if rule.IsActive != true {
		t.Errorf("Expected is_active true, got false")
	}
}

func TestRuleHandler_RegisterRoutes(t *testing.T) {
	handler, _, cleanup := setupRuleTest(t)
	defer cleanup()

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	routes := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/rules"},
		{http.MethodGet, "/api/rules/test"},
		{http.MethodPost, "/api/rules"},
		{http.MethodPatch, "/api/rules/test"},
		{http.MethodDelete, "/api/rules/test"},
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

func TestRuleModel_ToResponse(t *testing.T) {
	rule := &db.QualityRule{
		ID:         "test-rule",
		MetricType: db.MetricTypeLATENCYMS,
		Operator:   db.RuleOperatorValue0,
		Action:     db.RuleActionOPENINCIDENT,
		Priority:   1,
		Severity:   db.IncidentSeverityHIGH,
		IsActive:   true,
	}

	response := ToResponse(rule)

	if response.ID != "test-rule" {
		t.Errorf("Expected ID 'test-rule', got %s", response.ID)
	}
	if response.MetricType != "LATENCY_MS" {
		t.Errorf("Expected metric_type LATENCY_MS, got %s", response.MetricType)
	}
	if response.Operator != ">" {
		t.Errorf("Expected operator '>', got %s", response.Operator)
	}
}
