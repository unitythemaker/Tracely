'use client';

import { useEffect, useState } from 'react';
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
} from '@/lib/api';
import { SlidersHorizontal, Plus, Pencil, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

const severityColors: Record<string, string> = {
  CRITICAL: '#ff3b5c',
  HIGH: '#ffb800',
  MEDIUM: '#00d9ff',
  LOW: '#6b7a8f',
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

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [formData, setFormData] = useState<CreateRuleInput>(defaultRule);
  const [saving, setSaving] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);

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

  const activeCount = rules.filter((r) => r.is_active).length;

  return (
    <div className="space-y-6 grid-pattern min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kurallar</h1>
          <p className="text-muted-foreground mt-1">Kalite kurallarını yönetin</p>
        </div>
        <Button
          className="bg-[#00d9ff] text-[#0a0e14] hover:bg-[#00d9ff]/90"
          onClick={openCreateDialog}
        >
          <Plus className="w-4 h-4 mr-2" />
          Yeni Kural
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border card-hover">
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
        <Card className="bg-card border-border card-hover">
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
        <Card className="bg-card border-border card-hover">
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

      {/* Table */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[#00d9ff]" />
            Kural Listesi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d9ff]" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <SlidersHorizontal className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Kural bulunamadı</p>
              <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                İlk Kuralı Oluştur
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">ID</TableHead>
                  <TableHead className="text-muted-foreground">Metrik</TableHead>
                  <TableHead className="text-muted-foreground">Koşul</TableHead>
                  <TableHead className="text-muted-foreground">Aksiyon</TableHead>
                  <TableHead className="text-muted-foreground">Önem</TableHead>
                  <TableHead className="text-muted-foreground">Öncelik</TableHead>
                  <TableHead className="text-muted-foreground">Durum</TableHead>
                  <TableHead className="text-muted-foreground text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} className="border-border hover:bg-muted/30">
                    <TableCell className="font-mono text-sm text-[#00d9ff]">{rule.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {rule.metric_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {rule.operator} {rule.threshold}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className="text-xs"
                        style={{
                          backgroundColor: 'rgba(0, 217, 255, 0.1)',
                          color: '#00d9ff',
                          border: '1px solid rgba(0, 217, 255, 0.3)',
                        }}
                      >
                        {rule.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: `${severityColors[rule.severity]}15`,
                          color: severityColors[rule.severity],
                          border: `1px solid ${severityColors[rule.severity]}30`,
                        }}
                      >
                        {rule.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{rule.priority}</TableCell>
                    <TableCell>
                      {rule.is_active ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#10b981] status-pulse" />
                          <span className="text-sm text-[#10b981]">Aktif</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Pasif</span>
                        </div>
                      )}
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
                          className="text-muted-foreground hover:text-[#ff3b5c]"
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
            <Button
              className="bg-[#00d9ff] text-[#0a0e14] hover:bg-[#00d9ff]/90"
              onClick={handleSubmit}
              disabled={saving}
            >
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
            <DialogTitle className="flex items-center gap-2 text-[#ff3b5c]">
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
            <Button
              className="bg-[#ff3b5c] text-white hover:bg-[#ff3b5c]/90"
              onClick={handleDelete}
              disabled={saving}
            >
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
