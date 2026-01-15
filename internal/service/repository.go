package service

import (
	"context"

	"github.com/unitythemaker/tracely/internal/db"
)

type Repository struct {
	q *db.Queries
}

func NewRepository(q *db.Queries) *Repository {
	return &Repository{q: q}
}

func (r *Repository) Get(ctx context.Context, id string) (*db.Service, error) {
	svc, err := r.q.GetService(ctx, id)
	if err != nil {
		return nil, err
	}
	return &svc, nil
}

func (r *Repository) List(ctx context.Context) ([]db.Service, error) {
	return r.q.ListServices(ctx)
}

type ServiceListFilteredParams struct {
	Search  *string
	SortBy  string
	SortDir string
	Limit   int32
	Offset  int32
}

func (r *Repository) ListFiltered(ctx context.Context, params ServiceListFilteredParams) ([]db.Service, int, error) {
	filterParams := db.ListServicesFilteredParams{
		Limit:  params.Limit,
		Offset: params.Offset,
	}

	if params.Search != nil {
		filterParams.Column1 = *params.Search
	}

	filterParams.Column2 = params.SortBy
	filterParams.Column3 = params.SortDir

	services, err := r.q.ListServicesFiltered(ctx, filterParams)
	if err != nil {
		return nil, 0, err
	}

	total, err := r.q.CountServicesFiltered(ctx, filterParams.Column1)
	if err != nil {
		return nil, 0, err
	}

	return services, int(total), nil
}

func (r *Repository) Create(ctx context.Context, id, name string) (*db.Service, error) {
	svc, err := r.q.CreateService(ctx, db.CreateServiceParams{
		ID:   id,
		Name: name,
	})
	if err != nil {
		return nil, err
	}
	return &svc, nil
}
