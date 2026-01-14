package metric

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

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
	mux.HandleFunc("POST /api/metrics", h.Create)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	serviceID := r.URL.Query().Get("service_id")

	var metrics []MetricResponse
	var err error

	if serviceID != "" {
		dbMetrics, e := h.repo.ListByService(r.Context(), serviceID, int32(limit), int32(offset))
		err = e
		if err == nil {
			metrics = ToResponseList(dbMetrics)
		}
	} else {
		dbMetrics, e := h.repo.List(r.Context(), int32(limit), int32(offset))
		err = e
		if err == nil {
			metrics = ToResponseList(dbMetrics)
		}
	}

	if err != nil {
		slog.Error("failed to list metrics", "error", err)
		httputil.InternalError(w, "failed to list metrics")
		return
	}

	httputil.Success(w, metrics)
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
