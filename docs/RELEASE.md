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

## Chrome Web Store candidate

Build:

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

The CWS build:
- sets `DISTRIBUTION_CHANNEL="cws"`;
- removes broad `tabs` permission from the packaged manifest;
- keeps the shared runtime source unchanged;
- bundles OCR/PDF dependencies locally;
- pins Indonesian tessdata to an immutable upstream commit.

For Store upload, zip the **contents** of that directory so `manifest.json` is at ZIP root:

```bash
VERSION=$(node -p "require('./extension/manifest.json').version")
(
  cd "dist/cws/BMP-Terbuka-v${VERSION}"
  zip -qr "../../BMP-Terbuka-v${VERSION}-CWS.zip" .
)
```

The `CWS Candidate` GitHub Actions workflow performs this build, validation, flat-root ZIP packaging, checksum generation, and artifact upload automatically on the `cws-candidate` branch.

## GitHub release

Existing GitHub release behavior remains:
1. update changelog/version when a real release is approved;
2. tag `v<VERSION>`;
3. `release.yml` validates source;
4. builds the self-contained manual package;
5. creates ZIP/checksum and GitHub Release.

CWS candidate work must not change the Android signing key or require the CWS extension ID to match the existing Android CRX ID.

## Manual smoke test

Before distribution:
- activation succeeds;
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

CWS additionally requires clean-install testing and reviewer activation instructions.
