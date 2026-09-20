# Cloud Surface Contract

Cloud Surface adalah jalur **data/state**, bukan jalur pengiriman executable code.

## Endpoint

```text
GET /v1/extension-state?extension_version=<version>&distribution_channel=<github|cws|edge|android>
```

Client pada `cws-candidate` sudah mengimplementasikan endpoint ini. Jika endpoint belum tersedia, gagal, atau payload tidak valid, client **fail closed** ke state kosong dan fungsi OCR/PDF utama tetap berjalan.

## Schema v1

```json
{
  "schema_version": 1,
  "generated_at": "2026-09-20T00:00:00Z",
  "ttl_seconds": 60,
  "sections": [
    {
      "id": "maintenance-001",
      "visible": true,
      "kind": "warning",
      "title": "Info layanan",
      "text": "Teks plain dari server.",
      "action": {
        "type": "OPEN_URL",
        "label": "Lihat info",
        "url": "https://example.com/status"
      }
    }
  ],
  "supporter": {
    "active": false,
    "until": null,
    "label": "BMP Supporter"
  },
  "features": {
    "supporter_card": false,
    "community_banner": false
  }
}
```

Payload blueprint lama dengan `notice` dan `community` tetap dapat diterjemahkan client ke section aman untuk backward compatibility.

## Section allowlist

Maksimal 8 section per payload.

Known `kind`:
- `info`
- `warning`
- `success`
- `community`
- `supporter`

Field content dirender dengan DOM `textContent`, bukan `innerHTML`. Server tidak mengontrol CSS class selain pemilihan dari enum yang sudah dikirim di package.

## Action registry

Known action:
- `OPEN_URL` — HTTPS URL tervalidasi;
- `OPEN_CHANNEL` — URL komunitas yang sudah ada di config package;
- `OPEN_GROUP` — URL group yang sudah ada di config package;
- `OPEN_ABOUT` — halaman lokal extension.

Action lain ditolak. `OPEN_URL` menolak scheme non-HTTPS seperti `javascript:`, `data:`, `file:`, dan custom executable schemes.

## Cache/freshness

`ttl_seconds` dibatasi client ke 60–86400 detik. Popup boleh meminta state setiap 30 detik, tetapi background hanya melakukan network refresh saat cache expired. Kegagalan endpoint mendapat backoff 5 menit dan menghasilkan state kosong.

## Forbidden

Client menolak/mengabaikan:
- JavaScript source atau URL untuk JavaScript;
- arbitrary HTML;
- remote WASM atau executable worker URL;
- CSS/code injection;
- expression/template yang dievaluasi sebagai code;
- arbitrary command string;
- downloaded functionality yang belum ada dalam package.

Unknown schema version menghasilkan state kosong.

## Ads/supporter boundary

Sponsor/ads **belum menjadi bagian initial Store acceptance build**. Sponsor future membutuhkan release code dan disclosure privacy/listing sebelum diaktifkan. Cloud Surface sekarang sengaja tidak menyediakan remote arbitrary ad renderer.

Mental model:

```text
CLOUD CONTROLS APPROVED STATE AND PLAIN CONTENT.
STORE PACKAGE CONTROLS EXECUTABLE CODE AND ACTIONS.
```
