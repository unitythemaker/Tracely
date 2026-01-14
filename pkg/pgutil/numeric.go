package pgutil

import (
	"math/big"

	"github.com/jackc/pgx/v5/pgtype"
)

// NumericToFloat64 converts pgtype.Numeric to float64
func NumericToFloat64(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	f, _ := n.Float64Value()
	return f.Float64
}

// Float64ToNumeric converts float64 to pgtype.Numeric
func Float64ToNumeric(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	n.Int = big.NewInt(int64(f * 100)) // 2 decimal places
	n.Exp = -2
	n.Valid = true
	return n
}
