**Codenight Case: Turkcell Service Quality Monitor – Servis Kalitesi ve Olay Yönetim Platformu**

**Amaç**

Ekipler, Turkcell servislerine ait performans metriklerini izleyen, belirlenen eşiklere göre **kalite
ihlallerini tespit eden** , bu ihlaller için **olay (incident) oluşturan** ve ilgili ekiplere bildirim
gönderen bir yazılım sistemi geliştirir.

Sistem; servis metriklerini işler, kalite kurallarını uygular, aksiyon üretir ve tüm kararları kayıt
altına alır.

**Temel Özellikler**

**1. Servis ve Metrik Yönetimi**
    - Sistem birden fazla servisi desteklemelidir (Superonline, TV+, Paycell vb.).
    - Her servis için farklı metrikler toplanmalıdır.
       o gecikme (latency)
       o paket kaybı
       o hata oranı
       o buffer oranı

Örnek metrik:

{

"service": "Superonline",

"metric_type": "LATENCY_MS",

"value": 180,

"timestamp": "2026- 03 - 12T09:00:00Z"

}

**2. Kalite Kural Motoru**
    - Metrikler, **veri bazlı kalite kuralları** ile değerlendirilmelidir.
    - Kurallar kod içine gömülmemeli, dışarıdan yönetilebilir olmalıdır.


Örnek kural:

{

"metric_type": "LATENCY_MS",

"threshold": 150,

"operator": ">",

"action": "OPEN_INCIDENT",

"priority": 1

}

**3. Incident (Olay) Yönetimi**
    - Bir kural ihlal edildiğinde sistem otomatik olarak incident oluşturmalıdır.
    - Incident alanları:
       o servis
       o tetikleyen kural
       o şiddet seviyesi
       o durum (OPEN / IN_PROGRESS / CLOSED)
       o zaman bilgisi
**4. Bildirim (Ops / BiP Mock)**
    - Oluşan incident’lar ilgili operasyon ekiplerine bildirilmelidir (mock).

Örnek:

{

"target": "OPS_TEAM",

"message": "Superonline latency threshold exceeded."

}


**5. Kayıt ve İzlenebilirlik**
    - Sistem tüm metrikleri, kural tetiklenmelerini ve incident’ları kayıt altına almalıdır.
**6. Yönetim ve İzleme Ekranı (Dashboard)**

Dashboard’da aşağıdakiler yer almalıdır:

- Servis bazlı anlık metrikler
- Açık / kapalı incident’lar
- En sık tetiklenen kalite kuralları
- Servis bazlı kalite durumu

Dashboard web tabanlı olabilir; mobil uyum zorunlu değildir.

**Bonus Özellik: Kalite Kural Yönetim Ekranı (Opsiyonel)**

- Kural ekleme / güncelleme
- Eşik değerlerini değiştirme
- Kuralları aktif / pasif yapabilme
- Değişikliklerin anında sistem davranışına yansıması

**Puanlama Kriterleri (Genel – 100 Puan)**

```
Kategori Puan
```
```
Temel İşlevsellik ve Doğru Çalışma 30
```
```
Veri Modeli ve Sistem Tasarımı 20
```
```
Kural ve Olay Yönetimi 20
```
```
Kod Kalitesi ve Yapı 15
```
```
Görsellik ve Anlatılabilirlik 10
```
```
Bonus Özellikler 5
```


