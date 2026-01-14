package metric

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
	"github.com/unitythemaker/tracely/internal/testutil"
)

func setupMetricTest(t *testing.T) (*Handler, *db.Queries, *pgxpool.Pool, func()) {
	t.Helper()

	pool := testutil.GetTestPool(t)
	q := db.New(pool)

	testutil.CleanupTestData(t, pool)

	// Create test service first (foreign key)
	testutil.TestService(t, q, "test-service", "Test Service")

	repo := NewRepository(pool, q)
	handler := NewHandler(repo)

	cleanup := func() {
		testutil.CleanupTestData(t, pool)
	}

	return handler, q, pool, cleanup
}

func TestMetricHandler_List(t *testing.T) {
	handler, q, _, cleanup := setupMetricTest(t)
	defer cleanup()

	// Create test metrics
	testutil.TestMetric(t, q, testutil.TestMetricParams{
		ServiceID:  "test-service",
		MetricType: db.MetricTypeLATENCYMS,
		Value:      100.5,
	})
	testutil.TestMetric(t, q, testutil.TestMetricParams{
		ServiceID:  "test-service",
		MetricType: db.MetricTypeERRORRATE,
		Value:      0.5,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/metrics", nil)
	rr := httptest.NewRecorder()

	handler.List(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, rr.Code, rr.Body.String())
	}

	var response struct {
		Data []MetricResponse `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if len(response.Data) != 2 {
		t.Errorf("Expected 2 metrics, got %d", len(response.Data))
	}
}

func TestMetricHandler_List_ByService(t *testing.T) {
	handler, q, pool, cleanup := setupMetricTest(t)
	defer cleanup()

	// Create another service
	testutil.TestService(t, q, "other-service", "Other Service")

	// Create metrics for different services
	testutil.TestMetric(t, q, testutil.TestMetricParams{
		ServiceID:  "test-service",
		MetricType: db.MetricTypeLATENCYMS,
		Value:      100.0,
	})
	testutil.TestMetric(t, q, testutil.TestMetricParams{
		ServiceID:  "other-service",
		MetricType: db.MetricTypeLATENCYMS,
		Value:      200.0,
	})

	_ = pool // unused but passed for cleanup

	req := httptest.NewRequest(http.MethodGet, "/api/metrics?service_id=test-service", nil)
	rr := httptest.NewRecorder()

	handler.List(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var response struct {
		Data []MetricResponse `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if len(response.Data) != 1 {
		t.Errorf("Expected 1 metric for test-service, got %d", len(response.Data))
	}

	if len(response.Data) > 0 && response.Data[0].ServiceID != "test-service" {
		t.Errorf("Expected service_id 'test-service', got %s", response.Data[0].ServiceID)
	}
}

func TestMetricHandler_List_Pagination(t *testing.T) {
	handler, q, _, cleanup := setupMetricTest(t)
	defer cleanup()

	// Create multiple metrics
	for i := 0; i < 10; i++ {
		testutil.TestMetric(t, q, testutil.TestMetricParams{
			ServiceID:  "test-service",
			MetricType: db.MetricTypeLATENCYMS,
			Value:      float64(i * 10),
		})
	}

	// Test limit
	req := httptest.NewRequest(http.MethodGet, "/api/metrics?limit=5", nil)
	rr := httptest.NewRecorder()
	handler.List(rr, req)

	var response struct {
		Data []MetricResponse `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 5 {
		t.Errorf("Expected 5 metrics with limit=5, got %d", len(response.Data))
	}

	// Test offset
	req = httptest.NewRequest(http.MethodGet, "/api/metrics?limit=5&offset=5", nil)
	rr = httptest.NewRecorder()
	handler.List(rr, req)

	json.Unmarshal(rr.Body.Bytes(), &response)

	if len(response.Data) != 5 {
		t.Errorf("Expected 5 metrics with offset=5, got %d", len(response.Data))
	}
}

func TestMetricHandler_Create(t *testing.T) {
	handler, _, _, cleanup := setupMetricTest(t)
	defer cleanup()

	body := CreateMetricRequest{
		ServiceID:  "test-service",
		MetricType: "LATENCY_MS",
		Value:      150.5,
		RecordedAt: time.Now(),
	}

	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/metrics", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.Create(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, rr.Code, rr.Body.String())
	}

	var response struct {
		Data MetricResponse `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Data.ServiceID != "test-service" {
		t.Errorf("Expected service_id 'test-service', got %s", response.Data.ServiceID)
	}
	if response.Data.MetricType != "LATENCY_MS" {
		t.Errorf("Expected metric_type 'LATENCY_MS', got %s", response.Data.MetricType)
	}
}

func TestMetricHandler_Create_MissingServiceID(t *testing.T) {
	handler, _, _, cleanup := setupMetricTest(t)
	defer cleanup()

	body := map[string]any{
		"metric_type": "LATENCY_MS",
		"value":       100.0,
	}

	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/metrics", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.Create(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestMetricHandler_Create_MissingMetricType(t *testing.T) {
	handler, _, _, cleanup := setupMetricTest(t)
	defer cleanup()

	body := map[string]any{
		"service_id": "test-service",
		"value":      100.0,
	}

	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/metrics", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.Create(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestMetricHandler_Create_InvalidMetricType(t *testing.T) {
	handler, _, _, cleanup := setupMetricTest(t)
	defer cleanup()

	body := map[string]any{
		"service_id":  "test-service",
		"metric_type": "INVALID_TYPE",
		"value":       100.0,
	}

	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/metrics", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.Create(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestMetricHandler_Create_InvalidJSON(t *testing.T) {
	handler, _, _, cleanup := setupMetricTest(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodPost, "/api/metrics", bytes.NewReader([]byte("{invalid")))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.Create(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestMetricHandler_Create_AllMetricTypes(t *testing.T) {
	handler, _, _, cleanup := setupMetricTest(t)
	defer cleanup()

	metricTypes := []string{"LATENCY_MS", "PACKET_LOSS", "ERROR_RATE", "BUFFER_RATIO"}

	for _, mt := range metricTypes {
		t.Run(mt, func(t *testing.T) {
			body := CreateMetricRequest{
				ServiceID:  "test-service",
				MetricType: mt,
				Value:      50.0,
				RecordedAt: time.Now(),
			}

			bodyBytes, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPost, "/api/metrics", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			handler.Create(rr, req)

			if rr.Code != http.StatusCreated {
				t.Errorf("Expected status %d for %s, got %d", http.StatusCreated, mt, rr.Code)
			}
		})
	}
}

func TestMetricHandler_RegisterRoutes(t *testing.T) {
	handler, _, _, cleanup := setupMetricTest(t)
	defer cleanup()

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// Verify routes are registered
	req := httptest.NewRequest(http.MethodGet, "/api/metrics", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code == http.StatusNotFound && rr.Body.String() == "404 page not found\n" {
		t.Errorf("GET /api/metrics route not registered")
	}
}

func TestMetricRepository_List(t *testing.T) {
	pool := testutil.GetTestPool(t)
	q := db.New(pool)
	testutil.CleanupTestData(t, pool)
	defer testutil.CleanupTestData(t, pool)

	// Create service
	testutil.TestService(t, q, "repo-test-service", "Repo Test Service")

	repo := NewRepository(pool, q)
	ctx := context.Background()

	// Create metrics
	testutil.TestMetric(t, q, testutil.TestMetricParams{
		ServiceID:  "repo-test-service",
		MetricType: db.MetricTypeLATENCYMS,
		Value:      100.0,
	})

	metrics, err := repo.List(ctx, 50, 0)
	if err != nil {
		t.Fatalf("Failed to list metrics: %v", err)
	}

	if len(metrics) != 1 {
		t.Errorf("Expected 1 metric, got %d", len(metrics))
	}
}

func TestMetricModel_ToResponse(t *testing.T) {
	metric := db.Metric{
		ServiceID:  "test-svc",
		MetricType: db.MetricTypeLATENCYMS,
		RecordedAt: time.Now(),
		CreatedAt:  time.Now(),
	}

	response := ToResponse(&metric)

	if response.ServiceID != "test-svc" {
		t.Errorf("Expected service_id 'test-svc', got %s", response.ServiceID)
	}
	if response.MetricType != "LATENCY_MS" {
		t.Errorf("Expected metric_type 'LATENCY_MS', got %s", response.MetricType)
	}
}

func TestMetricModel_ToResponseList(t *testing.T) {
	metrics := []db.Metric{
		{ServiceID: "svc-1", MetricType: db.MetricTypeLATENCYMS},
		{ServiceID: "svc-2", MetricType: db.MetricTypeERRORRATE},
	}

	responses := ToResponseList(metrics)

	if len(responses) != 2 {
		t.Errorf("Expected 2 responses, got %d", len(responses))
	}
}
