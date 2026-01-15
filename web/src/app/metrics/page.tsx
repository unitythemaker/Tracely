'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Metric,
  Service,
  AggregatedMetric,
  ChartParams,
  METRIC_TYPE_LABELS,
  formatLabel,
  ListParams,
  PaginationMeta,
} from '@/lib/api';
import { format, subHours, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Clock,
  Calendar,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
} from 'recharts';
import { Pagination } from '@/components/ui/pagination';
import { ColumnSelector, ColumnDefinition } from '@/components/ui/column-selector';
import { MultiSelect } from '@/components/ui/multi-select';
import { usePolling } from '@/hooks/usePolling';
import { RefreshIndicator } from '@/components/ui/refresh-indicator';

const metricTypeConfig: Record<string, { color: string; unit: string }> = {
  LATENCY_MS: { color: '#00d9ff', unit: 'ms' },
  PACKET_LOSS: { color: '#ff4d6a', unit: '%' },
  ERROR_RATE: { color: '#ffb800', unit: '%' },
  BUFFER_RATIO: { color: '#a855f7', unit: '%' },
};

type SortField = 'service_id' | 'metric_type' | 'value' | 'recorded_at';
type SortDirection = 'asc' | 'desc';

// Time range presets
const TIME_RANGES = [
  { id: '1h', label: '1 Saat', hours: 1 },
  { id: '6h', label: '6 Saat', hours: 6 },
  { id: '12h', label: '12 Saat', hours: 12 },
  { id: '24h', label: '24 Saat', hours: 24 },
  { id: '7d', label: '7 Gün', hours: 24 * 7 },
] as const;

const COLUMNS: ColumnDefinition[] = [
  { id: 'service_id', label: 'Servis', defaultVisible: true },
  { id: 'metric_type', label: 'Tip', defaultVisible: true },
  { id: 'value', label: 'Değer', defaultVisible: true },
  { id: 'recorded_at', label: 'Tarih', defaultVisible: true },
  { id: 'id', label: 'ID', defaultVisible: false },
  { id: 'created_at', label: 'Oluşturulma', defaultVisible: false },
];

const DEFAULT_VISIBLE_COLUMNS = COLUMNS.filter((c) => c.defaultVisible !== false).map((c) => c.id);

// Custom tooltip for aggregated chart data
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const metricType = data.metric_type || 'LATENCY_MS';
  const config = metricTypeConfig[metricType] || { color: '#00d9ff', unit: '' };

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 shadow-xl">
      <p className="text-sm font-medium text-white mb-2">{label}</p>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Ortalama:</span>
          <span className="font-mono text-white">{data.avg?.toFixed(2)} {config.unit}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Min:</span>
          <span className="font-mono text-[#10b981]">{data.min?.toFixed(2)} {config.unit}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Max:</span>
          <span className="font-mono text-[#ff4d6a]">{data.max?.toFixed(2)} {config.unit}</span>
        </div>
        <div className="border-t border-[#30363d] my-1.5" />
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">P50:</span>
          <span className="font-mono text-[#a855f7]">{data.p50?.toFixed(2)} {config.unit}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">P95:</span>
          <span className="font-mono text-[#ffb800]">{data.p95?.toFixed(2)} {config.unit}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">P99:</span>
          <span className="font-mono text-[#ff4d6a]">{data.p99?.toFixed(2)} {config.unit}</span>
        </div>
        <div className="border-t border-[#30363d] my-1.5" />
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Veri sayısı:</span>
          <span className="font-mono text-white">{data.count}</span>
        </div>
      </div>
    </div>
  );
}

// Multi-metric tooltip
function MultiMetricTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 shadow-xl">
      <p className="text-sm font-medium text-white mb-2">{label}</p>
      <div className="space-y-2 text-xs">
        {payload.map((entry: any, index: number) => {
          const metricType = entry.dataKey;
          const config = metricTypeConfig[metricType] || { color: entry.color, unit: '' };
          const data = entry.payload[`${metricType}_data`];

          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="font-medium" style={{ color: config.color }}>
                  {METRIC_TYPE_LABELS[metricType] || metricType}
                </span>
              </div>
              {data && (
                <div className="pl-4 space-y-0.5 text-muted-foreground">
                  <div className="flex justify-between gap-3">
                    <span>Avg:</span>
                    <span className="font-mono text-white">{data.avg?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Min-Max:</span>
                    <span className="font-mono text-white">
                      {data.min?.toFixed(1)} - {data.max?.toFixed(1)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [chartData, setChartData] = useState<AggregatedMetric[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, limit: 20, offset: 0 });

  // Filters
  const [selectedService, setSelectedService] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Time range for chart
  const [timeRange, setTimeRange] = useState<string>('24h');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('recorded_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);

  // Debounce search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setOffset(0);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Refs for polling
  const filtersRef = useRef({ limit, offset, sortField, sortDirection, selectedService, selectedType, debouncedSearch, timeRange });
  useEffect(() => {
    filtersRef.current = { limit, offset, sortField, sortDirection, selectedService, selectedType, debouncedSearch, timeRange };
  }, [limit, offset, sortField, sortDirection, selectedService, selectedType, debouncedSearch, timeRange]);

  // Silent fetch for polling
  const fetchMetricsSilent = useCallback(async () => {
    const f = filtersRef.current;
    const params: ListParams = {
      limit: f.limit,
      offset: f.offset,
      sort_by: f.sortField,
      sort_dir: f.sortDirection,
    };

    if (f.selectedService.length > 0) {
      params.service_id = f.selectedService.join(',');
    }
    if (f.selectedType !== 'all') {
      params.metric_type = f.selectedType;
    }
    if (f.debouncedSearch) {
      params.search = f.debouncedSearch;
    }

    const response = await api.getMetrics(params);
    setMetrics(response.data || []);
    setMeta(response.meta);
  }, []);

  const fetchChartDataSilent = useCallback(async () => {
    const f = filtersRef.current;
    const range = TIME_RANGES.find((r) => r.id === f.timeRange) || TIME_RANGES[3];
    const now = new Date();
    const from = range.hours >= 24 * 7
      ? subDays(now, Math.floor(range.hours / 24))
      : subHours(now, range.hours);

    const params: ChartParams = {
      from: from.toISOString(),
      to: now.toISOString(),
    };

    if (f.selectedService.length > 0) {
      params.service_id = f.selectedService.join(',');
    }
    if (f.selectedType !== 'all') {
      params.metric_type = f.selectedType;
    }

    const data = await api.getMetricsChart(params);
    setChartData(data || []);
  }, []);

  const fetchServicesSilent = useCallback(async () => {
    const servicesRes = await api.getServices({ limit: 100 });
    setServices(servicesRes.data || []);
  }, []);

  // Combined fetch for polling
  const fetchAllData = useCallback(async () => {
    await Promise.all([
      fetchMetricsSilent(),
      fetchChartDataSilent(),
    ]);
  }, [fetchMetricsSilent, fetchChartDataSilent]);

  // Polling hook
  const { isRefreshing, lastUpdated, refresh } = usePolling(fetchAllData, {
    interval: 5000,
    enabled: !loading,
  });

  // Initial load
  useEffect(() => {
    async function initialFetch() {
      setLoading(true);
      setChartLoading(true);
      try {
        await Promise.all([
          fetchMetricsSilent(),
          fetchChartDataSilent(),
          fetchServicesSilent(),
        ]);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
        setChartLoading(false);
      }
    }
    initialFetch();
  }, [fetchMetricsSilent, fetchChartDataSilent, fetchServicesSilent]);

  // Refetch when filters change
  useEffect(() => {
    if (!loading) {
      fetchMetricsSilent();
    }
  }, [limit, offset, sortField, sortDirection, selectedService, selectedType, debouncedSearch, loading, fetchMetricsSilent]);

  // Refetch chart when time range or service/type changes
  useEffect(() => {
    if (!loading) {
      fetchChartDataSilent();
    }
  }, [selectedService, selectedType, timeRange, loading, fetchChartDataSilent]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setOffset(0);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4 ml-1 text-[#00d9ff]" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1 text-[#00d9ff]" />
    );
  }

  function clearFilters() {
    setSelectedService([]);
    setSelectedType('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setOffset(0);
  }

  const hasActiveFilters = selectedService.length > 0 || selectedType !== 'all' || searchQuery;

  // Prepare chart data for display
  const prepareChartData = () => {
    if (chartData.length === 0) return [];

    const range = TIME_RANGES.find((r) => r.id === timeRange) || TIME_RANGES[3];
    const timeFormat = range.hours > 24 ? 'dd/MM HH:mm' : 'HH:mm';

    if (selectedType !== 'all') {
      // Single metric type - show with min/max area
      return chartData.map((d) => ({
        time: format(new Date(d.time), timeFormat, { locale: tr }),
        avg: d.avg,
        min: d.min,
        max: d.max,
        p50: d.p50,
        p95: d.p95,
        p99: d.p99,
        count: d.count,
        metric_type: d.metric_type,
      }));
    }

    // Multiple metric types - group by time
    const timeGroups = new Map<string, Record<string, any>>();

    chartData.forEach((d) => {
      const timeLabel = format(new Date(d.time), timeFormat, { locale: tr });
      if (!timeGroups.has(timeLabel)) {
        timeGroups.set(timeLabel, { time: timeLabel });
      }
      const group = timeGroups.get(timeLabel)!;
      group[d.metric_type] = d.avg;
      group[`${d.metric_type}_data`] = d; // Store full data for tooltip
    });

    return Array.from(timeGroups.values());
  };

  const processedChartData = prepareChartData();

  // Get unique metric types in chart data
  const activeMetricTypes =
    selectedType !== 'all'
      ? [selectedType]
      : [...new Set(chartData.map((d) => d.metric_type))];

  // Calculate stats from chart data
  const chartStats = {
    latest: chartData[chartData.length - 1]?.avg || 0,
    previous: chartData[chartData.length - 2]?.avg || chartData[chartData.length - 1]?.avg || 0,
    min: Math.min(...chartData.map((d) => d.min)),
    max: Math.max(...chartData.map((d) => d.max)),
    avgP95: chartData.length > 0
      ? chartData.reduce((sum, d) => sum + d.p95, 0) / chartData.length
      : 0,
  };

  const trend = chartStats.latest - chartStats.previous;
  const trendPercent = chartStats.previous > 0 ? ((trend / chartStats.previous) * 100).toFixed(1) : '0';

  const chartColor =
    selectedType !== 'all' ? metricTypeConfig[selectedType]?.color || '#00d9ff' : '#00d9ff';

  const uniqueServices = services.map((s) => ({ label: s.name, value: s.id }));
  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  return (
    <div className="space-y-6 grid-pattern min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Metrikler</h1>
          <p className="text-muted-foreground mt-1">Servis metriklerini inceleyin ve analiz edin</p>
        </div>
        <RefreshIndicator
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          onRefresh={refresh}
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Son Değer</p>
                <p className="text-3xl font-bold text-foreground font-data">
                  {chartStats.latest.toFixed(1)}
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
                <p className="text-sm text-muted-foreground">Trend</p>
                <div className="flex items-center gap-2">
                  <p
                    className="text-3xl font-bold font-data"
                    style={{
                      color: trend > 0 ? '#ff4d6a' : trend < 0 ? '#10b981' : '#7d8a9d',
                    }}
                  >
                    {trend > 0 ? '+' : ''}
                    {trendPercent}%
                  </p>
                  {trend > 0 ? (
                    <TrendingUp className="w-5 h-5 text-[#ff4d6a]" />
                  ) : trend < 0 ? (
                    <TrendingDown className="w-5 h-5 text-[#10b981]" />
                  ) : (
                    <Minus className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Min / Max</p>
                <p className="text-2xl font-bold text-foreground font-data">
                  <span className="text-[#10b981]">{isFinite(chartStats.min) ? chartStats.min.toFixed(1) : '-'}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-[#ff4d6a]">{isFinite(chartStats.max) ? chartStats.max.toFixed(1) : '-'}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ortalama P95</p>
                <p className="text-3xl font-bold text-[#ffb800] font-data">
                  {chartStats.avgP95.toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#00d9ff]" />
              Metrik Grafiği
              {selectedType !== 'all' && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({METRIC_TYPE_LABELS[selectedType] || selectedType})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div className="flex gap-1">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setTimeRange(range.id)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      timeRange === range.id
                        ? 'bg-[#00d9ff] text-black font-medium'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {chartLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d9ff]" />
            </div>
          ) : processedChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              Bu zaman aralığında veri bulunamadı
            </div>
          ) : selectedType !== 'all' ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={processedChartData}>
                <defs>
                  <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis
                  dataKey="time"
                  stroke="#7d8a9d"
                  tick={{ fill: '#7d8a9d', fontSize: 11 }}
                  tickLine={{ stroke: '#30363d' }}
                />
                <YAxis
                  stroke="#7d8a9d"
                  tick={{ fill: '#7d8a9d', fontSize: 11 }}
                  tickLine={{ stroke: '#30363d' }}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip content={<ChartTooltip />} />
                {/* Min-Max range area */}
                <Area
                  type="monotone"
                  dataKey="max"
                  stroke="transparent"
                  fill="url(#colorRange)"
                  fillOpacity={1}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="min"
                  stroke="transparent"
                  fill="#0d1117"
                  fillOpacity={1}
                  isAnimationActive={false}
                />
                {/* P95 line */}
                <Line
                  type="monotone"
                  dataKey="p95"
                  stroke="#ffb800"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  name="P95"
                  isAnimationActive={false}
                />
                {/* Average line */}
                <Area
                  type="monotone"
                  dataKey="avg"
                  stroke={chartColor}
                  strokeWidth={2}
                  fill="url(#colorAvg)"
                  fillOpacity={1}
                  name="Ortalama"
                  isAnimationActive={false}
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-muted-foreground">{value}</span>
                  )}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={processedChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis
                  dataKey="time"
                  stroke="#7d8a9d"
                  tick={{ fill: '#7d8a9d', fontSize: 11 }}
                  tickLine={{ stroke: '#30363d' }}
                />
                <YAxis
                  stroke="#7d8a9d"
                  tick={{ fill: '#7d8a9d', fontSize: 11 }}
                  tickLine={{ stroke: '#30363d' }}
                />
                <Tooltip content={<MultiMetricTooltip />} />
                {activeMetricTypes.map((type) => (
                  <Line
                    key={type}
                    type="monotone"
                    dataKey={type}
                    stroke={metricTypeConfig[type]?.color || '#00d9ff'}
                    strokeWidth={2}
                    dot={false}
                    name={METRIC_TYPE_LABELS[type] || type}
                    isAnimationActive={false}
                  />
                ))}
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-muted-foreground">{value}</span>
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Servis ID veya değer ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>

            {/* Service Filter */}
            <MultiSelect
              options={uniqueServices}
              selected={selectedService}
              onChange={(values) => {
                setSelectedService(values);
                setOffset(0);
              }}
              placeholder="Servis seçin"
            />

            {/* Metric Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tip:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setSelectedType('all');
                    setOffset(0);
                  }}
                  className={`filter-chip ${selectedType === 'all' ? 'active' : ''}`}
                >
                  Tümü
                </button>
                {Object.entries(METRIC_TYPE_LABELS).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedType(type);
                      setOffset(0);
                    }}
                    className={`filter-chip ${selectedType === type ? 'active' : ''}`}
                    style={
                      selectedType === type
                        ? {
                            borderColor: metricTypeConfig[type]?.color,
                            color: metricTypeConfig[type]?.color,
                            backgroundColor: `${metricTypeConfig[type]?.color}15`,
                          }
                        : {}
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Temizle
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <div className="mt-3 text-sm text-muted-foreground">
              {meta.total} sonuç bulundu
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#00d9ff]" />
              Metrik Listesi
            </CardTitle>
            <div className="flex items-center gap-2">
              <ColumnSelector
                columns={COLUMNS}
                visibleColumns={visibleColumns}
                onVisibilityChange={setVisibleColumns}
                storageKey="metrics-visible-columns"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d9ff]" />
            </div>
          ) : metrics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Metrik bulunamadı</p>
              {hasActiveFilters ? (
                <Button variant="link" onClick={clearFilters} className="mt-2 text-[#00d9ff]">
                  Filtreleri temizle
                </Button>
              ) : (
                <p className="text-xs mt-1">Henüz metrik kaydı yok</p>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    {isColumnVisible('service_id') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('service_id')}
                      >
                        <div className="flex items-center">
                          Servis
                          <SortIcon field="service_id" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('metric_type') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('metric_type')}
                      >
                        <div className="flex items-center">
                          Tip
                          <SortIcon field="metric_type" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('value') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('value')}
                      >
                        <div className="flex items-center">
                          Değer
                          <SortIcon field="value" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('recorded_at') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('recorded_at')}
                      >
                        <div className="flex items-center">
                          Tarih
                          <SortIcon field="recorded_at" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('id') && (
                      <TableHead className="text-muted-foreground">ID</TableHead>
                    )}
                    {isColumnVisible('created_at') && (
                      <TableHead className="text-muted-foreground">Oluşturulma</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((metric) => {
                    const config = metricTypeConfig[metric.metric_type] || {
                      color: '#7d8a9d',
                      unit: '',
                    };
                    return (
                      <TableRow key={metric.id} className="border-border hover:bg-muted/30">
                        {isColumnVisible('service_id') && (
                          <TableCell>
                            <Link
                              href={`/services/${metric.service_id}`}
                              className="text-sm text-[#00d9ff] hover:text-[#33e1ff] hover:underline"
                            >
                              {services.find((s) => s.id === metric.service_id)?.name ||
                                metric.service_id}
                            </Link>
                          </TableCell>
                        )}
                        {isColumnVisible('metric_type') && (
                          <TableCell>
                            <span
                              className="px-2 py-1 rounded-md text-xs font-medium"
                              style={{
                                backgroundColor: `${config.color}20`,
                                color: config.color,
                              }}
                            >
                              {METRIC_TYPE_LABELS[metric.metric_type] ||
                                formatLabel(metric.metric_type)}
                            </span>
                          </TableCell>
                        )}
                        {isColumnVisible('value') && (
                          <TableCell>
                            <span className="font-mono text-sm">
                              {metric.value.toFixed(2)}{' '}
                              <span className="text-muted-foreground">{config.unit}</span>
                            </span>
                          </TableCell>
                        )}
                        {isColumnVisible('recorded_at') && (
                          <TableCell className="text-sm text-muted-foreground font-mono">
                            {format(new Date(metric.recorded_at), 'dd MMM yyyy HH:mm:ss', {
                              locale: tr,
                            })}
                          </TableCell>
                        )}
                        {isColumnVisible('id') && (
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {metric.id.slice(0, 8)}...
                          </TableCell>
                        )}
                        {isColumnVisible('created_at') && (
                          <TableCell className="text-sm text-muted-foreground font-mono">
                            {format(new Date(metric.created_at), 'dd MMM yyyy HH:mm', {
                              locale: tr,
                            })}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="px-4 border-t border-border">
                <Pagination
                  total={meta.total}
                  limit={limit}
                  offset={offset}
                  onPageChange={setOffset}
                  onLimitChange={(newLimit) => {
                    setLimit(newLimit);
                    setOffset(0);
                  }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
