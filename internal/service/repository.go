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
