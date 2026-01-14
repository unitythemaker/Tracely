'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, Service, Incident, Metric, INCIDENT_STATUS } from '@/lib/api';
import {
  AlertTriangle,
  Server,
  Activity,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Play,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const severityConfig: Record<string, { color: string; bgColor: string }> = {
  CRITICAL: { color: '#ff3b5c', bgColor: 'rgba(255, 59, 92, 0.1)' },
  HIGH: { color: '#ffb800', bgColor: 'rgba(255, 184, 0, 0.1)' },
  MEDIUM: { color: '#00d9ff', bgColor: 'rgba(0, 217, 255, 0.1)' },
  LOW: { color: '#6b7a8f', bgColor: 'rgba(107, 122, 143, 0.1)' },
};

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

  const openIncidents = incidents.filter((i) => i.status === INCIDENT_STATUS.OPEN);
  const criticalIncidents = openIncidents.filter((i) => i.severity === 'CRITICAL');
  const inProgressIncidents = incidents.filter((i) => i.status === INCIDENT_STATUS.IN_PROGRESS);

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d9ff]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 grid-pattern min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Servis kalitesi genel görünümü</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#10b981]/10 border border-[#10b981]/20">
            <div className="w-2 h-2 rounded-full bg-[#10b981] status-pulse" />
            <span className="text-sm font-medium text-[#10b981]">Sistem Aktif</span>
          </div>
        </div>
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
                <p className="text-sm text-muted-foreground">Son 24s Metrik</p>
                <p className="text-3xl font-bold text-foreground font-data">{metrics.length}</p>
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
        {/* Latency Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#00d9ff]" />
                Latency (ms)
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
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d9ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d9ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="time"
                    stroke="#6b7a8f"
                    tick={{ fill: '#6b7a8f', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#6b7a8f"
                    tick={{ fill: '#6b7a8f', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111820',
                      border: '1px solid #1f2937',
                      borderRadius: '8px',
                      color: '#e6e8eb',
                    }}
                    labelStyle={{ color: '#6b7a8f' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#00d9ff"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorLatency)"
                  />
                </AreaChart>
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
              {openIncidents.slice(0, 5).map((incident) => {
                const severity = severityConfig[incident.severity] || severityConfig.LOW;
                return (
                  <Link
                    key={incident.id}
                    href={`/incidents/${incident.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-[#00d9ff]/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full status-pulse"
                        style={{ backgroundColor: severity.color }}
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
                    <Badge
                      style={{
                        backgroundColor: severity.bgColor,
                        color: severity.color,
                        border: `1px solid ${severity.color}30`,
                      }}
                    >
                      {incident.severity}
                    </Badge>
                  </Link>
                );
              })}
              {openIncidents.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-[#10b981] opacity-50" />
                  <p className="text-muted-foreground">Açık olay yok</p>
                  <p className="text-xs text-muted-foreground mt-1">Tüm sistemler normal çalışıyor</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
                  href={`/services`}
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
