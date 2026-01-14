package rule

import (
	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/pkg/pgutil"
)

// Evaluate checks if a metric value violates the rule
func Evaluate(rule *db.QualityRule, value float64) bool {
	threshold := pgutil.NumericToFloat64(rule.Threshold)

	switch rule.Operator {
	case db.RuleOperatorValue0: // >
		return value > threshold
	case db.RuleOperatorValue1: // >=
		return value >= threshold
	case db.RuleOperatorValue2: // <
		return value < threshold
	case db.RuleOperatorValue3: // <=
		return value <= threshold
	case db.RuleOperatorValue4: // ==
		return value == threshold
	case db.RuleOperatorValue5: // !=
		return value != threshold
	default:
		return false
	}
}
