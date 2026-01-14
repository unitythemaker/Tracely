const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

// Types
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

export interface CreateRuleInput {
  id: string;
  metric_type: string;
  threshold: number;
  operator: string;
  action: string;
  priority: number;
  severity: string;
  is_active: boolean;
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

export interface Notification {
  id: string;
  incident_id: string;
  target: string;
  message: string;
  sent_at: string;
  created_at: string;
}

// Status constants matching backend
export const INCIDENT_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSED: 'CLOSED',
} as const;

export const SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export const METRIC_TYPES = {
  LATENCY_MS: 'LATENCY_MS',
  PACKET_LOSS: 'PACKET_LOSS',
  ERROR_RATE: 'ERROR_RATE',
  BUFFER_RATIO: 'BUFFER_RATIO',
} as const;

export const RULE_OPERATORS = {
  GT: '>',
  GTE: '>=',
  LT: '<',
  LTE: '<=',
  EQ: '==',
  NEQ: '!=',
} as const;

export const RULE_ACTIONS = {
  OPEN_INCIDENT: 'OPEN_INCIDENT',
  THROTTLE: 'THROTTLE',
  WEBHOOK: 'WEBHOOK',
} as const;

// User-friendly labels for metric types
export const METRIC_TYPE_LABELS: Record<string, string> = {
  LATENCY_MS: 'Latency',
  PACKET_LOSS: 'Packet Loss',
  ERROR_RATE: 'Error Rate',
  BUFFER_RATIO: 'Buffer Ratio',
};

// User-friendly labels for severity
export const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

// User-friendly labels for rule actions
export const RULE_ACTION_LABELS: Record<string, string> = {
  OPEN_INCIDENT: 'Open Incident',
  THROTTLE: 'Throttle',
  WEBHOOK: 'Webhook',
};

// Helper function to format any SNAKE_CASE to Title Case
export function formatLabel(value: string): string {
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// API functions
export const api = {
  // Services
  getServices: () => fetchAPI<Service[]>('/api/services'),
  getService: (id: string) => fetchAPI<Service>(`/api/services/${id}`),

  // Metrics
  getMetrics: (limit = 50) => fetchAPI<Metric[]>(`/api/metrics?limit=${limit}`),
  getMetricsByService: (serviceId: string, limit = 50) =>
    fetchAPI<Metric[]>(`/api/metrics?service_id=${serviceId}&limit=${limit}`),
  createMetric: async (data: { service_id: string; metric_type: string; value: number }) => {
    const res = await fetch(`${API_BASE}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  // Rules
  getRules: () => fetchAPI<Rule[]>('/api/rules'),
  getRule: (id: string) => fetchAPI<Rule>(`/api/rules/${id}`),
  createRule: async (data: CreateRuleInput) => {
    const res = await fetch(`${API_BASE}/api/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${res.status}`);
    }
    return res.json();
  },
  updateRule: async (id: string, data: Partial<CreateRuleInput>) => {
    const res = await fetch(`${API_BASE}/api/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${res.status}`);
    }
    return res.json();
  },
  deleteRule: async (id: string) => {
    const res = await fetch(`${API_BASE}/api/rules/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${res.status}`);
    }
    return true;
  },

  // Incidents
  getIncidents: (limit = 50) => fetchAPI<Incident[]>(`/api/incidents?limit=${limit}`),
  getIncident: (id: string) => fetchAPI<Incident>(`/api/incidents/${id}`),
  getIncidentsByStatus: (status: string, limit = 50) =>
    fetchAPI<Incident[]>(`/api/incidents?status=${status}&limit=${limit}`),
  getIncidentsByService: (serviceId: string, limit = 50) =>
    fetchAPI<Incident[]>(`/api/incidents?service_id=${serviceId}&limit=${limit}`),
  updateIncidentStatus: async (id: string, status: string) => {
    const res = await fetch(`${API_BASE}/api/incidents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${res.status}`);
    }
    return res.json();
  },
};
