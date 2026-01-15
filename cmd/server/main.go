package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unitythemaker/tracely/internal/config"
	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/internal/department"
	"github.com/unitythemaker/tracely/internal/elasticsearch"
	"github.com/unitythemaker/tracely/internal/incident"
	"github.com/unitythemaker/tracely/internal/metric"
	"github.com/unitythemaker/tracely/internal/notification"
	"github.com/unitythemaker/tracely/internal/outbox"
	"github.com/unitythemaker/tracely/internal/rule"
	"github.com/unitythemaker/tracely/internal/service"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// Setup structured logging
	logLevel := slog.LevelInfo
	if cfg.Debug {
		logLevel = slog.LevelDebug
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel}))
	slog.SetDefault(logger)

	slog.Info("starting Tracely server",
		"port", cfg.Port,
		"debug", cfg.Debug,
	)

	// Initialize database connection
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		slog.Error("failed to ping database", "error", err)
		os.Exit(1)
	}
	slog.Info("connected to database")

	// Initialize queries
	queries := db.New(pool)

	// Initialize ElasticSearch client
	esClient, err := elasticsearch.NewClient(
		[]string{cfg.ElasticSearchURL},
		cfg.ElasticSearchIndex,
	)
	if err != nil {
		slog.Error("failed to create elasticsearch client", "error", err)
		os.Exit(1)
	}

	if err := esClient.Ping(context.Background()); err != nil {
		slog.Warn("elasticsearch not available, will retry", "error", err)
	} else {
		slog.Info("connected to elasticsearch")
		if err := esClient.CreateIndex(context.Background()); err != nil {
			slog.Warn("failed to create elasticsearch index", "error", err)
		}
	}

	// Initialize repositories
	serviceRepo := service.NewRepository(queries)
	departmentRepo := department.NewRepository(queries)
	metricRepo := metric.NewRepository(pool, queries)
	ruleRepo := rule.NewRepository(queries)
	incidentRepo := incident.NewRepository(pool, queries)
	notificationRepo := notification.NewRepository(queries)
	outboxRepo := outbox.NewRepository(queries)

	// Initialize handlers
	serviceHandler := service.NewHandler(serviceRepo)
	departmentHandler := department.NewHandler(departmentRepo)
	metricHandler := metric.NewHandler(metricRepo)
	ruleHandler := rule.NewHandler(ruleRepo)
	incidentHandler := incident.NewHandler(incidentRepo)
	notificationHandler := notification.NewHandler(notificationRepo)

	// Setup HTTP server
	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Register API routes
	serviceHandler.RegisterRoutes(mux)
	departmentHandler.RegisterRoutes(mux)
	metricHandler.RegisterRoutes(mux)
	ruleHandler.RegisterRoutes(mux)
	incidentHandler.RegisterRoutes(mux)
	notificationHandler.RegisterRoutes(mux)

	// Middleware chain: CORS -> Body limit
	handler := corsMiddleware(cfg.CORSAllowedOrigins, bodyLimitMiddleware(mux))

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Create worker context
	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()

	// Start workers
	workerInterval := time.Duration(cfg.WorkerPollInterval) * time.Second

	ruleWorker := rule.NewWorker(outboxRepo, ruleRepo, incidentRepo, workerInterval)
	go ruleWorker.Run(workerCtx)

	esWorker := elasticsearch.NewWorker(outboxRepo, serviceRepo, esClient, workerInterval)
	go esWorker.Run(workerCtx)

	notificationWorker := notification.NewWorker(outboxRepo, notificationRepo, workerInterval)
	go notificationWorker.Run(workerCtx)

	// Graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		slog.Info("HTTP server listening", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down server...")

	// Stop workers
	workerCancel()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	slog.Info("server stopped")
}

func corsMiddleware(allowedOrigins string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Check if origin is allowed
		if allowedOrigins == "*" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origin != "" {
			// Check if origin matches allowed origins
			for _, allowed := range splitOrigins(allowedOrigins) {
				if origin == allowed {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					break
				}
			}
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func splitOrigins(origins string) []string {
	var result []string
	for _, o := range strings.Split(origins, ",") {
		if trimmed := strings.TrimSpace(o); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

const maxBodySize = 1 << 20 // 1 MB

func bodyLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
		}
		next.ServeHTTP(w, r)
	})
}
