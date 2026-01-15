# Tracely Architecture Documentation

## Overview

Tracely is built on a modern, event-driven architecture that combines:
- **3-tier layered architecture** for clear separation of concerns
- **Event sourcing with Outbox pattern** for reliable async processing
- **Worker-based architecture** for background processing
- **RESTful API** for client-server communication

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Layer                                │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Browser    │  │  Mobile App  │  │  API Client  │         │
│  │  (Next.js)   │  │  (Future)    │  │              │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │ HTTP/REST
┌──────────────────────────────┼─────────────────────────────────┐
│                     API Gateway Layer                           │
│                              │                                  │
│                      ┌───────▼───────┐                          │
│                      │  HTTP Server  │                          │
│                      │   (Go net/http)│                         │
│                      └───────┬───────┘                          │
└──────────────────────────────┼─────────────────────────────────┘
                               │
┌──────────────────────────────┼─────────────────────────────────┐
│                    Application Layer                            │
│                              │                                  │
│  ┌──────────────────────────┴──────────────────────────┐       │
│  │              Handler Layer                          │       │
│  │  (HTTP Request/Response Processing)                 │       │
│  └──────────────────┬──────────────────────────────────┘       │
│                     │                                           │
│  ┌─────────────────┴──────────────────────────────────┐        │
│  │           Business Logic Layer                     │        │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐ │        │
│  │  │ Service │ │  Metric  │ │  Rule   │ │Incident │ │        │
│  │  │ Manager │ │ Manager  │ │ Engine  │ │ Manager │ │        │
│  │  └─────────┘ └──────────┘ └─────────┘ └─────────┘ │        │
│  │  ┌──────────┐ ┌───────────┐                       │        │
│  │  │Notif     │ │Department │                       │        │
│  │  │Manager   │ │Manager    │                       │        │
│  │  └──────────┘ └───────────┘                       │        │
│  └─────────────────┬──────────────────────────────────┘        │
│                    │                                            │
│  ┌────────────────┴───────────────────────────────────┐        │
│  │           Repository Layer                         │        │
│  │  (Data Access Abstraction)                         │        │
│  │  - ServiceRepository                               │        │
│  │  - MetricRepository                                │        │
│  │  - RuleRepository                                  │        │
│  │  - IncidentRepository                              │        │
│  │  - NotificationRepository                          │        │
│  │  - DepartmentRepository                            │        │
│  │  - OutboxRepository                                │        │
│  └────────────────┬───────────────────────────────────┘        │
└───────────────────┼────────────────────────────────────────────┘
                    │
┌───────────────────┼────────────────────────────────────────────┐
│              Data Layer                                         │
│                   │                                             │
│      ┌────────────┴────────────┐                               │
│      │                         │                               │
│ ┌────▼─────┐           ┌───────▼────────┐                     │
│ │PostgreSQL│           │ Elasticsearch  │                     │
│ │          │           │                │                     │
│ │- Services│           │- Metrics Index │                     │
│ │- Metrics │           │- Aggregations  │                     │
│ │- Rules   │           │- Analytics     │                     │
│ │- Incidents│          │                │                     │
│ │- Notifs  │           │                │                     │
│ │- Outbox  │           │                │                     │
│ └──────────┘           └────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### Worker Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Worker Pool                                  │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │   Rule Worker    │  │ Notif Worker     │  │  ES Worker   │ │
│  │                  │  │                  │  │              │ │
│  │ Poll: 1s         │  │ Poll: 1s         │  │ Poll: 1s     │ │
│  │ Batch: 100       │  │ Batch: 100       │  │ Batch: 100   │ │
│  │                  │  │                  │  │              │ │
│  │ Processes:       │  │ Processes:       │  │ Processes:   │ │
│  │ METRIC_CREATED   │  │ INCIDENT_CREATED │  │ All Events   │ │
│  │                  │  │ INCIDENT_UPDATED │  │              │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘ │
│           │                     │                    │         │
└───────────┼─────────────────────┼────────────────────┼─────────┘
            │                     │                    │
            └─────────────────────┴────────────────────┘
                                  │
                         ┌────────▼────────┐
                         │ Outbox Table    │
                         │ (Event Queue)   │
                         └─────────────────┘
```

## Data Flow

### 1. Metric Ingestion Flow

```
Client → POST /api/metrics
   ↓
Handler validates request
   ↓
Repository.CreateMetric()
   ├─ INSERT INTO metrics
   └─ INSERT INTO outbox (type: METRIC_CREATED)
   ↓
Transaction committed
   ↓
Response to client (201 Created)

--- Async Processing ---
   ↓
Rule Worker polls outbox
   ↓
For each METRIC_CREATED event:
   ├─ Fetch active rules matching metric_type
   ├─ Evaluate metric against threshold
   ├─ If violated:
   │    ├─ CREATE incident
   │    ├─ INSERT outbox (INCIDENT_CREATED)
   │    └─ UPDATE rule trigger_count
   └─ Mark outbox event as processed
   ↓
Notification Worker polls outbox
   ↓
For each INCIDENT_CREATED event:
   ├─ Fetch incident details
   ├─ Fetch department info
   ├─ CREATE notification
   ├─ Send notification (mock/email/slack)
   └─ Mark outbox event as processed
   ↓
ES Worker polls outbox
   ↓
For each event:
   ├─ Extract metric data
   ├─ Index to Elasticsearch
   └─ Mark outbox event as processed
```

### 2. Incident Lifecycle Flow

```
Rule Violation Detected
   ↓
CREATE incident (status: OPEN, severity: from rule)
   ↓
INSERT incident_events (type: CREATED)
   ↓
Notification sent to department
   ↓
User updates status → IN_PROGRESS
   ↓
INSERT incident_events (type: STATUS_CHANGED)
   ↓
INSERT outbox (INCIDENT_UPDATED)
   ↓
User adds comment
   ↓
INSERT incident_comments
   ↓
INSERT incident_events (type: COMMENTED)
   ↓
User closes incident
   ↓
UPDATE incident (status: CLOSED, closed_at: NOW())
   ↓
INSERT incident_events (type: STATUS_CHANGED)
```

## Database Schema Design

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  departments │       │   services   │       │    metrics   │
│──────────────│       │──────────────│       │──────────────│
│ id (PK)      │       │ id (PK)      │◄──────┤ id (PK)      │
│ name         │       │ name         │       │ service_id   │
│ created_at   │       │ created_at   │       │ metric_type  │
└──────┬───────┘       └──────────────┘       │ value        │
       │                                       │ recorded_at  │
       │                                       │ created_at   │
       │                                       └──────────────┘
       │
       │               ┌──────────────┐
       │               │ quality_rules│
       │               │──────────────│
       │               │ id (PK)      │
       └───────────────┤ department_id│
                       │ name         │
                       │ metric_type  │
                       │ operator     │
                       │ threshold    │
                       │ severity     │
                       │ enabled      │
                       │ trigger_count│
                       │ created_at   │
                       └──────┬───────┘
                              │
                              │
┌──────────────┐       ┌──────▼───────┐       ┌──────────────┐
│incident_     │       │  incidents   │       │notifications │
│comments      │       │──────────────│       │──────────────│
│──────────────│       │ id (PK)      │───────► id (PK)      │
│ id (PK)      │◄──────┤ service_id   │       │ incident_id  │
│ incident_id  │       │ rule_id      │       │ department_id│
│ user_name    │       │ severity     │       │ title        │
│ content      │       │ status       │       │ message      │
│ created_at   │       │ message      │       │ is_read      │
└──────────────┘       │ opened_at    │       │ created_at   │
                       │ in_progress_at│      └──────────────┘
┌──────────────┐       │ closed_at    │
│incident_     │       │ created_at   │
│events        │       │ updated_at   │
│──────────────│       └──────────────┘
│ id (PK)      │
│ incident_id  │◄──────┘
│ event_type   │
│ user_name    │
│ old_value    │
│ new_value    │
│ created_at   │
└──────────────┘

        ┌──────────────┐       ┌──────────────────┐
        │   outbox     │       │outbox_processing │
        │──────────────│       │──────────────────│
        │ id (PK)      │───────► outbox_id        │
        │ event_type   │       │ processor_name   │
        │ aggregate_id │       │ processed_at     │
        │ payload      │       │ created_at       │
        │ created_at   │       └──────────────────┘
        └──────────────┘
```

### Key Design Decisions

#### 1. Outbox Pattern
**Why:** Ensures reliable event processing without distributed transactions.

**How:**
- Every state change writes to `outbox` table in same transaction
- Workers poll outbox independently
- `outbox_processing` tracks which worker processed which event
- Idempotent processing allows retries

**Benefits:**
- Guaranteed event delivery
- No message broker dependency
- Transaction consistency
- Easy debugging (events are in DB)

#### 2. Trigger Count in Rules
**Why:** Track rule effectiveness and identify noisy rules.

**Implementation:**
- Incremented atomically in rule worker
- Used for "Top Triggered Rules" analytics
- Helps identify rules that need tuning

#### 3. Department-Based Routing
**Why:** Scale notification system for multi-team environments.

**Implementation:**
- Rules belong to departments
- Incidents inherit department from rule
- Notifications routed to department
- Supports future RBAC implementation

#### 4. Incident Events Timeline
**Why:** Full audit trail of incident lifecycle.

**Implementation:**
- Separate `incident_events` table
- Event types: CREATED, STATUS_CHANGED, COMMENTED, ASSIGNED, SEVERITY_CHANGED
- Stores old/new values for changes
- Queryable timeline for UI

#### 5. Dual Storage (PostgreSQL + Elasticsearch)
**Why:** Optimize for different query patterns.

**PostgreSQL:**
- Transactional data (CRUD operations)
- Complex joins
- Strong consistency

**Elasticsearch:**
- Time-series analytics
- Fast aggregations
- Dashboard queries
- Full-text search (future)

## Component Details

### Backend Components

#### 1. Handlers
**Responsibility:** HTTP request/response processing

**Pattern:**
```go
type Handler struct {
    repo Repository
}

func (h *Handler) HandleRequest(w http.ResponseWriter, r *http.Request) {
    // 1. Parse request
    // 2. Validate input
    // 3. Call repository
    // 4. Format response
}
```

**Key Files:**
- `internal/metric/handler.go`
- `internal/incident/handler.go`
- `internal/notification/handler.go`

#### 2. Repositories
**Responsibility:** Data access abstraction

**Pattern:**
```go
type Repository interface {
    Create(ctx context.Context, input CreateInput) (*Model, error)
    Get(ctx context.Context, id uuid.UUID) (*Model, error)
    List(ctx context.Context, opts ListOptions) ([]*Model, int, error)
    Update(ctx context.Context, id uuid.UUID, input UpdateInput) error
    Delete(ctx context.Context, id uuid.UUID) error
}
```

**Key Features:**
- Uses sqlc-generated queries
- Transaction support
- Context propagation
- Error wrapping

#### 3. Workers
**Responsibility:** Async event processing

**Pattern:**
```go
type Worker struct {
    outboxRepo OutboxRepository
    // other dependencies
}

func (w *Worker) Start(ctx context.Context) {
    ticker := time.NewTicker(pollInterval)
    for {
        select {
        case <-ticker.C:
            w.processEvents(ctx)
        case <-ctx.Done():
            return
        }
    }
}

func (w *Worker) processEvents(ctx context.Context) {
    events := w.outboxRepo.GetUnprocessed(ctx, eventType, batchSize)
    for _, event := range events {
        w.processEvent(ctx, event)
        w.outboxRepo.MarkProcessed(ctx, event.ID, processorName)
    }
}
```

**Workers:**
1. **RuleWorker** - Evaluates metrics against rules
2. **NotificationWorker** - Sends notifications
3. **ElasticsearchWorker** - Syncs to ES

### Frontend Components

#### Page Structure
```
app/
├── page.tsx                  # Dashboard (overview)
├── incidents/
│   ├── page.tsx             # Incident list
│   └── [id]/
│       └── page.tsx         # Incident detail
├── metrics/
│   └── page.tsx             # Metrics view
├── rules/
│   └── page.tsx             # Rules management
├── notifications/
│   └── page.tsx             # Notification inbox
└── services/
    └── page.tsx             # Service management
```

#### Component Hierarchy
```
Page Component
  ├─ Layout Component
  │   ├─ Header
  │   └─ Sidebar
  ├─ Filter Component
  │   ├─ SearchInput
  │   ├─ StatusFilter
  │   └─ SeverityFilter
  ├─ Data Table Component
  │   ├─ Table Header
  │   ├─ Table Rows
  │   │   └─ Row Component
  │   └─ Pagination
  └─ Chart Component (if applicable)
      ├─ LineChart
      ├─ BarChart
      └─ PieChart
```

## Scalability Considerations

### Current Architecture
- **Single server** deployment
- **Vertical scaling** (add more CPU/RAM)
- **Local workers** (run in same process)

### Future Scaling Options

#### 1. Horizontal Scaling (API Layer)
```
Load Balancer
    ↓
┌───────┬───────┬───────┐
│ API-1 │ API-2 │ API-3 │
└───┬───┴───┬───┴───┬───┘
    └───────┴───────┘
           │
      PostgreSQL
```

**Changes needed:**
- Stateless API servers (already done ✓)
- Session management (if auth added)
- Health check endpoints (already done ✓)

#### 2. Separate Worker Deployment
```
API Servers ──┐
              ├─► PostgreSQL ◄── Worker Pool
              │                  ├─ Rule Worker × 3
Frontend ─────┘                  ├─ Notif Worker × 2
                                 └─ ES Worker × 1
```

**Changes needed:**
- Deploy workers separately
- Leader election (prevent duplicate processing)
- Use `outbox_processing` to track worker instances

#### 3. Message Queue Migration
```
PostgreSQL → Kafka/RabbitMQ → Workers
```

**When needed:**
- Event throughput > 10k/sec
- Need event replay
- Cross-service events

**Trade-offs:**
- More infrastructure complexity
- Eventual consistency
- External dependency

#### 4. Database Sharding
```
Shard 1 (Services 1-100)
Shard 2 (Services 101-200)
Shard 3 (Services 201-300)
```

**When needed:**
- Data > 1TB
- Write throughput bottleneck

**Sharding key:** `service_id`

## Security Architecture

### Current Implementation
- No authentication (internal tool)
- CORS protection
- SQL injection protection (parameterized queries)
- Input validation

### Future Security Enhancements

#### 1. Authentication & Authorization
```
User → Auth Service (JWT) → API Gateway → Backend
                                ↓
                          Verify JWT + Check Permissions
```

**Recommended:**
- OAuth2/OIDC for SSO
- JWT tokens
- Role-based access control (RBAC)

#### 2. RBAC Model
```
Roles:
- Admin: Full access
- Manager: Manage rules, view all incidents
- Operator: View incidents, add comments
- Viewer: Read-only access

Departments:
- Network Team
- Platform Team
- Support Team

Permissions:
- incidents.create
- incidents.update
- incidents.view
- rules.create
- rules.update
- etc.
```

#### 3. API Security
- Rate limiting
- API keys for external integrations
- Request signing
- TLS/SSL enforcement

## Monitoring & Observability

### Current Capabilities
- Health check endpoint: `/health`
- Database connection health
- Elasticsearch connection health

### Recommended Additions

#### 1. Logging
```
Structured logging with levels:
- ERROR: Critical failures
- WARN: Degraded performance
- INFO: Important events
- DEBUG: Detailed diagnostics
```

**Use:** `zerolog` or `zap`

#### 2. Metrics
```
Business Metrics:
- incidents.created.count
- incidents.closed.count
- rules.triggered.count
- notifications.sent.count
- metrics.ingested.count

System Metrics:
- http.request.duration
- http.request.count
- db.query.duration
- worker.processing.duration
- outbox.queue.size
```

**Use:** Prometheus + Grafana

#### 3. Tracing
```
Request → Handler → Repository → Database
   └─────────── Trace ID ──────────┘
```

**Use:** OpenTelemetry + Jaeger

#### 4. Alerting
```
Alerts:
- High incident creation rate
- Worker lag > threshold
- Database connection errors
- API error rate > 5%
- Disk usage > 80%
```

**Use:** Prometheus Alertmanager

## Performance Optimization

### Database Optimizations

#### 1. Indexes (Already Implemented)
```sql
-- Frequent queries
CREATE INDEX idx_metrics_service_id ON metrics(service_id);
CREATE INDEX idx_metrics_created_at ON metrics(created_at);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_outbox_created_at ON outbox(created_at);
```

#### 2. Query Optimization
- Use `LIMIT` and `OFFSET` for pagination
- Avoid `SELECT *` (use specific columns)
- Use prepared statements (sqlc generates these)
- Connection pooling (pgx supports this)

#### 3. Partitioning (Future)
```sql
-- Partition metrics by month
CREATE TABLE metrics_2024_01 PARTITION OF metrics
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Application Optimizations

#### 1. Caching
```
Cache Layer (Redis)
    ↓
GET /api/services → Check cache → Return cached
                         ↓ (miss)
                    Query DB → Cache → Return
```

**Cache candidates:**
- Services list (rarely changes)
- Active rules (change infrequently)
- Department list

#### 2. Batch Processing
```go
// Instead of:
for _, metric := range metrics {
    db.CreateMetric(metric)
}

// Use:
db.CreateMetricsBatch(metrics)
```

#### 3. Connection Pooling
```go
// Already configured in pgx
pool, _ := pgxpool.New(ctx, connString)
// Max connections: 20
// Min connections: 5
```

## Testing Strategy

### Unit Tests
- Repository layer (mock database)
- Business logic
- Utility functions

### Integration Tests
- API endpoints (with test database)
- Worker processing
- Database queries

### E2E Tests
- Full user flows
- Frontend + Backend integration

### Performance Tests
- Load testing (k6, vegeta)
- Stress testing
- Soak testing (24h run)

## Disaster Recovery

### Backup Strategy
1. **PostgreSQL backups**
   - Daily full backups
   - WAL archiving for point-in-time recovery
   - Retention: 30 days

2. **Elasticsearch snapshots**
   - Daily snapshots
   - S3 backup repository
   - Retention: 7 days (metrics are transient)

### Recovery Procedures
1. **Database failure**
   - Restore from latest backup
   - Replay WAL logs
   - Restart workers

2. **Elasticsearch failure**
   - Restore from snapshot
   - OR re-sync from PostgreSQL (metrics table)
   - ES Worker will catch up

3. **Application failure**
   - Docker restart (auto-restart enabled)
   - Outbox pattern ensures no event loss
   - Workers resume from last processed event

## Conclusion

Tracely's architecture is designed for:
- **Reliability** - Outbox pattern ensures no data loss
- **Scalability** - Horizontal scaling ready
- **Maintainability** - Clear separation of concerns
- **Observability** - Ready for monitoring tools
- **Performance** - Optimized queries and async processing

The event-driven architecture with workers provides a solid foundation for future enhancements while maintaining simplicity for current needs.
