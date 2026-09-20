# Backend Store Contract

Dokumen ini adalah kontrak minimum untuk private activation/control backend agar client Store tidak perlu didesain ulang lagi.

## Distribution channels

Backend harus memperlakukan nilai berikut sebagai channel terpisah:

```text
github
android
cws
edge
```

Unknown channel harus diperlakukan konservatif dan tidak boleh menaikkan minimum version untuk channel Store lain.

## Version endpoint

Existing endpoint:

```text
GET /v1/version?extension_version=<version>&distribution_channel=<channel>
```

Response candidate:

```json
{
  "latest_version": "1.0.5",
  "minimum_version": "1.0.5",
  "force_after": null,
  "release_url": "",
  "message": "",
  "store_ready": false
}
```

Rules:
- `cws` dan `edge` wajib channel-specific.
- Selama versi baru masih draft/in review, `store_ready=false`.
- Hanya setelah versi benar-benar tersedia di Store, backend boleh mengembalikan `store_ready=true` dan menaikkan minimum version channel tersebut.
- `github` / `android` tidak boleh ikut terkunci karena status CWS/Edge.

Client sudah fail-open untuk Store minimum-version enforcement sampai `store_ready=true`.

## Pairing endpoint

Client sekarang mengirim:

```json
{
  "install_id": "<random UUID>",
  "extension_version": "1.0.5",
  "distribution_channel": "cws"
}
```

Backend lama yang mengabaikan field tambahan tetap kompatibel.

## Reviewer activation

Reviewer Store harus memakai **normal signed-token authority**, bukan hard-coded client bypass.

Recommended backend model:
1. client membuat pair seperti biasa;
2. untuk submission/reviewer, backend menyediakan temporary revocable verification path;
3. reviewer secret/credential hanya ditaruh di private CWS/Edge test instructions;
4. verification menghasilkan token RS256 normal yang tetap terikat ke `install_id`, issuer, audience, dan expiry;
5. reviewer credential dapat dicabut setelah review tanpa release extension.

Public repository tidak boleh berisi reviewer secret.

Existing client menerima `deep_link` dari pair response dan membukanya. Backend boleh memakai HTTPS verification page untuk reviewer selama flow akhirnya mengeluarkan token normal melalui pair status.

## Realtime Cloud Surface

Implement:

```text
GET /v1/extension-state?extension_version=<version>&distribution_channel=<channel>
```

Response harus mengikuti `docs/CLOUD_SURFACE.md`.

No JavaScript, HTML executable, WASM, worker URL, command language, atau downloaded functionality.

## Retention/privacy evidence required before Store publication

Sebelum privacy policy dinyatakan final, private backend perlu memiliki jawaban berbasis implementasi untuk:
- storage yang dipakai untuk pair record;
- field pair yang disimpan;
- TTL pair/poll secret;
- apakah Telegram user ID/username disimpan;
- membership lookup/cache dan TTL;
- activation/supporter record dan TTL;
- request/IP/provider logs yang berada di kontrol operator;
- deletion/expiry behavior;
- backup/replication retention bila ada;
- pihak ketiga yang menerima data;
- apakah ada analytics/telemetry.

Jangan mengisi angka retention berdasarkan tebakan. Ambil langsung dari Worker/KV/D1/R2/config/logging yang live.

## Security invariants

Backend tidak pernah memerlukan:
- password portal sumber;
- NIM;
- cookie/session portal;
- gambar halaman BMP;
- OCR text;
- generated PDF.

Private signing key, Telegram bot token, reviewer secret, dan backend secrets tidak boleh masuk public extension/repository.
