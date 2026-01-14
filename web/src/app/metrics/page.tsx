'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, Metric, Service } from '@/lib/api';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const metricTypeLabels: Record<string, string> = {
  LATENCY_MS: 'Latency (ms)',
  PACKET_LOSS: 'Packet Loss (%)',
  ERROR_RATE: 'Error Rate (%)',
  BUFFER_RATIO: 'Buffer Ratio (%)',
};

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

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

  const filteredMetrics = metrics.filter((m) => {
    if (selectedService !== 'all' && m.service_id !== selectedService) return false;
    if (selectedType !== 'all' && m.metric_type !== selectedType) return false;
    return true;
  });

  const chartData = filteredMetrics
    .slice(0, 30)
    .reverse()
    .map((m) => ({
      time: format(new Date(m.recorded_at), 'HH:mm', { locale: tr }),
      value: m.value,
      type: m.metric_type,
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Metrikler</h1>
          <p className="text-muted-foreground">Servis metriklerini inceleyin</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Servis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Servisler</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Tipler</SelectItem>
              <SelectItem value="LATENCY_MS">Latency</SelectItem>
              <SelectItem value="PACKET_LOSS">Packet Loss</SelectItem>
              <SelectItem value="ERROR_RATE">Error Rate</SelectItem>
              <SelectItem value="BUFFER_RATIO">Buffer Ratio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Metrik Grafiği</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Veri yok
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Metrik Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMetrics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Metrik bulunamadı
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servis</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Değer</TableHead>
                  <TableHead>Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMetrics.slice(0, 50).map((metric) => (
                  <TableRow key={metric.id}>
                    <TableCell>{metric.service_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {metricTypeLabels[metric.metric_type] || metric.metric_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {metric.value.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(metric.recorded_at), 'dd MMM HH:mm:ss', {
                        locale: tr,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
