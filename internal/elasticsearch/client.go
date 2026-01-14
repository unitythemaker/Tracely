package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/elastic/go-elasticsearch/v8"
)

type Client struct {
	es    *elasticsearch.Client
	index string
}

func NewClient(addresses []string, index string) (*Client, error) {
	cfg := elasticsearch.Config{
		Addresses: addresses,
	}

	es, err := elasticsearch.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create elasticsearch client: %w", err)
	}

	return &Client{
		es:    es,
		index: index,
	}, nil
}

func (c *Client) Ping(ctx context.Context) error {
	res, err := c.es.Ping()
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("elasticsearch ping failed: %s", res.Status())
	}
	return nil
}

func (c *Client) CreateIndex(ctx context.Context) error {
	mapping := map[string]any{
		"settings": map[string]any{
			"number_of_shards":   1,
			"number_of_replicas": 0,
			"refresh_interval":   "5s",
		},
		"mappings": map[string]any{
			"properties": map[string]any{
				"id":           map[string]any{"type": "keyword"},
				"service_id":   map[string]any{"type": "keyword"},
				"service_name": map[string]any{"type": "keyword"},
				"metric_type":  map[string]any{"type": "keyword"},
				"value":        map[string]any{"type": "float"},
				"recorded_at": map[string]any{
					"type":   "date",
					"format": "strict_date_optional_time",
				},
				"created_at": map[string]any{
					"type":   "date",
					"format": "strict_date_optional_time",
				},
			},
		},
	}

	body, err := json.Marshal(mapping)
	if err != nil {
		return err
	}

	res, err := c.es.Indices.Create(
		c.index,
		c.es.Indices.Create.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.IsError() {
		// Index might already exist, that's ok
		slog.Debug("elasticsearch create index response", "status", res.Status())
	}

	return nil
}

type MetricDocument struct {
	ID          string  `json:"id"`
	ServiceID   string  `json:"service_id"`
	ServiceName string  `json:"service_name"`
	MetricType  string  `json:"metric_type"`
	Value       float64 `json:"value"`
	RecordedAt  string  `json:"recorded_at"`
	CreatedAt   string  `json:"created_at"`
}

func (c *Client) IndexMetric(ctx context.Context, doc MetricDocument) error {
	body, err := json.Marshal(doc)
	if err != nil {
		return err
	}

	res, err := c.es.Index(
		c.index,
		bytes.NewReader(body),
		c.es.Index.WithDocumentID(doc.ID),
		c.es.Index.WithRefresh("wait_for"),
	)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("failed to index metric: %s", res.Status())
	}

	return nil
}

func (c *Client) Search(ctx context.Context, query map[string]any) ([]map[string]any, error) {
	body, err := json.Marshal(query)
	if err != nil {
		return nil, err
	}

	res, err := c.es.Search(
		c.es.Search.WithContext(ctx),
		c.es.Search.WithIndex(c.index),
		c.es.Search.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("search failed: %s", res.Status())
	}

	var result map[string]any
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, err
	}

	hits, ok := result["hits"].(map[string]any)
	if !ok {
		return nil, nil
	}

	hitsList, ok := hits["hits"].([]any)
	if !ok {
		return nil, nil
	}

	var docs []map[string]any
	for _, hit := range hitsList {
		if h, ok := hit.(map[string]any); ok {
			if source, ok := h["_source"].(map[string]any); ok {
				docs = append(docs, source)
			}
		}
	}

	return docs, nil
}

func (c *Client) Aggregate(ctx context.Context, query map[string]any) (map[string]any, error) {
	body, err := json.Marshal(query)
	if err != nil {
		return nil, err
	}

	res, err := c.es.Search(
		c.es.Search.WithContext(ctx),
		c.es.Search.WithIndex(c.index),
		c.es.Search.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("aggregation failed: %s", res.Status())
	}

	var result map[string]any
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}
