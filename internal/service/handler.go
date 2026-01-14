package service

import (
	"net/http"

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
	services, err := h.repo.List(r.Context())
	if err != nil {
		httputil.InternalError(w, "failed to list services")
		return
	}
	httputil.Success(w, services)
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
