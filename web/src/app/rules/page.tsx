'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  api,
  Rule,
  CreateRuleInput,
  METRIC_TYPES,
  RULE_OPERATORS,
  RULE_ACTIONS,
  SEVERITY,
  METRIC_TYPE_LABELS,
  RULE_ACTION_LABELS,
  formatLabel,
} from '@/lib/api';
import {
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';

const severityColors: Record<string, { color: string; priority: number }> = {
  CRITICAL: { color: '#ff4d6a', priority: 4 },
  HIGH: { color: '#ffb800', priority: 3 },
  MEDIUM: { color: '#00d9ff', priority: 2 },
  LOW: { color: '#7d8a9d', priority: 1 },
};

const defaultRule: CreateRuleInput = {
  id: '',
  metric_type: 'LATENCY_MS',
  threshold: 100,
  operator: '>',
  action: 'OPEN_INCIDENT',
  priority: 1,
  severity: 'MEDIUM',
  is_active: true,
};

type SortField = 'id' | 'metric_type' | 'threshold' | 'severity' | 'priority' | 'is_active';
type SortDirection = 'asc' | 'desc';

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [formData, setFormData] = useState<CreateRuleInput>(defaultRule);
  const [saving, setSaving] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [metricFilter, setMetricFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    setLoading(true);
    try {
      const data = await api.getRules();
      setRules(data || []);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filtering and sorting
  const filteredAndSortedRules = useMemo(() => {
    let result = [...rules];

    // Apply filters
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.id.toLowerCase().includes(query) ||
          r.metric_type.toLowerCase().includes(query) ||
          r.action.toLowerCase().includes(query)
      );
    }
    if (metricFilter !== 'all') {
      result = result.filter((r) => r.metric_type === metricFilter);
    }
    if (severityFilter !== 'all') {
      result = result.filter((r) => r.severity === severityFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((r) => (statusFilter === 'active' ? r.is_active : !r.is_active));
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'id':
          comparison = a.id.localeCompare(b.id);
          break;
        case 'metric_type':
          comparison = a.metric_type.localeCompare(b.metric_type);
          break;
        case 'threshold':
          comparison = a.threshold - b.threshold;
          break;
        case 'severity':
          comparison =
            (severityColors[a.severity]?.priority || 0) - (severityColors[b.severity]?.priority || 0);
          break;
        case 'priority':
          comparison = a.priority - b.priority;
          break;
        case 'is_active':
          comparison = (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [rules, searchQuery, metricFilter, severityFilter, statusFilter, sortField, sortDirection]);

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
    setSearchQuery('');
    setMetricFilter('all');
    setSeverityFilter('all');
    setStatusFilter('all');
  }

  const hasActiveFilters =
    searchQuery || metricFilter !== 'all' || severityFilter !== 'all' || statusFilter !== 'all';

  function openCreateDialog() {
    setEditingRule(null);
    setFormData({
      ...defaultRule,
      id: `QR-${String(rules.length + 1).padStart(2, '0')}`,
    });
    setDialogOpen(true);
  }

  function openEditDialog(rule: Rule) {
    setEditingRule(rule);
    setFormData({
      id: rule.id,
      metric_type: rule.metric_type,
      threshold: rule.threshold,
      operator: rule.operator,
      action: rule.action,
      priority: rule.priority,
      severity: rule.severity,
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  }

  function openDeleteDialog(rule: Rule) {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      if (editingRule) {
        await api.updateRule(editingRule.id, formData);
      } else {
        await api.createRule(formData);
      }
      setDialogOpen(false);
      await fetchRules();
    } catch (error) {
      console.error('Failed to save rule:', error);
      alert('Kural kaydedilemedi: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!ruleToDelete) return;
    setSaving(true);
    try {
      await api.deleteRule(ruleToDelete.id);
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
      await fetchRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      alert('Kural silinemedi: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(rule: Rule) {
    setToggling(rule.id);
    try {
      await api.updateRule(rule.id, { is_active: !rule.is_active });
      await fetchRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    } finally {
      setToggling(null);
    }
  }

  const activeCount = rules.filter((r) => r.is_active).length;
  const uniqueMetrics = [...new Set(rules.map((r) => r.metric_type))];

  return (
    <div className="space-y-6 grid-pattern min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kurallar</h1>
        <p className="text-muted-foreground mt-1">Kalite kurallarını yönetin</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${statusFilter === 'all' && !hasActiveFilters ? 'ring-2 ring-[#00d9ff]' : ''}`}
          onClick={() => {
            setStatusFilter('all');
            setMetricFilter('all');
            setSeverityFilter('all');
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Toplam Kural</p>
                <p className="text-3xl font-bold text-foreground font-data">{rules.length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#00d9ff]/10 flex items-center justify-center">
                <SlidersHorizontal className="w-6 h-6 text-[#00d9ff]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${statusFilter === 'active' ? 'ring-2 ring-[#10b981]' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aktif Kurallar</p>
                <p className="text-3xl font-bold text-[#10b981] font-data">{activeCount}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#10b981]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border card-hover cursor-pointer ${statusFilter === 'inactive' ? 'ring-2 ring-[#7d8a9d]' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pasif Kurallar</p>
                <p className="text-3xl font-bold text-muted-foreground font-data">
                  {rules.length - activeCount}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center">
                <SlidersHorizontal className="w-6 h-6 text-muted-foreground" />
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
                placeholder="ID, metrik veya aksiyon ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>

            {/* Metric Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Metrik:</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setMetricFilter('all')}
                  className={`filter-chip ${metricFilter === 'all' ? 'active' : ''}`}
                >
                  Tümü
                </button>
                {uniqueMetrics.map((metric) => (
                  <button
                    key={metric}
                    onClick={() => setMetricFilter(metric)}
                    className={`filter-chip ${metricFilter === metric ? 'active' : ''}`}
                  >
                    {METRIC_TYPE_LABELS[metric] || formatLabel(metric)}
                  </button>
                ))}
              </div>
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
                    style={
                      sev !== 'all' && severityFilter === sev
                        ? {
                            borderColor: severityColors[sev]?.color,
                            color: severityColors[sev]?.color,
                            backgroundColor: `${severityColors[sev]?.color}15`,
                          }
                        : {}
                    }
                  >
                    {sev === 'all' ? 'Tümü' : sev}
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
              {filteredAndSortedRules.length} sonuç gösteriliyor
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-[#00d9ff]" />
              Kural Listesi
            </CardTitle>
            <Button className="btn-primary" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Yeni Kural
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d9ff]" />
            </div>
          ) : filteredAndSortedRules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <SlidersHorizontal className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Kural bulunamadı</p>
              {hasActiveFilters ? (
                <Button variant="link" onClick={clearFilters} className="mt-2 text-[#00d9ff]">
                  Filtreleri temizle
                </Button>
              ) : (
                <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  İlk Kuralı Oluştur
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
                    onClick={() => handleSort('metric_type')}
                  >
                    <div className="flex items-center">
                      Metrik
                      <SortIcon field="metric_type" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('threshold')}
                  >
                    <div className="flex items-center">
                      Koşul
                      <SortIcon field="threshold" />
                    </div>
                  </TableHead>
                  <TableHead className="text-muted-foreground">Aksiyon</TableHead>
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
                    onClick={() => handleSort('priority')}
                  >
                    <div className="flex items-center">
                      Öncelik
                      <SortIcon field="priority" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('is_active')}
                  >
                    <div className="flex items-center">
                      Durum
                      <SortIcon field="is_active" />
                    </div>
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedRules.map((rule) => (
                  <TableRow key={rule.id} className="border-border hover:bg-muted/30">
                    <TableCell className="font-mono text-sm text-[#00d9ff]">{rule.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {METRIC_TYPE_LABELS[rule.metric_type] || formatLabel(rule.metric_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {rule.operator} {rule.threshold}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className="text-xs font-medium"
                        style={{
                          backgroundColor: 'rgba(0, 217, 255, 0.1)',
                          color: '#00d9ff',
                          border: '1px solid rgba(0, 217, 255, 0.3)',
                        }}
                      >
                        {RULE_ACTION_LABELS[rule.action] || formatLabel(rule.action)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: `${severityColors[rule.severity]?.color}15`,
                          color: severityColors[rule.severity]?.color,
                          border: `1px solid ${severityColors[rule.severity]?.color}30`,
                        }}
                      >
                        {rule.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{rule.priority}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleActive(rule)}
                        disabled={toggling === rule.id}
                        className="flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {toggling === rule.id ? (
                          <div className="w-4 h-4 border-2 border-[#00d9ff] border-t-transparent rounded-full animate-spin" />
                        ) : rule.is_active ? (
                          <>
                            <div className="w-2 h-2 rounded-full bg-[#10b981] status-pulse" />
                            <span className="text-sm text-[#10b981] hover:text-[#34d399]">Aktif</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                            <span className="text-sm text-muted-foreground hover:text-foreground">Pasif</span>
                          </>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-[#00d9ff]"
                          onClick={() => openEditDialog(rule)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-[#ff4d6a]"
                          onClick={() => openDeleteDialog(rule)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-[#00d9ff]" />
              {editingRule ? 'Kuralı Düzenle' : 'Yeni Kural Oluştur'}
            </DialogTitle>
            <DialogDescription>Kalite kuralı için parametreleri belirleyin</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editingRule && (
              <div className="grid gap-2">
                <Label htmlFor="id">Kural ID</Label>
                <Input
                  id="id"
                  className="bg-background border-border"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="QR-01"
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="metric_type">Metrik Tipi</Label>
              <Select
                value={formData.metric_type}
                onValueChange={(v) => setFormData({ ...formData, metric_type: v })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METRIC_TYPES).map(([key, value]) => (
                    <SelectItem key={key} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="operator">Operatör</Label>
                <Select
                  value={formData.operator}
                  onValueChange={(v) => setFormData({ ...formData, operator: v })}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RULE_OPERATORS).map(([key, value]) => (
                      <SelectItem key={key} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="threshold">Eşik Değeri</Label>
                <Input
                  id="threshold"
                  type="number"
                  className="bg-background border-border"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="severity">Önem Derecesi</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(v) => setFormData({ ...formData, severity: v })}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY).map(([key, value]) => (
                      <SelectItem key={key} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">Öncelik</Label>
                <Input
                  id="priority"
                  type="number"
                  className="bg-background border-border"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  min={1}
                  max={10}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="action">Aksiyon</Label>
              <Select
                value={formData.action}
                onValueChange={(v) => setFormData({ ...formData, action: v })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RULE_ACTIONS).map(([key, value]) => (
                    <SelectItem key={key} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Aktif</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button className="btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              ) : null}
              {editingRule ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#ff4d6a]">
              <AlertTriangle className="w-5 h-5" />
              Kuralı Sil
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono text-[#00d9ff]">{ruleToDelete?.id}</span> kuralını silmek
              istediğinize emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              İptal
            </Button>
            <Button className="btn-outline-danger" onClick={handleDelete} disabled={saving}>
              {saving ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
