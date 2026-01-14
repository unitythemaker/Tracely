'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { api, Metric, Service, METRIC_TYPE_LABELS, formatLabel } from '@/lib/api';
import { format } from 'date-fns';
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
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

const metricTypeConfig: Record<string, { color: string; unit: string }> = {
  LATENCY_MS: { color: '#00d9ff', unit: 'ms' },
  PACKET_LOSS: { color: '#ff4d6a', unit: '%' },
  ERROR_RATE: { color: '#ffb800', unit: '%' },
  BUFFER_RATIO: { color: '#a855f7', unit: '%' },
};

type SortField = 'service_id' | 'metric_type' | 'value' | 'recorded_at';
type SortDirection = 'asc' | 'desc';

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('recorded_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    async function fetchData() {
      try {
        const [metricsData, servicesData] = await Promise.all([
          api.getMetrics(200),
          api.getServices(),
        ]);
        setMetrics(metricsData || []);
        setServices(servicesData || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filtering and sorting
  const filteredAndSortedMetrics = useMemo(() => {
    let result = [...metrics];

    // Apply filters
    if (selectedService !== 'all') {
      result = result.filter((m) => m.service_id === selectedService);
    }
    if (selectedType !== 'all') {
      result = result.filter((m) => m.metric_type === selectedType);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.service_id.toLowerCase().includes(query) ||
          m.metric_type.toLowerCase().includes(query) ||
          m.value.toString().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'service_id':
          comparison = a.service_id.localeCompare(b.service_id);
          break;
        case 'metric_type':
          comparison = a.metric_type.localeCompare(b.metric_type);
          break;
        case 'value':
          comparison = a.value - b.value;
          break;
        case 'recorded_at':
          comparison = new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [metrics, selectedService, selectedType, searchQuery, sortField, sortDirection]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
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
    setSelectedService('all');
    setSelectedType('all');
    setSearchQuery('');
  }

  const hasActiveFilters = selectedService !== 'all' || selectedType !== 'all' || searchQuery;

  const chartData = filteredAndSortedMetrics
    .slice(0, 30)
    .reverse()
    .map((m) => ({
      time: format(new Date(m.recorded_at), 'HH:mm', { locale: tr }),
      value: m.value,
      type: m.metric_type,
    }));

  // Calculate trend
  const latestValue = chartData[chartData.length - 1]?.value || 0;
  const previousValue = chartData[chartData.length - 2]?.value || latestValue;
  const trend = latestValue - previousValue;
  const trendPercent = previousValue > 0 ? ((trend / previousValue) * 100).toFixed(1) : '0';

  // Get chart color based on selected type or default
  const chartColor =
    selectedType !== 'all' ? metricTypeConfig[selectedType]?.color || '#00d9ff' : '#00d9ff';

  // Get unique services from metrics
  const uniqueServices = [...new Set(metrics.map((m) => m.service_id))];

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Metrikler</h1>
          <p className="text-muted-foreground mt-1">Servis metriklerini inceleyin ve analiz edin</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Son Değer</p>
                <p className="text-3xl font-bold text-foreground font-data">
                  {latestValue.toFixed(1)}
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
                <p className="text-sm text-muted-foreground">Toplam Metrik</p>
                <p className="text-3xl font-bold text-foreground font-data">
                  {filteredAndSortedMetrics.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ortalama</p>
                <p className="text-3xl font-bold text-foreground font-data">
                  {(
                    filteredAndSortedMetrics.reduce((acc, m) => acc + m.value, 0) /
                      filteredAndSortedMetrics.length || 0
                  ).toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Servis veya değer ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>

            {/* Service Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Servis:</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setSelectedService('all')}
                  className={`filter-chip ${selectedService === 'all' ? 'active' : ''}`}
                >
                  Tümü
                </button>
                {uniqueServices.map((service) => (
                  <button
                    key={service}
                    onClick={() => setSelectedService(service)}
                    className={`filter-chip ${selectedService === service ? 'active' : ''}`}
                  >
                    {services.find((s) => s.id === service)?.name || service}
                  </button>
                ))}
              </div>
            </div>

            {/* Metric Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tip:</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setSelectedType('all')}
                  className={`filter-chip ${selectedType === 'all' ? 'active' : ''}`}
                >
                  Tümü
                </button>
                {Object.entries(metricTypeConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedType(key)}
                    className={`filter-chip ${selectedType === key ? 'active' : ''}`}
                    style={
                      selectedType === key
                        ? {
                            borderColor: config.color,
                            color: config.color,
                            backgroundColor: `${config.color}15`,
                          }
                        : {}
                    }
                  >
                    <div
                      className="w-2 h-2 rounded-full mr-1"
                      style={{ backgroundColor: config.color }}
                    />
                    {METRIC_TYPE_LABELS[key] || formatLabel(key)}
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
              {filteredAndSortedMetrics.length} sonuç gösteriliyor
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#00d9ff]" />
            Metrik Grafiği
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3544" />
                <XAxis dataKey="time" stroke="#7d8a9d" tick={{ fill: '#7d8a9d', fontSize: 12 }} />
                <YAxis stroke="#7d8a9d" tick={{ fill: '#7d8a9d', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161d27',
                    border: '1px solid #2a3544',
                    borderRadius: '8px',
                    color: '#e8eaed',
                  }}
                  labelStyle={{ color: '#7d8a9d' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={chartColor}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Veri yok</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle>Metrik Listesi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredAndSortedMetrics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Metrik bulunamadı</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2 text-[#00d9ff]">
                  Filtreleri temizle
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('service_id')}
                  >
                    <div className="flex items-center">
                      Servis
                      <SortIcon field="service_id" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('metric_type')}
                  >
                    <div className="flex items-center">
                      Tip
                      <SortIcon field="metric_type" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('value')}
                  >
                    <div className="flex items-center">
                      Değer
                      <SortIcon field="value" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('recorded_at')}
                  >
                    <div className="flex items-center">
                      Tarih
                      <SortIcon field="recorded_at" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedMetrics.slice(0, 50).map((metric) => {
                  const config = metricTypeConfig[metric.metric_type];
                  return (
                    <TableRow key={metric.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-mono text-sm">{metric.service_id}</TableCell>
                      <TableCell>
                        <Badge
                          className="font-medium"
                          style={{
                            backgroundColor: `${config?.color || '#00d9ff'}15`,
                            color: config?.color || '#00d9ff',
                            border: `1px solid ${config?.color || '#00d9ff'}30`,
                          }}
                        >
                          {METRIC_TYPE_LABELS[metric.metric_type] || formatLabel(metric.metric_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-lg font-medium">
                        {metric.value.toFixed(2)}
                        <span className="text-xs text-muted-foreground ml-1">{config?.unit}</span>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-soft">
                        {format(new Date(metric.recorded_at), 'dd MMM HH:mm:ss', {
                          locale: tr,
                        })}
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
