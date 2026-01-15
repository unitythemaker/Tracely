'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  api,
  Service,
  Incident,
  Metric,
  AggregatedMetric,
  INCIDENT_STATUS,
  METRIC_TYPE_LABELS,
  formatLabel,
  PaginationMeta,
} from '@/lib/api';
import {
  AlertTriangle,
  Server,
  Activity,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Play,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, subHours, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';

const severityConfig: Record<string, { color: string; bgColor: string }> = {
  CRITICAL: { color: '#ff3b5c', bgColor: 'rgba(255, 59, 92, 0.1)' },
  HIGH: { color: '#ffb800', bgColor: 'rgba(255, 184, 0, 0.1)' },
  MEDIUM: { color: '#00d9ff', bgColor: 'rgba(0, 217, 255, 0.1)' },
  LOW: { color: '#6b7a8f', bgColor: 'rgba(107, 122, 143, 0.1)' },
};

const metricTypeConfig: Record<string, { color: string; unit: string }> = {
  LATENCY_MS: { color: '#00d9ff', unit: 'ms' },
  PACKET_LOSS: { color: '#ff4d6a', unit: '%' },
  ERROR_RATE: { color: '#ffb800', unit: '%' },
  BUFFER_RATIO: { color: '#a855f7', unit: '%' },
};

// Time range presets
const TIME_RANGES = [
  { label: '1s', hours: 1 },
  { label: '6s', hours: 6 },
  { label: '12s', hours: 12 },
  { label: '24s', hours: 24 },
  { label: '7g', hours: 168 },
] as const;

const METRICS_EXPAND_LEVELS = [5, 10, 20, -1]; // -1 means all

// Custom tooltip for chart
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; payload: { min?: number; max?: number; avg?: number; p50?: number; p95?: number; p99?: number; count?: number } }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-[#111820] border border-[#1f2937] rounded-lg p-3 shadow-xl">
      <p className="text-sm text-muted-foreground mb-2 font-medium">{label}</p>
      <div className="space-y-1 text-sm">
        {data.avg !== undefined && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Ortalama:</span>
            <span className="font-mono text-[#00d9ff]">{data.avg.toFixed(2)}</span>
          </div>
        )}
        {data.min !== undefined && data.max !== undefined && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Min / Max:</span>
            <span className="font-mono">
              <span className="text-[#10b981]">{data.min.toFixed(2)}</span>
              {' / '}
              <span className="text-[#ff4d6a]">{data.max.toFixed(2)}</span>
            </span>
          </div>
        )}
        {data.p50 !== undefined && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">P50:</span>
            <span className="font-mono text-muted-foreground">{data.p50.toFixed(2)}</span>
          </div>
        )}
        {data.p95 !== undefined && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">P95:</span>
            <span className="font-mono text-[#ffb800]">{data.p95.toFixed(2)}</span>
          </div>
        )}
        {data.p99 !== undefined && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">P99:</span>
            <span className="font-mono text-[#ff4d6a]">{data.p99.toFixed(2)}</span>
          </div>
        )}
        {data.count !== undefined && (
          <div className="flex justify-between gap-4 pt-1 border-t border-border">
            <span className="text-muted-foreground">Kayıt:</span>
            <span className="font-mono text-muted-foreground">{data.count}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Multi-metric tooltip
function MultiMetricTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color?: string; name?: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-[#111820] border border-[#1f2937] rounded-lg p-3 shadow-xl">
      <p className="text-sm text-muted-foreground mb-2 font-medium">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => {
          const metricType = entry.dataKey?.replace('_avg', '');
          const config = metricTypeConfig[metricType] || { color: entry.color || '#00d9ff', unit: '' };
          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-sm text-muted-foreground">
                  {METRIC_TYPE_LABELS[metricType] || formatLabel(metricType)}
                </span>
              </div>
              <span className="font-mono text-sm" style={{ color: config.color }}>
                {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
                <span className="text-xs text-muted-foreground ml-1">{config.unit}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [chartData, setChartData] = useState<AggregatedMetric[]>([]);
  const [metricsMeta, setMetricsMeta] = useState<PaginationMeta>({ total: 0, limit: 100, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);

  // Time range state
  const [selectedTimeRange, setSelectedTimeRange] = useState(3); // Default 24h

  // Metrics expand state
  const [metricsExpandLevel, setMetricsExpandLevel] = useState(0); // Index in METRICS_EXPAND_LEVELS

  // Fetch chart data with aggregation
  const fetchChartData = useCallback(async () => {
    setChartLoading(true);
    try {
      const now = new Date();
      const hours = TIME_RANGES[selectedTimeRange].hours;
      const from = hours >= 168 ? subDays(now, 7) : subHours(now, hours);

      const data = await api.getMetricsChart({
        from: from.toISOString(),
        to: now.toISOString(),
      });
      setChartData(data || []);
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
    } finally {
      setChartLoading(false);
    }
  }, [selectedTimeRange]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [servicesRes, incidentsRes, metricsRes] = await Promise.all([
          api.getServices({ limit: 100 }),
          api.getIncidents({ limit: 20 }),
          api.getMetrics({ limit: 100, sort_by: 'recorded_at', sort_dir: 'desc' }),
        ]);
        setServices(servicesRes.data || []);
        setIncidents(incidentsRes.data || []);
        setMetrics(metricsRes.data || []);
        setMetricsMeta(metricsRes.meta);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const openIncidents = incidents.filter((i) => i.status === INCIDENT_STATUS.OPEN);
  const criticalIncidents = openIncidents.filter((i) => i.severity === 'CRITICAL');
  const inProgressIncidents = incidents.filter((i) => i.status === INCIDENT_STATUS.IN_PROGRESS);

  // Prepare multi-metric chart data
  const prepareMultiMetricChartData = () => {
    if (chartData.length === 0) return [];

    // Group by time bucket
    const timeMap = new Map<string, Record<string, string | number>>();
    const hours = TIME_RANGES[selectedTimeRange].hours;

    chartData.forEach((m) => {
      const date = new Date(m.time);
      let timeKey: string;
      if (hours >= 168) {
        timeKey = format(date, 'dd/MM', { locale: tr });
      } else if (hours >= 24) {
        timeKey = format(date, 'dd/MM HH:mm', { locale: tr });
      } else {
        timeKey = format(date, 'HH:mm', { locale: tr });
      }

      if (!timeMap.has(timeKey)) {
        timeMap.set(timeKey, { time: timeKey });
      }
      const entry = timeMap.get(timeKey)!;
      entry[`${m.metric_type}_avg`] = m.avg;
    });

    return Array.from(timeMap.values());
  };

  const multiMetricChartData = prepareMultiMetricChartData();

  // Get unique metric types from chart data
  const uniqueMetricTypes = [...new Set(chartData.map((m) => m.metric_type))];

  // Get current display limit for metrics
  const currentMetricsLimit = METRICS_EXPAND_LEVELS[metricsExpandLevel];
  const displayedMetrics = currentMetricsLimit === -1
    ? metrics
    : metrics.slice(0, currentMetricsLimit);

  const canExpandMore = metricsExpandLevel < METRICS_EXPAND_LEVELS.length - 1 &&
    (currentMetricsLimit === -1 || metrics.length > currentMetricsLimit);
  const canCollapse = metricsExpandLevel > 0;

  function handleExpandMetrics() {
    if (canExpandMore) {
      setMetricsExpandLevel((prev) => prev + 1);
    }
  }

  function handleCollapseMetrics() {
    setMetricsExpandLevel(0);
  }

  // Get next expand label
  function getExpandLabel() {
    const nextLevel = metricsExpandLevel + 1;
    if (nextLevel >= METRICS_EXPAND_LEVELS.length) return '';
    const nextLimit = METRICS_EXPAND_LEVELS[nextLevel];
    if (nextLimit === -1) {
      return `Tümünü Göster (${metricsMeta.total})`;
    }
    return `${nextLimit} Göster`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d9ff]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 grid-pattern min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Servis kalitesi genel görünümü</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Toplam Servis</p>
                <p className="text-3xl font-bold text-foreground font-data">{services.length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#00d9ff]/10 flex items-center justify-center">
                <Server className="w-6 h-6 text-[#00d9ff]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Açık Olaylar</p>
                <p className="text-3xl font-bold text-[#ffb800] font-data">{openIncidents.length}</p>
                {criticalIncidents.length > 0 && (
                  <p className="text-xs text-[#ff3b5c] mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {criticalIncidents.length} kritik
                  </p>
                )}
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#ffb800]/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-[#ffb800]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">İşlenen Olaylar</p>
                <p className="text-3xl font-bold text-[#00d9ff] font-data">{inProgressIncidents.length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#00d9ff]/10 flex items-center justify-center">
                <Play className="w-6 h-6 text-[#00d9ff]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Toplam Metrik</p>
                <p className="text-3xl font-bold text-foreground font-data">{metricsMeta.total}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#a855f7]/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#a855f7]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Recent Incidents */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Multi-Metric Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#00d9ff]" />
                Metrikler
              </div>
              <div className="flex items-center gap-2">
                {/* Time Range Selector */}
                <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5">
                  {TIME_RANGES.map((range, index) => (
                    <button
                      key={range.label}
                      onClick={() => setSelectedTimeRange(index)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        selectedTimeRange === index
                          ? 'bg-[#00d9ff] text-black font-medium'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
                <Link href="/metrics">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[#00d9ff]">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {chartLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00d9ff]" />
              </div>
            ) : multiMetricChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={multiMetricChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="time"
                    stroke="#6b7a8f"
                    tick={{ fill: '#6b7a8f', fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis stroke="#6b7a8f" tick={{ fill: '#6b7a8f', fontSize: 11 }} />
                  <Tooltip content={<MultiMetricTooltip />} />
                  <Legend
                    formatter={(value) => {
                      const metricType = value.replace('_avg', '');
                      return METRIC_TYPE_LABELS[metricType] || formatLabel(metricType);
                    }}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  {uniqueMetricTypes.map((type) => {
                    const config = metricTypeConfig[type] || { color: '#00d9ff' };
                    return (
                      <Line
                        key={type}
                        type="monotone"
                        dataKey={`${type}_avg`}
                        stroke={config.color}
                        strokeWidth={2}
                        dot={false}
                        name={`${type}_avg`}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Veri yok</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Incidents */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#ffb800]" />
                Son Olaylar
              </div>
              <Link href="/incidents">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[#00d9ff]">
                  Tümünü Gör
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {incidents.slice(0, 5).map((incident) => {
                const severity = severityConfig[incident.severity] || severityConfig.LOW;
                const isClosed = incident.status === INCIDENT_STATUS.CLOSED;

                const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
                  [INCIDENT_STATUS.OPEN]: { label: 'Açık', color: '#ffb800', bgColor: 'rgba(255, 184, 0, 0.1)' },
                  [INCIDENT_STATUS.IN_PROGRESS]: { label: 'İşleniyor', color: '#00d9ff', bgColor: 'rgba(0, 217, 255, 0.1)' },
                  [INCIDENT_STATUS.CLOSED]: { label: 'Çözüldü', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
                };
                const status = statusConfig[incident.status];

                return (
                  <Link
                    key={incident.id}
                    href={`/incidents/${incident.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-[#00d9ff]/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${!isClosed ? 'status-pulse' : ''}`}
                        style={{ backgroundColor: isClosed ? '#10b981' : severity.color }}
                      />
                      <div className="space-y-0.5">
                        <p className="text-sm font-mono text-[#00d9ff] group-hover:underline">
                          {incident.id}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {incident.message}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        style={{
                          backgroundColor: severity.bgColor,
                          color: severity.color,
                          border: `1px solid ${severity.color}30`,
                        }}
                      >
                        {incident.severity}
                      </Badge>
                      <Badge
                        style={{
                          backgroundColor: status.bgColor,
                          color: status.color,
                          border: `1px solid ${status.color}30`,
                        }}
                      >
                        {status.label}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
              {incidents.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-[#10b981] opacity-50" />
                  <p className="text-muted-foreground">Olay yok</p>
                  <p className="text-xs text-muted-foreground mt-1">Henüz olay kaydedilmedi</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics List with Expand */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#a855f7]" />
              Son Metrikler
              <span className="text-sm font-normal text-muted-foreground">
                ({displayedMetrics.length} / {metricsMeta.total})
              </span>
            </div>
            <Link href="/metrics">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[#00d9ff]">
                Tümünü Gör
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {displayedMetrics.length > 0 ? (
            <>
              <div className="space-y-2">
                {displayedMetrics.map((metric) => {
                  const config = metricTypeConfig[metric.metric_type] || { color: '#00d9ff', unit: '' };
                  return (
                    <div
                      key={metric.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-[#00d9ff]/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: config.color }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge
                              className="text-xs font-medium"
                              style={{
                                backgroundColor: `${config.color}15`,
                                color: config.color,
                                border: `1px solid ${config.color}30`,
                              }}
                            >
                              {METRIC_TYPE_LABELS[metric.metric_type] || formatLabel(metric.metric_type)}
                            </Badge>
                            <Link
                              href={`/services/${metric.service_id}`}
                              className="text-sm text-muted-foreground hover:text-[#00d9ff] hover:underline"
                            >
                              {services.find((s) => s.id === metric.service_id)?.name || metric.service_id}
                            </Link>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-lg font-medium">
                          {metric.value.toFixed(2)}
                          <span className="text-xs text-muted-foreground ml-1">{config.unit}</span>
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {format(new Date(metric.recorded_at), 'HH:mm:ss', { locale: tr })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Expand/Collapse Buttons */}
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border">
                {canCollapse && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCollapseMetrics}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Daralt
                  </Button>
                )}
                {canExpandMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExpandMetrics}
                    className="text-[#00d9ff] border-[#00d9ff]/30 hover:bg-[#00d9ff]/10"
                  >
                    <ChevronDown className="w-4 h-4 mr-1" />
                    {getExpandLabel()}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground">Metrik verisi yok</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Services Overview */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-[#00d9ff]" />
              Servis Durumu
            </div>
            <Link href="/services">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[#00d9ff]">
                Tümünü Gör
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            {services.map((service) => {
              const serviceIncidents = openIncidents.filter((i) => i.service_id === service.id);
              const hasIssues = serviceIncidents.length > 0;
              const hasCritical = serviceIncidents.some((i) => i.severity === 'CRITICAL');

              return (
                <Link
                  key={service.id}
                  href={`/services/${service.id}`}
                  className="p-4 rounded-lg border border-border hover:border-[#00d9ff]/30 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${hasIssues ? 'status-pulse' : ''}`}
                        style={{
                          backgroundColor: hasCritical
                            ? '#ff3b5c'
                            : hasIssues
                              ? '#ffb800'
                              : '#10b981',
                        }}
                      />
                      <span className="font-medium group-hover:text-[#00d9ff]">{service.name}</span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{service.id}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {hasIssues ? `${serviceIncidents.length} olay açık` : 'Normal'}
                    </span>
                    {hasIssues && (
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{
                          color: hasCritical ? '#ff3b5c' : '#ffb800',
                          borderColor: hasCritical ? '#ff3b5c30' : '#ffb80030',
                        }}
                      >
                        {hasCritical ? 'Kritik' : 'Uyarı'}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
