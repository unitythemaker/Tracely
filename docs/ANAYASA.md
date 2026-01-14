# Yazılım Anayasası - Turkcell Service Quality Monitor

## 1. Mimari Kararlar

| Karar | Seçim |
|-------|-------|
| Mimari | Monolith |
| Klasör Yapısı | Domain-Driven |
| Binary | Tek binary, çoklu goroutine |
| Async Pattern | Outbox Pattern |

## 2. Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Backend | Go |
| Database | PostgreSQL (source of truth) |
| Query Builder | sqlc |
| Search/Analytics | ElasticSearch (sadece metrics) |
| Frontend | Next.js (static export) |
| Container | Docker |

## 3. Veri Akışı

```
┌──────────────┐     ┌─────────────────────────────────────┐
│  HTTP POST   │────▶│  PostgreSQL (metrics + outbox) TX   │
└──────────────┘     └─────────────────────────────────────┘
                                      │
                       ┌──────────────┴──────────────┐
                       ▼                             ▼
                ┌─────────────┐              ┌─────────────┐
                │ RuleWorker  │              │  ESWorker   │
                │ (goroutine) │              │ (goroutine) │
                └─────────────┘              └─────────────┘
                       │                             │
                       ▼                             ▼
                ┌─────────────┐              ┌─────────────┐
                │  Incident   │              │ ES: metrics │
                │ (PG only)   │              │  index only │
                └─────────────┘              └─────────────┘
```

## 4. Storage Stratejisi

| Veri | Storage | Neden |
|------|---------|-------|
| Metrics | PostgreSQL + ES | Time-series aggregation, dashboard |
| Incidents | Sadece PostgreSQL | Düşük hacim, ilişkisel query |
| Rules | Sadece PostgreSQL | CRUD, düşük hacim |
| Notifications | Sadece PostgreSQL | Log amaçlı |
| Audit | Outbox tablosu | Event history zaten mevcut |

## 5. Outbox Pattern

### Event Types

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `METRIC_CREATED` | Metrik POST | RuleWorker, ESWorker |
| `INCIDENT_CREATED` | Rule ihlali | NotificationWorker |
| `INCIDENT_UPDATED` | Status change | NotificationWorker |

### Worker Tracking

Her worker bağımsız ilerler. `outbox_processing` tablosu hangi worker'ın hangi event'i işlediğini tutar.

## 6. API Tasarımı

| Method | Endpoint | Açıklama | Source |
|--------|----------|----------|--------|
| POST | `/api/metrics` | Metrik gönder | PG write |
| GET | `/api/metrics` | Metrikleri listele | ES |
| GET | `/api/metrics/latest` | Son metrikler | ES |
| GET | `/api/incidents` | Incident listele | PG |
| PATCH | `/api/incidents/:id` | Incident güncelle | PG |
| GET | `/api/rules` | Kuralları listele | PG |
| POST | `/api/rules` | Kural ekle | PG |
| PATCH | `/api/rules/:id` | Kural güncelle | PG |
| GET | `/api/services` | Servisleri listele | PG |
| GET | `/api/stats/overview` | Dashboard summary | ES + PG |

### Polling

Frontend 5-10 sn interval ile GET endpoint'lerini çağırır. SSE veya WebSocket yok.

## 7. Domain Modelleri

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Service   │◄────│   Metric    │────▶│    Rule     │
│  (S1, S2)   │     │ (M1, M2..)  │     │ (QR-01..)   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           │    triggers       │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Incident   │────▶│Notification │
                    │ (INC-01..)  │     │  (N-01..)   │
                    └─────────────┘     └─────────────┘
```

## 8. Klasör Yapısı

```
/cmd
  /server              # main.go, worker bootstrap
/internal
  /metric              # domain: metric
  /rule                # domain: rule + engine
  /incident            # domain: incident
  /notification        # domain: notification
  /outbox              # outbox repository + workers
  /elasticsearch       # ES client + indexing
  /service             # domain: service
/pkg
  /config              # config loading
  /httputil            # HTTP helpers
/db
  /migrations          # SQL migrations
  /queries             # sqlc queries
/web                   # Next.js static
/docker                # Dockerfile, compose
```

## 9. Kurallar ve Kısıtlar

1. **Transaction Boundary:** Metric insert + Outbox insert = tek transaction
2. **Idempotency:** Worker'lar idempotent olmalı (aynı event tekrar işlenebilir)
3. **Error Handling:** Worker hata alırsa event'i işlemez, sonraki poll'da tekrar dener
4. **ES Eventual Consistency:** ES'e yazım başarısız olursa log + retry, sistem durmaz
5. **Rule Engine:** Kurallar DB'den okunur, kod içine gömülmez

## 10. ID Stratejisi

| Entity | ID Format | Örnek |
|--------|-----------|-------|
| Service | String prefix | S1, S2, S3 |
| Metric | UUID | 550e8400-e29b-41d4-a716-446655440000 |
| Rule | String prefix | QR-01, QR-02 |
| Incident | String prefix | INC-001, INC-002 |
| Notification | String prefix | N-001, N-002 |
| Outbox | UUID | Auto-generated |

## 11. Metric Types (Enum)

| Type | Açıklama |
|------|----------|
| `LATENCY_MS` | Gecikme (milisaniye) |
| `PACKET_LOSS` | Paket kaybı (%) |
| `ERROR_RATE` | Hata oranı (%) |
| `BUFFER_RATIO` | Buffer oranı (%) |

## 12. Incident Severity & Status

**Severity:**
| Level | Açıklama |
|-------|----------|
| `CRITICAL` | Servis kullanılamaz |
| `HIGH` | Ciddi performans sorunu |
| `MEDIUM` | Dikkat gerektiren durum |
| `LOW` | Bilgilendirme |

**Status:**
| Status | Açıklama |
|--------|----------|
| `OPEN` | Yeni açıldı |
| `IN_PROGRESS` | Üzerinde çalışılıyor |
| `CLOSED` | Çözüldü |

## 13. Rule Operators

| Operator | Açıklama |
|----------|----------|
| `>` | Büyüktür |
| `>=` | Büyük eşit |
| `<` | Küçüktür |
| `<=` | Küçük eşit |
| `==` | Eşittir |
| `!=` | Eşit değildir |

## 14. Rule Actions

| Action | Açıklama |
|--------|----------|
| `OPEN_INCIDENT` | Incident oluştur |
| `QUALITY_ALERT` | Kalite uyarısı |
| `STREAMING_WARNING` | Streaming uyarısı |
