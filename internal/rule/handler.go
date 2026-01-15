package rule

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/pkg/httputil"
	"github.com/unitythemaker/tracely/pkg/pgerror"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/rules", h.List)
	mux.HandleFunc("GET /api/rules/stats/top-triggered", h.TopTriggered)
	mux.HandleFunc("GET /api/rules/{id}", h.Get)
	mux.HandleFunc("POST /api/rules", h.Create)
	mux.HandleFunc("PATCH /api/rules/{id}", h.Update)
	mux.HandleFunc("DELETE /api/rules/{id}", h.Delete)
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
		sortBy = "priority"
	}
	sortDir := query.Get("sort_dir")
	if sortDir != "asc" && sortDir != "desc" {
		sortDir = "asc"
	}

	// Filters
	params := RuleListFilteredParams{
		SortBy:  sortBy,
		SortDir: sortDir,
		Limit:   int32(limit),
		Offset:  int32(offset),
	}

	if metricType := query.Get("metric_type"); metricType != "" {
		mt := db.MetricType(metricType)
		params.MetricType = &mt
	}
	if severity := query.Get("severity"); severity != "" {
		s := db.IncidentSeverity(severity)
		params.Severity = &s
	}
	if isActiveStr := query.Get("is_active"); isActiveStr != "" {
		isActive := isActiveStr == "true"
		params.IsActive = &isActive
	}
	if search := query.Get("search"); search != "" {
		params.Search = &search
	}

	rules, total, err := h.repo.ListFiltered(r.Context(), params)
	if err != nil {
		slog.Error("failed to list rules", "error", err)
		httputil.InternalError(w, "failed to list rules")
		return
	}

	httputil.SuccessPaginated(w, ToFilteredResponseList(rules), total, limit, offset)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing rule id")
		return
	}

	rule, err := h.repo.Get(r.Context(), id)
	if err != nil {
		httputil.NotFound(w, "rule not found")
		return
	}
	httputil.Success(w, ToResponse(rule))
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateRuleRequest
	if err := httputil.Decode(r, &req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	if req.ID == "" {
		httputil.BadRequest(w, "id is required")
		return
	}
	if req.MetricType == "" {
		httputil.BadRequest(w, "metric_type is required")
		return
	}

	rule, err := h.repo.Create(r.Context(), req)
	if err != nil {
		if pgerror.IsUniqueViolation(err) {
			httputil.Conflict(w, "rule with this id already exists")
			return
		}
		slog.Error("failed to create rule", "error", err)
		httputil.InternalError(w, "failed to create rule")
		return
	}
	httputil.Created(w, ToResponse(rule))
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing rule id")
		return
	}

	var req UpdateRuleRequest
	if err := httputil.Decode(r, &req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	rule, err := h.repo.Update(r.Context(), id, req)
	if err != nil {
		slog.Error("failed to update rule", "error", err)
		httputil.InternalError(w, "failed to update rule")
		return
	}
	httputil.Success(w, ToResponse(rule))
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing rule id")
		return
	}

	// Check if rule exists first
	_, err := h.repo.Get(r.Context(), id)
	if err != nil {
		if err == pgx.ErrNoRows {
			httputil.NotFound(w, "rule not found")
			return
		}
		slog.Error("failed to get rule", "error", err)
		httputil.InternalError(w, "failed to delete rule")
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		slog.Error("failed to delete rule", "error", err)
		httputil.InternalError(w, "failed to delete rule")
		return
	}
	httputil.NoContent(w)
}

func (h *Handler) TopTriggered(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	limit, _ := strconv.Atoi(query.Get("limit"))
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	rows, err := h.repo.GetTopTriggered(r.Context(), int32(limit))
	if err != nil {
		slog.Error("failed to get top triggered rules", "error", err)
		httputil.InternalError(w, "failed to get top triggered rules")
		return
	}

	httputil.Success(w, ToTopTriggeredResponseList(rows))
}
