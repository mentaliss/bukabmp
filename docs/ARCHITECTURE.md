# Public Architecture

Repository ini menjelaskan komponen **publik** BMP Terbuka tanpa membuka implementation backend private.

## Public surface

- browser extension Manifest V3;
- local OCR/PDF runtime yang dibundel pada release;
- public build/validation tooling;
- public website source;
- public documentation/release metadata.

## Private production surface

Tidak dipublikasikan di repository ini:
- production Cloudflare Worker implementation;
- Telegram bot/backend implementation;
- Control Center;
- D1 migrations/private operational schema;
- deployment secrets;
- private signing material.

## Extension flow

1. User login ke reader melalui mekanisme normal sumber.
2. Extension menggunakan sesi browser yang sudah terautentikasi.
3. Halaman yang tersedia pada sesi user diproses lokal.
4. Offscreen document menjalankan Tesseract.js/WASM + Indonesian traineddata + pdf-lib yang dibundel.
5. PDF disimpan di cache lokal dan dapat diekspor melalui browser Downloads.

## Network boundary

Extension memakai public backend endpoints untuk activation, version/realtime state, pseudonymous telemetry, dan sponsor state/metrics.

Document pages, OCR text, dan generated PDF tidak dikirim ke backend BMP Terbuka sebagai bagian dari OCR/PDF workflow.

Remote state melewati client allowlist dan tidak dapat mengirim arbitrary executable JavaScript/WASM baru ke extension.

## Failure behavior

Saat sumber mengembalikan 403, 429, login/re-authentication response, Request Rejected, atau kondisi jaringan yang tidak aman untuk dilanjutkan, extension berhenti. Tidak ada blind retry/request storm.
