# Bundled OCR runtime

Folder ini diisi **saat build release**, bukan saat end-user menjalankan extension.

`tools/build-release.mjs` mengambil versi yang dipin:
- Tesseract.js 6.0.1
- tesseract.js-core 6.0.0
- pdf-lib 1.17.1
- Indonesian tessdata 4.0.0_fast

Release ZIP memuat semuanya secara lokal. Tidak ada runtime JavaScript CDN.

Saat build, generic CDN fallback dan legacy `Function(...)` fallback yang masih ada di browser distribution Tesseract upstream dipatch keluar dari **output package**. Source upstream tetap dipin dengan SHA-256 sebelum patch; `VENDOR_MANIFEST.json` lalu merekam hash file final yang benar-benar dikirim ke pengguna. Ini menjaga artifact Manifest V3 self-contained dan mencegah dead remote-code path ikut masuk Store package.
