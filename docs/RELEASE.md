# Extension Release Process

Repository ini hanya membangun dan mempublikasikan **Chrome extension**.

## Tujuan release

End-user release harus:
- self-contained;
- tidak memerlukan BAT/Python/Tesseract desktop;
- tidak menjalankan OCR JavaScript dari CDN saat runtime;
- membawa konfigurasi public activation API yang diperlukan client;
- berisi SHA-256 checksum.

## Local validation

```bash
npm run validate
```

## Local build

Development build:

```bash
npm run build
```

Production build:

```bash
BMP_API_BASE_URL="https://..." \
BMP_TELEGRAM_CHANNEL_URL="https://t.me/..." \
BMP_TELEGRAM_GROUP_URL="https://t.me/..." \
npm run build:release
```

Output mengikuti version pada `extension/manifest.json`:

```text
dist/BMP-Terbuka-v<VERSION>/
```

Builder mengambil dependency OCR hanya saat build lalu membundelkannya ke release.

## GitHub release

1. Update `CHANGELOG.md`.
2. Update version pada `extension/manifest.json` dan `package.json` bila diperlukan.
3. Commit perubahan.
4. Buat dan push tag `v<VERSION>`.
5. Workflow `release.yml` memvalidasi source, membangun extension self-contained, membuat ZIP/checksum, memeriksa ZIP, lalu membuat GitHub Release.

## Manual smoke test

Sebelum distribusi luas, verifikasi minimal:
- activation komunitas sukses;
- M1 menghasilkan searchable PDF;
- OCR progress berpindah halaman;
- PDF per modul dan FULL PDF valid;
- 403/429/login/Request Rejected memicu safe stop;
- watermark sumber tetap terlihat;
- runtime OCR tidak mengambil JavaScript dari CDN.
