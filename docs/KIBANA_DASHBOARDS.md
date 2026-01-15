# Kibana Dashboards Guide

This guide explains how to set up and use the Kibana dashboards for Tracely monitoring.

## Quick Start

### 1. Start Kibana

Make sure Elasticsearch and Kibana are running:

```bash
docker-compose up -d elasticsearch kibana
```

Wait for services to be ready (this may take 1-2 minutes):

```bash
# Check Kibana status
curl http://localhost:5601/api/status

# Check Elasticsearch status
curl http://localhost:9200/_cluster/health
```

### 2. Import Dashboards

Run the automated setup script:

```bash
chmod +x scripts/setup-kibana-dashboards.sh
./scripts/setup-kibana-dashboards.sh
```

This script will:
- ✅ Create the index pattern for `metrics*`
- ✅ Import all visualization configurations
- ✅ Set up the three main dashboards
- ✅ Configure auto-refresh intervals

### 3. Access Kibana

Open your browser and navigate to:

**http://localhost:5601**

## Available Dashboards

### 1. Service Health Overview

**URL:** http://localhost:5601/app/dashboards#/view/service-health-dashboard

**Refresh Interval:** 10 seconds
**Time Range:** Last 24 hours

**What's Included:**
- 📊 **Total Metrics Count** - Overall metric volume indicator
- 📈 **Latency Trends** - Multi-service latency comparison over time
- 🔴 **Packet Loss by Service** - Stacked area chart showing packet loss patterns
- 🔥 **Error Rate Heatmap** - Hourly error rate heatmap by service
- ⚡ **Buffer Ratio Gauges** - Current buffer usage for top 5 services
- 📋 **Service Metrics Table** - Detailed breakdown with avg/max/min values

**Best For:**
- Executive overview
- Daily health check
- Service comparison
- Trend identification

---

### 2. Performance Analytics

**URL:** http://localhost:5601/app/dashboards#/view/performance-analytics-dashboard

**Refresh Interval:** 30 seconds
**Time Range:** Last 24 hours

**What's Included:**
- 🥧 **Metrics by Type (Pie Chart)** - Distribution of metric types
- 📊 **Packet Loss Stats** - Avg/Max/Min packet loss indicators
- 📉 **Latency Distribution Histogram** - Latency value distribution (10ms buckets)
- 📈 **Latency Percentiles** - P50, P75, P95, P99 latency trends
- 🔶 **Error Rate Trends** - Max and average error rates over time
- 📊 **Service Performance Comparison** - Horizontal bar chart comparing services across all metrics
- 🌊 **All Metrics Timeline** - Combined view of all metric types (last 6 hours)

**Best For:**
- Performance analysis
- Percentile tracking
- Distribution analysis
- Deep-dive investigations
- SLA monitoring

---

### 3. Real-time Monitoring

**URL:** http://localhost:5601/app/dashboards#/view/realtime-monitoring-dashboard

**Refresh Interval:** 5 seconds ⚡
**Time Range:** Last 1 hour

**What's Included:**
- 🟢 **Current Latency** - Live average latency with color-coded thresholds
  - Green: 0-100ms
  - Yellow: 100-150ms
  - Red: >150ms
- 🔴 **Current Error Rate** - Live error rate percentage
  - Green: 0-5%
  - Yellow: 5-15%
  - Red: >15%
- 📶 **Current Packet Loss** - Live packet loss percentage
  - Green: 0-3%
  - Yellow: 3-10%
  - Red: >10%
- 💾 **Current Buffer Ratio** - Live buffer utilization
  - Green: 0-60%
  - Yellow: 60-80%
  - Red: >80%
- 📡 **Live Metrics Stream** - 15-minute real-time chart with 30s intervals
- 🔥 **Service Activity Heatmap** - Last hour activity by service (5-minute buckets)
- 📊 **Top Services by Metric Count** - Most active services
- 📈 **Latency by Service** - Last hour latency trends with 150ms threshold line

**Best For:**
- Live monitoring
- Incident response
- Real-time alerting
- Operations dashboard (NOC display)

---

## Manual Import (Alternative Method)

If the automated script doesn't work, you can manually import dashboards:

1. Go to **Kibana** → **Stack Management** → **Saved Objects**
2. Click **Import**
3. Select one of these files:
   - `scripts/kibana-dashboards/service-health-overview.ndjson`
   - `scripts/kibana-dashboards/performance-analytics.ndjson`
   - `scripts/kibana-dashboards/realtime-monitoring.ndjson`
4. Click **Import**
5. Resolve any conflicts by selecting "Overwrite"

## Creating the Index Pattern Manually

If you need to create the index pattern manually:

1. Go to **Kibana** → **Stack Management** → **Index Patterns**
2. Click **Create index pattern**
3. Enter: `metrics*`
4. Click **Next step**
5. Select **Time field:** `recorded_at`
6. Click **Create index pattern**

## Customizing Dashboards

### Adjust Time Ranges

Each dashboard has preset time ranges, but you can change them:
- Click the **time picker** in the top right
- Choose from quick options: Last 15 minutes, Last 1 hour, Last 24 hours, Last 7 days
- Or set a custom absolute/relative range

### Modify Refresh Intervals

To change auto-refresh:
1. Click the **refresh interval** dropdown (next to time picker)
2. Select a new interval: 5s, 10s, 30s, 1m, 5m, etc.
3. Or click **Pause** to stop auto-refresh

### Edit Visualizations

To customize a visualization:
1. Click the **gear icon** on any panel
2. Select **Edit visualization**
3. Modify aggregations, filters, or appearance
4. Click **Save** and return to dashboard

### Add Filters

To filter data:
1. Click **Add filter** in the top menu
2. Select field (e.g., `service_name`)
3. Choose operator (is, is not, is one of, etc.)
4. Enter value
5. Click **Save**

## Query Examples

### Using Dev Tools Console

Navigate to **Dev Tools** → **Console** and try these queries:

#### Get Latest Metrics

```json
GET metrics/_search
{
  "size": 10,
  "sort": [
    { "recorded_at": "desc" }
  ]
}
```

#### Average Latency by Service (Last Hour)

```json
GET metrics/_search
{
  "size": 0,
  "query": {
    "bool": {
      "filter": [
        { "term": { "metric_type": "LATENCY_MS" } },
        { "range": { "recorded_at": { "gte": "now-1h" } } }
      ]
    }
  },
  "aggs": {
    "by_service": {
      "terms": {
        "field": "service_name.keyword",
        "size": 20
      },
      "aggs": {
        "avg_latency": {
          "avg": { "field": "value" }
        }
      }
    }
  }
}
```

#### Services with High Error Rate

```json
GET metrics/_search
{
  "size": 0,
  "query": {
    "bool": {
      "filter": [
        { "term": { "metric_type": "ERROR_RATE" } },
        { "range": { "value": { "gte": 10 } } },
        { "range": { "recorded_at": { "gte": "now-24h" } } }
      ]
    }
  },
  "aggs": {
    "high_error_services": {
      "terms": {
        "field": "service_name.keyword",
        "size": 10
      },
      "aggs": {
        "avg_error_rate": {
          "avg": { "field": "value" }
        },
        "max_error_rate": {
          "max": { "field": "value" }
        }
      }
    }
  }
}
```

#### Time Series Data for Grafana-style Chart

```json
GET metrics/_search
{
  "size": 0,
  "query": {
    "bool": {
      "filter": [
        { "term": { "service_id": "S1" } },
        { "term": { "metric_type": "LATENCY_MS" } },
        { "range": { "recorded_at": { "gte": "now-24h" } } }
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
        "max_value": { "max": { "field": "value" } },
        "min_value": { "min": { "field": "value" } }
      }
    }
  }
}
```

## Troubleshooting

### Dashboards Show "No Results"

**Problem:** Dashboards are empty or show "No results found"

**Solutions:**
1. Check if data exists in Elasticsearch:
   ```bash
   curl http://localhost:9200/metrics/_count
   ```
2. Verify time range includes your data
3. Run the seed script to generate test data:
   ```bash
   cd scripts && npm install && npm run seed:once
   ```

### Kibana Won't Start

**Problem:** Kibana container keeps restarting

**Solutions:**
1. Check Elasticsearch is healthy:
   ```bash
   docker-compose logs elasticsearch
   ```
2. Increase Docker memory allocation (min 4GB recommended)
3. Check Kibana logs:
   ```bash
   docker-compose logs kibana
   ```

### "Index pattern conflicts" Error

**Problem:** Import fails due to existing index pattern

**Solutions:**
1. Delete existing pattern: **Stack Management** → **Index Patterns** → delete `metrics*`
2. Re-run the import
3. Or select "Overwrite" during import

### Visualizations Don't Update

**Problem:** Data is flowing but visualizations are stale

**Solutions:**
1. Check auto-refresh is enabled (not paused)
2. Manually refresh: Click the **Refresh** button
3. Verify time range includes recent data
4. Check Elasticsearch refresh interval:
   ```bash
   curl http://localhost:9200/metrics/_settings
   ```

## Performance Tips

### For Large Data Volumes

1. **Reduce Query Range:** Use shorter time windows (1h instead of 24h)
2. **Increase Refresh Interval:** Set to 30s or 1m instead of 5s
3. **Limit Buckets:** Reduce histogram intervals
4. **Use Filters:** Filter by specific services instead of showing all

### Optimize Elasticsearch

Add these settings to your index for better performance:

```bash
curl -X PUT "http://localhost:9200/metrics/_settings" -H 'Content-Type: application/json' -d'
{
  "index": {
    "refresh_interval": "5s",
    "number_of_replicas": 0
  }
}
'
```

## Advanced Features

### Creating Alerts (Requires Kibana Alerting)

1. Go to **Stack Management** → **Rules and Connectors**
2. Click **Create rule**
3. Choose **Threshold** rule type
4. Configure:
   - Index: `metrics*`
   - When: `avg(value)` over `last 5 minutes`
   - Threshold: `> 150` (for latency)
   - Actions: Email, Slack, Webhook, etc.

### Exporting Dashboards

To share or backup dashboards:

1. Go to **Stack Management** → **Saved Objects**
2. Select dashboards to export
3. Click **Export**
4. Save the `.ndjson` file

### Creating Custom Visualizations

1. Go to **Visualize Library**
2. Click **Create visualization**
3. Choose visualization type:
   - **Line** - Time series
   - **Bar** - Comparisons
   - **Gauge** - Current values
   - **Metric** - Single number
   - **Heatmap** - Pattern detection
4. Configure aggregations and appearance
5. Save to dashboard

## Integration with Grafana

If you prefer Grafana over Kibana:

1. Install Elasticsearch data source in Grafana
2. Use the same queries from this guide
3. Configure dashboards using Elasticsearch query builder

Example Grafana query for latency:

```json
{
  "query": "metric_type:LATENCY_MS",
  "metrics": [
    {"type": "avg", "field": "value"}
  ],
  "timeField": "recorded_at"
}
```

## Additional Resources

- [Elasticsearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)
- [Kibana Dashboard Documentation](https://www.elastic.co/guide/en/kibana/current/dashboard.html)
- [Elasticsearch Aggregations](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations.html)
- [Tracely Elasticsearch Architecture](./ELASTICSEARCH_ARCHITECTURE.md)

## Support

If you encounter issues:

1. Check Docker logs: `docker-compose logs kibana elasticsearch`
2. Verify network connectivity: `docker-compose exec server ping elasticsearch`
3. Review Elasticsearch cluster health: `curl http://localhost:9200/_cluster/health?pretty`
4. Check index stats: `curl http://localhost:9200/metrics/_stats?pretty`

---

**Last Updated:** 2026-01-15
**Kibana Version:** 8.11.0
**Elasticsearch Version:** 8.11.0
