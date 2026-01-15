package service

import (
	"net/http"
	"strconv"

	"github.com/unitythemaker/tracely/pkg/httputil"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/services", h.List)
	mux.HandleFunc("GET /api/services/{id}", h.Get)
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
		sortBy = "name"
	}
	sortDir := query.Get("sort_dir")
	if sortDir != "asc" && sortDir != "desc" {
		sortDir = "asc"
	}

	// Filters
	params := ServiceListFilteredParams{
		SortBy:  sortBy,
		SortDir: sortDir,
		Limit:   int32(limit),
		Offset:  int32(offset),
	}

	if search := query.Get("search"); search != "" {
		params.Search = &search
	}

	services, total, err := h.repo.ListFiltered(r.Context(), params)
	if err != nil {
		httputil.InternalError(w, "failed to list services")
		return
	}

	httputil.SuccessPaginated(w, services, total, limit, offset)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing service id")
		return
	}

	svc, err := h.repo.Get(r.Context(), id)
	if err != nil {
		httputil.NotFound(w, "service not found")
		return
	}
	httputil.Success(w, svc)
}
