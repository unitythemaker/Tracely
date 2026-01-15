'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
import { api, Service, Incident, ListParams, PaginationMeta } from '@/lib/api';
import {
  Server,
  AlertTriangle,
  CheckCircle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  ExternalLink,
  Activity,
  Clock,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Pagination } from '@/components/ui/pagination';
import { ColumnSelector, ColumnDefinition } from '@/components/ui/column-selector';
import { usePolling } from '@/hooks/usePolling';
import { RefreshIndicator } from '@/components/ui/refresh-indicator';

type SortField = 'id' | 'name' | 'created_at';
type SortDirection = 'asc' | 'desc';

const COLUMNS: ColumnDefinition[] = [
  { id: 'id', label: 'ID', defaultVisible: true },
  { id: 'name', label: 'Servis Adı', defaultVisible: true },
  { id: 'status', label: 'Durum', defaultVisible: true },
  { id: 'open_incidents', label: 'Açık Olaylar', defaultVisible: true },
  { id: 'total_incidents', label: 'Toplam Olay', defaultVisible: false },
  { id: 'created_at', label: 'Oluşturulma', defaultVisible: true },
  { id: 'actions', label: 'İşlem', defaultVisible: true },
];

const DEFAULT_VISIBLE_COLUMNS = COLUMNS.filter((c) => c.defaultVisible !== false).map((c) => c.id);

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, limit: 20, offset: 0 });

  // Stats
  const [totalServices, setTotalServices] = useState(0);
  const [healthyCount, setHealthyCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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
  const filtersRef = useRef({ limit, offset, sortField, sortDirection, debouncedSearch });
  useEffect(() => {
    filtersRef.current = { limit, offset, sortField, sortDirection, debouncedSearch };
  }, [limit, offset, sortField, sortDirection, debouncedSearch]);

  // Silent fetch for polling
  const fetchIncidentsSilent = useCallback(async () => {
    const res = await api.getIncidents({ limit: 1000, status: 'OPEN' });
    setIncidents(res.data || []);
  }, []);

  const fetchServicesSilent = useCallback(async () => {
    const f = filtersRef.current;
    const params: ListParams = {
      limit: f.limit,
      offset: f.offset,
      sort_by: f.sortField,
      sort_dir: f.sortDirection,
    };

    if (f.debouncedSearch) {
      params.search = f.debouncedSearch;
    }

    const response = await api.getServices(params);
    setServices(response.data || []);
    setMeta(response.meta);
    setTotalServices(response.meta.total);
  }, []);

  // Combined fetch for polling
  const fetchAllData = useCallback(async () => {
    await Promise.all([
      fetchServicesSilent(),
      fetchIncidentsSilent(),
    ]);
  }, [fetchServicesSilent, fetchIncidentsSilent]);

  // Polling hook
  const { isRefreshing, lastUpdated, refresh } = usePolling(fetchAllData, {
    interval: 5000,
    enabled: !loading,
  });

  // Initial load
  useEffect(() => {
    async function initialFetch() {
      setLoading(true);
      try {
        await fetchAllData();
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    initialFetch();
  }, [fetchAllData]);

  // Refetch when filters change
  useEffect(() => {
    if (!loading) {
      fetchServicesSilent();
    }
  }, [limit, offset, sortField, sortDirection, debouncedSearch, loading, fetchServicesSilent]);

  // Calculate stats when services or incidents change
  useEffect(() => {
    if (services.length === 0) return;

    let healthy = 0;
    let warning = 0;

    services.forEach((service) => {
      const openIncidents = incidents.filter((i) => i.service_id === service.id);
      if (openIncidents.length === 0) {
        healthy++;
      } else {
        warning++;
      }
    });

    setHealthyCount(healthy);
    setWarningCount(warning);
  }, [services, incidents]);

  function getServiceStatus(serviceId: string) {
    const openIncidents = incidents.filter((i) => i.service_id === serviceId);
    if (openIncidents.some((i) => i.severity === 'CRITICAL')) return 'critical';
    if (openIncidents.length > 0) return 'warning';
    return 'healthy';
  }

  function getOpenIncidentCount(serviceId: string) {
    return incidents.filter((i) => i.service_id === serviceId).length;
  }

  function getTotalIncidentCount(serviceId: string) {
    // This would need a separate API call for total incidents
    // For now, return open incidents count
    return incidents.filter((i) => i.service_id === serviceId).length;
  }

  // Filter services by status
  const filteredServices = services.filter((service) => {
    if (statusFilter === 'all') return true;
    const status = getServiceStatus(service.id);
    if (statusFilter === 'healthy') return status === 'healthy';
    if (statusFilter === 'warning') return status === 'warning' || status === 'critical';
    return true;
  });

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
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
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setOffset(0);
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all';

  // Column visibility check
  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  const statusColors: Record<string, { color: string; bgColor: string; label: string }> = {
    healthy: { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)', label: 'Normal' },
    warning: { color: '#ffb800', bgColor: 'rgba(255, 184, 0, 0.1)', label: 'Uyarı' },
    critical: { color: '#ff4d6a', bgColor: 'rgba(255, 77, 106, 0.1)', label: 'Kritik' },
  };

  return (
    <div className="space-y-6 grid-pattern min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Servisler</h1>
          <p className="text-muted-foreground mt-1">İzlenen servislerin durumu</p>
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
          className={`bg-card border-border card-hover cursor-pointer ${statusFilter === 'all' ? 'ring-2 ring-[#00d9ff]' : ''}`}
          onClick={() => {
            setStatusFilter('all');
            setOffset(0);
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Toplam Servis</p>
                <p className="text-3xl font-bold text-foreground font-data">{totalServices}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#00d9ff]/10 flex items-center justify-center">
                <Server className="w-6 h-6 text-[#00d9ff]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${statusFilter === 'healthy' ? 'ring-2 ring-[#10b981]' : ''}`}
          onClick={() => {
            setStatusFilter(statusFilter === 'healthy' ? 'all' : 'healthy');
            setOffset(0);
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Normal</p>
                <p className="text-3xl font-bold text-[#10b981] font-data">{healthyCount}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#10b981]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${statusFilter === 'warning' ? 'ring-2 ring-[#ffb800]' : ''}`}
          onClick={() => {
            setStatusFilter(statusFilter === 'warning' ? 'all' : 'warning');
            setOffset(0);
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sorunlu</p>
                <p className="text-3xl font-bold text-[#ffb800] font-data">{warningCount}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#ffb800]/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-[#ffb800]" />
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
                placeholder="Servis adı veya ID ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Durum:</span>
              <div className="flex gap-1">
                {[
                  { id: 'all', label: 'Tümü' },
                  { id: 'healthy', label: 'Normal', color: '#10b981' },
                  { id: 'warning', label: 'Sorunlu', color: '#ffb800' },
                ].map((status) => (
                  <button
                    key={status.id}
                    onClick={() => {
                      setStatusFilter(status.id);
                      setOffset(0);
                    }}
                    className={`filter-chip ${statusFilter === status.id ? 'active' : ''}`}
                    style={
                      status.color && statusFilter === status.id
                        ? {
                            borderColor: status.color,
                            color: status.color,
                            backgroundColor: `${status.color}15`,
                          }
                        : {}
                    }
                  >
                    {status.label}
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
              {filteredServices.length} sonuç bulundu
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-[#00d9ff]" />
              Servis Listesi
            </CardTitle>
            <div className="flex items-center gap-2">
              <ColumnSelector
                columns={COLUMNS}
                visibleColumns={visibleColumns}
                onVisibilityChange={setVisibleColumns}
                storageKey="services-visible-columns"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d9ff]" />
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Server className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Servis bulunamadı</p>
              {hasActiveFilters ? (
                <Button variant="link" onClick={clearFilters} className="mt-2 text-[#00d9ff]">
                  Filtreleri temizle
                </Button>
              ) : (
                <p className="text-xs mt-1">Henüz servis tanımlanmamış</p>
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
                    {isColumnVisible('name') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center">
                          Servis Adı
                          <SortIcon field="name" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('status') && (
                      <TableHead className="text-muted-foreground">Durum</TableHead>
                    )}
                    {isColumnVisible('open_incidents') && (
                      <TableHead className="text-muted-foreground">Açık Olaylar</TableHead>
                    )}
                    {isColumnVisible('total_incidents') && (
                      <TableHead className="text-muted-foreground">Toplam Olay</TableHead>
                    )}
                    {isColumnVisible('created_at') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('created_at')}
                      >
                        <div className="flex items-center">
                          Oluşturulma
                          <SortIcon field="created_at" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('actions') && (
                      <TableHead className="text-muted-foreground text-right"></TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map((service) => {
                    const status = getServiceStatus(service.id);
                    const statusStyle = statusColors[status];
                    const openCount = getOpenIncidentCount(service.id);

                    return (
                      <TableRow key={service.id} className="border-border hover:bg-muted/30">
                        {isColumnVisible('id') && (
                          <TableCell className="font-mono text-sm text-[#00d9ff]">
                            {service.id}
                          </TableCell>
                        )}
                        {isColumnVisible('name') && (
                          <TableCell>
                            <Link
                              href={`/services/${service.id}`}
                              className="font-medium text-foreground hover:text-[#00d9ff] hover:underline flex items-center gap-2"
                            >
                              <Server className="w-4 h-4 text-muted-foreground" />
                              {service.name}
                            </Link>
                          </TableCell>
                        )}
                        {isColumnVisible('status') && (
                          <TableCell>
                            <div
                              className="flex items-center gap-2 px-2.5 py-1 rounded-md w-fit"
                              style={{
                                backgroundColor: statusStyle.bgColor,
                                border: `1px solid ${statusStyle.color}30`,
                              }}
                            >
                              <div
                                className={`w-2 h-2 rounded-full ${status !== 'healthy' ? 'status-pulse' : ''}`}
                                style={{ backgroundColor: statusStyle.color }}
                              />
                              <span className="text-sm" style={{ color: statusStyle.color }}>
                                {statusStyle.label}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        {isColumnVisible('open_incidents') && (
                          <TableCell>
                            {openCount > 0 ? (
                              <Link
                                href={`/incidents?service_id=${service.id}&status=OPEN`}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#ffb800]/10 text-[#ffb800] hover:bg-[#ffb800]/20 transition-colors"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span className="font-mono text-sm">{openCount}</span>
                              </Link>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#10b981]/10 text-[#10b981]">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span className="text-sm">0</span>
                              </span>
                            )}
                          </TableCell>
                        )}
                        {isColumnVisible('total_incidents') && (
                          <TableCell>
                            <Link
                              href={`/incidents?service_id=${service.id}`}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                            >
                              <Activity className="w-3.5 h-3.5" />
                              <span className="font-mono text-sm">{getTotalIncidentCount(service.id)}</span>
                            </Link>
                          </TableCell>
                        )}
                        {isColumnVisible('created_at') && (
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-mono text-sm text-muted-foreground">
                                {format(new Date(service.created_at), 'dd MMM yyyy', { locale: tr })}
                              </span>
                              <span className="text-xs text-muted-foreground/70">
                                {formatDistanceToNow(new Date(service.created_at), {
                                  addSuffix: true,
                                  locale: tr,
                                })}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        {isColumnVisible('actions') && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/services/${service.id}`}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-[#00d9ff]"
                                >
                                  Detay
                                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
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
