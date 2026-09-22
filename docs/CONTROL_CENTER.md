# BMP Terbuka Control Center — v0.1

Control Center adalah private operator console untuk mengubah surface realtime BMP Terbuka tanpa merilis ulang extension.

## URL

Setelah Worker yang memuat fitur ini aktif:

```text
https://<worker-domain>/control
```

UI hanya tersedia bila `ADMIN_SETUP_TOKEN` dikonfigurasi. API Control Center tetap menolak request tanpa Bearer token yang benar.

## Security model

v0.1 memakai dua lapis yang direkomendasikan:

1. **Cloudflare Access** di depan route `/control*` sebagai outer gate.
2. **ADMIN_SETUP_TOKEN** sebagai application-level owner authority.

Token admin:
- tidak ditanam di HTML/JavaScript;
- dimasukkan manual oleh owner;
- hanya disimpan di memory tab;
- tidak ditulis ke localStorage/sessionStorage/cookie;
- dikirim hanya lewat HTTPS Authorization header.

Cloudflare Access sangat direkomendasikan sebelum URL Control Center dipakai rutin. Jangan menaruh token admin di query string, bookmark, screenshot, atau source repository.

## Scope v0.1

### Overview
- pilih distribution channel: GitHub/manual, Android, CWS, Edge;
- lihat Worker version;
- lihat version policy read-only;
- preview status badge dan sponsor card;
- refresh live state;
- publish state.

### Extension Surface
- status badge realtime;
- feature toggles yang sudah didukung client;
- sections JSON yang tetap melewati server-side sanitizer.

Remote state tidak dapat mengirim arbitrary HTML/JavaScript/WASM ke extension.

### Ads Manager
- paid campaign enable/disable;
- campaign ID + revision;
- sponsor label / advertiser / headline / body / disclaimer;
- HTTPS CTA;
- start/end schedule;
- card/interstitial placement;
- interstitial delay 2–5 detik;
- house inventory + contact CTA;
- emergency pause paid ads.

Emergency pause hanya mematikan paid campaign. House inventory tetap tersedia.

### History / Rollback

Setiap publish dari Control Center:
1. membaca current live channel state;
2. menyimpan snapshot current state;
3. baru menulis state baru.

Per channel disimpan maksimum **20 metadata history entries**. Snapshot body diberi TTL **90 hari**.

Rollback:
1. snapshot current state terlebih dahulu;
2. restore snapshot yang dipilih;
3. menjalankan sanitizer lagi sebelum publish.

History Control Center hanya mencatat mutation yang dilakukan lewat Control Center. Mutation langsung lewat endpoint admin lama tidak otomatis masuk history.

## API

Semua endpoint di bawah ini membutuhkan:

```http
Authorization: Bearer <ADMIN_SETUP_TOKEN>
```

### Session

```text
GET /control/api/session
```

### Read/publish state

```text
GET  /control/api/state?distribution_channel=edge
POST /control/api/state?distribution_channel=edge
```

Publish body:

```json
{
  "reason": "campaign_publish",
  "state": {
    "schema_version": 1
  }
}
```

State selalu melewati sanitizer backend sebelum disimpan.

### Validate without write

```text
POST /control/api/validate?distribution_channel=edge
```

Body adalah candidate extension-state. Response berisi hasil sanitized tanpa mengubah live state.

### Emergency pause paid ads

```text
POST /control/api/pause-ads
```

```json
{
  "distribution_channel": "edge"
}
```

### Rollback

```text
POST /control/api/rollback
```

```json
{
  "distribution_channel": "edge",
  "history_id": "<snapshot-id>"
}
```

## Current boundary

v0.1 fokus pada **extension surface + realtime ads**, karena dua area tersebut memang sudah memiliki runtime contract yang aman untuk mutation.

Bot/AI/payment/version-policy mutation belum dipindahkan ke GUI pada v0.1. Area tersebut tetap mengikuti authority dan safety gate masing-masing sampai control contract khususnya dibangun dan diuji. Version policy ditampilkan read-only agar Control Center tidak bisa secara tidak sengaja memaksa versi Store yang belum tersedia.

## Release safety

Control Center tidak mengubah:
- extension signing identity;
- activation signing key;
- user activation token secara langsung;
- OCR/cache/PDF data;
- Store publication;
- minimum version policy;
- Telegram payment/supporter ledger.

Setiap penambahan write authority baru ke Control Center harus punya endpoint sempit, sanitizer/validation, regression test, dan rollback/stop path sendiri.
