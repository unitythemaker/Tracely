#!/bin/bash

# Kibana Dashboard Setup Script
# This script creates index patterns, visualizations, and dashboards in Kibana

KIBANA_URL="http://localhost:5601"
ES_URL="http://localhost:9200"

echo "🚀 Setting up Kibana dashboards for Tracely..."

# Wait for Kibana to be ready
echo "⏳ Waiting for Kibana to be ready..."
until curl -s "$KIBANA_URL/api/status" | grep -q "available"; do
  echo "Waiting for Kibana..."
  sleep 5
done
echo "✅ Kibana is ready!"

# Wait for Elasticsearch to be ready
echo "⏳ Waiting for Elasticsearch to be ready..."
until curl -s "$ES_URL/_cluster/health" | grep -q "yellow\|green"; do
  echo "Waiting for Elasticsearch..."
  sleep 5
done
echo "✅ Elasticsearch is ready!"

# Check if metrics index exists
echo "📊 Checking metrics index..."
if ! curl -s "$ES_URL/metrics" | grep -q "metrics"; then
  echo "⚠️  Warning: 'metrics' index not found. Make sure to run the seed script first."
fi

# Create index pattern
echo "📋 Creating index pattern..."
curl -X POST "$KIBANA_URL/api/saved_objects/index-pattern/metrics-pattern" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -d '{
    "attributes": {
      "title": "metrics*",
      "timeFieldName": "recorded_at"
    }
  }' 2>/dev/null

echo ""
echo "✅ Index pattern created!"

# Set as default index pattern
curl -X POST "$KIBANA_URL/api/kibana/settings/defaultIndex" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -d '{"value": "metrics-pattern"}' 2>/dev/null

echo ""
echo "🎨 Importing dashboards..."

# Import the dashboard configurations
for dashboard_file in scripts/kibana-dashboards/*.ndjson; do
  if [ -f "$dashboard_file" ]; then
    echo "📦 Importing $(basename $dashboard_file)..."
    curl -X POST "$KIBANA_URL/api/saved_objects/_import?overwrite=true" \
      -H "kbn-xsrf: true" \
      --form file=@"$dashboard_file" 2>/dev/null
    echo ""
  fi
done

echo ""
echo "✨ Setup complete!"
echo ""
echo "🌐 Access Kibana at: $KIBANA_URL"
echo "📊 Dashboards are ready to use!"
echo ""
echo "Available Dashboards:"
echo "  1. Service Health Overview - Real-time service status"
echo "  2. Performance Analytics - Deep dive into metrics"
echo "  3. Real-time Monitoring - Live metrics dashboard"
echo ""
