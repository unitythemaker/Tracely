'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, Service, Incident } from '@/lib/api';
import { Server, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [servicesData, incidentsData] = await Promise.all([
          api.getServices(),
          api.getIncidents(100),
        ]);
        setServices(servicesData || []);
        setIncidents(incidentsData || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function getServiceStatus(serviceId: string) {
    const openIncidents = incidents.filter(
      (i) => i.service_id === serviceId && i.status === 'OPEN'
    );
    if (openIncidents.some((i) => i.severity === 'CRITICAL')) return 'critical';
    if (openIncidents.length > 0) return 'warning';
    return 'healthy';
  }

  function getOpenIncidentCount(serviceId: string) {
    return incidents.filter(
      (i) => i.service_id === serviceId && i.status === 'OPEN'
    ).length;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Servisler</h1>
        <p className="text-muted-foreground">İzlenen servislerin durumu</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const status = getServiceStatus(service.id);
          const openCount = getOpenIncidentCount(service.id);

          return (
            <Card key={service.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">
                  {service.name}
                </CardTitle>
                {status === 'healthy' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : status === 'critical' ? (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Server className="h-4 w-4" />
                    <span>{service.id}</span>
                  </div>
                  <Badge
                    variant={
                      status === 'healthy'
                        ? 'outline'
                        : status === 'critical'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {status === 'healthy'
                      ? 'Sağlıklı'
                      : openCount > 0
                      ? `${openCount} olay`
                      : 'Uyarı'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Oluşturulma:{' '}
                  {format(new Date(service.created_at), 'dd MMM yyyy', {
                    locale: tr,
                  })}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {services.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Henüz servis tanımlanmamış
          </CardContent>
        </Card>
      )}
    </div>
  );
}
