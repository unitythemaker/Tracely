package pgutil

import (
	"math"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestNumericToFloat64(t *testing.T) {
	tests := []struct {
		name     string
		input    pgtype.Numeric
		expected float64
	}{
		{
			name:     "valid positive integer",
			input:    Float64ToNumeric(100.0),
			expected: 100.0,
		},
		{
			name:     "valid decimal",
			input:    Float64ToNumeric(99.99),
			expected: 99.99,
		},
		{
			name:     "zero",
			input:    Float64ToNumeric(0.0),
			expected: 0.0,
		},
		{
			name:     "negative value",
			input:    Float64ToNumeric(-50.5),
			expected: -50.5,
		},
		{
			name:     "invalid numeric",
			input:    pgtype.Numeric{Valid: false},
			expected: 0.0,
		},
		{
			name:     "small decimal",
			input:    Float64ToNumeric(0.01),
			expected: 0.01,
		},
		{
			name:     "large number",
			input:    Float64ToNumeric(999999.99),
			expected: 999999.99,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := NumericToFloat64(tt.input)
			if math.Abs(result-tt.expected) > 0.001 {
				t.Errorf("Expected %f, got %f", tt.expected, result)
			}
		})
	}
}

func TestFloat64ToNumeric(t *testing.T) {
	tests := []struct {
		name     string
		input    float64
		expected float64
	}{
		{
			name:     "positive integer",
			input:    100.0,
			expected: 100.0,
		},
		{
			name:     "decimal value",
			input:    99.99,
			expected: 99.99,
		},
		{
			name:     "zero",
			input:    0.0,
			expected: 0.0,
		},
		{
			name:     "negative value",
			input:    -50.5,
			expected: -50.5,
		},
		{
			name:     "small decimal",
			input:    0.01,
			expected: 0.01,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			numeric := Float64ToNumeric(tt.input)

			if !numeric.Valid {
				t.Errorf("Expected Valid=true, got false")
			}

			// Convert back and verify
			result := NumericToFloat64(numeric)
			if math.Abs(result-tt.expected) > 0.001 {
				t.Errorf("Round trip failed: input %f, got %f", tt.input, result)
			}
		})
	}
}

func TestFloat64ToNumeric_Structure(t *testing.T) {
	numeric := Float64ToNumeric(123.45)

	if !numeric.Valid {
		t.Errorf("Expected Valid=true")
	}

	if numeric.Exp != -2 {
		t.Errorf("Expected Exp=-2, got %d", numeric.Exp)
	}

	if numeric.Int == nil {
		t.Errorf("Expected Int to be non-nil")
	}
}

func TestRoundTrip(t *testing.T) {
	// Test round-trip conversion
	values := []float64{0.0, 1.0, 99.99, 100.5, -25.25, 999.99}

	for _, v := range values {
		t.Run("", func(t *testing.T) {
			numeric := Float64ToNumeric(v)
			result := NumericToFloat64(numeric)

			if math.Abs(result-v) > 0.01 {
				t.Errorf("Round trip failed for %f: got %f", v, result)
			}
		})
	}
}

func TestNumericToFloat64_EdgeCases(t *testing.T) {
	// Test with zero value struct
	var zeroNumeric pgtype.Numeric
	result := NumericToFloat64(zeroNumeric)
	if result != 0.0 {
		t.Errorf("Expected 0.0 for zero-value Numeric, got %f", result)
	}
}

func BenchmarkFloat64ToNumeric(b *testing.B) {
	for i := 0; i < b.N; i++ {
		Float64ToNumeric(99.99)
	}
}

func BenchmarkNumericToFloat64(b *testing.B) {
	n := Float64ToNumeric(99.99)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		NumericToFloat64(n)
	}
}
