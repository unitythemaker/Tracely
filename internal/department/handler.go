package department

import (
	"encoding/json"
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
	mux.HandleFunc("GET /api/departments", h.List)
	mux.HandleFunc("GET /api/departments/{id}", h.Get)
	mux.HandleFunc("POST /api/departments", h.Create)
	mux.HandleFunc("PUT /api/departments/{id}", h.Update)
	mux.HandleFunc("DELETE /api/departments/{id}", h.Delete)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	departments, err := h.repo.List(r.Context())
	if err != nil {
		httputil.InternalError(w, "failed to list departments")
		return
	}

	httputil.Success(w, departments)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing department id")
		return
	}

	dept, err := h.repo.Get(r.Context(), id)
	if err != nil {
		httputil.NotFound(w, "department not found")
		return
	}

	httputil.Success(w, dept)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateDepartmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	if req.ID == "" || req.Name == "" {
		httputil.BadRequest(w, "id and name are required")
		return
	}

	dept, err := h.repo.Create(r.Context(), req)
	if err != nil {
		httputil.InternalError(w, "failed to create department")
		return
	}

	httputil.Success(w, dept)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing department id")
		return
	}

	var req UpdateDepartmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	if req.Name == "" {
		httputil.BadRequest(w, "name is required")
		return
	}

	dept, err := h.repo.Update(r.Context(), id, req)
	if err != nil {
		httputil.InternalError(w, "failed to update department")
		return
	}

	httputil.Success(w, dept)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httputil.BadRequest(w, "missing department id")
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		httputil.InternalError(w, "failed to delete department")
		return
	}

	httputil.Success(w, map[string]string{"message": "department deleted"})
}
