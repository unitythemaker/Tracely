'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
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
import { api, Incident, INCIDENT_STATUS, Service } from '@/lib/api';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Play,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X
} from 'lucide-react';

const severityConfig: Record<string, { color: string; bgColor: string; borderColor: string; priority: number }> = {
  CRITICAL: { color: '#ff4d6a', bgColor: 'rgba(255, 77, 106, 0.1)', borderColor: 'rgba(255, 77, 106, 0.3)', priority: 4 },
  HIGH: { color: '#ffb800', bgColor: 'rgba(255, 184, 0, 0.1)', borderColor: 'rgba(255, 184, 0, 0.3)', priority: 3 },
  MEDIUM: { color: '#00d9ff', bgColor: 'rgba(0, 217, 255, 0.1)', borderColor: 'rgba(0, 217, 255, 0.3)', priority: 2 },
  LOW: { color: '#7d8a9d', bgColor: 'rgba(125, 138, 157, 0.1)', borderColor: 'rgba(125, 138, 157, 0.3)', priority: 1 },
};

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string; priority: number }> = {
  OPEN: { icon: <AlertTriangle className="h-4 w-4" />, color: '#ffb800', label: 'Açık', priority: 3 },
  IN_PROGRESS: { icon: <Play className="h-4 w-4" />, color: '#00d9ff', label: 'İşleniyor', priority: 2 },
  CLOSED: { icon: <CheckCircle className="h-4 w-4" />, color: '#10b981', label: 'Çözüldü', priority: 1 },
};

type SortField = 'id' | 'status' | 'severity' | 'service_id' | 'opened_at';
type SortDirection = 'asc' | 'desc';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('opened_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [incidentsData, servicesData] = await Promise.all([
        api.getIncidents(200),
        api.getServices(),
      ]);
      setIncidents(incidentsData || []);
      setServices(servicesData || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    try {
      await api.updateIncidentStatus(id, status);
      await fetchData();
    } catch (error) {
      console.error('Failed to update incident:', error);
      alert('Durum güncellenemedi: ' + (error as Error).message);
    } finally {
      setUpdating(null);
    }
  }

  // Filtering and sorting logic
  const filteredAndSortedIncidents = useMemo(() => {
    let result = [...incidents];

    // Apply filters
    if (statusFilter !== 'all') {
      result = result.filter(i => i.status === statusFilter);
    }
    if (severityFilter !== 'all') {
      result = result.filter(i => i.severity === severityFilter);
    }
    if (serviceFilter !== 'all') {
      result = result.filter(i => i.service_id === serviceFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.id.toLowerCase().includes(query) ||
        i.message.toLowerCase().includes(query) ||
        i.service_id.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'id':
          comparison = a.id.localeCompare(b.id);
          break;
        case 'status':
          comparison = (statusConfig[a.status]?.priority || 0) - (statusConfig[b.status]?.priority || 0);
          break;
        case 'severity':
          comparison = (severityConfig[a.severity]?.priority || 0) - (severityConfig[b.severity]?.priority || 0);
          break;
        case 'service_id':
          comparison = a.service_id.localeCompare(b.service_id);
          break;
        case 'opened_at':
          comparison = new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [incidents, statusFilter, severityFilter, serviceFilter, searchQuery, sortField, sortDirection]);

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
    return sortDirection === 'asc'
      ? <ArrowUp className="w-4 h-4 ml-1 text-[#00d9ff]" />
      : <ArrowDown className="w-4 h-4 ml-1 text-[#00d9ff]" />;
  }

  function clearFilters() {
    setStatusFilter('all');
    setSeverityFilter('all');
    setServiceFilter('all');
    setSearchQuery('');
  }

  const hasActiveFilters = statusFilter !== 'all' || severityFilter !== 'all' || serviceFilter !== 'all' || searchQuery;

  const openCount = incidents.filter((i) => i.status === INCIDENT_STATUS.OPEN).length;
  const inProgressCount = incidents.filter((i) => i.status === INCIDENT_STATUS.IN_PROGRESS).length;
  const closedCount = incidents.filter((i) => i.status === INCIDENT_STATUS.CLOSED).length;

  return (
    <div className="space-y-6 grid-pattern min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Olaylar</h1>
          <p className="text-muted-foreground mt-1">Servis olaylarını yönetin ve takip edin</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${statusFilter === INCIDENT_STATUS.OPEN ? 'ring-2 ring-[#ffb800]' : ''}`}
          onClick={() => setStatusFilter(statusFilter === INCIDENT_STATUS.OPEN ? 'all' : INCIDENT_STATUS.OPEN)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Açık Olaylar</p>
                <p className="text-3xl font-bold text-[#ffb800] font-data">{openCount}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#ffb800]/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-[#ffb800]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${statusFilter === INCIDENT_STATUS.IN_PROGRESS ? 'ring-2 ring-[#00d9ff]' : ''}`}
          onClick={() => setStatusFilter(statusFilter === INCIDENT_STATUS.IN_PROGRESS ? 'all' : INCIDENT_STATUS.IN_PROGRESS)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">İşleniyor</p>
                <p className="text-3xl font-bold text-[#00d9ff] font-data">{inProgressCount}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#00d9ff]/10 flex items-center justify-center">
                <Play className="w-6 h-6 text-[#00d9ff]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${statusFilter === INCIDENT_STATUS.CLOSED ? 'ring-2 ring-[#10b981]' : ''}`}
          onClick={() => setStatusFilter(statusFilter === INCIDENT_STATUS.CLOSED ? 'all' : INCIDENT_STATUS.CLOSED)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Çözüldü</p>
                <p className="text-3xl font-bold text-[#10b981] font-data">{closedCount}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#10b981]" />
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
                placeholder="ID, mesaj veya servis ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Önem:</span>
              <div className="flex gap-1">
                {['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`filter-chip ${severityFilter === sev ? 'active' : ''}`}
                    style={sev !== 'all' && severityFilter === sev ? {
                      borderColor: severityConfig[sev]?.color,
                      color: severityConfig[sev]?.color,
                      backgroundColor: severityConfig[sev]?.bgColor,
                    } : {}}
                  >
                    {sev === 'all' ? 'Tümü' : sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Service Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Servis:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setServiceFilter('all')}
                  className={`filter-chip ${serviceFilter === 'all' ? 'active' : ''}`}
                >
                  Tümü
                </button>
                {services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => setServiceFilter(service.id)}
                    className={`filter-chip ${serviceFilter === service.id ? 'active' : ''}`}
                  >
                    {service.name}
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

          {/* Active filter count */}
          {hasActiveFilters && (
            <div className="mt-3 text-sm text-muted-foreground">
              {filteredAndSortedIncidents.length} sonuç gösteriliyor
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#ffb800]" />
            Olay Listesi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d9ff]" />
            </div>
          ) : filteredAndSortedIncidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Olay bulunamadı</p>
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
                    onClick={() => handleSort('id')}
                  >
                    <div className="flex items-center">
                      ID
                      <SortIcon field="id" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      Durum
                      <SortIcon field="status" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('severity')}
                  >
                    <div className="flex items-center">
                      Önem
                      <SortIcon field="severity" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('service_id')}
                  >
                    <div className="flex items-center">
                      Servis
                      <SortIcon field="service_id" />
                    </div>
                  </TableHead>
                  <TableHead className="text-muted-foreground">Kural</TableHead>
                  <TableHead className="text-muted-foreground">Mesaj</TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('opened_at')}
                  >
                    <div className="flex items-center">
                      Açılma
                      <SortIcon field="opened_at" />
                    </div>
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedIncidents.map((incident) => {
                  const severity = severityConfig[incident.severity] || severityConfig.LOW;
                  const status = statusConfig[incident.status] || statusConfig.OPEN;
                  return (
                    <TableRow key={incident.id} className="border-border hover:bg-muted/30">
                      <TableCell>
                        <Link
                          href={`/incidents/${incident.id}`}
                          className="font-mono text-sm text-[#00d9ff] hover:text-[#33e1ff] hover:underline"
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
                      <TableCell className="font-mono text-sm">{incident.service_id}</TableCell>
                      <TableCell>
                        <Link
                          href="/rules"
                          className="font-mono text-sm text-[#00d9ff] hover:text-[#33e1ff] hover:underline"
                        >
                          {incident.rule_id}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-soft">
                        {incident.message}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-soft">
                        {format(new Date(incident.opened_at), 'dd MMM HH:mm', {
                          locale: tr,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {incident.status === INCIDENT_STATUS.OPEN && (
                            <Button
                              size="sm"
                              className="btn-outline-cyan"
                              onClick={() => updateStatus(incident.id, INCIDENT_STATUS.IN_PROGRESS)}
                              disabled={updating === incident.id}
                            >
                              {updating === incident.id ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-1" />
                                  İşleme Al
                                </>
                              )}
                            </Button>
                          )}
                          {incident.status === INCIDENT_STATUS.IN_PROGRESS && (
                            <Button
                              size="sm"
                              className="btn-outline-success"
                              onClick={() => updateStatus(incident.id, INCIDENT_STATUS.CLOSED)}
                              disabled={updating === incident.id}
                            >
                              {updating === incident.id ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Çöz
                                </>
                              )}
                            </Button>
                          )}
                          <Link href={`/incidents/${incident.id}`}>
                            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-[#00d9ff]">
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
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
