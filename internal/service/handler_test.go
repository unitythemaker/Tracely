package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/internal/testutil"
)

func setupServiceTest(t *testing.T) (*Handler, *db.Queries, func()) {
	t.Helper()

	pool := testutil.GetTestPool(t)
	q := db.New(pool)

	// Clean up before test
	testutil.CleanupTestData(t, pool)

	repo := NewRepository(q)
	handler := NewHandler(repo)

	cleanup := func() {
		testutil.CleanupTestData(t, pool)
	}

	return handler, q, cleanup
}

func TestHandler_List(t *testing.T) {
	handler, q, cleanup := setupServiceTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create test services
	_, err := q.CreateService(ctx, db.CreateServiceParams{ID: "svc-1", Name: "Service One"})
	if err != nil {
		t.Fatalf("Failed to create service: %v", err)
	}
	_, err = q.CreateService(ctx, db.CreateServiceParams{ID: "svc-2", Name: "Service Two"})
	if err != nil {
		t.Fatalf("Failed to create service: %v", err)
	}

	// Create request
	req := httptest.NewRequest(http.MethodGet, "/api/services", nil)
	rr := httptest.NewRecorder()

	handler.List(rr, req)

	// Verify response
	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var response struct {
		Data []db.Service `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if len(response.Data) != 2 {
		t.Errorf("Expected 2 services, got %d", len(response.Data))
	}
}

func TestHandler_List_Empty(t *testing.T) {
	handler, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/services", nil)
	rr := httptest.NewRecorder()

	handler.List(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var response struct {
		Data []db.Service `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if len(response.Data) != 0 {
		t.Errorf("Expected 0 services, got %d", len(response.Data))
	}
}

func TestHandler_Get(t *testing.T) {
	handler, q, cleanup := setupServiceTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create test service
	svc, err := q.CreateService(ctx, db.CreateServiceParams{ID: "svc-test", Name: "Test Service"})
	if err != nil {
		t.Fatalf("Failed to create service: %v", err)
	}

	// Create request with path value
	req := httptest.NewRequest(http.MethodGet, "/api/services/svc-test", nil)
	req.SetPathValue("id", "svc-test")
	rr := httptest.NewRecorder()

	handler.Get(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, rr.Code, rr.Body.String())
	}

	var response struct {
		Data db.Service `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Data.ID != svc.ID {
		t.Errorf("Expected ID %s, got %s", svc.ID, response.Data.ID)
	}
	if response.Data.Name != svc.Name {
		t.Errorf("Expected Name %s, got %s", svc.Name, response.Data.Name)
	}
}

func TestHandler_Get_NotFound(t *testing.T) {
	handler, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/services/non-existent", nil)
	req.SetPathValue("id", "non-existent")
	rr := httptest.NewRecorder()

	handler.Get(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, rr.Code)
	}

	var response struct {
		Error   string `json:"error"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Error != "not_found" {
		t.Errorf("Expected error 'not_found', got %s", response.Error)
	}
}

func TestHandler_Get_MissingID(t *testing.T) {
	handler, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/services/", nil)
	// Don't set path value - simulates missing ID
	rr := httptest.NewRecorder()

	handler.Get(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestHandler_RegisterRoutes(t *testing.T) {
	handler, _, cleanup := setupServiceTest(t)
	defer cleanup()

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// Test that routes are registered
	routes := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/services"},
		{http.MethodGet, "/api/services/test-id"},
	}

	for _, route := range routes {
		req := httptest.NewRequest(route.method, route.path, nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)

		// Should not return 404 (pattern not found)
		if rr.Code == http.StatusNotFound && rr.Body.String() == "404 page not found\n" {
			t.Errorf("Route %s %s not registered", route.method, route.path)
		}
	}
}

func TestRepository_Create(t *testing.T) {
	pool := testutil.GetTestPool(t)
	q := db.New(pool)
	testutil.CleanupTestData(t, pool)
	defer testutil.CleanupTestData(t, pool)

	repo := NewRepository(q)
	ctx := context.Background()

	svc, err := repo.Create(ctx, "new-svc", "New Service")
	if err != nil {
		t.Fatalf("Failed to create service: %v", err)
	}

	if svc.ID != "new-svc" {
		t.Errorf("Expected ID 'new-svc', got %s", svc.ID)
	}
	if svc.Name != "New Service" {
		t.Errorf("Expected Name 'New Service', got %s", svc.Name)
	}
	if svc.CreatedAt.IsZero() {
		t.Errorf("Expected non-zero CreatedAt")
	}
}

func TestRepository_List(t *testing.T) {
	pool := testutil.GetTestPool(t)
	q := db.New(pool)
	testutil.CleanupTestData(t, pool)
	defer testutil.CleanupTestData(t, pool)

	repo := NewRepository(q)
	ctx := context.Background()

	// Create services
	repo.Create(ctx, "svc-a", "Service A")
	repo.Create(ctx, "svc-b", "Service B")

	services, err := repo.List(ctx)
	if err != nil {
		t.Fatalf("Failed to list services: %v", err)
	}

	if len(services) != 2 {
		t.Errorf("Expected 2 services, got %d", len(services))
	}
}

func TestRepository_Get(t *testing.T) {
	pool := testutil.GetTestPool(t)
	q := db.New(pool)
	testutil.CleanupTestData(t, pool)
	defer testutil.CleanupTestData(t, pool)

	repo := NewRepository(q)
	ctx := context.Background()

	// Create a service
	created, _ := repo.Create(ctx, "get-test", "Get Test Service")

	// Get the service
	svc, err := repo.Get(ctx, "get-test")
	if err != nil {
		t.Fatalf("Failed to get service: %v", err)
	}

	if svc.ID != created.ID {
		t.Errorf("Expected ID %s, got %s", created.ID, svc.ID)
	}
}

func TestRepository_Get_NotFound(t *testing.T) {
	pool := testutil.GetTestPool(t)
	q := db.New(pool)
	testutil.CleanupTestData(t, pool)
	defer testutil.CleanupTestData(t, pool)

	repo := NewRepository(q)
	ctx := context.Background()

	_, err := repo.Get(ctx, "non-existent")
	if err == nil {
		t.Errorf("Expected error for non-existent service")
	}
}

func TestHandler_List_WithTimeout(t *testing.T) {
	handler, q, cleanup := setupServiceTest(t)
	defer cleanup()

	ctx := context.Background()
	_, _ = q.CreateService(ctx, db.CreateServiceParams{ID: "timeout-svc", Name: "Timeout Service"})

	// Test with a context that has a timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req := httptest.NewRequest(http.MethodGet, "/api/services", nil).WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.List(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}
}
