# Journal #001: Backend Test Raporu

**Tarih:** 2026-01-14
**Durum:** Backend v1 tamamlandı, testler yapıldı
**Commit:** 21eba38

---

## 1. Genel Durum

### Tamamlanan Bileşenler
- [x] Go backend (monolith)
- [x] PostgreSQL schema + migrations
- [x] sqlc query generation
- [x] Domain katmanları (service, metric, rule, incident, notification, outbox)
- [x] HTTP API endpoints
- [x] Outbox pattern implementasyonu
- [x] RuleWorker (kural değerlendirme motoru)
- [x] ESWorker (ElasticSearch sync)
- [x] NotificationWorker (bildirim sistemi)
- [x] ElasticSearch client

### Bekleyen Bileşenler
- [ ] Next.js dashboard
- [ ] Rule yönetim ekranı (BONUS)
- [ ] Bug fixes (aşağıda detaylı)

---

## 2. API Endpoint Listesi

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | /health | Health check |
| GET | /api/services | Tüm servisleri listele |
| GET | /api/services/{id} | Servis detayı |
| GET | /api/metrics | Metrikleri listele |
| POST | /api/metrics | Yeni metrik oluştur |
| GET | /api/rules | Kuralları listele |
| GET | /api/rules/{id} | Kural detayı |
| POST | /api/rules | Yeni kural oluştur |
| PATCH | /api/rules/{id} | Kural güncelle |
| DELETE | /api/rules/{id} | Kural sil |
| GET | /api/incidents | Incident'ları listele |
| GET | /api/incidents/{id} | Incident detayı |
| PATCH | /api/incidents/{id} | Incident güncelle |

---

## 3. Test Sonuçları

### 3.1 Fonksiyonel Testler

| Test | Sonuç | Notlar |
|------|-------|--------|
| Services API | ✅ PASS | 3 seed servis döndü |
| Rules API | ✅ PASS | 4 seed kural döndü |
| Metrics API | ✅ PASS | Metrik oluşturma başarılı |
| Outbox Pattern | ✅ PASS | Event'ler doğru oluşturuluyor |
| RuleWorker | ✅ PASS | Kural ihlalinde incident oluşturdu |
| NotificationWorker | ✅ PASS | Incident için notification gönderdi |
| ESWorker | ⚠️ FAIL | Bug var (aşağıda detay) |

### 3.2 Edge Case Testleri

| # | Test | Beklenen | Gerçekleşen | Sonuç |
|---|------|----------|-------------|-------|
| 1 | POST /api/metrics - boş service_id | 400 | 400 | ✅ PASS |
| 2 | POST /api/metrics - geçersiz metric_type | 400 | 400 | ✅ PASS |
| 3 | GET /api/services/{id} - olmayan id | 404 | 404 | ✅ PASS |
| 4 | GET /api/rules/{id} - olmayan id | 404 | 404 | ✅ PASS |
| 5 | PATCH /api/incidents/{id} - geçersiz status | 400 | 400 | ✅ PASS |
| 6 | POST /api/rules - duplicate id | 409 | 500 | ❌ FAIL |
| 7 | DELETE /api/rules/{id} - olmayan id | 404 | 204 | ❌ FAIL |

---

## 4. Bulunan Bug'lar

### 4.1 [CRITICAL] ElasticSearch Sync Çalışmıyor

**Dosya:** `internal/elasticsearch/client.go:115`

**Problem:**
```go
c.es.Index.WithRefresh("false")  // Dokumentlar flush edilmiyor
```

**Çözüm:**
```go
c.es.Index.WithRefresh("wait_for")  // Dokumentların görünür olmasını bekle
```

**Etki:** Metrikler ES'e yazılıyor ama aranabilir değil, index "red" durumda.

---

### 4.2 [HIGH] Worker Race Condition

**Dosyalar:**
- `internal/rule/worker.go:50-66`
- `internal/elasticsearch/worker.go:49-65`
- `internal/notification/worker.go:46-62`

**Problem:** Outbox event'leri işlendikten SONRA marker yazılıyor. Bu arada başka worker aynı event'i tekrar işleyebilir.

**Çözüm:** SELECT FOR UPDATE kullan veya marker'ı işlemeden ÖNCE yaz.

---

### 4.3 [MEDIUM] ID Overflow

**Dosyalar:**
- `internal/incident/repository.go:16, 88-91`
- `internal/notification/repository.go:11, 40-43`

**Problem:** Atomic counter 999,999'dan sonra `INC-1000000` formatına geçer (6 haneli format bozulur).

**Çözüm:** UUID kullan veya database sequence ile ID üret.

---

### 4.4 [MEDIUM] Duplicate Rule 500 Hatası

**Dosya:** `internal/rule/handler.go`

**Problem:** Duplicate key hatası yakalanmıyor, 500 dönüyor.

**Çözüm:** PostgreSQL unique constraint hatasını yakala, 409 Conflict dön.

---

### 4.5 [LOW] Delete Non-Existent Rule 204 Dönüyor

**Dosya:** `internal/rule/repository.go`

**Problem:** Olmayan kayıt silinince 204 dönüyor, 404 dönmeli.

**Çözüm:** DELETE sonrası affected rows kontrol et.

---

### 4.6 [LOW] CORS Wildcard

**Dosya:** `cmd/server/main.go:168`

**Problem:** `Access-Control-Allow-Origin: "*"` güvenlik riski.

**Çözüm:** Production'da spesifik domain'ler tanımla.

---

### 4.7 [LOW] Request Body Limit Yok

**Dosya:** `pkg/httputil/request.go`

**Problem:** `http.MaxBytesReader()` kullanılmıyor, DoS riski.

**Çözüm:** Body size limiti ekle (örn: 1MB).

---

## 5. Postman Test Komutları

Aşağıdaki curl komutlarını test için kullanabilirsin. Server `http://127.0.0.1:8080` adresinde çalışmalı.

### 5.1 Health Check

```bash
curl -s http://127.0.0.1:8080/health | jq .
```

### 5.2 Services

```bash
# Tüm servisleri listele
curl -s http://127.0.0.1:8080/api/services | jq .

# Tek servis getir
curl -s http://127.0.0.1:8080/api/services/S1 | jq .

# Olmayan servis (404 beklenir)
curl -s -w "\nHTTP Status: %{http_code}\n" http://127.0.0.1:8080/api/services/INVALID | jq .
```

### 5.3 Rules

```bash
# Tüm kuralları listele
curl -s http://127.0.0.1:8080/api/rules | jq .

# Tek kural getir
curl -s http://127.0.0.1:8080/api/rules/QR-01 | jq .

# Yeni kural oluştur
curl -s -X POST http://127.0.0.1:8080/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "id": "QR-TEST",
    "metric_type": "LATENCY_MS",
    "threshold": 100,
    "operator": ">",
    "action": "OPEN_INCIDENT",
    "priority": 1,
    "severity": "HIGH",
    "is_active": true
  }' | jq .

# Kural güncelle
curl -s -X PATCH http://127.0.0.1:8080/api/rules/QR-TEST \
  -H "Content-Type: application/json" \
  -d '{
    "metric_type": "LATENCY_MS",
    "threshold": 200,
    "operator": ">",
    "action": "OPEN_INCIDENT",
    "priority": 2,
    "severity": "MEDIUM",
    "is_active": true
  }' | jq .

# Kural sil
curl -s -X DELETE http://127.0.0.1:8080/api/rules/QR-TEST -w "\nHTTP Status: %{http_code}\n"
```

### 5.4 Metrics

```bash
# Metrikleri listele
curl -s http://127.0.0.1:8080/api/metrics | jq .

# Servise göre metrikler
curl -s "http://127.0.0.1:8080/api/metrics?service_id=S1" | jq .

# Yeni metrik oluştur (kural tetiklemez - threshold altında)
curl -s -X POST http://127.0.0.1:8080/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "S1",
    "metric_type": "LATENCY_MS",
    "value": 100
  }' | jq .

# Yeni metrik oluştur (kural tetikler - threshold üstünde)
curl -s -X POST http://127.0.0.1:8080/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "S1",
    "metric_type": "LATENCY_MS",
    "value": 200
  }' | jq .

# Farklı metrik tipleri test et
curl -s -X POST http://127.0.0.1:8080/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "S2",
    "metric_type": "PACKET_LOSS",
    "value": 2.5
  }' | jq .

curl -s -X POST http://127.0.0.1:8080/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "S3",
    "metric_type": "ERROR_RATE",
    "value": 10
  }' | jq .
```

### 5.5 Incidents

```bash
# Incident'ları listele
curl -s http://127.0.0.1:8080/api/incidents | jq .

# Duruma göre filtrele
curl -s "http://127.0.0.1:8080/api/incidents?status=OPEN" | jq .

# Tek incident getir (ID'yi incidents listesinden al)
curl -s http://127.0.0.1:8080/api/incidents/INC-001 | jq .

# Incident kapat
curl -s -X PATCH http://127.0.0.1:8080/api/incidents/INC-001 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "RESOLVED"
  }' | jq .
```

### 5.6 Edge Case Testleri

```bash
# Boş service_id (400 beklenir)
curl -s -X POST http://127.0.0.1:8080/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "",
    "metric_type": "LATENCY_MS",
    "value": 100
  }' -w "\nHTTP Status: %{http_code}\n"

# Geçersiz metric_type (400 beklenir)
curl -s -X POST http://127.0.0.1:8080/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "S1",
    "metric_type": "INVALID_TYPE",
    "value": 100
  }' -w "\nHTTP Status: %{http_code}\n"

# Olmayan servis (404 beklenir)
curl -s http://127.0.0.1:8080/api/services/NONEXISTENT -w "\nHTTP Status: %{http_code}\n"

# Olmayan kural (404 beklenir)
curl -s http://127.0.0.1:8080/api/rules/NONEXISTENT -w "\nHTTP Status: %{http_code}\n"

# Geçersiz incident status (400 beklenir)
curl -s -X PATCH http://127.0.0.1:8080/api/incidents/INC-001 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "INVALID_STATUS"
  }' -w "\nHTTP Status: %{http_code}\n"
```

### 5.7 Database Kontrolleri (psql)

```bash
# Outbox tablosunu kontrol et
PGPASSWORD=postgres psql -h localhost -U postgres -d tracely -c "SELECT * FROM outbox ORDER BY created_at DESC LIMIT 5;"

# Notifications tablosunu kontrol et
PGPASSWORD=postgres psql -h localhost -U postgres -d tracely -c "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;"

# Incidents tablosunu kontrol et
PGPASSWORD=postgres psql -h localhost -U postgres -d tracely -c "SELECT * FROM incidents ORDER BY created_at DESC LIMIT 5;"

# Metrics tablosunu kontrol et
PGPASSWORD=postgres psql -h localhost -U postgres -d tracely -c "SELECT * FROM metrics ORDER BY created_at DESC LIMIT 5;"
```

### 5.8 ElasticSearch Kontrolleri

```bash
# ES health check
curl -s http://localhost:9200/_cluster/health | jq .

# Index listesi
curl -s http://localhost:9200/_cat/indices?v

# Metrics index'indeki dökümanlar
curl -s http://localhost:9200/metrics/_search?size=10 | jq '.hits.hits'

# Metrics index mapping
curl -s http://localhost:9200/metrics/_mapping | jq .
```

---

## 6. Çalıştırma Talimatları

### 6.1 Servisleri Başlat

```bash
# Docker servisleri başlat
docker compose up -d postgres elasticsearch

# Servislerin hazır olmasını bekle
sleep 10

# Migration çalıştır
PGPASSWORD=postgres psql -h localhost -U postgres -d tracely -f db/migrations/000001_init_schema.up.sql

# Seed data yükle
PGPASSWORD=postgres psql -h localhost -U postgres -d tracely -f db/seed.sql

# .env dosyası oluştur
cp .env.example .env

# Server'ı başlat
go run ./cmd/server
```

### 6.2 Servisleri Durdur

```bash
# Server'ı durdur (Ctrl+C)

# Docker servisleri durdur
docker compose down
```

---

## 7. Sonraki Adımlar

1. **Bug fixes** - Yukarıdaki bug'ları düzelt
2. **Frontend** - Next.js dashboard geliştir
3. **Integration tests** - Otomatik test suite ekle
4. **Documentation** - API documentation (Swagger/OpenAPI)

---

*Son güncelleme: 2026-01-14 21:45*
