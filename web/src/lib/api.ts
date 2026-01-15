const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Pagination types
export interface ListParams {
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

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

async function fetchPaginatedAPI<T>(endpoint: string, params: ListParams = {}): Promise<PaginatedResponse<T>> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  const url = queryString ? `${API_BASE}${endpoint}?${queryString}` : `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${res.status}`);
  }
  const json = await res.json();
  return {
    data: json.data,
    meta: json.meta,
  };
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

export interface AggregatedMetric {
  time: string;
  metric_type: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ChartParams {
  from?: string;
  to?: string;
  service_id?: string;
  metric_type?: string;
  bucket?: 'minute' | 'hour' | 'day';
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
  trigger_count: number;
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

export interface TopTriggeredRule extends Rule {
  trigger_count: number;
  last_triggered_at: string | null;
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
  in_progress_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentComment {
  id: string;
  incident_id: string;
  author: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentEvent {
  id: string;
  incident_id: string;
  event_type: 'CREATED' | 'STATUS_CHANGED' | 'COMMENT_ADDED' | 'ASSIGNED' | 'SEVERITY_CHANGED';
  actor: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
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
  getServices: (params: ListParams = {}) => fetchPaginatedAPI<Service>('/api/services', params),
  getService: (id: string) => fetchAPI<Service>(`/api/services/${id}`),

  // Metrics
  getMetrics: (params: ListParams = {}) => fetchPaginatedAPI<Metric>('/api/metrics', params),
  getMetricsByService: (serviceId: string, params: ListParams = {}) =>
    fetchPaginatedAPI<Metric>('/api/metrics', { ...params, service_id: serviceId }),
  getMetricsChart: async (params: ChartParams = {}): Promise<AggregatedMetric[]> => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    const url = queryString
      ? `${API_BASE}/api/metrics/chart?${queryString}`
      : `${API_BASE}/api/metrics/chart`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  },
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
  getRules: (params: ListParams = {}) => fetchPaginatedAPI<Rule>('/api/rules', params),
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
  getTopTriggeredRules: (limit: number = 10) => fetchAPI<TopTriggeredRule[]>(`/api/rules/stats/top-triggered?limit=${limit}`),

  // Incidents
  getIncidents: (params: ListParams = {}) => fetchPaginatedAPI<Incident>('/api/incidents', params),
  getIncident: (id: string) => fetchAPI<Incident>(`/api/incidents/${id}`),
  getIncidentsByStatus: (status: string, params: ListParams = {}) =>
    fetchPaginatedAPI<Incident>('/api/incidents', { ...params, status }),
  getIncidentsByService: (serviceId: string, params: ListParams = {}) =>
    fetchPaginatedAPI<Incident>('/api/incidents', { ...params, service_id: serviceId }),
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

  // Incident Comments
  getIncidentComments: (incidentId: string) =>
    fetchAPI<IncidentComment[]>(`/api/incidents/${incidentId}/comments`),
  createIncidentComment: async (incidentId: string, author: string, content: string) => {
    const res = await fetch(`${API_BASE}/api/incidents/${incidentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, content }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${res.status}`);
    }
    return res.json();
  },
  deleteIncidentComment: async (incidentId: string, commentId: string) => {
    const res = await fetch(`${API_BASE}/api/incidents/${incidentId}/comments/${commentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${res.status}`);
    }
    return true;
  },

  // Incident Events (Timeline)
  getIncidentEvents: (incidentId: string) =>
    fetchAPI<IncidentEvent[]>(`/api/incidents/${incidentId}/events`),
};
