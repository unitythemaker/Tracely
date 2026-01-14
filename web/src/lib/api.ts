const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export interface Service {
  id: string;
  name: string;
  created_at: string;
}

export interface Metric {
  id: string;
  service_id: string;
  metric_type: string;
  value: number;
  recorded_at: string;
  created_at: string;
}

export interface Rule {
  id: string;
  metric_type: string;
  threshold: number;
  operator: string;
  action: string;
  priority: number;
  severity: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  service_id: string;
  rule_id: string;
  metric_id: string;
  severity: string;
  status: string;
  message: string;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const api = {
  getServices: () => fetchAPI<Service[]>('/api/services'),
  getService: (id: string) => fetchAPI<Service>(`/api/services/${id}`),

  getMetrics: (limit = 50) => fetchAPI<Metric[]>(`/api/metrics?limit=${limit}`),
  getMetricsByService: (serviceId: string, limit = 50) =>
    fetchAPI<Metric[]>(`/api/metrics?service_id=${serviceId}&limit=${limit}`),

  getRules: () => fetchAPI<Rule[]>('/api/rules'),
  getRule: (id: string) => fetchAPI<Rule>(`/api/rules/${id}`),

  getIncidents: (limit = 50) => fetchAPI<Incident[]>(`/api/incidents?limit=${limit}`),
  getIncidentsByStatus: (status: string, limit = 50) =>
    fetchAPI<Incident[]>(`/api/incidents?status=${status}&limit=${limit}`),

  updateIncidentStatus: async (id: string, status: string) => {
    const res = await fetch(`${API_BASE}/api/incidents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
};
