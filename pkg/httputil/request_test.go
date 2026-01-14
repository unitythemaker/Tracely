package httputil

import (
	"bytes"
	"net/http/httptest"
	"testing"
)

func TestDecode(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		target      any
		expectError bool
		validate    func(t *testing.T, target any)
	}{
		{
			name: "valid JSON object",
			body: `{"name": "test", "value": 42}`,
			target: &struct {
				Name  string `json:"name"`
				Value int    `json:"value"`
			}{},
			expectError: false,
			validate: func(t *testing.T, target any) {
				v := target.(*struct {
					Name  string `json:"name"`
					Value int    `json:"value"`
				})
				if v.Name != "test" {
					t.Errorf("Expected name=test, got %s", v.Name)
				}
				if v.Value != 42 {
					t.Errorf("Expected value=42, got %d", v.Value)
				}
			},
		},
		{
			name:   "valid JSON array",
			body:   `[1, 2, 3]`,
			target: &[]int{},
			validate: func(t *testing.T, target any) {
				v := target.(*[]int)
				if len(*v) != 3 {
					t.Errorf("Expected 3 items, got %d", len(*v))
				}
			},
		},
		{
			name:        "invalid JSON",
			body:        `{invalid`,
			target:      &map[string]string{},
			expectError: true,
		},
		{
			name:   "empty body",
			body:   ``,
			target: &struct{}{},
			// EOF error expected
			expectError: true,
		},
		{
			name: "null value",
			body: `null`,
			target: &struct {
				Name string `json:"name"`
			}{Name: "default"},
			expectError: false,
			validate: func(t *testing.T, target any) {
				// After decoding null, the pointer target should be nil-ish or reset
			},
		},
		{
			name: "extra fields ignored",
			body: `{"name": "test", "extra": "ignored"}`,
			target: &struct {
				Name string `json:"name"`
			}{},
			expectError: false,
			validate: func(t *testing.T, target any) {
				v := target.(*struct {
					Name string `json:"name"`
				})
				if v.Name != "test" {
					t.Errorf("Expected name=test, got %s", v.Name)
				}
			},
		},
		{
			name: "nested JSON",
			body: `{"outer": {"inner": "value"}}`,
			target: &struct {
				Outer struct {
					Inner string `json:"inner"`
				} `json:"outer"`
			}{},
			expectError: false,
			validate: func(t *testing.T, target any) {
				v := target.(*struct {
					Outer struct {
						Inner string `json:"inner"`
					} `json:"outer"`
				})
				if v.Outer.Inner != "value" {
					t.Errorf("Expected inner=value, got %s", v.Outer.Inner)
				}
			},
		},
		{
			name: "float values",
			body: `{"value": 3.14159}`,
			target: &struct {
				Value float64 `json:"value"`
			}{},
			expectError: false,
			validate: func(t *testing.T, target any) {
				v := target.(*struct {
					Value float64 `json:"value"`
				})
				if v.Value != 3.14159 {
					t.Errorf("Expected value=3.14159, got %f", v.Value)
				}
			},
		},
		{
			name: "boolean values",
			body: `{"active": true}`,
			target: &struct {
				Active bool `json:"active"`
			}{},
			expectError: false,
			validate: func(t *testing.T, target any) {
				v := target.(*struct {
					Active bool `json:"active"`
				})
				if !v.Active {
					t.Errorf("Expected active=true, got false")
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/", bytes.NewBufferString(tt.body))
			err := Decode(req, tt.target)

			if tt.expectError && err == nil {
				t.Errorf("Expected error, got nil")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if !tt.expectError && tt.validate != nil {
				tt.validate(t, tt.target)
			}
		})
	}
}

func TestDecode_LargeBody(t *testing.T) {
	// Create a large JSON object
	largeValue := make([]byte, 10000)
	for i := range largeValue {
		largeValue[i] = 'a'
	}
	body := `{"data": "` + string(largeValue) + `"}`

	req := httptest.NewRequest("POST", "/", bytes.NewBufferString(body))
	target := &struct {
		Data string `json:"data"`
	}{}

	err := Decode(req, target)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}

	if len(target.Data) != 10000 {
		t.Errorf("Expected data length 10000, got %d", len(target.Data))
	}
}

func TestDecode_TypeMismatch(t *testing.T) {
	// String value for int field - should cause error
	body := `{"value": "not a number"}`
	req := httptest.NewRequest("POST", "/", bytes.NewBufferString(body))
	target := &struct {
		Value int `json:"value"`
	}{}

	err := Decode(req, target)
	if err == nil {
		t.Errorf("Expected error for type mismatch, got nil")
	}
}
