package incident

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
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

	// Comment endpoints
	mux.HandleFunc("GET /api/incidents/{id}/comments", h.ListComments)
	mux.HandleFunc("POST /api/incidents/{id}/comments", h.CreateComment)
	mux.HandleFunc("DELETE /api/incidents/{id}/comments/{commentId}", h.DeleteComment)

	// Event endpoints (timeline)
	mux.HandleFunc("GET /api/incidents/{id}/events", h.ListEvents)
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
		sortBy = "opened_at"
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

	if status := query.Get("status"); status != "" {
		s := db.IncidentStatus(status)
		params.Status = &s
	}
	if severity := query.Get("severity"); severity != "" {
		s := db.IncidentSeverity(severity)
		params.Severity = &s
	}
	if serviceID := query.Get("service_id"); serviceID != "" {
		params.ServiceID = &serviceID
	}
	if search := query.Get("search"); search != "" {
		params.Search = &search
	}

	incidents, total, err := h.repo.ListFiltered(r.Context(), params)
	if err != nil {
		slog.Error("failed to list incidents", "error", err)
		httputil.InternalError(w, "failed to list incidents")
		return
	}

	httputil.SuccessPaginated(w, ToResponseList(incidents), total, limit, offset)
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

	// Get current incident for event tracking
	currentInc, err := h.repo.Get(r.Context(), id)
	if err != nil {
		httputil.NotFound(w, "incident not found")
		return
	}
	oldStatus := string(currentInc.Status)

	var inc *db.Incident

	switch req.Status {
	case "CLOSED":
		inc, err = h.repo.Close(r.Context(), id)
	case "IN_PROGRESS":
		inc, err = h.repo.SetInProgress(r.Context(), id)
	default:
		inc, err = h.repo.UpdateStatus(r.Context(), id, db.IncidentStatus(req.Status))
	}

	if err != nil {
		slog.Error("failed to update incident", "error", err)
		httputil.InternalError(w, "failed to update incident")
		return
	}

	// Create timeline event for status change
	if oldStatus != req.Status {
		h.repo.CreateEvent(r.Context(), id, db.IncidentEventTypeSTATUSCHANGED, "system", &oldStatus, &req.Status)
	}

	httputil.Success(w, ToResponse(inc))
}

// Comment handlers
type CreateCommentRequest struct {
	Author  string `json:"author"`
	Content string `json:"content"`
}

type CommentResponse struct {
	ID         uuid.UUID `json:"id"`
	IncidentID string    `json:"incident_id"`
	Author     string    `json:"author"`
	Content    string    `json:"content"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func toCommentResponse(c *db.IncidentComment) CommentResponse {
	return CommentResponse{
		ID:         c.ID,
		IncidentID: c.IncidentID,
		Author:     c.Author,
		Content:    c.Content,
		CreatedAt:  c.CreatedAt,
		UpdatedAt:  c.UpdatedAt,
	}
}

func toCommentResponseList(comments []db.IncidentComment) []CommentResponse {
	result := make([]CommentResponse, len(comments))
	for i, c := range comments {
		result[i] = toCommentResponse(&c)
	}
	return result
}

func (h *Handler) ListComments(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing incident id")
		return
	}

	comments, err := h.repo.ListComments(r.Context(), id)
	if err != nil {
		slog.Error("failed to list comments", "error", err)
		httputil.InternalError(w, "failed to list comments")
		return
	}

	httputil.Success(w, toCommentResponseList(comments))
}

func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing incident id")
		return
	}

	var req CreateCommentRequest
	if err := httputil.Decode(r, &req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	if req.Content == "" {
		httputil.BadRequest(w, "content is required")
		return
	}

	author := req.Author
	if author == "" {
		author = "anonymous"
	}

	comment, err := h.repo.CreateComment(r.Context(), id, author, req.Content)
	if err != nil {
		slog.Error("failed to create comment", "error", err)
		httputil.InternalError(w, "failed to create comment")
		return
	}

	httputil.Created(w, toCommentResponse(comment))
}

func (h *Handler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	commentIDStr := r.PathValue("commentId")
	if commentIDStr == "" {
		httputil.BadRequest(w, "missing comment id")
		return
	}

	commentID, err := uuid.Parse(commentIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid comment id")
		return
	}

	if err := h.repo.DeleteComment(r.Context(), commentID); err != nil {
		slog.Error("failed to delete comment", "error", err)
		httputil.InternalError(w, "failed to delete comment")
		return
	}

	httputil.NoContent(w)
}

// Event handlers
type EventResponse struct {
	ID         uuid.UUID `json:"id"`
	IncidentID string    `json:"incident_id"`
	EventType  string    `json:"event_type"`
	Actor      *string   `json:"actor"`
	OldValue   *string   `json:"old_value"`
	NewValue   *string   `json:"new_value"`
	CreatedAt  time.Time `json:"created_at"`
}

func toEventResponse(e *db.IncidentEvent) EventResponse {
	return EventResponse{
		ID:         e.ID,
		IncidentID: e.IncidentID,
		EventType:  string(e.EventType),
		Actor:      e.Actor,
		OldValue:   e.OldValue,
		NewValue:   e.NewValue,
		CreatedAt:  e.CreatedAt,
	}
}

func toEventResponseList(events []db.IncidentEvent) []EventResponse {
	result := make([]EventResponse, len(events))
	for i, e := range events {
		result[i] = toEventResponse(&e)
	}
	return result
}

func (h *Handler) ListEvents(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing incident id")
		return
	}

	events, err := h.repo.ListEvents(r.Context(), id)
	if err != nil {
		slog.Error("failed to list events", "error", err)
		httputil.InternalError(w, "failed to list events")
		return
	}

	httputil.Success(w, toEventResponseList(events))
}
