#!/bin/bash

# Generate test data for Tracely
# Usage: ./scripts/generate-test-data.sh

API_URL="${API_URL:-http://localhost:8080}"

echo "🚀 Generating test data for Tracely..."
echo "API URL: $API_URL"

# Services array
SERVICES=("S1" "S2" "S3" "S4" "S5" "S6" "S7" "S8")

# Metric types
METRIC_TYPES=("LATENCY_MS" "PACKET_LOSS" "ERROR_RATE" "BUFFER_RATIO")

# Function to generate random float between min and max
random_float() {
    local min=$1
    local max=$2
    echo "$(awk -v min="$min" -v max="$max" 'BEGIN{srand(); print min+rand()*(max-min)}')"
}

# Function to post metric
post_metric() {
    local service_id=$1
    local metric_type=$2
    local value=$3

    curl -s -X POST "${API_URL}/api/metrics" \
        -H "Content-Type: application/json" \
        -d "{\"service_id\": \"${service_id}\", \"metric_type\": \"${metric_type}\", \"value\": ${value}}" \
        > /dev/null
}

echo ""
echo "📊 Generating normal metrics..."

# Generate normal metrics for each service
for service in "${SERVICES[@]}"; do
    for i in {1..10}; do
        # Normal latency (20-100ms)
        post_metric "$service" "LATENCY_MS" "$(random_float 20 100)"

        # Normal packet loss (0-1%)
        post_metric "$service" "PACKET_LOSS" "$(random_float 0 1)"

        # Normal error rate (0-1.5%)
        post_metric "$service" "ERROR_RATE" "$(random_float 0 1.5)"

        # Normal buffer ratio (0-4%)
        post_metric "$service" "BUFFER_RATIO" "$(random_float 0 4)"
    done
    echo "  ✓ Normal metrics for $service"
done

echo ""
echo "⚠️  Generating problematic metrics (will trigger incidents)..."

# S1 - High latency issues
for i in {1..3}; do
    post_metric "S1" "LATENCY_MS" "$(random_float 160 250)"
done
echo "  ✓ S1: High latency incidents"

# S2 - Packet loss issues
for i in {1..2}; do
    post_metric "S2" "PACKET_LOSS" "$(random_float 2 4)"
done
echo "  ✓ S2: Packet loss incidents"

# S3 - Critical error rate
for i in {1..2}; do
    post_metric "S3" "ERROR_RATE" "$(random_float 6 12)"
done
echo "  ✓ S3: Critical error rate incidents"

# S4 - Buffer issues
for i in {1..2}; do
    post_metric "S4" "BUFFER_RATIO" "$(random_float 7 10)"
done
echo "  ✓ S4: Buffer ratio incidents"

# S5 - Multiple issues
post_metric "S5" "LATENCY_MS" "$(random_float 320 400)"
post_metric "S5" "ERROR_RATE" "$(random_float 3 5)"
echo "  ✓ S5: Multiple issues (critical latency + error rate)"

# S6 - Minor issues
post_metric "S6" "ERROR_RATE" "$(random_float 2.5 4)"
echo "  ✓ S6: Minor error rate issue"

# S7 - Severe packet loss
post_metric "S7" "PACKET_LOSS" "$(random_float 6 10)"
echo "  ✓ S7: Severe packet loss"

# S8 - Normal (no incidents)
echo "  ✓ S8: Normal operation (no incidents)"

echo ""
echo "✅ Test data generation complete!"
echo ""
echo "Summary:"
echo "  - 8 services with normal metrics"
echo "  - Various incidents triggered across services"
echo "  - Check the dashboard at http://localhost:3000"
