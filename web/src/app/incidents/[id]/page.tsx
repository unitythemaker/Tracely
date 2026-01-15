'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { api, Incident, Rule, Service, IncidentComment, IncidentEvent, INCIDENT_STATUS, METRIC_TYPE_LABELS, formatLabel } from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Play,
  Clock,
  Server,
  Settings,
  MessageSquare,
  Send,
  GitCommit,
  User,
  Calendar,
  Tag,
  CircleDot,
} from 'lucide-react';

const severityConfig: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  CRITICAL: { color: '#ff3b5c', bgColor: 'rgba(255, 59, 92, 0.1)', borderColor: 'rgba(255, 59, 92, 0.3)' },
  HIGH: { color: '#ffb800', bgColor: 'rgba(255, 184, 0, 0.1)', borderColor: 'rgba(255, 184, 0, 0.3)' },
  MEDIUM: { color: '#00d9ff', bgColor: 'rgba(0, 217, 255, 0.1)', borderColor: 'rgba(0, 217, 255, 0.3)' },
  LOW: { color: '#6b7a8f', bgColor: 'rgba(107, 122, 143, 0.1)', borderColor: 'rgba(107, 122, 143, 0.3)' },
};

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string; bgColor: string }> = {
  OPEN: { icon: <CircleDot className="h-4 w-4" />, color: '#ffb800', label: 'Açık', bgColor: 'rgba(255, 184, 0, 0.15)' },
  IN_PROGRESS: { icon: <Play className="h-4 w-4" />, color: '#00d9ff', label: 'İşlemde', bgColor: 'rgba(0, 217, 255, 0.15)' },
  CLOSED: { icon: <CheckCircle className="h-4 w-4" />, color: '#10b981', label: 'Çözüldü', bgColor: 'rgba(16, 185, 129, 0.15)' },
};

const eventTypeLabels: Record<string, string> = {
  CREATED: 'oluşturuldu',
  STATUS_CHANGED: 'durumu değiştirdi',
  COMMENT_ADDED: 'yorum ekledi',
  ASSIGNED: 'atandı',
  SEVERITY_CHANGED: 'önem derecesini değiştirdi',
};

const statusLabels: Record<string, string> = {
  OPEN: 'Açık',
  IN_PROGRESS: 'İşlemde',
  CLOSED: 'Çözüldü',
};

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [rule, setRule] = useState<Rule | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [comments, setComments] = useState<IncidentComment[]>([]);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const incidentData = await api.getIncident(id);
        setIncident(incidentData);

        const [ruleData, serviceData, commentsData, eventsData] = await Promise.all([
          api.getRule(incidentData.rule_id).catch(() => null),
          api.getService(incidentData.service_id).catch(() => null),
          api.getIncidentComments(id).catch(() => []),
          api.getIncidentEvents(id).catch(() => []),
        ]);
        setRule(ruleData);
        setService(serviceData);
        setComments(commentsData);
        setEvents(eventsData);
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
      // Refresh events after status change
      const eventsData = await api.getIncidentEvents(id).catch(() => []);
      setEvents(eventsData);
    } catch (error) {
      console.error('Failed to update incident:', error);
      alert('Durum güncellenemedi: ' + (error as Error).message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleSubmitComment() {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await api.createIncidentComment(id, 'Kullanıcı', newComment);
      setNewComment('');
      // Refresh comments and events
      const [commentsData, eventsData] = await Promise.all([
        api.getIncidentComments(id).catch(() => []),
        api.getIncidentEvents(id).catch(() => []),
      ]);
      setComments(commentsData);
      setEvents(eventsData);
    } catch (error) {
      console.error('Failed to create comment:', error);
      alert('Yorum eklenemedi: ' + (error as Error).message);
    } finally {
      setSubmittingComment(false);
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

  // Combine events and comments for timeline
  type TimelineItem =
    | { type: 'event'; data: IncidentEvent; timestamp: string }
    | { type: 'comment'; data: IncidentComment; timestamp: string };

  const timelineItems: TimelineItem[] = [
    ...events.map(e => ({ type: 'event' as const, data: e, timestamp: e.created_at })),
    ...comments.map(c => ({ type: 'comment' as const, data: c, timestamp: c.created_at })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="space-y-6 grid-pattern min-h-screen">
      {/* Header - GitHub style */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/incidents">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold">{incident.message || 'Olay'}</h1>
              <span className="text-2xl text-muted-foreground font-mono">#{incident.id}</span>
            </div>
          </div>
        </div>

        {/* Status badges and actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge
            className="px-3 py-1 text-sm font-medium flex items-center gap-1.5"
            style={{
              backgroundColor: status.bgColor,
              color: status.color,
              border: `1px solid ${status.color}40`
            }}
          >
            {status.icon}
            {status.label}
          </Badge>
          <Badge
            variant="outline"
            className="px-3 py-1 text-sm"
            style={{
              borderColor: severity.borderColor,
              color: severity.color,
              backgroundColor: severity.bgColor
            }}
          >
            <Tag className="w-3 h-3 mr-1.5" />
            {incident.severity}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Açıldı: {formatDistanceToNow(new Date(incident.opened_at), { addSuffix: true, locale: tr })}
          </span>

          <div className="flex-1" />

          {/* Action buttons */}
          {incident.status === INCIDENT_STATUS.OPEN && (
            <Button
              size="sm"
              className="bg-[#00d9ff]/10 text-[#00d9ff] border border-[#00d9ff]/30 hover:bg-[#00d9ff]/20"
              onClick={() => updateStatus(INCIDENT_STATUS.IN_PROGRESS)}
              disabled={updating}
            >
              {updating ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              İşleme Al
            </Button>
          )}
          {incident.status === INCIDENT_STATUS.IN_PROGRESS && (
            <Button
              size="sm"
              className="bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 hover:bg-[#10b981]/20"
              onClick={() => updateStatus(INCIDENT_STATUS.CLOSED)}
              disabled={updating}
            >
              {updating ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Çöz
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Main content - Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left column - Timeline and Discussion */}
        <div className="lg:col-span-3 space-y-6">
          {/* Timeline */}
          <Card className="bg-card border-border">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <GitCommit className="w-5 h-5 text-[#a855f7]" />
                Zaman Çizelgesi
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {timelineItems.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Henüz aktivite yok</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                  <div className="space-y-6">
                    {timelineItems.map((item, index) => (
                      <div key={index} className="relative flex gap-4">
                        {/* Timeline dot */}
                        <div
                          className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: item.type === 'comment' ? 'rgba(0, 217, 255, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                            border: `2px solid ${item.type === 'comment' ? '#00d9ff' : '#a855f7'}`
                          }}
                        >
                          {item.type === 'comment' ? (
                            <MessageSquare className="w-3.5 h-3.5 text-[#00d9ff]" />
                          ) : (
                            <CircleDot className="w-3.5 h-3.5 text-[#a855f7]" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {item.type === 'comment' ? (
                            <div className="bg-muted/30 rounded-lg border border-border">
                              <div className="px-4 py-2 border-b border-border bg-muted/50 rounded-t-lg flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{item.data.author}</span>
                                <span className="text-muted-foreground text-sm">
                                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: tr })}
                                </span>
                              </div>
                              <div className="px-4 py-3">
                                <p className="text-sm whitespace-pre-wrap">{item.data.content}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="py-2">
                              <p className="text-sm">
                                <span className="font-medium">{item.data.actor || 'Sistem'}</span>
                                <span className="text-muted-foreground"> {eventTypeLabels[item.data.event_type] || item.data.event_type}</span>
                                {item.data.old_value && item.data.new_value && (
                                  <span className="text-muted-foreground">
                                    {' '}<Badge variant="outline" className="text-xs mx-1">{statusLabels[item.data.old_value] || item.data.old_value}</Badge>
                                    {' → '}
                                    <Badge variant="outline" className="text-xs mx-1">{statusLabels[item.data.new_value] || item.data.new_value}</Badge>
                                  </span>
                                )}
                                <span className="text-muted-foreground ml-2 text-xs">
                                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: tr })}
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Comment */}
          <Card className="bg-card border-border">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5 text-[#00d9ff]" />
                Yorum Ekle
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <Textarea
                  placeholder="Yorumunuzu yazın..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[100px] resize-none bg-background"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || submittingComment}
                    className="bg-[#00d9ff] hover:bg-[#00d9ff]/80 text-black"
                  >
                    {submittingComment ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Gönder
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Sidebar */}
        <div className="space-y-4">
          {/* Service Info */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Server className="w-4 h-4" />
                Servis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Link
                href={`/services/${incident.service_id}`}
                className="text-[#00d9ff] hover:underline font-medium"
              >
                {service?.name || incident.service_id}
              </Link>
            </CardContent>
          </Card>

          {/* Rule Info */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Settings className="w-4 h-4" />
                Tetikleyen Kural
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <Link
                href="/rules"
                className="text-[#00d9ff] hover:underline font-mono text-sm"
              >
                {incident.rule_id}
              </Link>
              {rule && (
                <div className="text-sm text-muted-foreground">
                  <p>{METRIC_TYPE_LABELS[rule.metric_type] || formatLabel(rule.metric_type)}</p>
                  <p className="font-mono">{rule.operator} {rule.threshold}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Tarihler
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Açıldı</p>
                <p className="text-sm font-mono">
                  {format(new Date(incident.opened_at), 'dd MMM yyyy HH:mm', { locale: tr })}
                </p>
              </div>
              {incident.in_progress_at && (
                <div>
                  <p className="text-xs text-muted-foreground">İşleme Alındı</p>
                  <p className="text-sm font-mono">
                    {format(new Date(incident.in_progress_at), 'dd MMM yyyy HH:mm', { locale: tr })}
                  </p>
                </div>
              )}
              {incident.closed_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Çözüldü</p>
                  <p className="text-sm font-mono">
                    {format(new Date(incident.closed_at), 'dd MMM yyyy HH:mm', { locale: tr })}
                  </p>
                </div>
              )}
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Son Güncelleme</p>
                <p className="text-sm font-mono">
                  {format(new Date(incident.updated_at), 'dd MMM yyyy HH:mm', { locale: tr })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Metric ID */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="w-4 h-4" />
                Metrik ID
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs font-mono text-muted-foreground break-all">
                {incident.metric_id}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
