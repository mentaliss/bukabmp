# Backend / Store Contract — v1.1.0

Kontrak ini menjelaskan interface antara package extension dan Cloudflare Worker pada kandidat v1.1.0. Source Worker berada di `worker/`; secret dan authority produksi tetap server-side.

## Distribution channels

Known channel:

```text
github
android
cws
edge
```

Policy version dan realtime state dipisahkan per channel. Store channel tidak boleh memaksa minimum version baru sebelum `store_ready=true`.

## Version endpoint

```text
GET /v1/version?extension_version=<version>&distribution_channel=<channel>
```

Response mencakup latest/minimum version, force-after, release URL, message, dan `store_ready`.

Client Store mengabaikan remote minimum-version enforcement saat `store_ready=false`.

## Pairing

```text
POST /v1/pair/start
GET  /v1/pair/status
```

Payload start v1.1.0:

```json
{
  "install_id": "<random UUID>",
  "extension_version": "1.1.0",
  "distribution_channel": "edge",
  "current_token": "<optional current signed token during re-verification>"
}
```

`current_token` hanya dipakai untuk one-time legacy→v2 migration. Backend:
- memverifikasi RS256 issuer/audience/expiry;
- memastikan token berasal dari install yang sama;
- mengambil expiry floor + member_ref dari token valid;
- saat Telegram user baru selesai diverifikasi, expiry floor hanya diterapkan bila member_ref cocok dengan user yang sama;
- invalid/expired/foreign token tidak memberi floor.

Client juga memverifikasi replacement token dan menolak swap bila token baru memperpendek token aktif.

Pair record TTL: **15 menit**.

## Token v2 refresh

```text
POST /v1/token/refresh
Authorization: Bearer <signed-token-v2>
```

Backend memeriksa:
- minimum extension version 1.1.0;
- token signature/issuer/audience/scope;
- `token_version >= 2`;
- `sub=tg:<id>`;
- installation ID;
- membership channel + group;
- current Supporter entitlement.

Refresh tidak boleh memperpendek expiry. Bonus entitlement yang tercatat dapat diterapkan lalu pending bonus di-clear sesuai authority backend.

## Realtime state / ads

```text
GET /v1/extension-state
POST /v1/ad-event
```

Detail schema berada di `docs/CLOUD_SURFACE.md`.

Ads v1.1.0:
- text creative only;
- HTTPS CTA;
- card/interstitial placement;
- interstitial fixed trigger `job_started`;
- delay clamped 2–5 detik;
- house fallback;
- event metrics tanpa user/document identifier.

Ad events di-rate-limit dan divalidasi terhadap campaign/revision/placement yang sedang aktif.

## Reviewer activation

Reviewer memakai signed token authority yang sama, bukan hard-coded client bypass:
1. client membuat pair;
2. reviewer membuka `/review`;
3. secret reviewer tetap private di provider/Store certification notes;
4. backend mengeluarkan installation-bound RS256 token dengan scope `store_review`;
5. client menampilkan local OCR fixture.

Reviewer token maksimum 24 jam.

## Security invariants

Backend extension tidak memerlukan atau menerima:
- password portal sumber;
- NIM;
- cookie/session portal;
- gambar halaman BMP;
- OCR text;
- generated PDF.

Private signing key, bot token, reviewer secret, admin token, dan provider credentials tidak boleh masuk package extension atau repository.

## Publication gates

Sebelum publikasi Store:
- live Worker harus menjalankan backend commit yang telah diaudit;
- channel target tetap `store_ready=false` selama draft/review;
- privacy/listing harus mendeklarasikan realtime sponsor + coarse metrics;
- clean-install reviewer flow harus lulus;
- same-listing update dari live 1.0.5 ke 1.1.0 harus membuktikan token/storage/cache bertahan;
- authenticated real-device RBV smoke regression harus lulus;
- minimum-version baru hanya dinaikkan setelah package 1.1.0 benar-benar tersedia di channel tersebut.
