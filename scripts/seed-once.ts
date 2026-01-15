#!/usr/bin/env npx ts-node
/**
 * One-time seed script - Seeds sample data via API
 * Usage: npx ts-node scripts/seed-once.ts
 *    or: bun scripts/seed-once.ts
 */

const API_BASE = process.env.API_URL || 'http://localhost:8080';

const SERVICES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'];

const METRIC_TYPES = ['LATENCY_MS', 'PACKET_LOSS', 'ERROR_RATE', 'BUFFER_RATIO'] as const;

// Realistic value ranges for each metric type
const METRIC_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  LATENCY_MS: { min: 10, max: 500, unit: 'ms' },
  PACKET_LOSS: { min: 0, max: 15, unit: '%' },
  ERROR_RATE: { min: 0, max: 10, unit: '%' },
  BUFFER_RATIO: { min: 20, max: 100, unit: '%' },
};

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function createMetric(
  serviceId: string,
  metricType: string,
  value: number,
  timestamp?: Date
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      service_id: serviceId,
      metric_type: metricType,
      value: Number(value.toFixed(2)),
    };

    // Add timestamp if provided
    if (timestamp) {
      body.timestamp = timestamp.toISOString();
    }

    const res = await fetch(`${API_BASE}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`Failed to create metric: ${error}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Error creating metric:`, error);
    return false;
  }
}

// Generate a realistic value with time-based patterns
function generateRealisticValue(metricType: string, hour: number, serviceIndex: number): number {
  const range = METRIC_RANGES[metricType];
  let value = randomBetween(range.min, range.max);

  // Service-specific bias (different services have different baselines)
  const serviceBias = 1 + (serviceIndex * 0.05);

  // Time-of-day variation (simulate peak hours 9-18)
  const isPeakHour = hour >= 9 && hour <= 18;
  const peakMultiplier = isPeakHour ? 1.2 : 0.9;

  // Random spikes (5% chance)
  const hasSpike = Math.random() < 0.05;
  const spikeMultiplier = hasSpike ? randomBetween(1.5, 2.5) : 1.0;

  if (metricType === 'LATENCY_MS') {
    value *= serviceBias * peakMultiplier * spikeMultiplier;
  } else if (metricType === 'ERROR_RATE' || metricType === 'PACKET_LOSS') {
    // Errors spike during high traffic
    value *= hasSpike ? spikeMultiplier : (isPeakHour ? 1.1 : 0.8);
  }

  return Math.min(value, range.max * 2); // Cap at 2x max
}

async function seedMetricsSpread(count: number, hoursSpread: number): Promise<void> {
  console.log(`\n📊 Seeding ${count} metrics spread over ${hoursSpread} hours...`);

  const now = new Date();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < count; i++) {
    const serviceId = randomChoice(SERVICES);
    const serviceIndex = SERVICES.indexOf(serviceId);
    const metricType = randomChoice(METRIC_TYPES);

    // Spread timestamps across the time range
    const hoursAgo = randomBetween(0, hoursSpread);
    const minutesOffset = randomInt(0, 59);
    const secondsOffset = randomInt(0, 59);
    const timestamp = new Date(
      now.getTime() -
        hoursAgo * 60 * 60 * 1000 -
        minutesOffset * 60 * 1000 -
        secondsOffset * 1000
    );

    const hour = timestamp.getHours();
    const value = generateRealisticValue(metricType, hour, serviceIndex);

    const ok = await createMetric(serviceId, metricType, value, timestamp);
    if (ok) {
      success++;
      process.stdout.write(`\r  Progress: ${success}/${count} metrics created`);
    } else {
      failed++;
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  console.log(`\n  ✅ Success: ${success}, ❌ Failed: ${failed}`);
}

async function seedWithTimeSeries(days: number, metricsPerHour: number): Promise<void> {
  console.log(`\n📈 Seeding time-series data for ${days} days (${metricsPerHour} metrics/hour per service)...`);

  const now = new Date();
  const totalHours = days * 24;

  let success = 0;
  let failed = 0;

  // For each service, create metrics over time
  for (let svcIdx = 0; svcIdx < SERVICES.length; svcIdx++) {
    const serviceId = SERVICES[svcIdx];
    console.log(`\n  Service ${serviceId}:`);

    for (let hour = 0; hour < totalHours; hour++) {
      // Create timestamp for this hour
      const baseTimestamp = new Date(now.getTime() - (totalHours - hour) * 60 * 60 * 1000);
      const hourOfDay = baseTimestamp.getHours();

      for (let i = 0; i < metricsPerHour; i++) {
        // Add some minute variation within the hour
        const minuteOffset = Math.floor((60 / metricsPerHour) * i) + randomInt(0, 5);
        const timestamp = new Date(baseTimestamp.getTime() + minuteOffset * 60 * 1000);

        const metricType = randomChoice(METRIC_TYPES);
        const value = generateRealisticValue(metricType, hourOfDay, svcIdx);

        const ok = await createMetric(serviceId, metricType, value, timestamp);
        if (ok) {
          success++;
        } else {
          failed++;
        }
      }

      process.stdout.write(`\r    Progress: ${Math.round((hour / totalHours) * 100)}%`);

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  }

  console.log(`\n\n  ✅ Total Success: ${success}, ❌ Failed: ${failed}`);
}

async function main(): Promise<void> {
  console.log('🌱 Tracely One-Time Seeder');
  console.log('==========================');
  console.log(`API: ${API_BASE}`);
  console.log(`Services: ${SERVICES.join(', ')}`);
  console.log(`Metric Types: ${METRIC_TYPES.join(', ')}`);

  // Check API connectivity
  try {
    const res = await fetch(`${API_BASE}/api/services`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log('✅ API connection OK\n');
  } catch (error) {
    console.error('❌ Cannot connect to API. Is the server running?');
    console.error(`   URL: ${API_BASE}`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const mode = args[0] || 'quick';

  switch (mode) {
    case 'quick':
      // Quick seed: 100 metrics spread over 2 hours
      await seedMetricsSpread(100, 2);
      break;

    case 'medium':
      // Medium seed: 500 metrics spread over 12 hours
      await seedMetricsSpread(500, 12);
      break;

    case 'large':
      // Large seed: 2000 metrics spread over 48 hours
      await seedMetricsSpread(2000, 48);
      break;

    case 'timeseries':
      // Time-series seed: 7 days of data, 4 metrics per hour per service
      await seedWithTimeSeries(7, 4);
      break;

    case 'day':
      // One day of data: 24 hours, 10 metrics per hour per service
      await seedWithTimeSeries(1, 10);
      break;

    default:
      console.log('Usage: npx ts-node scripts/seed-once.ts [mode]');
      console.log('Modes:');
      console.log('  quick      - 100 metrics spread over 2 hours (default)');
      console.log('  medium     - 500 metrics spread over 12 hours');
      console.log('  large      - 2000 metrics spread over 48 hours (2 days)');
      console.log('  day        - 1 day of time-series data (10 metrics/hour/service)');
      console.log('  timeseries - 7 days of time-series data (4 metrics/hour/service)');
      process.exit(0);
  }

  console.log('\n🎉 Seeding complete!');
}

main().catch(console.error);
