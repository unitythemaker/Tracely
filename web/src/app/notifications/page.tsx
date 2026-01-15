'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Pagination } from '@/components/ui/pagination';
import { ColumnSelector, ColumnDefinition } from '@/components/ui/column-selector';
import { api, Notification, ListParams, PaginationMeta } from '@/lib/api';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Bell,
  BellOff,
  Mail,
  MailOpen,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  CheckCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type SortField = 'id' | 'sent_at' | 'target' | 'is_read';
type SortDirection = 'asc' | 'desc';

// Column definitions
const columns: ColumnDefinition[] = [
  { id: 'id', label: 'ID', defaultVisible: true },
  { id: 'is_read', label: 'Durum', defaultVisible: true },
  { id: 'target', label: 'Hedef', defaultVisible: true },
  { id: 'message', label: 'Mesaj', defaultVisible: true },
  { id: 'incident_id', label: 'Olay', defaultVisible: true },
  { id: 'sent_at', label: 'Gönderilme', defaultVisible: true },
  { id: 'created_at', label: 'Oluşturulma', defaultVisible: false },
  { id: 'updated_at', label: 'Güncellenme', defaultVisible: false },
  { id: 'actions', label: 'İşlem', defaultVisible: true },
];

const defaultVisibleColumns = columns.filter((c) => c.defaultVisible !== false).map((c) => c.id);

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Filters
  const [readFilter, setReadFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('sent_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleColumns);

  // Stats
  const [stats, setStats] = useState({ total: 0, unread: 0, read: 0 });

  // Expanded messages
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  function toggleMessageExpand(id: string) {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params: ListParams = {
        limit,
        offset,
        sort_by: sortField,
        sort_dir: sortDirection,
      };

      if (readFilter === 'unread') params.is_read = false;
      if (readFilter === 'read') params.is_read = true;
      if (searchQuery) params.search = searchQuery;

      const res = await api.getNotifications(params);
      setNotifications(res.data || []);
      setMeta(res.meta || { total: 0, limit: 20, offset: 0 });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, sortField, sortDirection, readFilter, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const [allRes, unreadRes, readRes] = await Promise.all([
        api.getNotifications({ limit: 1 }),
        api.getNotifications({ limit: 1, is_read: false }),
        api.getNotifications({ limit: 1, is_read: true }),
      ]);
      setStats({
        total: allRes.meta?.total || 0,
        unread: unreadRes.meta?.total || 0,
        read: readRes.meta?.total || 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function markAsRead(id: string) {
    setUpdating(id);
    try {
      await api.markNotificationAsRead(id);
      await fetchNotifications();
      await fetchStats();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      alert('Bildirim okunamadı: ' + (error as Error).message);
    } finally {
      setUpdating(null);
    }
  }

  async function markAsUnread(id: string) {
    setUpdating(id);
    try {
      await api.markNotificationAsUnread(id);
      await fetchNotifications();
      await fetchStats();
    } catch (error) {
      console.error('Failed to mark notification as unread:', error);
      alert('Bildirim durumu değiştirilemedi: ' + (error as Error).message);
    } finally {
      setUpdating(null);
    }
  }

  async function markAllAsRead() {
    setUpdating('all');
    try {
      await api.markAllNotificationsAsRead();
      await fetchNotifications();
      await fetchStats();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      alert('Bildirimler okunamadı: ' + (error as Error).message);
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
    setOffset(0);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-4 h-4 ml-1 text-[#00d9ff]" />
      : <ArrowDown className="w-4 h-4 ml-1 text-[#00d9ff]" />;
  }

  function clearFilters() {
    setReadFilter('all');
    setSearchInput('');
    setSearchQuery('');
    setOffset(0);
  }

  const hasActiveFilters = readFilter !== 'all' || searchQuery;

  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  return (
    <div className="space-y-6 grid-pattern min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bildirimler</h1>
          <p className="text-muted-foreground mt-1">Sistem bildirimlerini görüntüleyin ve yönetin</p>
        </div>
        {stats.unread > 0 && (
          <Button
            onClick={markAllAsRead}
            disabled={updating === 'all'}
            className="btn-outline-cyan"
          >
            {updating === 'all' ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <CheckCheck className="w-4 h-4 mr-2" />
            )}
            Tümünü Okundu İşaretle
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${readFilter === 'all' ? 'ring-2 ring-[#00d9ff]' : ''}`}
          onClick={() => {
            setReadFilter('all');
            setOffset(0);
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Toplam Bildirim</p>
                <p className="text-3xl font-bold text-[#00d9ff] font-data">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#00d9ff]/10 flex items-center justify-center">
                <Bell className="w-6 h-6 text-[#00d9ff]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${readFilter === 'unread' ? 'ring-2 ring-[#ffb800]' : ''}`}
          onClick={() => {
            setReadFilter(readFilter === 'unread' ? 'all' : 'unread');
            setOffset(0);
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Okunmamış</p>
                <p className="text-3xl font-bold text-[#ffb800] font-data">{stats.unread}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#ffb800]/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-[#ffb800]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${readFilter === 'read' ? 'ring-2 ring-[#10b981]' : ''}`}
          onClick={() => {
            setReadFilter(readFilter === 'read' ? 'all' : 'read');
            setOffset(0);
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Okunmuş</p>
                <p className="text-3xl font-bold text-[#10b981] font-data">{stats.read}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
                <MailOpen className="w-6 h-6 text-[#10b981]" />
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
                placeholder="ID, mesaj, hedef veya olay ara..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>

            {/* Read Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Durum:</span>
              <div className="flex gap-1">
                {[
                  { key: 'all', label: 'Tümü' },
                  { key: 'unread', label: 'Okunmamış' },
                  { key: 'read', label: 'Okunmuş' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setReadFilter(item.key);
                      setOffset(0);
                    }}
                    className={`filter-chip ${readFilter === item.key ? 'active' : ''}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Column Selector */}
            <ColumnSelector
              columns={columns}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
              storageKey="notifications-columns"
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
            <Bell className="w-5 h-5 text-[#00d9ff]" />
            Bildirim Listesi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d9ff]" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BellOff className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Bildirim bulunamadı</p>
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
                    {isColumnVisible('is_read') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('is_read')}
                      >
                        <div className="flex items-center">
                          Durum
                          <SortIcon field="is_read" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('target') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('target')}
                      >
                        <div className="flex items-center">
                          Hedef
                          <SortIcon field="target" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('message') && (
                      <TableHead className="text-muted-foreground">Mesaj</TableHead>
                    )}
                    {isColumnVisible('incident_id') && (
                      <TableHead className="text-muted-foreground">Olay</TableHead>
                    )}
                    {isColumnVisible('sent_at') && (
                      <TableHead
                        className="text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('sent_at')}
                      >
                        <div className="flex items-center">
                          Gönderilme
                          <SortIcon field="sent_at" />
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
                  {notifications.map((notification) => (
                    <TableRow
                      key={notification.id}
                      className={`border-border hover:bg-muted/30 ${!notification.is_read ? 'bg-[#ffb800]/5' : ''}`}
                    >
                      {isColumnVisible('id') && (
                        <TableCell>
                          <span className="font-mono text-sm text-[#00d9ff]">
                            {notification.id}
                          </span>
                        </TableCell>
                      )}
                      {isColumnVisible('is_read') && (
                        <TableCell>
                          {notification.is_read ? (
                            <Badge
                              className="font-medium"
                              style={{
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              <MailOpen className="w-3 h-3 mr-1" />
                              Okundu
                            </Badge>
                          ) : (
                            <Badge
                              className="font-medium"
                              style={{
                                backgroundColor: 'rgba(255, 184, 0, 0.1)',
                                color: '#ffb800',
                                border: '1px solid rgba(255, 184, 0, 0.3)',
                              }}
                            >
                              <Mail className="w-3 h-3 mr-1" />
                              Okunmadı
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible('target') && (
                        <TableCell className="text-soft">
                          {notification.target}
                        </TableCell>
                      )}
                      {isColumnVisible('message') && (
                        <TableCell style={{ minWidth: '200px', maxWidth: '350px' }}>
                          <div
                            className="cursor-pointer"
                            onClick={() => toggleMessageExpand(notification.id)}
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={`text-soft break-words ${
                                  expandedMessages.has(notification.id) ? 'whitespace-pre-wrap' : 'truncate block'
                                }`}
                                style={{ wordBreak: 'break-word' }}
                              >
                                {notification.message}
                              </span>
                              {notification.message.length > 40 && (
                                <span className="text-muted-foreground hover:text-[#00d9ff] shrink-0">
                                  {expandedMessages.has(notification.id) ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      )}
                      {isColumnVisible('incident_id') && (
                        <TableCell>
                          <Link
                            href={`/incidents/${notification.incident_id}`}
                            className="font-mono text-sm text-[#00d9ff] hover:text-[#33e1ff] hover:underline flex items-center gap-1"
                          >
                            {notification.incident_id}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </TableCell>
                      )}
                      {isColumnVisible('sent_at') && (
                        <TableCell className="font-mono text-sm text-soft">
                          {format(new Date(notification.sent_at), 'dd MMM HH:mm', { locale: tr })}
                        </TableCell>
                      )}
                      {isColumnVisible('created_at') && (
                        <TableCell className="font-mono text-sm text-soft">
                          {format(new Date(notification.created_at), 'dd MMM HH:mm', { locale: tr })}
                        </TableCell>
                      )}
                      {isColumnVisible('updated_at') && (
                        <TableCell className="font-mono text-sm text-soft">
                          {format(new Date(notification.updated_at), 'dd MMM HH:mm', { locale: tr })}
                        </TableCell>
                      )}
                      {isColumnVisible('actions') && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {notification.is_read ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markAsUnread(notification.id)}
                                disabled={updating === notification.id}
                                className="text-muted-foreground hover:text-[#ffb800]"
                                title="Okunmadı olarak işaretle"
                              >
                                {updating === notification.id ? (
                                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Mail className="w-4 h-4" />
                                )}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="btn-outline-success"
                                onClick={() => markAsRead(notification.id)}
                                disabled={updating === notification.id}
                              >
                                {updating === notification.id ? (
                                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <MailOpen className="w-4 h-4 mr-1" />
                                    Okundu
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
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
