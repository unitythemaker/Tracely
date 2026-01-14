package pgerror

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

const (
	// PostgreSQL error codes
	UniqueViolation = "23505"
)

// IsUniqueViolation checks if the error is a PostgreSQL unique constraint violation
func IsUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == UniqueViolation
	}
	return false
}
