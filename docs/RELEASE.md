# Extension Release Process

Repository ini membangun **satu shared extension source** untuk beberapa jalur distribusi.

## Tujuan release

End-user release harus:
- self-contained;
- tidak memerlukan BAT/Python/Tesseract desktop;
- tidak menjalankan OCR JavaScript/WASM dari CDN saat runtime;
- membawa konfigurasi public activation API yang diperlukan client;
- mencatat provenance vendor yang dibundel.

## Local validation

Source:

```bash
npm run validate
```

## GitHub/manual build

Development:

```bash
npm run build
```

Production/manual:

```bash
BMP_API_BASE_URL="https://..." \
BMP_TELEGRAM_CHANNEL_URL="https://t.me/..." \
BMP_TELEGRAM_GROUP_URL="https://t.me/..." \
npm run build:release
```

Output tetap kompatibel dengan pipeline v1.0.5:

```text
dist/BMP-Terbuka-v<VERSION>/
```

## Store candidates

Chrome Web Store:

```bash
BMP_API_BASE_URL="https://community.bukabmp.workers.dev" \
BMP_TELEGRAM_CHANNEL_URL="https://t.me/bukabmp" \
BMP_TELEGRAM_GROUP_URL="https://t.me/..." \
npm run build:cws
npm run validate:cws
```

Output:

```text
dist/cws/BMP-Terbuka-v<VERSION>/
```

Microsoft Edge Add-ons:

```bash
BMP_API_BASE_URL="https://community.bukabmp.workers.dev" \
BMP_TELEGRAM_CHANNEL_URL="https://t.me/bukabmp" \
BMP_TELEGRAM_GROUP_URL="https://t.me/..." \
npm run build:edge
npm run validate:edge
```

Output:

```text
dist/edge/BMP-Terbuka-v<VERSION>/
```

Store builds:
- set channel to `cws` or `edge`;
- remove broad `tabs` permission from the packaged manifest;
- keep the shared runtime source unchanged;
- bundle OCR/PDF dependencies locally;
- verify every fetched vendor against known-good SHA-256;
- pin Indonesian tessdata to an immutable upstream commit and digest.

For Store upload, zip the **contents** of that directory so `manifest.json` is at ZIP root:

```bash
VERSION=$(node -p "require('./extension/manifest.json').version")
(
  cd "dist/cws/BMP-Terbuka-v${VERSION}"
  zip -qr "../../BMP-Terbuka-v${VERSION}-CWS.zip" .
)
```

The `Store and Compatibility Candidate` GitHub Actions workflow automatically validates source, builds and validates `github`, `android`, `cws`, and `edge` profiles, creates flat-root CWS/Edge ZIPs, generates checksums, and uploads both Store artifacts.

## GitHub release

Existing GitHub release behavior remains:
1. update changelog/version when a real release is approved;
2. tag `v<VERSION>`;
3. `release.yml` validates source;
4. builds the self-contained manual package;
5. creates ZIP/checksum and GitHub Release.

Store candidate work must not change the Android signing key or require CWS/Edge Store IDs to match the existing Android CRX ID. The public repository does not contain the private Android signing pipeline/key, so CI proves source/package compatibility only; signed-CRX regression remains an external controlled step.

## 1.1.0 release gates

Sebelum 1.1.0 dinyatakan siap:
- token lama dari versi sebelum 1.1.0 tetap dapat dipakai sampai kedaluwarsa;
- token legacy dapat melakukan one-time re-verification tanpa menghapus token aktif sebelum token baru terverifikasi;
- refresh token 1.1.0 tidak memperpanjang masa aktivasi tanpa entitlement server;
- bonus Supporter yang sudah tercatat dapat diterapkan melalui refresh;
- update in-place 1.0.5 → 1.1.0 mempertahankan token, IndexedDB PDF cache, draft, dan state;
- Edge Stable Android menjalani regression activation → OCR → PDF → download → resume → refresh activation;
- Edge Canary hanya fallback/testing;
- store listing 1.1.0 harus sudah tersedia sebelum minimum-version policy memaksa user update.

## Manual smoke test

Before distribution:
- activation succeeds;
- activation refresh succeeds without extending entitlement by itself;
- legacy token one-time re-verification succeeds;
- M1 produces searchable PDF;
- OCR progress advances;
- page-count termination works;
- resume skips completed OCR;
- redownload selected range works;
- cache export works without OCR repeat;
- optional FULL/range merge works only with complete ranges;
- BMP-scoped cache clear works;
- 403/429/login/Request Rejected causes safe stop;
- Worker outage fails safely;
- runtime OCR does not load executable code from CDN.

CWS and Edge additionally require clean-install testing and reviewer activation instructions. Automated CI does not substitute for a real authenticated RBV/browser regression.
