# Bundled OCR runtime

Folder ini diisi **saat build release**, bukan saat end-user menjalankan extension.

`tools/build-release.mjs` mengambil versi yang dipin:
- Tesseract.js 6.0.1
- tesseract.js-core 6.0.0
- pdf-lib 1.17.1
- Indonesian tessdata 4.0.0_fast

Release ZIP memuat semuanya secara lokal. Tidak ada runtime JavaScript CDN.
