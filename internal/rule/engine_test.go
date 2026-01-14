package rule

import (
	"testing"

	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/pkg/pgutil"
)

func TestEvaluate(t *testing.T) {
	tests := []struct {
		name      string
		operator  db.RuleOperator
		threshold float64
		value     float64
		expected  bool
	}{
		// Greater than operator (>)
		{
			name:      "greater than - value above threshold",
			operator:  db.RuleOperatorValue0,
			threshold: 100.0,
			value:     150.0,
			expected:  true,
		},
		{
			name:      "greater than - value equals threshold",
			operator:  db.RuleOperatorValue0,
			threshold: 100.0,
			value:     100.0,
			expected:  false,
		},
		{
			name:      "greater than - value below threshold",
			operator:  db.RuleOperatorValue0,
			threshold: 100.0,
			value:     50.0,
			expected:  false,
		},

		// Greater than or equal operator (>=)
		{
			name:      "greater than or equal - value above threshold",
			operator:  db.RuleOperatorValue1,
			threshold: 100.0,
			value:     150.0,
			expected:  true,
		},
		{
			name:      "greater than or equal - value equals threshold",
			operator:  db.RuleOperatorValue1,
			threshold: 100.0,
			value:     100.0,
			expected:  true,
		},
		{
			name:      "greater than or equal - value below threshold",
			operator:  db.RuleOperatorValue1,
			threshold: 100.0,
			value:     50.0,
			expected:  false,
		},

		// Less than operator (<)
		{
			name:      "less than - value above threshold",
			operator:  db.RuleOperatorValue2,
			threshold: 100.0,
			value:     150.0,
			expected:  false,
		},
		{
			name:      "less than - value equals threshold",
			operator:  db.RuleOperatorValue2,
			threshold: 100.0,
			value:     100.0,
			expected:  false,
		},
		{
			name:      "less than - value below threshold",
			operator:  db.RuleOperatorValue2,
			threshold: 100.0,
			value:     50.0,
			expected:  true,
		},

		// Less than or equal operator (<=)
		{
			name:      "less than or equal - value above threshold",
			operator:  db.RuleOperatorValue3,
			threshold: 100.0,
			value:     150.0,
			expected:  false,
		},
		{
			name:      "less than or equal - value equals threshold",
			operator:  db.RuleOperatorValue3,
			threshold: 100.0,
			value:     100.0,
			expected:  true,
		},
		{
			name:      "less than or equal - value below threshold",
			operator:  db.RuleOperatorValue3,
			threshold: 100.0,
			value:     50.0,
			expected:  true,
		},

		// Equal operator (==)
		{
			name:      "equal - value equals threshold",
			operator:  db.RuleOperatorValue4,
			threshold: 100.0,
			value:     100.0,
			expected:  true,
		},
		{
			name:      "equal - value not equals threshold",
			operator:  db.RuleOperatorValue4,
			threshold: 100.0,
			value:     99.0,
			expected:  false,
		},

		// Not equal operator (!=)
		{
			name:      "not equal - value equals threshold",
			operator:  db.RuleOperatorValue5,
			threshold: 100.0,
			value:     100.0,
			expected:  false,
		},
		{
			name:      "not equal - value not equals threshold",
			operator:  db.RuleOperatorValue5,
			threshold: 100.0,
			value:     99.0,
			expected:  true,
		},

		// Edge cases
		{
			name:      "zero threshold - greater than",
			operator:  db.RuleOperatorValue0,
			threshold: 0.0,
			value:     0.01,
			expected:  true,
		},
		{
			name:      "zero value - less than",
			operator:  db.RuleOperatorValue2,
			threshold: 0.01,
			value:     0.0,
			expected:  true,
		},
		{
			name:      "negative values - greater than",
			operator:  db.RuleOperatorValue0,
			threshold: -100.0,
			value:     -50.0,
			expected:  true,
		},
		{
			name:      "large values - greater than",
			operator:  db.RuleOperatorValue0,
			threshold: 999999.99,
			value:     1000000.0,
			expected:  true,
		},
		{
			name:      "decimal precision - equal",
			operator:  db.RuleOperatorValue4,
			threshold: 99.99,
			value:     99.99,
			expected:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := &db.QualityRule{
				Operator:  tt.operator,
				Threshold: pgutil.Float64ToNumeric(tt.threshold),
			}

			result := Evaluate(rule, tt.value)
			if result != tt.expected {
				t.Errorf("Evaluate() = %v, want %v (operator: %s, threshold: %v, value: %v)",
					result, tt.expected, tt.operator, tt.threshold, tt.value)
			}
		})
	}
}

func TestEvaluate_InvalidOperator(t *testing.T) {
	rule := &db.QualityRule{
		Operator:  db.RuleOperator("invalid"),
		Threshold: pgutil.Float64ToNumeric(100.0),
	}

	result := Evaluate(rule, 150.0)
	if result != false {
		t.Errorf("Evaluate() with invalid operator should return false, got %v", result)
	}
}

func TestEvaluate_AllOperators(t *testing.T) {
	operators := []db.RuleOperator{
		db.RuleOperatorValue0, // >
		db.RuleOperatorValue1, // >=
		db.RuleOperatorValue2, // <
		db.RuleOperatorValue3, // <=
		db.RuleOperatorValue4, // ==
		db.RuleOperatorValue5, // !=
	}

	for _, op := range operators {
		rule := &db.QualityRule{
			Operator:  op,
			Threshold: pgutil.Float64ToNumeric(100.0),
		}

		// Just verify no panic occurs
		_ = Evaluate(rule, 100.0)
		_ = Evaluate(rule, 50.0)
		_ = Evaluate(rule, 150.0)
	}
}

func BenchmarkEvaluate(b *testing.B) {
	rule := &db.QualityRule{
		Operator:  db.RuleOperatorValue0,
		Threshold: pgutil.Float64ToNumeric(100.0),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Evaluate(rule, 150.0)
	}
}
