# BMP Terbuka Control Center — v0.2

Control Center adalah private owner console untuk **compact analytics, direct sponsor media, extension surface, global version policy, dan rollback**. Source v0.2 ini masih pre-release; branch ini tidak melakukan deployment production atau Store publication.

## Access

Setelah Worker yang memuat v0.2 benar-benar dideploy oleh Owner:

```text
https://<worker-domain>/control
```

Security model tetap:
1. Cloudflare Access direkomendasikan sebagai outer gate untuk `/control*`.
2. `ADMIN_SETUP_TOKEN` adalah application-level owner authority.
3. Token tidak ditanam di HTML/JavaScript dan hanya disimpan di memory tab.

Semua mutation API Control Center wajib menggunakan:

```http
Authorization: Bearer <ADMIN_SETUP_TOKEN>
```

## Navigation

Sidebar v0.2:
- Overview
- Analytics
- Ads
- Extension
- Version
- History

Default screen sengaja menyembunyikan engineer-facing fields. Campaign ID, revision, dan raw state berada di Advanced.

## Overview + Analytics

Period:
- 24H
- 7D
- 30D

Overview menampilkan:
- Telegram Channel Subscribers
- Group Terbuka Members
- Total Users
- Active Users
- Opens
- Jobs
- Returning
- Health
- paid-direct Ad Reach
- paid-direct Impressions
- CTR

Subscribers dan Members **tidak dijumlahkan sebagai unique community users** karena overlap tidak diketahui.

Extension analytics menggunakan pseudonymous installation identity `bmpAnalyticsIdV1`. Worker mengubah raw incoming ID menjadi HMAC-SHA-256 menggunakan `TELEMETRY_HASH_KEY` sebelum storage. Raw analytics ID tidak dipakai sebagai D1 actor key.

Telemetry hanya product usage. Tidak boleh membawa Telegram identity, activation/pairing data, `bmpInstallId`, BMP/module/RBV/PDF/OCR/document content, atau browsing history.

D1 migration:
```text
worker/migrations/0003_media_analytics.sql
```

Logical retention:
- daily pseudonymous activity: ~180 days;
- aggregate daily metrics: ~13 months.

## Telegram community counts

`GET /control/api/community` menggunakan Telegram Bot API `getChatMemberCount` untuk:
- `CHANNEL_ID`
- `SUPPORT_GROUP_ID` (fallback `GROUP_ID`)

Result dicache sekitar 10 menit dan satu aggregate snapshot harian disimpan bila D1 tersedia. Tidak ada member-list retrieval.

## Ads Manager

Priority:
- Card: Direct BMP Sponsor → AdsOnBread → House Ad
- Interstitial: Direct BMP Sponsor → House Ad

AdsOnBread tidak dipakai sebagai interstitial.

Direct creative v2 tetap additive terhadap `schema_version=1`: text fields lama wajib tetap usable sebagai fallback.

Media:
- Card banner: JPEG/PNG/WebP, max 3 MiB, ideal 16:9.
- Interstitial image: JPEG/PNG/WebP, max 3 MiB, ideal 1:1.
- Interstitial video: MP4/WebM, max 10 MiB, max 15 detik.
- SVG/GIF tidak diterima.
- Rendering memakai `object-fit: contain`.
- Video autoplay muted + playsinline + no infinite loop.

Advertiser-controlled media URL tidak diteruskan ke extension. Upload owner:
1. browser Control Center memeriksa metadata;
2. `POST /control/api/media`;
3. Worker memvalidasi MIME + file magic + size/duration;
4. content masuk ke BMP-owned `AD_MEDIA` R2 dengan immutable hash ID;
5. extension mengambil `GET /v1/media/:id`.

Video delivery mendukung single byte Range. Response memasang correct MIME, immutable cache, dan `X-Content-Type-Options: nosniff`.

Interstitial timing adalah invariant:
```text
Random 2–5 seconds
LOCKED
```
Tidak ada editable delay control di UI. Job/OCR tidak bergantung pada media, telemetry, R2, atau ad-network availability.

### Demo creative

Control Center menyediakan **Load Demo Creative** untuk neutral fixture:
- DEMO SPONSOR
- BMP Terbuka
- Materi iklan contoh

Repository source fixtures berada di `demo/ads/` dan tidak dimasukkan ke package extension production.

## ALL target

`distribution_channel=all` bukan channel baru. Itu berarti intended state identik untuk:
- github
- android
- cws
- edge

Backend melakukan:
1. validate seluruh candidate;
2. snapshot seluruh current state;
3. write seluruh channel;
4. verify seluruh channel;
5. bila ada kegagalan, rollback channel yang sudah berubah.

Individual target tetap tersedia untuk canary, Store-specific emergency, dan staged rollout.

## Extension surface

Default UI hanya:
- Target (ALL default)
- status badge ON/OFF
- type
- text
- Preview
- Publish

Raw cloud-state editor tetap di Advanced dan semua state tetap melewati server-side sanitizer.

## Global version policy

`GET/POST /control/api/version-policy` menyimpan runtime override di KV. Env policy lama tetap fallback jika override belum ada.

Policy:
- `latest_version`
- `minimum_global`
- readiness github/android/cws/edge
- release URL/message

Minimum global hanya enforced pada channel yang **Ready**. Store channel yang belum Ready mendapat no minimum enforcement dari global override, sehingga user Store tidak dikunci ke versi yang belum tersedia di Store tersebut.

Control Center tidak otomatis menandai CWS/Edge Ready hanya karena source GitHub tersedia.

## API v0.2

Public:
```text
GET  /v1/extension-state
GET  /v1/version
GET  /v1/media/:id
POST /v1/telemetry
```

Owner Control Center:
```text
GET    /control/api/session
GET    /control/api/state
POST   /control/api/state
POST   /control/api/validate
GET    /control/api/analytics
GET    /control/api/community
POST   /control/api/media
DELETE /control/api/media/:id
GET    /control/api/version-policy
POST   /control/api/version-policy
POST   /control/api/pause-ads
POST   /control/api/rollback
```

## Required bindings/secrets before deployment

Existing bindings remain unchanged. v0.2 additionally requires:

```text
R2 binding: AD_MEDIA
D1 migration: 0003_media_analytics.sql
Secret: TELEMETRY_HASH_KEY
```

`TELEMETRY_HASH_KEY` must be an independent server-side secret. Do not reuse activation signing material or Telegram credentials.

## Release safety

Source implementation does **not**:
- publish extension v1.1.0;
- submit/update CWS or Edge;
- deploy Worker production;
- create/mutate production R2/D1 merely for testing;
- force minimum version 1.1.0;
- mark Store readiness automatically;
- change activation signing identity;
- change extension signing identity / Android extension ID;
- mutate activation, payment, or Supporter authority.

Production deployment, D1 migration application, R2 creation/binding, Store readiness, live AdsOnBread SDK approval, and minimum-version activation remain explicit Owner actions.
