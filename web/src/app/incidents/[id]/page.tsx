'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { api, Incident, Rule, Service, INCIDENT_STATUS, METRIC_TYPE_LABELS, formatLabel } from '@/lib/api';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Play,
  Clock,
  Server,
  Settings,
  Activity,
  Calendar,
} from 'lucide-react';

const severityConfig: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  CRITICAL: { color: '#ff3b5c', bgColor: 'rgba(255, 59, 92, 0.1)', borderColor: 'rgba(255, 59, 92, 0.3)' },
  HIGH: { color: '#ffb800', bgColor: 'rgba(255, 184, 0, 0.1)', borderColor: 'rgba(255, 184, 0, 0.3)' },
  MEDIUM: { color: '#00d9ff', bgColor: 'rgba(0, 217, 255, 0.1)', borderColor: 'rgba(0, 217, 255, 0.3)' },
  LOW: { color: '#6b7a8f', bgColor: 'rgba(107, 122, 143, 0.1)', borderColor: 'rgba(107, 122, 143, 0.3)' },
};

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  OPEN: { icon: <AlertTriangle className="h-5 w-5" />, color: '#ffb800', label: 'Açık' },
  IN_PROGRESS: { icon: <Play className="h-5 w-5" />, color: '#00d9ff', label: 'İşleniyor' },
  CLOSED: { icon: <CheckCircle className="h-5 w-5" />, color: '#10b981', label: 'Çözüldü' },
};

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [rule, setRule] = useState<Rule | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const incidentData = await api.getIncident(id);
        setIncident(incidentData);

        // Fetch related data
        const [ruleData, serviceData] = await Promise.all([
          api.getRule(incidentData.rule_id).catch(() => null),
          api.getService(incidentData.service_id).catch(() => null),
        ]);
        setRule(ruleData);
        setService(serviceData);
      } catch (error) {
        console.error('Failed to fetch incident:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  async function updateStatus(status: string) {
    if (!incident) return;
    setUpdating(true);
    try {
      await api.updateIncidentStatus(incident.id, status);
      setIncident({ ...incident, status });
    } catch (error) {
      console.error('Failed to update incident:', error);
      alert('Durum güncellenemedi: ' + (error as Error).message);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d9ff]" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-semibold mb-2">Olay Bulunamadı</h2>
        <p className="text-muted-foreground mb-4">ID: {id}</p>
        <Link href="/incidents">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Olaylara Dön
          </Button>
        </Link>
      </div>
    );
  }

  const severity = severityConfig[incident.severity] || severityConfig.LOW;
  const status = statusConfig[incident.status] || statusConfig.OPEN;

  return (
    <div className="space-y-6 grid-pattern min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/incidents">
            <Button variant="outline" size="icon" className="border-border">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-mono">{incident.id}</h1>
            <p className="text-muted-foreground mt-1">Olay Detayları</p>
          </div>
        </div>
      </div>

      {/* Status and Severity Banner */}
      <div className="flex gap-4">
        <Card
          className="flex-1 border-2"
          style={{ borderColor: status.color, backgroundColor: `${status.color}10` }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${status.color}20` }}
                >
                  <span style={{ color: status.color }}>{status.icon}</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Durum</p>
                  <p className="text-2xl font-bold" style={{ color: status.color }}>
                    {status.label}
                  </p>
                </div>
              </div>
              {incident.status === INCIDENT_STATUS.OPEN && (
                <Button
                  className="btn-outline-cyan"
                  onClick={() => updateStatus(INCIDENT_STATUS.IN_PROGRESS)}
                  disabled={updating}
                >
                  {updating ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      İşleme Al
                    </>
                  )}
                </Button>
              )}
              {incident.status === INCIDENT_STATUS.IN_PROGRESS && (
                <Button
                  className="btn-outline-success"
                  onClick={() => updateStatus(INCIDENT_STATUS.CLOSED)}
                  disabled={updating}
                >
                  {updating ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Çöz
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <Card
          className="flex-1 border-2"
          style={{ borderColor: severity.borderColor, backgroundColor: severity.bgColor }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${severity.color}20` }}
              >
                <AlertTriangle className="w-6 h-6" style={{ color: severity.color }} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Önem Derecesi</p>
                <p className="text-2xl font-bold" style={{ color: severity.color }}>
                  {incident.severity}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#00d9ff]" />
            Olay Mesajı
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-lg leading-relaxed">{incident.message}</p>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Service Info */}
        <Card className="bg-card border-border card-hover">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-[#00d9ff]" />
              Servis Bilgisi
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Servis ID</span>
              <Link
                href={`/services/${incident.service_id}`}
                className="font-mono text-[#00d9ff] hover:underline"
              >
                {incident.service_id}
              </Link>
            </div>
            {service && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Servis Adı</span>
                <span className="font-medium">{service.name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rule Info */}
        <Card className="bg-card border-border card-hover">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#ffb800]" />
              Tetikleyen Kural
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Kural ID</span>
              <Link
                href={`/rules`}
                className="font-mono text-[#00d9ff] hover:underline"
              >
                {incident.rule_id}
              </Link>
            </div>
            {rule && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Metrik Tipi</span>
                  <Badge variant="outline">{METRIC_TYPE_LABELS[rule.metric_type] || formatLabel(rule.metric_type)}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Koşul</span>
                  <span className="font-mono">
                    {rule.operator} {rule.threshold}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="bg-card border-border card-hover md:col-span-2">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#a855f7]" />
              Zaman Çizelgesi
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-8">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Açılma Tarihi</p>
                <p className="font-mono text-lg">
                  {format(new Date(incident.opened_at), 'dd MMMM yyyy HH:mm:ss', { locale: tr })}
                </p>
              </div>
              {incident.closed_at && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Çözülme Tarihi</p>
                  <p className="font-mono text-lg">
                    {format(new Date(incident.closed_at), 'dd MMMM yyyy HH:mm:ss', { locale: tr })}
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Son Güncelleme</p>
                <p className="font-mono text-lg">
                  {format(new Date(incident.updated_at), 'dd MMMM yyyy HH:mm:ss', { locale: tr })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metric ID */}
      <Card className="bg-card border-border">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tetikleyen Metrik ID</span>
            <span className="font-mono text-sm text-muted-foreground">{incident.metric_id}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
