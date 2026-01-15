'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  api,
  Service,
  Incident,
  Metric,
  AggregatedMetric,
  INCIDENT_STATUS,
  METRIC_TYPE_LABELS,
  formatLabel,
} from '@/lib/api';
import { format, formatDistanceToNow, subHours, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Server,
  AlertTriangle,
  Activity,
  ArrowLeft,
  CheckCircle,
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Calendar,
  Hash,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

const severityConfig: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  CRITICAL: { color: '#ff4d6a', bgColor: 'rgba(255, 77, 106, 0.1)', borderColor: 'rgba(255, 77, 106, 0.3)' },
  HIGH: { color: '#ffb800', bgColor: 'rgba(255, 184, 0, 0.1)', borderColor: 'rgba(255, 184, 0, 0.3)' },
  MEDIUM: { color: '#00d9ff', bgColor: 'rgba(0, 217, 255, 0.1)', borderColor: 'rgba(0, 217, 255, 0.3)' },
  LOW: { color: '#7d8a9d', bgColor: 'rgba(125, 138, 157, 0.1)', borderColor: 'rgba(125, 138, 157, 0.3)' },
};

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  OPEN: { icon: <AlertTriangle className="h-4 w-4" />, color: '#ffb800', label: 'Açık' },
  IN_PROGRESS: { icon: <Play className="h-4 w-4" />, color: '#00d9ff', label: 'İşlemde' },
  CLOSED: { icon: <CheckCircle className="h-4 w-4" />, color: '#10b981', label: 'Çözüldü' },
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

// Custom tooltip for multi-metric chart
function MultiMetricTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color?: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-[#161d27] border border-[#2a3544] rounded-lg p-3 shadow-xl">
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

// Single metric tooltip with detailed stats
function SingleMetricTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; payload: AggregatedMetric }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const config = metricTypeConfig[data.metric_type] || { color: '#00d9ff', unit: '' };

  return (
    <div className="bg-[#161d27] border border-[#2a3544] rounded-lg p-3 shadow-xl">
      <p className="text-sm text-muted-foreground mb-2 font-medium">{label}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Ortalama:</span>
          <span className="font-mono" style={{ color: config.color }}>{data.avg.toFixed(2)} {config.unit}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Min / Max:</span>
          <span className="font-mono">
            <span className="text-[#10b981]">{data.min.toFixed(2)}</span>
            {' / '}
            <span className="text-[#ff4d6a]">{data.max.toFixed(2)}</span>
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">P50:</span>
          <span className="font-mono text-muted-foreground">{data.p50.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">P95:</span>
          <span className="font-mono text-[#ffb800]">{data.p95.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">P99:</span>
          <span className="font-mono text-[#ff4d6a]">{data.p99.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-border">
          <span className="text-muted-foreground">Kayıt:</span>
          <span className="font-mono text-muted-foreground">{data.count}</span>
        </div>
      </div>
    </div>
  );
}

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.id as string;

  const [service, setService] = useState<Service | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [chartData, setChartData] = useState<AggregatedMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Time range and metric type selection
  const [selectedTimeRange, setSelectedTimeRange] = useState(3); // Default 24h
  const [selectedMetricType, setSelectedMetricType] = useState<string>('all');

  // Stats
  const [incidentStats, setIncidentStats] = useState({ open: 0, inProgress: 0, closed: 0, total: 0 });

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
        service_id: serviceId,
        metric_type: selectedMetricType !== 'all' ? selectedMetricType : undefined,
      });
      setChartData(data || []);
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
    } finally {
      setChartLoading(false);
    }
  }, [serviceId, selectedTimeRange, selectedMetricType]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch service details
      const serviceData = await api.getService(serviceId);
      setService(serviceData);

      // Fetch incidents for this service
      const [openIncidents, inProgressIncidents, closedIncidents, recentIncidents] = await Promise.all([
        api.getIncidents({ service_id: serviceId, status: 'OPEN', limit: 1 }),
        api.getIncidents({ service_id: serviceId, status: 'IN_PROGRESS', limit: 1 }),
        api.getIncidents({ service_id: serviceId, status: 'CLOSED', limit: 1 }),
        api.getIncidents({ service_id: serviceId, limit: 10, sort_by: 'opened_at', sort_dir: 'desc' }),
      ]);

      setIncidentStats({
        open: openIncidents.meta.total,
        inProgress: inProgressIncidents.meta.total,
        closed: closedIncidents.meta.total,
        total: openIncidents.meta.total + inProgressIncidents.meta.total + closedIncidents.meta.total,
      });
      setIncidents(recentIncidents.data || []);

      // Fetch recent metrics for the table
      const metricsRes = await api.getMetrics({
        service_id: serviceId,
        limit: 20,
        sort_by: 'recorded_at',
        sort_dir: 'desc',
      });
      setMetrics(metricsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch service data:', err);
      setError((err as Error).message || 'Servis bilgileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  // Calculate health status
  const getHealthStatus = () => {
    if (incidentStats.open > 0) {
      const hasCritical = incidents.some((i) => i.status === 'OPEN' && i.severity === 'CRITICAL');
      return hasCritical
        ? { status: 'Kritik', color: '#ff4d6a', bgColor: 'rgba(255, 77, 106, 0.1)' }
        : { status: 'Uyarı', color: '#ffb800', bgColor: 'rgba(255, 184, 0, 0.1)' };
    }
    return { status: 'Normal', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' };
  };

  const healthStatus = getHealthStatus();

  // Get unique metric types from chart data
  const uniqueMetricTypes = [...new Set(chartData.map((m) => m.metric_type))];

  // Prepare multi-metric chart data
  const prepareMultiMetricChartData = () => {
    if (chartData.length === 0) return [];

    const hours = TIME_RANGES[selectedTimeRange].hours;

    // Group by time bucket
    const timeMap = new Map<string, Record<string, number | string>>();

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

  // Prepare single metric chart data with full stats
  const prepareSingleMetricChartData = () => {
    if (chartData.length === 0) return [];

    const hours = TIME_RANGES[selectedTimeRange].hours;

    return chartData.map((m) => {
      const date = new Date(m.time);
      let timeKey: string;
      if (hours >= 168) {
        timeKey = format(date, 'dd/MM', { locale: tr });
      } else if (hours >= 24) {
        timeKey = format(date, 'dd/MM HH:mm', { locale: tr });
      } else {
        timeKey = format(date, 'HH:mm', { locale: tr });
      }

      return {
        ...m,
        time: timeKey,
      };
    });
  };

  const multiMetricChartData = prepareMultiMetricChartData();
  const singleMetricChartData = prepareSingleMetricChartData();

  // Latest metric values for cards
  const latestMetrics = metrics.reduce((acc, m) => {
    if (!acc[m.metric_type] || new Date(m.recorded_at) > new Date(acc[m.metric_type].recorded_at)) {
      acc[m.metric_type] = m;
    }
    return acc;
  }, {} as Record<string, Metric>);

  // Calculate averages for stats cards (from aggregated data)
  const getMetricStats = (metricType: string) => {
    const typeData = chartData.filter((m) => m.metric_type === metricType);
    if (typeData.length === 0) return null;

    const totalCount = typeData.reduce((sum, m) => sum + m.count, 0);
    const weightedAvg = typeData.reduce((sum, m) => sum + m.avg * m.count, 0) / totalCount;
    const minVal = Math.min(...typeData.map((m) => m.min));
    const maxVal = Math.max(...typeData.map((m) => m.max));
    const avgP95 = typeData.reduce((sum, m) => sum + m.p95 * m.count, 0) / totalCount;

    return { avg: weightedAvg, min: minVal, max: maxVal, p95: avgP95, count: totalCount };
  };

  // Metric distribution for bar chart
  const metricDistribution = Object.entries(
    metrics.reduce((acc, m) => {
      acc[m.metric_type] = (acc[m.metric_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, count]) => ({
    name: METRIC_TYPE_LABELS[type] || formatLabel(type),
    value: count,
    fill: metricTypeConfig[type]?.color || '#00d9ff',
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d9ff]" />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Geri
        </Button>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Server className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Servis Bulunamadı</h2>
              <p className="text-muted-foreground">{error || 'Bu servis mevcut değil veya silinmiş olabilir.'}</p>
              <Link href="/services">
                <Button className="mt-4 btn-primary">
                  Servislere Dön
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 grid-pattern min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="mt-1">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-[#00d9ff]/10 flex items-center justify-center">
                <Server className="w-6 h-6 text-[#00d9ff]" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{service.name}</h1>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="font-mono text-sm">{service.id}</span>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="flex items-center gap-1 text-sm">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(service.created_at), 'dd MMMM yyyy', { locale: tr })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Badge
          className="text-sm font-medium px-3 py-1.5"
          style={{
            backgroundColor: healthStatus.bgColor,
            color: healthStatus.color,
            border: `1px solid ${healthStatus.color}30`,
          }}
        >
          <div
            className={`w-2 h-2 rounded-full mr-2 ${incidentStats.open > 0 ? 'status-pulse' : ''}`}
            style={{ backgroundColor: healthStatus.color }}
          />
          {healthStatus.status}
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Açık Olaylar</p>
                <p className="text-3xl font-bold text-[#ffb800] font-data">{incidentStats.open}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {incidentStats.inProgress} işlemde
                </p>
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
                <p className="text-sm text-muted-foreground">Toplam Olay</p>
                <p className="text-3xl font-bold text-foreground font-data">{incidentStats.total}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {incidentStats.closed} çözüldü
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#10b981]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Metrik Sayısı</p>
                <p className="text-3xl font-bold text-[#00d9ff] font-data">
                  {chartData.reduce((sum, m) => sum + m.count, 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Son {TIME_RANGES[selectedTimeRange].label}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#00d9ff]/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-[#00d9ff]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Metrik Tipi</p>
                <p className="text-3xl font-bold text-[#a855f7] font-data">{uniqueMetricTypes.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  farklı tip
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#a855f7]/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#a855f7]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Metric Values */}
      {Object.keys(latestMetrics).length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-[#00d9ff]" />
              Güncel Metrik Değerleri
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(latestMetrics).map(([type, metric]) => {
                const config = metricTypeConfig[type] || { color: '#00d9ff', unit: '' };
                const stats = getMetricStats(type);
                return (
                  <div
                    key={type}
                    className="p-4 rounded-lg border border-border"
                    style={{ borderLeftColor: config.color, borderLeftWidth: '3px' }}
                  >
                    <p className="text-sm text-muted-foreground mb-1">
                      {METRIC_TYPE_LABELS[type] || formatLabel(type)}
                    </p>
                    <p className="text-2xl font-bold font-data" style={{ color: config.color }}>
                      {metric.value.toFixed(2)}
                      <span className="text-sm text-muted-foreground ml-1">{config.unit}</span>
                    </p>
                    {stats && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                        <div className="flex justify-between">
                          <span>Ort:</span>
                          <span className="font-mono">{stats.avg.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>P95:</span>
                          <span className="font-mono text-[#ffb800]">{stats.p95.toFixed(1)}</span>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(metric.recorded_at), { addSuffix: true, locale: tr })}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Metrics Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#00d9ff]" />
                Metrik Grafiği
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
                <Link href={`/metrics?service_id=${serviceId}`}>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[#00d9ff]">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardTitle>
            {/* Metric Type Filter */}
            <div className="flex items-center gap-2 pt-3">
              <span className="text-sm text-muted-foreground">Tip:</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setSelectedMetricType('all')}
                  className={`filter-chip ${selectedMetricType === 'all' ? 'active' : ''}`}
                >
                  Tümü
                </button>
                {uniqueMetricTypes.map((type) => {
                  const config = metricTypeConfig[type] || { color: '#00d9ff' };
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedMetricType(type)}
                      className={`filter-chip ${selectedMetricType === type ? 'active' : ''}`}
                      style={selectedMetricType === type ? { backgroundColor: config.color, borderColor: config.color } : {}}
                    >
                      {METRIC_TYPE_LABELS[type] || formatLabel(type)}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {chartLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00d9ff]" />
              </div>
            ) : selectedMetricType === 'all' ? (
              // Multi-metric view
              multiMetricChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={multiMetricChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3544" />
                    <XAxis
                      dataKey="time"
                      stroke="#7d8a9d"
                      tick={{ fill: '#7d8a9d', fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis stroke="#7d8a9d" tick={{ fill: '#7d8a9d', fontSize: 11 }} />
                    <Tooltip content={<MultiMetricTooltip />} />
                    <Legend
                      formatter={(value) => {
                        const metricType = value.replace('_avg', '');
                        return METRIC_TYPE_LABELS[metricType] || formatLabel(metricType);
                      }}
                      wrapperStyle={{ fontSize: '11px' }}
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
              )
            ) : (
              // Single metric view with detailed tooltip
              singleMetricChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={singleMetricChartData}>
                    <defs>
                      <linearGradient id={`gradient-${selectedMetricType}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={metricTypeConfig[selectedMetricType]?.color || '#00d9ff'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={metricTypeConfig[selectedMetricType]?.color || '#00d9ff'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3544" />
                    <XAxis
                      dataKey="time"
                      stroke="#7d8a9d"
                      tick={{ fill: '#7d8a9d', fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis stroke="#7d8a9d" tick={{ fill: '#7d8a9d', fontSize: 11 }} />
                    <Tooltip content={<SingleMetricTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="avg"
                      stroke={metricTypeConfig[selectedMetricType]?.color || '#00d9ff'}
                      strokeWidth={2}
                      dot={false}
                      name="Ortalama"
                    />
                    <Line
                      type="monotone"
                      dataKey="p95"
                      stroke="#ffb800"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                      name="P95"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Veri yok</p>
                  </div>
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Metric Type Distribution */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#a855f7]" />
              Metrik Dağılımı
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {metricDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metricDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3544" />
                  <XAxis type="number" stroke="#7d8a9d" tick={{ fill: '#7d8a9d', fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#7d8a9d"
                    tick={{ fill: '#7d8a9d', fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161d27',
                      border: '1px solid #2a3544',
                      borderRadius: '8px',
                      color: '#e8eaed',
                    }}
                    formatter={(value) => [value, 'Kayıt']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Metrik verisi yok</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Incidents */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#ffb800]" />
              Son Olaylar
            </div>
            <Link href={`/incidents?service_id=${serviceId}`}>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[#00d9ff]">
                Tümünü Gör
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {incidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-[#10b981] opacity-50" />
              <p>Bu servis için olay kaydı yok</p>
              <p className="text-xs mt-1">Servis sorunsuz çalışıyor</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">ID</TableHead>
                  <TableHead className="text-muted-foreground">Durum</TableHead>
                  <TableHead className="text-muted-foreground">Önem</TableHead>
                  <TableHead className="text-muted-foreground">Mesaj</TableHead>
                  <TableHead className="text-muted-foreground">Tarih</TableHead>
                  <TableHead className="text-muted-foreground text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.slice(0, 5).map((incident) => {
                  const severity = severityConfig[incident.severity] || severityConfig.LOW;
                  const status = statusConfig[incident.status] || statusConfig.OPEN;
                  return (
                    <TableRow key={incident.id} className="border-border hover:bg-muted/30">
                      <TableCell>
                        <Link
                          href={`/incidents/${incident.id}`}
                          className="font-mono text-sm text-[#00d9ff] hover:underline"
                        >
                          {incident.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center gap-2 px-2 py-1 rounded-md w-fit"
                          style={{
                            backgroundColor: `${status.color}15`,
                            border: `1px solid ${status.color}30`,
                          }}
                        >
                          <span style={{ color: status.color }}>{status.icon}</span>
                          <span className="text-sm" style={{ color: status.color }}>
                            {status.label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="font-medium"
                          style={{
                            backgroundColor: severity.bgColor,
                            color: severity.color,
                            border: `1px solid ${severity.borderColor}`,
                          }}
                        >
                          {incident.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-soft">
                        {incident.message}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-soft">
                        {format(new Date(incident.opened_at), 'dd MMM HH:mm', { locale: tr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/incidents/${incident.id}`}>
                          <Button variant="ghost" size="icon-sm">
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Metrics */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#a855f7]" />
              Son Metrikler
            </div>
            <Link href={`/metrics?service_id=${serviceId}`}>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[#00d9ff]">
                Tümünü Gör
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {metrics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Bu servis için metrik verisi yok</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Tip</TableHead>
                  <TableHead className="text-muted-foreground">Değer</TableHead>
                  <TableHead className="text-muted-foreground">Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.slice(0, 10).map((metric) => {
                  const config = metricTypeConfig[metric.metric_type] || { color: '#00d9ff', unit: '' };
                  return (
                    <TableRow key={metric.id} className="border-border hover:bg-muted/30">
                      <TableCell>
                        <Badge
                          className="font-medium"
                          style={{
                            backgroundColor: `${config.color}15`,
                            color: config.color,
                            border: `1px solid ${config.color}30`,
                          }}
                        >
                          {METRIC_TYPE_LABELS[metric.metric_type] || formatLabel(metric.metric_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-lg font-medium">
                        {metric.value.toFixed(2)}
                        <span className="text-xs text-muted-foreground ml-1">{config.unit}</span>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-soft">
                        {format(new Date(metric.recorded_at), 'dd MMM HH:mm:ss', { locale: tr })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
