package department

import (
	"context"

	"github.com/unitythemaker/tracely/internal/db"
)

type Repository struct {
	queries *db.Queries
}

func NewRepository(queries *db.Queries) *Repository {
	return &Repository{queries: queries}
}

func (r *Repository) Create(ctx context.Context, req CreateDepartmentRequest) (DepartmentResponse, error) {
	var description *string
	if req.Description != "" {
		description = &req.Description
	}

	dept, err := r.queries.CreateDepartment(ctx, db.CreateDepartmentParams{
		ID:          req.ID,
		Name:        req.Name,
		Description: description,
	})
	if err != nil {
		return DepartmentResponse{}, err
	}

	return ToResponse(&dept), nil
}

func (r *Repository) Get(ctx context.Context, id string) (DepartmentResponse, error) {
	dept, err := r.queries.GetDepartment(ctx, id)
	if err != nil {
		return DepartmentResponse{}, err
	}

	return ToResponse(&dept), nil
}

func (r *Repository) List(ctx context.Context) ([]DepartmentResponse, error) {
	departments, err := r.queries.ListDepartments(ctx)
	if err != nil {
		return nil, err
	}

	return ToResponseList(departments), nil
}

func (r *Repository) Update(ctx context.Context, id string, req UpdateDepartmentRequest) (DepartmentResponse, error) {
	var description *string
	if req.Description != "" {
		description = &req.Description
	}

	dept, err := r.queries.UpdateDepartment(ctx, db.UpdateDepartmentParams{
		ID:          id,
		Name:        req.Name,
		Description: description,
	})
	if err != nil {
		return DepartmentResponse{}, err
	}

	return ToResponse(&dept), nil
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	return r.queries.DeleteDepartment(ctx, id)
}
