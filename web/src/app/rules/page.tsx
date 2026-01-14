'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, Rule } from '@/lib/api';
import { Settings, Check, X } from 'lucide-react';

const metricTypeLabels: Record<string, string> = {
  LATENCY_MS: 'Latency (ms)',
  PACKET_LOSS: 'Packet Loss (%)',
  ERROR_RATE: 'Error Rate (%)',
  BUFFER_RATIO: 'Buffer Ratio (%)',
};

const severityColors: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  CRITICAL: 'destructive',
  HIGH: 'destructive',
  MEDIUM: 'secondary',
  LOW: 'outline',
};

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRules() {
      try {
        const data = await api.getRules();
        setRules(data || []);
      } catch (error) {
        console.error('Failed to fetch rules:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchRules();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kurallar</h1>
          <p className="text-muted-foreground">Kalite kurallarını görüntüleyin</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Settings className="h-4 w-4" />
          <span>{rules.length} kural tanımlı</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kural Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Kural bulunamadı
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Metrik</TableHead>
                  <TableHead>Koşul</TableHead>
                  <TableHead>Önem</TableHead>
                  <TableHead>Öncelik</TableHead>
                  <TableHead>Aksiyon</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.id}</TableCell>
                    <TableCell>
                      {metricTypeLabels[rule.metric_type] || rule.metric_type}
                    </TableCell>
                    <TableCell className="font-mono">
                      {rule.operator} {rule.threshold}
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityColors[rule.severity] || 'secondary'}>
                        {rule.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{rule.priority}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.action}</Badge>
                    </TableCell>
                    <TableCell>
                      {rule.is_active ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="h-4 w-4" />
                          <span className="text-sm">Aktif</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-400">
                          <X className="h-4 w-4" />
                          <span className="text-sm">Pasif</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
