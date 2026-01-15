package testutil

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unitythemaker/tracely/internal/db"
)

var (
	testPool     *pgxpool.Pool
	testPoolOnce sync.Once
	testPoolErr  error
)

// GetTestDatabaseURL returns the test database URL from environment or default
func GetTestDatabaseURL() string {
	if url := os.Getenv("TEST_DATABASE_URL"); url != "" {
		return url
	}
	return "postgres://postgres:postgres@localhost:5432/tracely_test?sslmode=disable"
}

// GetTestPool returns a shared database pool for tests
func GetTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	testPoolOnce.Do(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		testPool, testPoolErr = pgxpool.New(ctx, GetTestDatabaseURL())
		if testPoolErr == nil {
			// Verify connection
			testPoolErr = testPool.Ping(ctx)
		}
	})

	if testPoolErr != nil {
		t.Skipf("Skipping test: database not available: %v", testPoolErr)
	}

	return testPool
}

// GetTestQueries returns a Queries instance for testing
func GetTestQueries(t *testing.T) *db.Queries {
	t.Helper()
	pool := GetTestPool(t)
	return db.New(pool)
}

// CleanupTestData cleans up test data from all tables using TRUNCATE CASCADE
func CleanupTestData(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Use TRUNCATE CASCADE to handle all foreign key dependencies
	_, err := pool.Exec(ctx, `
		TRUNCATE TABLE
			outbox_processing,
			outbox,
			notifications,
			incident_events,
			incident_comments,
			incidents,
			metrics,
			quality_rules,
			services
		CASCADE
	`)
	if err != nil {
		t.Logf("Warning: failed to truncate tables: %v", err)
	}

	// Reset sequences
	sequences := []string{
		"incident_id_seq",
		"notification_id_seq",
	}
	for _, seq := range sequences {
		_, err := pool.Exec(ctx, fmt.Sprintf("ALTER SEQUENCE %s RESTART WITH 1", seq))
		if err != nil {
			t.Logf("Warning: failed to reset sequence %s: %v", seq, err)
		}
	}
}

// WithTestTransaction runs a test function within a transaction that is rolled back
func WithTestTransaction(t *testing.T, pool *pgxpool.Pool, fn func(ctx context.Context, q *db.Queries)) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("Failed to begin transaction: %v", err)
	}
	defer tx.Rollback(ctx)

	q := db.New(pool).WithTx(tx)
	fn(ctx, q)
}
