# Tracely

> An intelligent incident management and quality monitoring system for real-time service health tracking

Tracely is a full-stack application designed to monitor service metrics, detect quality violations through configurable rules, automatically create incidents, and send notifications to teams. Built with Go and Next.js, it provides comprehensive monitoring capabilities for distributed systems.

## 🎯 Features

### Core Capabilities

- **📊 Metrics Management** - Collect and analyze time-series metrics (latency, packet loss, error rate, buffer ratio)
- **⚡ Real-time Rule Engine** - Define quality rules that automatically detect violations and trigger incidents
- **🚨 Incident Management** - Full lifecycle management (Open → In Progress → Closed) with comments and timeline
- **🔔 Smart Notifications** - Department-based routing with read/unread status tracking
- **📈 Analytics Dashboard** - Elasticsearch-powered analytics with aggregated charts and statistics
- **🏢 Department Organization** - Team-based incident routing and notification management
- **🔍 Advanced Filtering** - Multi-parameter search across incidents, metrics, and rules
- **📱 Responsive UI** - Modern Next.js frontend with real-time updates

### Key Highlights

- **Outbox Pattern** - Reliable event processing with guaranteed delivery
- **Worker Architecture** - Async processing for rules, notifications, and Elasticsearch sync
- **Type-Safe** - Full TypeScript frontend and strongly-typed Go backend
- **Scalable** - PostgreSQL + Elasticsearch for optimal performance
- **Developer-Friendly** - Comprehensive API, hot reload, and easy setup

## 🛠️ Technology Stack

### Backend
- **Go 1.24** - High-performance backend
- **PostgreSQL 16** - Primary data store
- **Elasticsearch 8.11** - Time-series analytics
- **sqlc** - Type-safe SQL code generation

### Frontend
- **Next.js** - React framework with TypeScript
- **Tailwind CSS v4** - Modern styling
- **pnpm** - Fast package management

### Infrastructure
- **Docker Compose** - Local development environment
- **golang-migrate** - Database migrations
- **Kibana** - Data visualization

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Go 1.24+
- Node.js 18+ and pnpm
- Make (optional, for convenience commands)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Tracely
```

2. **Start infrastructure services**
```bash
make setup
# Or manually:
docker-compose up -d
make db-up  # Run migrations
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start the backend**
```bash
make dev
# Or manually:
go run cmd/server/main.go
```

5. **Start the frontend**
```bash
cd web
pnpm install
pnpm dev
```

6. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Kibana: http://localhost:5601

### Seeding Data

```bash
make seed-quick    # 100 metrics
make seed-medium   # 500 metrics
make seed-large    # 2000 metrics
make seed-continuous  # Continuous generation (for testing)
```

## 📐 Architecture

Tracely follows a 3-tier architecture with event-driven workers:

```
┌─────────────────────────────────────────────────────────┐
│              Frontend (Next.js/React)                   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP REST API
┌────────────────────▼────────────────────────────────────┐
│              Backend API (Go)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Handlers │  │Repository│  │ Workers  │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐       ┌────────▼────────┐
│  PostgreSQL    │       │ Elasticsearch   │
│  (Primary DB)  │       │  (Analytics)    │
└────────────────┘       └─────────────────┘
```

### Event Flow (Outbox Pattern)

```
Metric Created → Outbox Entry → Rule Worker → Incident Created
                                                      ↓
                                            Notification Worker
                                                      ↓
                                             Notification Sent
                                                      ↓
                                              ES Worker → Analytics
```

### Core Components

- **Services** - Monitored systems (e.g., "Superonline", "TV+", "Paycell")
- **Metrics** - Time-series data with 4 types (latency, packet loss, error rate, buffer ratio)
- **Rules** - Configurable quality checks (e.g., "latency > 150ms")
- **Incidents** - Auto-generated when rules are violated
- **Notifications** - Team alerts with read status tracking
- **Departments** - Organization units for routing

## 📚 API Documentation

### Base URL
```
http://localhost:8080/api
```

### Key Endpoints

#### Services
```http
GET    /api/services           # List all services
GET    /api/services/{id}      # Get service details
```

#### Metrics
```http
GET    /api/metrics                    # List metrics (paginated)
POST   /api/metrics                    # Create new metric
GET    /api/metrics/chart              # Aggregated data for charts
```

**Create Metric Example:**
```json
POST /api/metrics
{
  "service_id": "uuid",
  "metric_type": "LATENCY_MS",
  "value": 145.5,
  "recorded_at": "2024-01-15T10:30:00Z"
}
```

#### Rules
```http
GET    /api/rules                      # List rules
POST   /api/rules                      # Create rule
GET    /api/rules/{id}                 # Get rule details
PATCH  /api/rules/{id}                 # Update rule
DELETE /api/rules/{id}                 # Delete rule
GET    /api/rules/stats/top-triggered  # Top triggered rules
```

**Create Rule Example:**
```json
POST /api/rules
{
  "name": "High Latency Alert",
  "description": "Alert when latency exceeds 150ms",
  "metric_type": "LATENCY_MS",
  "operator": ">",
  "threshold": 150,
  "severity": "HIGH",
  "department_id": "uuid",
  "enabled": true
}
```

#### Incidents
```http
GET    /api/incidents                 # List incidents (filterable)
GET    /api/incidents/{id}            # Get incident details
PATCH  /api/incidents/{id}            # Update incident status
GET    /api/incidents/{id}/comments   # Get comments
POST   /api/incidents/{id}/comments   # Add comment
DELETE /api/incidents/{id}/comments/{commentId}
GET    /api/incidents/{id}/events     # Get incident timeline
```

**Filters:** `?status=OPEN&severity=HIGH&service_id=uuid&search=keyword`

#### Notifications
```http
GET    /api/notifications              # List notifications
POST   /api/notifications/{id}/read    # Mark as read
POST   /api/notifications/{id}/unread  # Mark as unread
POST   /api/notifications/read-all     # Mark all as read
GET    /api/notifications/unread-count # Unread count
```

#### Departments
```http
GET    /api/departments       # List departments
POST   /api/departments       # Create department
GET    /api/departments/{id}  # Get department
PUT    /api/departments/{id}  # Update department
DELETE /api/departments/{id}  # Delete department
```

### Pagination

All list endpoints support pagination:
```
?limit=20&offset=0&sort_by=created_at&sort_dir=desc&search=keyword
```

**Response Format:**
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

## 🔧 Configuration

Environment variables (`.env`):

```bash
# Server
PORT=8080
DEBUG=false
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Database
DATABASE_URL=postgres://tracely:tracely@localhost:5432/tracely?sslmode=disable

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=metrics
```

## 🏗️ Development

### Project Structure

```
Tracely/
├── cmd/server/              # Application entry point
├── internal/                # Core business logic
│   ├── config/             # Configuration management
│   ├── db/                 # Database models (sqlc-generated)
│   ├── service/            # Service management
│   ├── metric/             # Metrics handling
│   ├── rule/               # Rules engine & worker
│   ├── incident/           # Incident management
│   ├── notification/       # Notification system & worker
│   ├── department/         # Department management
│   ├── elasticsearch/      # ES integration & worker
│   ├── outbox/             # Event outbox pattern
│   └── testutil/           # Test utilities
├── db/
│   ├── migrations/         # SQL migrations
│   ├── queries/            # SQL queries for sqlc
│   └── seed.sql            # Seed data
├── web/                    # Next.js frontend
│   └── src/
│       ├── app/           # Pages (routes)
│       ├── components/    # Reusable UI components
│       ├── hooks/         # Custom React hooks
│       └── lib/           # API client
├── scripts/               # Utility scripts
├── docs/                  # Documentation
├── docker-compose.yml     # Docker services
├── Makefile              # Development commands
└── sqlc.yaml             # sqlc configuration
```

### Makefile Commands

```bash
# Infrastructure
make setup          # Start Docker + run migrations
make down           # Stop all services
make clean          # Clean all data

# Database
make db-up          # Run migrations
make db-down        # Rollback migration
make db-reset       # Rollback all + migrate
make db-seed        # Seed data

# Development
make dev            # Run backend server
make test           # Run all tests
make build          # Build production binary

# Code Generation
make sqlc           # Generate sqlc code
make generate       # Run all code generation

# Seeding
make seed-quick     # Generate 100 metrics
make seed-medium    # Generate 500 metrics
make seed-large     # Generate 2000 metrics
```

### Database Migrations

Create a new migration:
```bash
migrate create -ext sql -dir db/migrations -seq your_migration_name
```

### Adding New Queries

1. Write SQL in `db/queries/*.sql`
2. Run `make sqlc` to generate Go code
3. Use generated functions in repositories

### Testing

```bash
# Run all tests
make test

# Run specific package tests
go test ./internal/incident/...

# Run with coverage
go test -cover ./...
```

## 📦 Deployment

### Building for Production

```bash
# Build backend
make build

# Build frontend
cd web
pnpm build
```

### Docker Deployment

```bash
# Build images
docker-compose build

# Run in production mode
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Setup

Ensure these services are configured:
- PostgreSQL 16+
- Elasticsearch 8.11+
- Proper network configuration
- SSL/TLS certificates (for production)

## 🎨 Frontend Features

### Pages

- **Dashboard** - Overview with metrics, incidents, and rules
- **Incidents** - List, detail, comments, and timeline
- **Metrics** - Service metrics with charts
- **Rules** - Quality rule management
- **Notifications** - Notification inbox with read tracking
- **Services** - Service management

### Components

- Responsive design
- Real-time updates with refresh indicator
- Multi-select filters
- Pagination controls
- Chart visualizations
- Status badges and icons

## 🔄 Workers

Three async workers process events:

### Rule Worker
- Polls for `METRIC_CREATED` events
- Evaluates metrics against active rules
- Creates incidents when rules are violated
- Runs every 1 second

### Notification Worker
- Polls for `INCIDENT_CREATED` and `INCIDENT_UPDATED` events
- Sends notifications to departments
- Tracks notification delivery
- Extensible for email, Slack, SMS

### Elasticsearch Worker
- Syncs metrics to Elasticsearch
- Maintains time-series data
- Enables fast analytics queries
- Supports dashboard aggregations

## 📊 Data Models

### Metric Types
- `LATENCY_MS` - Response time in milliseconds
- `PACKET_LOSS` - Packet loss percentage
- `ERROR_RATE` - Error rate percentage
- `BUFFER_RATIO` - Buffer ratio

### Incident Severity
- `CRITICAL` - Requires immediate attention
- `HIGH` - High priority
- `MEDIUM` - Medium priority
- `LOW` - Low priority

### Incident Status
- `OPEN` - Newly created
- `IN_PROGRESS` - Being worked on
- `CLOSED` - Resolved

### Rule Operators
- `>`, `>=`, `<`, `<=`, `==`, `!=`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Standards

- Follow Go best practices and `gofmt`
- Use TypeScript strict mode
- Write tests for new features
- Update documentation

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check existing documentation in `/docs`
- Review the API documentation above

## 🗺️ Roadmap

- [ ] Email/Slack integration for notifications
- [ ] Advanced analytics with ML predictions
- [ ] Multi-tenant support
- [ ] API authentication and authorization
- [ ] Webhook support for external integrations
- [ ] Mobile app
- [ ] Custom dashboard builder
- [ ] SLA tracking and reporting

## 🏆 Acknowledgments

Built with modern technologies and best practices:
- Go for high-performance backend
- Next.js for powerful frontend
- PostgreSQL for reliable data storage
- Elasticsearch for fast analytics
- Outbox pattern for event reliability

---

**Made with ❤️ for better incident management**
