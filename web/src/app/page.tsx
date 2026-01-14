'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, Service, Incident, Metric } from '@/lib/api';
import { AlertTriangle, Server, Activity, CheckCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function Dashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [servicesData, incidentsData, metricsData] = await Promise.all([
          api.getServices(),
          api.getIncidents(20),
          api.getMetrics(100),
        ]);
        setServices(servicesData || []);
        setIncidents(incidentsData || []);
        setMetrics(metricsData || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const openIncidents = incidents.filter((i) => i.status === 'OPEN');
  const criticalIncidents = openIncidents.filter((i) => i.severity === 'CRITICAL');

  const chartData = metrics
    .filter((m) => m.metric_type === 'LATENCY_MS')
    .slice(0, 20)
    .reverse()
    .map((m) => ({
      time: format(new Date(m.recorded_at), 'HH:mm', { locale: tr }),
      value: m.value,
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
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Servis kalitesi genel görünümü</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Servis</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Açık Olaylar</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openIncidents.length}</div>
            {criticalIncidents.length > 0 && (
              <p className="text-xs text-red-500">
                {criticalIncidents.length} kritik
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Son 24s Metrik</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistem Durumu</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Aktif</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Recent Incidents */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latency (ms)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
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
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Veri yok
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Son Olaylar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {openIncidents.slice(0, 5).map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{incident.id}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {incident.message}
                    </p>
                  </div>
                  <Badge
                    variant={
                      incident.severity === 'CRITICAL'
                        ? 'destructive'
                        : incident.severity === 'HIGH'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {incident.severity}
                  </Badge>
                </div>
              ))}
              {openIncidents.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Açık olay yok
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
