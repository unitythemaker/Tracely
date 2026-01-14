package pgerror

import (
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestIsUniqueViolation(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name: "unique violation error",
			err: &pgconn.PgError{
				Code: UniqueViolation,
			},
			expected: true,
		},
		{
			name: "other postgres error",
			err: &pgconn.PgError{
				Code: "23503", // foreign key violation
			},
			expected: false,
		},
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
		{
			name:     "non-postgres error",
			err:      errors.New("some error"),
			expected: false,
		},
		{
			name: "wrapped unique violation",
			err: fmt.Errorf("wrapped: %w", &pgconn.PgError{
				Code: UniqueViolation,
			}),
			expected: true,
		},
		{
			name: "double wrapped unique violation",
			err: fmt.Errorf("outer: %w", fmt.Errorf("inner: %w", &pgconn.PgError{
				Code: UniqueViolation,
			})),
			expected: true,
		},
		{
			name: "wrapped non-unique error",
			err: fmt.Errorf("wrapped: %w", &pgconn.PgError{
				Code: "42601", // syntax error
			}),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsUniqueViolation(tt.err)
			if result != tt.expected {
				t.Errorf("IsUniqueViolation() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestUniqueViolationConstant(t *testing.T) {
	if UniqueViolation != "23505" {
		t.Errorf("Expected UniqueViolation to be '23505', got %s", UniqueViolation)
	}
}

func TestIsUniqueViolation_WithMessage(t *testing.T) {
	err := &pgconn.PgError{
		Code:           UniqueViolation,
		Message:        "duplicate key value violates unique constraint",
		Detail:         "Key (id)=(test) already exists.",
		ConstraintName: "services_pkey",
	}

	if !IsUniqueViolation(err) {
		t.Errorf("Expected IsUniqueViolation to return true for unique violation error")
	}
}

func TestIsUniqueViolation_EmptyCode(t *testing.T) {
	err := &pgconn.PgError{
		Code: "",
	}

	if IsUniqueViolation(err) {
		t.Errorf("Expected IsUniqueViolation to return false for empty code")
	}
}

func BenchmarkIsUniqueViolation(b *testing.B) {
	err := &pgconn.PgError{
		Code: UniqueViolation,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		IsUniqueViolation(err)
	}
}

func BenchmarkIsUniqueViolation_Wrapped(b *testing.B) {
	err := fmt.Errorf("wrapped: %w", &pgconn.PgError{
		Code: UniqueViolation,
	})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		IsUniqueViolation(err)
	}
}
