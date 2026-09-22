# Cloud Surface Contract

Cloud Surface adalah jalur **data/state**, bukan jalur pengiriman executable code.

## Endpoint

```text
GET /v1/extension-state?extension_version=<version>&distribution_channel=<github|cws|edge|android>
```

Kandidat v1.1.0 menggunakan endpoint ini untuk notice/status dan sponsor state. Jika endpoint gagal, client memakai last-good cache bila ada; bila tidak ada, client jatuh ke default state lokal. OCR/PDF tetap tidak bergantung pada campaign backend.

## Schema v1

Contoh ringkas:

```json
{
  "schema_version": 1,
  "generated_at": "2026-09-22T00:00:00Z",
  "ttl_seconds": 300,
  "status_badge": {
    "visible": false,
    "kind": "info",
    "text": ""
  },
  "sections": [],
  "ads": {
    "enabled": true,
    "active": true,
    "campaign_id": "campaign-sep-2026",
    "revision": 3,
    "sponsor_label": "Sponsor",
    "advertiser": "Contoh Partner",
    "headline": "Headline sponsor",
    "body": "Plain text creative.",
    "disclaimer": "Konten berbayar.",
    "image_url": "",
    "cta": {
      "label": "Lihat",
      "url": "https://example.com/offer"
    },
    "house": {
      "sponsor_label": "Sponsor",
      "headline": "Space iklan tersedia",
      "body": "",
      "cta": {
        "label": "Pasang iklan? Hubungi",
        "url": "https://t.me/bukabmp?direct"
      }
    },
    "starts_at": null,
    "ends_at": null,
    "placements": {
      "card": true,
      "interstitial": true
    },
    "interstitial": {
      "enabled": true,
      "trigger": "job_started",
      "delay_min_ms": 2000,
      "delay_max_ms": 5000
    }
  },
  "features": {
    "supporter_card": false,
    "community_banner": false
  }
}
```

Legacy `notice` / `community` input masih dapat diterjemahkan ke section aman untuk compatibility.

## Status badge

Known `kind`:
- `info`
- `success`
- `warning`
- `community`
- `supporter`

Badge generik ini bukan authority entitlement personal. Status akses dan BMP Supporter personal di popup berasal dari signed activation token, bukan dari generic Cloud Surface.

## Sections

Maksimal 8 section. Known `kind`:
- `info`
- `warning`
- `success`
- `community`
- `supporter`
- `sponsor`

Content dirender via DOM `textContent`, bukan `innerHTML`.

## Action registry

Known action:
- `OPEN_URL` — HTTPS URL tervalidasi;
- `OPEN_CHANNEL` — URL channel dari package config;
- `OPEN_GROUP` — URL group dari package config;
- `OPEN_ABOUT` — halaman lokal extension.

Unknown action ditolak. `OPEN_URL` menolak non-HTTPS scheme.

## Ads contract

v1.1.0 hanya mengaktifkan campaign bila:
- `enabled=true`;
- campaign ID valid;
- campaign berada di jadwal aktif;
- ada text creative (`headline` atau `body`);
- placement yang bersangkutan aktif.

`image_url` disanitasi sebagai HTTPS tetapi **tidak membuat campaign aktif sendiri** pada v1.1.0. Renderer image first-party/proxy belum menjadi bagian release ini sehingga image-only creative tidak boleh menghasilkan card kosong atau third-party tracking.

Interstitial:
- hanya dipicu setelah `START_JOB` sukses;
- trigger fixed `job_started`;
- delay backend dan client sama-sama dibatasi **2–5 detik**;
- fetch ads tidak boleh menahan OCR/job;
- bila campaign tidak tersedia, house inventory lokal/backend tetap dapat tampil.

## Cache / freshness

`ttl_seconds` dibatasi client ke 60–86400 detik untuk cache normal.

Selain cache normal:
- popup yang sedang terbuka meminta fresh state setiap 30 detik;
- setelah `START_JOB` sukses, client melakukan fresh request untuk creative interstitial;
- failure menggunakan last-good state bila tersedia, atau default/house state lokal.

## Ads event

```text
POST /v1/ad-event
```

Allowed event:
- `impression`
- `click`
- `dismiss`

Allowed placement:
- `card`
- `interstitial`

Payload hanya membawa campaign/revision, placement/event, distribution channel, dan extension version. Backend rate-limits endpoint dan hanya menghitung event yang cocok dengan campaign/revision/placement yang sedang aktif.

## Forbidden

Client tidak mengeksekusi:
- JavaScript dari server;
- arbitrary HTML;
- remote WASM;
- remote Worker URL;
- CSS/code injection;
- expression/template sebagai code;
- arbitrary command strings;
- downloaded functionality yang belum ada di package.

Unknown schema version menghasilkan safe default state.

Mental model:

```text
CLOUD CONTROLS APPROVED STATE AND PLAIN CONTENT.
STORE PACKAGE CONTROLS EXECUTABLE CODE AND ACTIONS.
```
