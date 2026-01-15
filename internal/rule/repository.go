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

type RuleListFilteredParams struct {
	MetricType *db.MetricType
	Severity   *db.IncidentSeverity
	IsActive   *bool
	Search     *string
	SortBy     string
	SortDir    string
	Limit      int32
	Offset     int32
}

func (r *Repository) ListFiltered(ctx context.Context, params RuleListFilteredParams) ([]db.ListRulesFilteredRow, int, error) {
	filterParams := db.ListRulesFilteredParams{
		LimitVal:  params.Limit,
		OffsetVal: params.Offset,
		SortBy:    params.SortBy,
		SortDir:   params.SortDir,
	}

	if params.MetricType != nil {
		filterParams.FilterMetricType = db.NullMetricType{
			MetricType: *params.MetricType,
			Valid:      true,
		}
	}
	if params.Severity != nil {
		filterParams.FilterSeverity = db.NullIncidentSeverity{
			IncidentSeverity: *params.Severity,
			Valid:            true,
		}
	}
	if params.IsActive != nil {
		filterParams.FilterIsActive = params.IsActive
	}
	if params.Search != nil {
		filterParams.FilterSearch = params.Search
	}

	rules, err := r.q.ListRulesFiltered(ctx, filterParams)
	if err != nil {
		return nil, 0, err
	}

	countParams := db.CountRulesFilteredParams{
		FilterMetricType: filterParams.FilterMetricType,
		FilterSeverity:   filterParams.FilterSeverity,
		FilterIsActive:   filterParams.FilterIsActive,
		FilterSearch:     filterParams.FilterSearch,
	}
	total, err := r.q.CountRulesFiltered(ctx, countParams)
	if err != nil {
		return nil, 0, err
	}

	return rules, int(total), nil
}

func (r *Repository) Create(ctx context.Context, req CreateRuleRequest) (*db.QualityRule, error) {
	rule, err := r.q.CreateRule(ctx, db.CreateRuleParams{
		ID:           req.ID,
		MetricType:   db.MetricType(req.MetricType),
		Threshold:    pgutil.Float64ToNumeric(req.Threshold),
		Operator:     db.RuleOperator(req.Operator),
		Action:       db.RuleAction(req.Action),
		Priority:     req.Priority,
		Severity:     db.IncidentSeverity(req.Severity),
		IsActive:     req.IsActive,
		DepartmentID: req.DepartmentID,
	})
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *Repository) Update(ctx context.Context, id string, req UpdateRuleRequest) (*db.QualityRule, error) {
	rule, err := r.q.UpdateRule(ctx, db.UpdateRuleParams{
		ID:           id,
		MetricType:   db.MetricType(req.MetricType),
		Threshold:    pgutil.Float64ToNumeric(req.Threshold),
		Operator:     db.RuleOperator(req.Operator),
		Action:       db.RuleAction(req.Action),
		Priority:     req.Priority,
		Severity:     db.IncidentSeverity(req.Severity),
		IsActive:     req.IsActive,
		DepartmentID: req.DepartmentID,
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

func (r *Repository) GetTopTriggered(ctx context.Context, limit int32) ([]db.GetTopTriggeredRulesRow, error) {
	return r.q.GetTopTriggeredRules(ctx, limit)
}
