package incident

import (
	"log/slog"
	"net/http"
	"strconv"

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
	mux.HandleFunc("GET /api/incidents", h.List)
	mux.HandleFunc("GET /api/incidents/{id}", h.Get)
	mux.HandleFunc("PATCH /api/incidents/{id}", h.Update)
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

	status := r.URL.Query().Get("status")
	serviceID := r.URL.Query().Get("service_id")

	var incidents []db.Incident
	var err error

	if status != "" {
		incidents, err = h.repo.ListByStatus(r.Context(), db.IncidentStatus(status), int32(limit), int32(offset))
	} else if serviceID != "" {
		incidents, err = h.repo.ListByService(r.Context(), serviceID, int32(limit), int32(offset))
	} else {
		incidents, err = h.repo.List(r.Context(), int32(limit), int32(offset))
	}

	if err != nil {
		slog.Error("failed to list incidents", "error", err)
		httputil.InternalError(w, "failed to list incidents")
		return
	}

	httputil.Success(w, ToResponseList(incidents))
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing incident id")
		return
	}

	inc, err := h.repo.Get(r.Context(), id)
	if err != nil {
		httputil.NotFound(w, "incident not found")
		return
	}
	httputil.Success(w, ToResponse(inc))
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing incident id")
		return
	}

	var req UpdateIncidentRequest
	if err := httputil.Decode(r, &req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	// Validate status
	validStatuses := map[string]bool{
		"OPEN":        true,
		"IN_PROGRESS": true,
		"CLOSED":      true,
	}
	if !validStatuses[req.Status] {
		httputil.BadRequest(w, "invalid status")
		return
	}

	var inc *db.Incident
	var err error

	if req.Status == "CLOSED" {
		inc, err = h.repo.Close(r.Context(), id)
	} else {
		inc, err = h.repo.UpdateStatus(r.Context(), id, db.IncidentStatus(req.Status))
	}

	if err != nil {
		slog.Error("failed to update incident", "error", err)
		httputil.InternalError(w, "failed to update incident")
		return
	}

	httputil.Success(w, ToResponse(inc))
}
