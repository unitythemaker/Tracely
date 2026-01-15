package metric

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/pkg/httputil"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/metrics", h.List)
	mux.HandleFunc("GET /api/metrics/chart", h.ChartData)
	mux.HandleFunc("POST /api/metrics", h.Create)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	// Pagination
	limit, _ := strconv.Atoi(query.Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset, _ := strconv.Atoi(query.Get("offset"))
	if offset < 0 {
		offset = 0
	}

	// Sorting
	sortBy := query.Get("sort_by")
	if sortBy == "" {
		sortBy = "recorded_at"
	}
	sortDir := query.Get("sort_dir")
	if sortDir != "asc" && sortDir != "desc" {
		sortDir = "desc"
	}

	// Filters
	params := MetricListFilteredParams{
		SortBy:  sortBy,
		SortDir: sortDir,
		Limit:   int32(limit),
		Offset:  int32(offset),
	}

	if serviceID := query.Get("service_id"); serviceID != "" {
		params.ServiceID = &serviceID
	}
	if metricType := query.Get("metric_type"); metricType != "" {
		mt := db.MetricType(metricType)
		params.MetricType = &mt
	}
	if search := query.Get("search"); search != "" {
		params.Search = &search
	}

	metrics, total, err := h.repo.ListFiltered(r.Context(), params)
	if err != nil {
		slog.Error("failed to list metrics", "error", err)
		httputil.InternalError(w, "failed to list metrics")
		return
	}

	httputil.SuccessPaginated(w, ToResponseList(metrics), total, limit, offset)
}

func (h *Handler) ChartData(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	// Parse time range (required)
	fromStr := query.Get("from")
	toStr := query.Get("to")

	if fromStr == "" || toStr == "" {
		// Default to last 24 hours
		now := time.Now()
		toStr = now.Format(time.RFC3339)
		fromStr = now.Add(-24 * time.Hour).Format(time.RFC3339)
	}

	fromTime, err := time.Parse(time.RFC3339, fromStr)
	if err != nil {
		httputil.BadRequest(w, "invalid 'from' time format, use RFC3339")
		return
	}

	toTime, err := time.Parse(time.RFC3339, toStr)
	if err != nil {
		httputil.BadRequest(w, "invalid 'to' time format, use RFC3339")
		return
	}

	// Determine bucket size based on time range
	duration := toTime.Sub(fromTime)
	bucketSize := "minute"
	if duration > 7*24*time.Hour {
		bucketSize = "day"
	} else if duration > 24*time.Hour {
		bucketSize = "hour"
	} else if duration > 4*time.Hour {
		bucketSize = "hour"
	}

	// Override bucket size if specified
	if bs := query.Get("bucket"); bs != "" {
		if bs == "minute" || bs == "hour" || bs == "day" {
			bucketSize = bs
		}
	}

	// Build params
	params := MetricAggregatedParams{
		From:       fromTime,
		To:         toTime,
		BucketSize: bucketSize,
	}

	if serviceID := query.Get("service_id"); serviceID != "" {
		params.ServiceID = &serviceID
	}
	if metricType := query.Get("metric_type"); metricType != "" {
		mt := db.MetricType(metricType)
		params.MetricType = &mt
	}

	rows, err := h.repo.GetAggregated(r.Context(), params)
	if err != nil {
		slog.Error("failed to get aggregated metrics", "error", err)
		httputil.InternalError(w, "failed to get chart data")
		return
	}

	httputil.Success(w, ToAggregatedResponseList(rows))
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateMetricRequest
	if err := httputil.Decode(r, &req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	// Validate
	if req.ServiceID == "" {
		httputil.BadRequest(w, "service_id is required")
		return
	}
	if req.MetricType == "" {
		httputil.BadRequest(w, "metric_type is required")
		return
	}
	if req.RecordedAt.IsZero() {
		req.RecordedAt = time.Now()
	}

	// Validate metric type
	validTypes := map[string]bool{
		"LATENCY_MS":   true,
		"PACKET_LOSS":  true,
		"ERROR_RATE":   true,
		"BUFFER_RATIO": true,
	}
	if !validTypes[req.MetricType] {
		httputil.BadRequest(w, "invalid metric_type")
		return
	}

	metric, err := h.repo.CreateWithOutbox(r.Context(), req)
	if err != nil {
		slog.Error("failed to create metric", "error", err)
		httputil.InternalError(w, "failed to create metric")
		return
	}

	httputil.Created(w, ToResponse(metric))
}
