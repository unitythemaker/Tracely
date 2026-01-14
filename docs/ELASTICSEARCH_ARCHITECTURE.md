# ElasticSearch Mimarisi

## Genel Bakış

ES sadece **metrics** verisi için kullanılır. Amaç:
- Time-series aggregation (avg, max, min, percentile)
- Dashboard için hızlı sorgular
- Service bazlı metrik analizi

## Index: `metrics`

### Mapping

```json
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "refresh_interval": "5s"
  },
  "mappings": {
    "properties": {
      "id": {
        "type": "keyword"
      },
      "service_id": {
        "type": "keyword"
      },
      "service_name": {
        "type": "keyword"
      },
      "metric_type": {
        "type": "keyword"
      },
      "value": {
        "type": "float"
      },
      "recorded_at": {
        "type": "date",
        "format": "strict_date_optional_time"
      },
      "created_at": {
        "type": "date",
        "format": "strict_date_optional_time"
      }
    }
  }
}
```

### Document Örneği

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "service_id": "S1",
  "service_name": "Superonline",
  "metric_type": "LATENCY_MS",
  "value": 180.0,
  "recorded_at": "2026-03-12T09:00:00Z",
  "created_at": "2026-03-12T09:00:01Z"
}
```

## Query Patterns

### 1. Son N Metrik (Service Bazlı)

```json
{
  "size": 100,
  "query": {
    "bool": {
      "filter": [
        { "term": { "service_id": "S1" } }
      ]
    }
  },
  "sort": [
    { "recorded_at": { "order": "desc" } }
  ]
}
```

### 2. Metrik Tipi Bazlı Son Değerler

```json
{
  "size": 0,
  "aggs": {
    "by_service": {
      "terms": {
        "field": "service_id",
        "size": 100
      },
      "aggs": {
        "by_metric_type": {
          "terms": {
            "field": "metric_type",
            "size": 10
          },
          "aggs": {
            "latest": {
              "top_hits": {
                "size": 1,
                "sort": [{ "recorded_at": { "order": "desc" } }],
                "_source": ["value", "recorded_at"]
              }
            }
          }
        }
      }
    }
  }
}
```

### 3. Zaman Aralığında Ortalama

```json
{
  "size": 0,
  "query": {
    "bool": {
      "filter": [
        { "term": { "service_id": "S1" } },
        { "term": { "metric_type": "LATENCY_MS" } },
        {
          "range": {
            "recorded_at": {
              "gte": "now-1h",
              "lte": "now"
            }
          }
        }
      ]
    }
  },
  "aggs": {
    "avg_value": { "avg": { "field": "value" } },
    "max_value": { "max": { "field": "value" } },
    "min_value": { "min": { "field": "value" } }
  }
}
```

### 4. Time Histogram (Dashboard Grafik)

```json
{
  "size": 0,
  "query": {
    "bool": {
      "filter": [
        { "term": { "service_id": "S1" } },
        { "term": { "metric_type": "LATENCY_MS" } },
        {
          "range": {
            "recorded_at": {
              "gte": "now-24h",
              "lte": "now"
            }
          }
        }
      ]
    }
  },
  "aggs": {
    "over_time": {
      "date_histogram": {
        "field": "recorded_at",
        "fixed_interval": "1h"
      },
      "aggs": {
        "avg_value": { "avg": { "field": "value" } },
        "max_value": { "max": { "field": "value" } }
      }
    }
  }
}
```

### 5. Tüm Servislerin Anlık Durumu

```json
{
  "size": 0,
  "aggs": {
    "by_service": {
      "terms": {
        "field": "service_id",
        "size": 100
      },
      "aggs": {
        "by_metric": {
          "terms": {
            "field": "metric_type",
            "size": 10
          },
          "aggs": {
            "latest_value": {
              "top_hits": {
                "size": 1,
                "sort": [{ "recorded_at": { "order": "desc" } }],
                "_source": ["value", "recorded_at", "service_name"]
              }
            },
            "avg_1h": {
              "filter": {
                "range": {
                  "recorded_at": {
                    "gte": "now-1h"
                  }
                }
              },
              "aggs": {
                "avg": { "avg": { "field": "value" } }
              }
            }
          }
        }
      }
    }
  }
}
```

### 6. Threshold Aşımı Sayısı (Son 24 Saat)

```json
{
  "size": 0,
  "query": {
    "bool": {
      "filter": [
        { "term": { "metric_type": "LATENCY_MS" } },
        {
          "range": {
            "recorded_at": {
              "gte": "now-24h"
            }
          }
        },
        {
          "range": {
            "value": {
              "gt": 150
            }
          }
        }
      ]
    }
  },
  "aggs": {
    "by_service": {
      "terms": {
        "field": "service_id",
        "size": 100
      }
    }
  }
}
```

## Index Lifecycle Management (ILM)

Production için önerilen retention policy:

```json
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_age": "7d",
            "max_size": "50gb"
          }
        }
      },
      "delete": {
        "min_age": "30d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

**Not:** Hackathon için ILM opsiyonel. Basit tek index yeterli.

## ES Client Configuration (Go)

```go
type ESConfig struct {
    Addresses []string
    Index     string
}

// Default values
var DefaultESConfig = ESConfig{
    Addresses: []string{"http://localhost:9200"},
    Index:     "metrics",
}
```

## Sync Strategy

ESWorker outbox'tan `METRIC_CREATED` event'lerini okur ve ES'e yazar:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Outbox    │────▶│  ESWorker   │────▶│    ES       │
│ (PG table)  │     │ (goroutine) │     │  metrics    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### ESWorker Pseudo-code

```go
func (w *ESWorker) Run(ctx context.Context) {
    ticker := time.NewTicker(1 * time.Second)
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            events := w.outboxRepo.GetUnprocessed("es_worker", "METRIC_CREATED", 100)
            for _, event := range events {
                metric := parseMetricFromPayload(event.Payload)
                err := w.esClient.IndexMetric(ctx, metric)
                if err != nil {
                    log.Error("ES index failed", "error", err)
                    continue
                }
                w.outboxRepo.MarkProcessed(event.ID, "es_worker")
            }
        }
    }
}
```

## Dashboard Query Endpoints

| Endpoint | ES Query | Açıklama |
|----------|----------|----------|
| `GET /api/metrics?service_id=X` | Query #1 | Son metrikler |
| `GET /api/metrics/latest` | Query #2 | Tüm servislerin son değerleri |
| `GET /api/stats/overview` | Query #5 | Dashboard summary |
| `GET /api/stats/history?service_id=X&metric_type=Y` | Query #4 | Grafik verisi |
