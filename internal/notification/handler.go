package notification

import (
	"log/slog"
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
	mux.HandleFunc("GET /api/notifications", h.List)
	mux.HandleFunc("GET /api/notifications/unread-count", h.UnreadCount)
	mux.HandleFunc("GET /api/notifications/{id}", h.Get)
	mux.HandleFunc("POST /api/notifications/{id}/read", h.MarkAsRead)
	mux.HandleFunc("POST /api/notifications/{id}/unread", h.MarkAsUnread)
	mux.HandleFunc("POST /api/notifications/read-all", h.MarkAllAsRead)
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
		sortBy = "sent_at"
	}
	sortDir := query.Get("sort_dir")
	if sortDir != "asc" && sortDir != "desc" {
		sortDir = "desc"
	}

	// Filters
	params := ListFilteredParams{
		SortBy:  sortBy,
		SortDir: sortDir,
		Limit:   int32(limit),
		Offset:  int32(offset),
	}

	if isReadStr := query.Get("is_read"); isReadStr != "" {
		isRead := isReadStr == "true"
		params.IsRead = &isRead
	}
	if incidentID := query.Get("incident_id"); incidentID != "" {
		params.IncidentID = &incidentID
	}
	if search := query.Get("search"); search != "" {
		params.Search = &search
	}

	notifications, total, err := h.repo.ListFiltered(r.Context(), params)
	if err != nil {
		slog.Error("failed to list notifications", "error", err)
		httputil.InternalError(w, "failed to list notifications")
		return
	}

	httputil.SuccessPaginated(w, ToResponseList(notifications), total, limit, offset)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing notification id")
		return
	}

	notification, err := h.repo.Get(r.Context(), id)
	if err != nil {
		httputil.NotFound(w, "notification not found")
		return
	}
	httputil.Success(w, ToResponse(notification))
}

func (h *Handler) MarkAsRead(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing notification id")
		return
	}

	notification, err := h.repo.MarkAsRead(r.Context(), id)
	if err != nil {
		slog.Error("failed to mark notification as read", "error", err)
		httputil.InternalError(w, "failed to mark notification as read")
		return
	}
	httputil.Success(w, ToResponse(notification))
}

func (h *Handler) MarkAsUnread(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing notification id")
		return
	}

	notification, err := h.repo.MarkAsUnread(r.Context(), id)
	if err != nil {
		slog.Error("failed to mark notification as unread", "error", err)
		httputil.InternalError(w, "failed to mark notification as unread")
		return
	}
	httputil.Success(w, ToResponse(notification))
}

func (h *Handler) MarkAllAsRead(w http.ResponseWriter, r *http.Request) {
	if err := h.repo.MarkAllAsRead(r.Context()); err != nil {
		slog.Error("failed to mark all notifications as read", "error", err)
		httputil.InternalError(w, "failed to mark all notifications as read")
		return
	}
	httputil.NoContent(w)
}

func (h *Handler) UnreadCount(w http.ResponseWriter, r *http.Request) {
	count, err := h.repo.CountUnread(r.Context())
	if err != nil {
		slog.Error("failed to count unread notifications", "error", err)
		httputil.InternalError(w, "failed to count unread notifications")
		return
	}
	httputil.Success(w, map[string]int64{"count": count})
}
