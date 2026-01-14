package testutil

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// HTTPTestCase represents a test case for HTTP handlers
type HTTPTestCase struct {
	Name           string
	Method         string
	Path           string
	Body           any
	ExpectedStatus int
	ExpectedBody   map[string]any
	Setup          func(t *testing.T)
	Validate       func(t *testing.T, resp *http.Response, body []byte)
}

// MakeRequest creates an HTTP request for testing
func MakeRequest(t *testing.T, method, path string, body any) *http.Request {
	t.Helper()

	var bodyReader io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("Failed to marshal request body: %v", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req := httptest.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	return req
}

// ExecuteRequest executes an HTTP request against a handler
func ExecuteRequest(t *testing.T, handler http.Handler, req *http.Request) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	var responseBody map[string]any
	if rr.Body.Len() > 0 {
		if err := json.Unmarshal(rr.Body.Bytes(), &responseBody); err != nil {
			t.Logf("Response body is not JSON: %s", rr.Body.String())
		}
	}

	return rr, responseBody
}

// AssertStatus checks if the response status matches expected
func AssertStatus(t *testing.T, rr *httptest.ResponseRecorder, expected int) {
	t.Helper()

	if rr.Code != expected {
		t.Errorf("Expected status %d, got %d. Body: %s", expected, rr.Code, rr.Body.String())
	}
}

// AssertJSONResponse checks if the response contains expected JSON fields
func AssertJSONResponse(t *testing.T, body map[string]any, expected map[string]any) {
	t.Helper()

	for key, expectedValue := range expected {
		actualValue, ok := body[key]
		if !ok {
			t.Errorf("Expected key %q in response, but not found", key)
			continue
		}
		if actualValue != expectedValue {
			t.Errorf("Expected %q to be %v, got %v", key, expectedValue, actualValue)
		}
	}
}

// AssertDataField checks if the response has a data field with expected content
func AssertDataField(t *testing.T, body map[string]any, key string, expected any) {
	t.Helper()

	data, ok := body["data"]
	if !ok {
		t.Errorf("Expected 'data' field in response")
		return
	}

	dataMap, ok := data.(map[string]any)
	if !ok {
		// Could be a slice
		if _, isSlice := data.([]any); isSlice {
			return // Slice validation done separately
		}
		t.Errorf("Expected 'data' to be a map or slice, got %T", data)
		return
	}

	actualValue, ok := dataMap[key]
	if !ok {
		t.Errorf("Expected key %q in data, but not found", key)
		return
	}

	if actualValue != expected {
		t.Errorf("Expected data.%s to be %v, got %v", key, expected, actualValue)
	}
}

// AssertErrorResponse checks if the response is an error with expected message
func AssertErrorResponse(t *testing.T, body map[string]any, expectedError, expectedMessage string) {
	t.Helper()

	errorValue, ok := body["error"]
	if !ok {
		t.Errorf("Expected 'error' field in response")
		return
	}

	if errorValue != expectedError {
		t.Errorf("Expected error %q, got %q", expectedError, errorValue)
	}

	if expectedMessage != "" {
		message, ok := body["message"]
		if !ok {
			t.Errorf("Expected 'message' field in response")
			return
		}
		if message != expectedMessage {
			t.Errorf("Expected message %q, got %q", expectedMessage, message)
		}
	}
}

// ParseJSONResponse parses a JSON response into a map
func ParseJSONResponse(t *testing.T, body []byte) map[string]any {
	t.Helper()

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}
	return result
}

// GetDataSlice extracts the data slice from response
func GetDataSlice(t *testing.T, body map[string]any) []any {
	t.Helper()

	data, ok := body["data"]
	if !ok {
		t.Fatalf("Expected 'data' field in response")
	}

	slice, ok := data.([]any)
	if !ok {
		t.Fatalf("Expected 'data' to be a slice, got %T", data)
	}

	return slice
}
