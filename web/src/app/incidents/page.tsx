'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { api, Incident } from '@/lib/api';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

const severityColors: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  CRITICAL: 'destructive',
  HIGH: 'destructive',
  MEDIUM: 'secondary',
  LOW: 'outline',
};

const statusIcons: Record<string, React.ReactNode> = {
  OPEN: <Clock className="h-4 w-4 text-yellow-500" />,
  INVESTIGATING: <Clock className="h-4 w-4 text-blue-500" />,
  RESOLVED: <CheckCircle className="h-4 w-4 text-green-500" />,
  CLOSED: <XCircle className="h-4 w-4 text-gray-500" />,
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchIncidents();
  }, [filter]);

  async function fetchIncidents() {
    setLoading(true);
    try {
      const data =
        filter === 'all'
          ? await api.getIncidents(100)
          : await api.getIncidentsByStatus(filter, 100);
      setIncidents(data || []);
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api.updateIncidentStatus(id, status);
      fetchIncidents();
    } catch (error) {
      console.error('Failed to update incident:', error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Olaylar</h1>
          <p className="text-muted-foreground">Servis olaylarını yönetin</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="OPEN">Açık</SelectItem>
            <SelectItem value="INVESTIGATING">İnceleniyor</SelectItem>
            <SelectItem value="RESOLVED">Çözüldü</SelectItem>
            <SelectItem value="CLOSED">Kapatıldı</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Olay Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Olay bulunamadı
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Önem</TableHead>
                  <TableHead>Servis</TableHead>
                  <TableHead>Mesaj</TableHead>
                  <TableHead>Açılma</TableHead>
                  <TableHead>İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell className="font-medium">{incident.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcons[incident.status]}
                        <span className="text-sm">{incident.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityColors[incident.severity] || 'secondary'}>
                        {incident.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{incident.service_id}</TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {incident.message}
                    </TableCell>
                    <TableCell>
                      {format(new Date(incident.opened_at), 'dd MMM HH:mm', {
                        locale: tr,
                      })}
                    </TableCell>
                    <TableCell>
                      {incident.status === 'OPEN' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(incident.id, 'RESOLVED')}
                        >
                          Çöz
                        </Button>
                      )}
                      {incident.status === 'RESOLVED' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus(incident.id, 'CLOSED')}
                        >
                          Kapat
                        </Button>
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
