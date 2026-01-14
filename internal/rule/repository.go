package rule

import (
	"context"

	"github.com/unitythemaker/tracely/internal/db"
	"github.com/unitythemaker/tracely/pkg/pgutil"
)

type Repository struct {
	q *db.Queries
}

func NewRepository(q *db.Queries) *Repository {
	return &Repository{q: q}
}

func (r *Repository) Get(ctx context.Context, id string) (*db.QualityRule, error) {
	rule, err := r.q.GetRule(ctx, id)
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *Repository) List(ctx context.Context) ([]db.QualityRule, error) {
	return r.q.ListRules(ctx)
}

func (r *Repository) ListActive(ctx context.Context) ([]db.QualityRule, error) {
	return r.q.ListActiveRules(ctx)
}

func (r *Repository) ListActiveByMetricType(ctx context.Context, metricType db.MetricType) ([]db.QualityRule, error) {
	return r.q.ListActiveRulesByMetricType(ctx, metricType)
}

func (r *Repository) Create(ctx context.Context, req CreateRuleRequest) (*db.QualityRule, error) {
	rule, err := r.q.CreateRule(ctx, db.CreateRuleParams{
		ID:         req.ID,
		MetricType: db.MetricType(req.MetricType),
		Threshold:  pgutil.Float64ToNumeric(req.Threshold),
		Operator:   db.RuleOperator(req.Operator),
		Action:     db.RuleAction(req.Action),
		Priority:   req.Priority,
		Severity:   db.IncidentSeverity(req.Severity),
		IsActive:   req.IsActive,
	})
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *Repository) Update(ctx context.Context, id string, req UpdateRuleRequest) (*db.QualityRule, error) {
	rule, err := r.q.UpdateRule(ctx, db.UpdateRuleParams{
		ID:         id,
		MetricType: db.MetricType(req.MetricType),
		Threshold:  pgutil.Float64ToNumeric(req.Threshold),
		Operator:   db.RuleOperator(req.Operator),
		Action:     db.RuleAction(req.Action),
		Priority:   req.Priority,
		Severity:   db.IncidentSeverity(req.Severity),
		IsActive:   req.IsActive,
	})
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *Repository) SetActive(ctx context.Context, id string, active bool) (*db.QualityRule, error) {
	rule, err := r.q.SetRuleActive(ctx, db.SetRuleActiveParams{
		ID:       id,
		IsActive: active,
	})
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	return r.q.DeleteRule(ctx, id)
}
