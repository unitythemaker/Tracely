# Kibana Dashboard Configurations

This directory contains pre-configured Kibana dashboards for Tracely monitoring.

## Files

- **service-health-overview.ndjson** - Comprehensive service health monitoring
- **performance-analytics.ndjson** - Deep performance analysis with percentiles
- **realtime-monitoring.ndjson** - Live monitoring with 5-second refresh

## Quick Import

### Automated (Recommended)

```bash
# From project root
./scripts/setup-kibana-dashboards.sh
```

### Manual Import

1. Open Kibana: http://localhost:5601
2. Go to **Stack Management** → **Saved Objects**
3. Click **Import**
4. Select any `.ndjson` file from this directory
5. Click **Import** and resolve conflicts if needed

## Dashboard Previews

### Service Health Overview
- Time Range: Last 24 hours
- Auto-refresh: 10 seconds
- Visualizations: 6
- Focus: Overall health and trends

### Performance Analytics
- Time Range: Last 24 hours
- Auto-refresh: 30 seconds
- Visualizations: 7
- Focus: Detailed performance metrics

### Real-time Monitoring
- Time Range: Last 1 hour
- Auto-refresh: 5 seconds ⚡
- Visualizations: 8
- Focus: Live operational monitoring

## Requirements

- Elasticsearch 8.11.0+
- Kibana 8.11.0+
- Metrics data in `metrics` index

## Troubleshooting

**Empty dashboards?**
```bash
# Generate test data
cd scripts && npm run seed:once
```

**Import fails?**
- Delete existing index pattern: Stack Management → Index Patterns
- Re-run import with "Overwrite" option

## Full Documentation

See [KIBANA_DASHBOARDS.md](../../docs/KIBANA_DASHBOARDS.md) for complete guide.
