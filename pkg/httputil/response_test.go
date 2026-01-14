package httputil

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJSON(t *testing.T) {
	tests := []struct {
		name           string
		status         int
		data           any
		expectedStatus int
		validateBody   func(t *testing.T, body []byte)
	}{
		{
			name:           "success with data",
			status:         http.StatusOK,
			data:           map[string]string{"key": "value"},
			expectedStatus: http.StatusOK,
			validateBody: func(t *testing.T, body []byte) {
				var result map[string]string
				if err := json.Unmarshal(body, &result); err != nil {
					t.Fatalf("Failed to unmarshal: %v", err)
				}
				if result["key"] != "value" {
					t.Errorf("Expected key=value, got %v", result)
				}
			},
		},
		{
			name:           "nil data",
			status:         http.StatusNoContent,
			data:           nil,
			expectedStatus: http.StatusNoContent,
			validateBody: func(t *testing.T, body []byte) {
				if len(body) != 0 {
					t.Errorf("Expected empty body, got %s", string(body))
				}
			},
		},
		{
			name:           "slice data",
			status:         http.StatusOK,
			data:           []int{1, 2, 3},
			expectedStatus: http.StatusOK,
			validateBody: func(t *testing.T, body []byte) {
				var result []int
				if err := json.Unmarshal(body, &result); err != nil {
					t.Fatalf("Failed to unmarshal: %v", err)
				}
				if len(result) != 3 {
					t.Errorf("Expected 3 items, got %d", len(result))
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			JSON(rr, tt.status, tt.data)

			if rr.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, rr.Code)
			}

			contentType := rr.Header().Get("Content-Type")
			if contentType != "application/json" {
				t.Errorf("Expected Content-Type application/json, got %s", contentType)
			}

			tt.validateBody(t, rr.Body.Bytes())
		})
	}
}

func TestError(t *testing.T) {
	tests := []struct {
		name            string
		status          int
		err             string
		message         string
		expectedStatus  int
		expectedError   string
		expectedMessage string
	}{
		{
			name:            "bad request",
			status:          http.StatusBadRequest,
			err:             "bad_request",
			message:         "Invalid input",
			expectedStatus:  http.StatusBadRequest,
			expectedError:   "bad_request",
			expectedMessage: "Invalid input",
		},
		{
			name:            "internal error",
			status:          http.StatusInternalServerError,
			err:             "internal_error",
			message:         "Something went wrong",
			expectedStatus:  http.StatusInternalServerError,
			expectedError:   "internal_error",
			expectedMessage: "Something went wrong",
		},
		{
			name:            "empty message",
			status:          http.StatusNotFound,
			err:             "not_found",
			message:         "",
			expectedStatus:  http.StatusNotFound,
			expectedError:   "not_found",
			expectedMessage: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			Error(rr, tt.status, tt.err, tt.message)

			if rr.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, rr.Code)
			}

			var response ErrorResponse
			if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
				t.Fatalf("Failed to unmarshal: %v", err)
			}

			if response.Error != tt.expectedError {
				t.Errorf("Expected error %q, got %q", tt.expectedError, response.Error)
			}

			if response.Message != tt.expectedMessage {
				t.Errorf("Expected message %q, got %q", tt.expectedMessage, response.Message)
			}
		})
	}
}

func TestSuccess(t *testing.T) {
	rr := httptest.NewRecorder()
	data := map[string]string{"name": "test"}
	Success(rr, data)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var response SuccessResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	dataMap, ok := response.Data.(map[string]any)
	if !ok {
		t.Fatalf("Expected data to be map, got %T", response.Data)
	}

	if dataMap["name"] != "test" {
		t.Errorf("Expected name=test, got %v", dataMap["name"])
	}
}

func TestCreated(t *testing.T) {
	rr := httptest.NewRecorder()
	data := map[string]int{"id": 1}
	Created(rr, data)

	if rr.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d", http.StatusCreated, rr.Code)
	}

	var response SuccessResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	dataMap, ok := response.Data.(map[string]any)
	if !ok {
		t.Fatalf("Expected data to be map, got %T", response.Data)
	}

	if dataMap["id"] != float64(1) {
		t.Errorf("Expected id=1, got %v", dataMap["id"])
	}
}

func TestNoContent(t *testing.T) {
	rr := httptest.NewRecorder()
	NoContent(rr)

	if rr.Code != http.StatusNoContent {
		t.Errorf("Expected status %d, got %d", http.StatusNoContent, rr.Code)
	}

	if rr.Body.Len() != 0 {
		t.Errorf("Expected empty body, got %s", rr.Body.String())
	}
}

func TestBadRequest(t *testing.T) {
	rr := httptest.NewRecorder()
	BadRequest(rr, "invalid input")

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}

	var response ErrorResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if response.Error != "bad_request" {
		t.Errorf("Expected error bad_request, got %s", response.Error)
	}

	if response.Message != "invalid input" {
		t.Errorf("Expected message 'invalid input', got %s", response.Message)
	}
}

func TestNotFound(t *testing.T) {
	rr := httptest.NewRecorder()
	NotFound(rr, "resource not found")

	if rr.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, rr.Code)
	}

	var response ErrorResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if response.Error != "not_found" {
		t.Errorf("Expected error not_found, got %s", response.Error)
	}
}

func TestInternalError(t *testing.T) {
	rr := httptest.NewRecorder()
	InternalError(rr, "server error")

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("Expected status %d, got %d", http.StatusInternalServerError, rr.Code)
	}

	var response ErrorResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if response.Error != "internal_error" {
		t.Errorf("Expected error internal_error, got %s", response.Error)
	}
}

func TestConflict(t *testing.T) {
	rr := httptest.NewRecorder()
	Conflict(rr, "resource already exists")

	if rr.Code != http.StatusConflict {
		t.Errorf("Expected status %d, got %d", http.StatusConflict, rr.Code)
	}

	var response ErrorResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if response.Error != "conflict" {
		t.Errorf("Expected error conflict, got %s", response.Error)
	}
}

func TestSuccessResponse_EmptyMessage(t *testing.T) {
	rr := httptest.NewRecorder()
	JSON(rr, http.StatusOK, SuccessResponse{Data: "test"})

	var response map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	// Message should be omitted when empty
	if _, exists := response["message"]; exists {
		t.Errorf("Message should be omitted when empty")
	}
}
