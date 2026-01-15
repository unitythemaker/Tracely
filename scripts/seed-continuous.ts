#!/usr/bin/env npx ts-node
/**
 * Continuous seed script - Continuously writes data at random intervals
 * Usage: npx ts-node scripts/seed-continuous.ts
 *    or: bun scripts/seed-continuous.ts
 *
 * Press Ctrl+C to stop
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

// Interval settings (in milliseconds)
const MIN_INTERVAL = 100;   // Minimum 100ms between metrics
const MAX_INTERVAL = 3000;  // Maximum 3 seconds between metrics

// Burst mode settings
const BURST_CHANCE = 0.1;   // 10% chance of burst
const BURST_COUNT_MIN = 5;
const BURST_COUNT_MAX = 20;

// Stats
let totalCreated = 0;
let totalFailed = 0;
let startTime = Date.now();

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function createMetric(serviceId: string, metricType: string, value: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        metric_type: metricType,
        value: Number(value.toFixed(2)),
      }),
    });

    if (!res.ok) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function generateRealisticValue(metricType: string, serviceId: string): number {
  const range = METRIC_RANGES[metricType];
  let value = randomBetween(range.min, range.max);

  // Add some service-specific variation
  const serviceIndex = SERVICES.indexOf(serviceId);
  const serviceBias = 1 + (serviceIndex * 0.05); // S1 is baseline, S7 is 30% higher

  // Add time-of-day variation (simulate peak hours)
  const hour = new Date().getHours();
  const isPeakHour = hour >= 9 && hour <= 18;
  const peakMultiplier = isPeakHour ? 1.2 : 1.0;

  // Add some random spikes (10% chance)
  const hasSpike = Math.random() < 0.1;
  const spikeMultiplier = hasSpike ? randomBetween(1.5, 3.0) : 1.0;

  if (metricType === 'LATENCY_MS') {
    value *= serviceBias * peakMultiplier * spikeMultiplier;
  } else if (metricType === 'ERROR_RATE' || metricType === 'PACKET_LOSS') {
    // Errors and packet loss spike during high traffic
    value *= hasSpike ? spikeMultiplier : 1.0;
  }

  return Math.min(value, range.max * 3); // Cap at 3x max
}

async function sendMetric(): Promise<void> {
  const serviceId = randomChoice(SERVICES);
  const metricType = randomChoice(METRIC_TYPES);
  const value = generateRealisticValue(metricType, serviceId);

  const ok = await createMetric(serviceId, metricType, value);
  if (ok) {
    totalCreated++;
  } else {
    totalFailed++;
  }
}

async function sendBurst(): Promise<void> {
  const count = randomInt(BURST_COUNT_MIN, BURST_COUNT_MAX);
  const serviceId = randomChoice(SERVICES); // Burst from same service

  console.log(`\n  💥 Burst: ${count} metrics from ${serviceId}`);

  for (let i = 0; i < count; i++) {
    const metricType = randomChoice(METRIC_TYPES);
    const value = generateRealisticValue(metricType, serviceId);
    const ok = await createMetric(serviceId, metricType, value);
    if (ok) totalCreated++;
    else totalFailed++;

    // Very short delay in burst
    await new Promise((resolve) => setTimeout(resolve, randomInt(10, 50)));
  }
}

function printStats(): void {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const rate = totalCreated / (elapsed || 1);

  process.stdout.write(
    `\r📊 Created: ${totalCreated} | Failed: ${totalFailed} | ` +
    `Rate: ${rate.toFixed(1)}/sec | Uptime: ${formatDuration(elapsed)}`
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

async function main(): Promise<void> {
  console.log('🔄 Tracely Continuous Seeder');
  console.log('============================');
  console.log(`API: ${API_BASE}`);
  console.log(`Interval: ${MIN_INTERVAL}ms - ${MAX_INTERVAL}ms`);
  console.log(`Burst chance: ${BURST_CHANCE * 100}%`);
  console.log('\nPress Ctrl+C to stop\n');

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

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping...');
    console.log(`\n📈 Final Stats:`);
    console.log(`   Total Created: ${totalCreated}`);
    console.log(`   Total Failed: ${totalFailed}`);
    console.log(`   Success Rate: ${((totalCreated / (totalCreated + totalFailed)) * 100).toFixed(1)}%`);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`   Uptime: ${formatDuration(elapsed)}`);
    console.log(`   Avg Rate: ${(totalCreated / (elapsed || 1)).toFixed(1)} metrics/sec`);
    process.exit(0);
  });

  // Stats display interval
  setInterval(printStats, 500);

  // Main loop
  while (true) {
    // Check for burst
    if (Math.random() < BURST_CHANCE) {
      await sendBurst();
    } else {
      await sendMetric();
    }

    // Random delay before next metric
    const delay = randomInt(MIN_INTERVAL, MAX_INTERVAL);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

main().catch(console.error);
