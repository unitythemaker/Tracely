'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePolling } from '@/hooks/usePolling';
import { RefreshIndicator } from '@/components/ui/refresh-indicator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { ColumnSelector, ColumnDefinition } from '@/components/ui/column-selector';
import { MultiSelect } from '@/components/ui/multi-select';
import { api, Incident, INCIDENT_STATUS, Service, ListParams, PaginationMeta } from '@/lib/api';
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
  X,
} from 'lucide-react';

const severityConfig: Record<string, { color: string; bgColor: string; borderColor: string; priority: number }> = {
  CRITICAL: { color: '#ff4d6a', bgColor: 'rgba(255, 77, 106, 0.1)', borderColor: 'rgba(255, 77, 106, 0.3)', priority: 4 },
  HIGH: { color: '#ffb800', bgColor: 'rgba(255, 184, 0, 0.1)', borderColor: 'rgba(255, 184, 0, 0.3)', priority: 3 },
  MEDIUM: { color: '#00d9ff', bgColor: 'rgba(0, 217, 255, 0.1)', borderColor: 'rgba(0, 217, 255, 0.3)', priority: 2 },
  LOW: { color: '#7d8a9d', bgColor: 'rgba(125, 138, 157, 0.1)', borderColor: 'rgba(125, 138, 157, 0.3)', priority: 1 },
};

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string; priority: number }> = {
  OPEN: { icon: <AlertTriangle className="h-4 w-4" />, color: '#ffb800', label: 'Açık', priority: 3 },
  IN_PROGRESS: { icon: <Play className="h-4 w-4" />, color: '#00d9ff', label: 'İşlemde', priority: 2 },
  CLOSED: { icon: <CheckCircle className="h-4 w-4" />, color: '#10b981', label: 'Çözüldü', priority: 1 },
};

type SortField = 'id' | 'status' | 'severity' | 'service_id' | 'opened_at';
type SortDirection = 'asc' | 'desc';

// Column definitions
const columns: ColumnDefinition[] = [
  { id: 'id', label: 'ID', defaultVisible: true },
  { id: 'status', label: 'Durum', defaultVisible: true },
  { id: 'severity', label: 'Önem', defaultVisible: true },
  { id: 'service_id', label: 'Servis', defaultVisible: true },
  { id: 'rule_id', label: 'Kural', defaultVisible: true },
  { id: 'message', label: 'Mesaj', defaultVisible: true },
  { id: 'opened_at', label: 'Açılma', defaultVisible: true },
  { id: 'metric_id', label: 'Metrik ID', defaultVisible: false },
  { id: 'created_at', label: 'Oluşturulma', defaultVisible: false },
  { id: 'updated_at', label: 'Güncellenme', defaultVisible: false },
  { id: 'actions', label: 'İşlem', defaultVisible: true },
];

const defaultVisibleColumns = columns.filter((c) => c.defaultVisible !== false).map((c) => c.id);

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('opened_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleColumns);

  // Stats (fetched separately without filters)
  const [stats, setStats] = useState({ open: 0, inProgress: 0, closed: 0 });

  // Refs for polling (to access latest filter values)
  const filtersRef = useRef({ limit, offset, sortField, sortDirection, statusFilter, severityFilter, serviceFilter, searchQuery });
  useEffect(() => {
    filtersRef.current = { limit, offset, sortField, sortDirection, statusFilter, severityFilter, serviceFilter, searchQuery };
  }, [limit, offset, sortField, sortDirection, statusFilter, severityFilter, serviceFilter, searchQuery]);

  // Silent fetch for polling (doesn't set loading)
  const fetchIncidentsSilent = useCallback(async () => {
    const f = filtersRef.current;
    const params: ListParams = {
      limit: f.limit,
      offset: f.offset,
      sort_by: f.sortField,
      sort_dir: f.sortDirection,
    };

    if (f.statusFilter !== 'all') params.status = f.statusFilter;
    if (f.severityFilter !== 'all') params.severity = f.severityFilter;
    if (f.serviceFilter.length > 0) params.service_id = f.serviceFilter.join(',');
    if (f.searchQuery) params.search = f.searchQuery;

    const res = await api.getIncidents(params);
    setIncidents(res.data || []);
    setMeta(res.meta || { total: 0, limit: 20, offset: 0 });
  }, []);

  const fetchStatsSilent = useCallback(async () => {
    const [openRes, inProgressRes, closedRes] = await Promise.all([
      api.getIncidents({ status: 'OPEN', limit: 1 }),
      api.getIncidents({ status: 'IN_PROGRESS', limit: 1 }),
      api.getIncidents({ status: 'CLOSED', limit: 1 }),
    ]);
    setStats({
      open: openRes.meta?.total || 0,
      inProgress: inProgressRes.meta?.total || 0,
      closed: closedRes.meta?.total || 0,
    });
  }, []);

  // Combined fetch for polling
  const fetchAllData = useCallback(async () => {
    await Promise.all([
      fetchIncidentsSilent(),
      fetchStatsSilent(),
    ]);
  }, [fetchIncidentsSilent, fetchStatsSilent]);

  // Polling hook
  const { isRefreshing, lastUpdated, refresh } = usePolling(fetchAllData, {
    interval: 5000,
    enabled: !loading,
  });

  const fetchServices = useCallback(async () => {
    try {
      const res = await api.getServices({ limit: 100 });
      setServices(res.data || []);
    } catch (error) {
      console.error('Failed to fetch services:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    async function initialFetch() {
      setLoading(true);
      try {
        await Promise.all([
          fetchIncidentsSilent(),
          fetchStatsSilent(),
          fetchServices(),
        ]);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    initialFetch();
  }, [fetchIncidentsSilent, fetchStatsSilent, fetchServices]);

  // Refetch when filters change
  useEffect(() => {
    if (!loading) {
      fetchIncidentsSilent();
    }
  }, [limit, offset, sortField, sortDirection, statusFilter, severityFilter, serviceFilter, searchQuery, loading, fetchIncidentsSilent]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setOffset(0); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    try {
      await api.updateIncidentStatus(id, status);
      await fetchAllData();
    } catch (error) {
      console.error('Failed to update incident:', error);
      alert('Durum güncellenemedi: ' + (error as Error).message);
    } finally {
      setUpdating(null);
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setOffset(0); // Reset to first page on sort change
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
    setServiceFilter([]);
    setSearchInput('');
    setSearchQuery('');
    setOffset(0);
  }

  const hasActiveFilters = statusFilter !== 'all' || severityFilter !== 'all' || serviceFilter.length > 0 || searchQuery;

  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  return (
    <div className="space-y-6 grid-pattern min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Olaylar</h1>
          <p className="text-muted-foreground mt-1">Servis olaylarını yönetin ve takip edin</p>
        </div>
        <RefreshIndicator
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          onRefresh={refresh}
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${statusFilter === INCIDENT_STATUS.OPEN ? 'ring-2 ring-[#ffb800]' : ''}`}
          onClick={() => {
            setStatusFilter(statusFilter === INCIDENT_STATUS.OPEN ? 'all' : INCIDENT_STATUS.OPEN);
            setOffset(0);
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Açık Olaylar</p>
                <p className="text-3xl font-bold text-[#ffb800] font-data">{stats.open}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#ffb800]/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-[#ffb800]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${statusFilter === INCIDENT_STATUS.IN_PROGRESS ? 'ring-2 ring-[#00d9ff]' : ''}`}
          onClick={() => {
            setStatusFilter(statusFilter === INCIDENT_STATUS.IN_PROGRESS ? 'all' : INCIDENT_STATUS.IN_PROGRESS);
            setOffset(0);
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">İşlemde</p>
                <p className="text-3xl font-bold text-[#00d9ff] font-data">{stats.inProgress}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#00d9ff]/10 flex items-center justify-center">
                <Play className="w-6 h-6 text-[#00d9ff]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${statusFilter === INCIDENT_STATUS.CLOSED ? 'ring-2 ring-[#10b981]' : ''}`}
          onClick={() => {
            setStatusFilter(statusFilter === INCIDENT_STATUS.CLOSED ? 'all' : INCIDENT_STATUS.CLOSED);
            setOffset(0);
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Çözüldü</p>
                <p className="text-3xl font-bold text-[#10b981] font-data">{stats.closed}</p>
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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
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
                    onClick={() => {
                      setSeverityFilter(sev);
                      setOffset(0);
                    }}
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
              <MultiSelect
                options={services.map((s) => ({ label: s.name, value: s.id }))}
                selected={serviceFilter}
                onChange={(values) => {
                  setServiceFilter(values);
                  setOffset(0);
                }}
                placeholder="Servis seçiniz..."
                className="min-w-[200px]"
              />
            </div>

            {/* Column Selector */}
            <ColumnSelector
              columns={columns}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
              storageKey="incidents-columns"
            />

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
          ) : incidents.length === 0 ? (
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
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    {isColumnVisible('id') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('id')}
                      >
                        <div className="flex items-center">
                          ID
                          <SortIcon field="id" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('status') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center">
                          Durum
                          <SortIcon field="status" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('severity') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('severity')}
                      >
                        <div className="flex items-center">
                          Önem
                          <SortIcon field="severity" />
                        </div>
                      </TableHead>
                    )}
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
                    {isColumnVisible('rule_id') && (
                      <TableHead className="text-muted-foreground">Kural</TableHead>
                    )}
                    {isColumnVisible('message') && (
                      <TableHead className="text-muted-foreground">Mesaj</TableHead>
                    )}
                    {isColumnVisible('metric_id') && (
                      <TableHead className="text-muted-foreground">Metrik ID</TableHead>
                    )}
                    {isColumnVisible('opened_at') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('opened_at')}
                      >
                        <div className="flex items-center">
                          Açılma
                          <SortIcon field="opened_at" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('created_at') && (
                      <TableHead className="text-muted-foreground">Oluşturulma</TableHead>
                    )}
                    {isColumnVisible('updated_at') && (
                      <TableHead className="text-muted-foreground">Güncellenme</TableHead>
                    )}
                    {isColumnVisible('actions') && (
                      <TableHead className="text-muted-foreground text-right"></TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident) => {
                    const severity = severityConfig[incident.severity] || severityConfig.LOW;
                    const status = statusConfig[incident.status] || statusConfig.OPEN;
                    return (
                      <TableRow key={incident.id} className="border-border hover:bg-muted/30">
                        {isColumnVisible('id') && (
                          <TableCell>
                            <Link
                              href={`/incidents/${incident.id}`}
                              className="font-mono text-sm text-[#00d9ff] hover:text-[#33e1ff] hover:underline"
                            >
                              {incident.id}
                            </Link>
                          </TableCell>
                        )}
                        {isColumnVisible('status') && (
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
                        )}
                        {isColumnVisible('severity') && (
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
                        )}
                        {isColumnVisible('service_id') && (
                          <TableCell>
                            <Link
                              href={`/services/${incident.service_id}`}
                              className="text-sm text-[#00d9ff] hover:text-[#33e1ff] hover:underline"
                            >
                              {services.find((s) => s.id === incident.service_id)?.name || incident.service_id}
                            </Link>
                          </TableCell>
                        )}
                        {isColumnVisible('rule_id') && (
                          <TableCell>
                            <Link
                              href="/rules"
                              className="font-mono text-sm text-[#00d9ff] hover:text-[#33e1ff] hover:underline"
                            >
                              {incident.rule_id}
                            </Link>
                          </TableCell>
                        )}
                        {isColumnVisible('message') && (
                          <TableCell className="max-w-[300px] truncate text-soft">
                            {incident.message}
                          </TableCell>
                        )}
                        {isColumnVisible('metric_id') && (
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {incident.metric_id}
                          </TableCell>
                        )}
                        {isColumnVisible('opened_at') && (
                          <TableCell className="font-mono text-sm text-soft">
                            {format(new Date(incident.opened_at), 'dd MMM HH:mm', { locale: tr })}
                          </TableCell>
                        )}
                        {isColumnVisible('created_at') && (
                          <TableCell className="font-mono text-sm text-soft">
                            {format(new Date(incident.created_at), 'dd MMM HH:mm', { locale: tr })}
                          </TableCell>
                        )}
                        {isColumnVisible('updated_at') && (
                          <TableCell className="font-mono text-sm text-soft">
                            {format(new Date(incident.updated_at), 'dd MMM HH:mm', { locale: tr })}
                          </TableCell>
                        )}
                        {isColumnVisible('actions') && (
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
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
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
