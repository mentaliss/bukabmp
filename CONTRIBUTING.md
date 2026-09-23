# Contributing

Kontribusi repository publik BMP Terbuka mencakup **browser extension**, public website, build/release tooling, dan dokumentasi publik.

## Diterima

- perbaikan OCR/PDF;
- UX/accessibility extension atau website;
- reliability dan safe-stop;
- compatibility fix yang tetap menggunakan akses sah user;
- privacy/security hardening pada extension atau public website;
- test/build tooling;
- dokumentasi pengguna/developer;
- perbaikan bilingual content, broken link, atau accessibility website.

## Di luar scope repository publik

- implementation/deployment production Worker;
- Telegram bot/backend implementation;
- Control Center;
- D1 migrations/private operational schema;
- private infrastructure/server operations;
- production secrets atau private signing material.

Jangan membuka PR yang menambahkan:
- fingerprint spoofing/stealth;
- IP rotation untuk menghindari blokir;
- brute/blind retry;
- pemalsuan credential/cookie/token keamanan sumber;
- credential theft/sharing;
- penghapusan watermark;
- distribusi materi yang diambil;
- private backend code atau secret ke repository publik.

## Pull request

1. Jelaskan masalah dan perubahan.
2. Jalankan `npm run validate`.
3. Untuk perubahan website, jalankan `npm run build:site` dan `npm run validate:site`.
4. Jangan commit secret, token privat, private signing key, credential, atau materi berhak cipta.
5. Untuk perubahan kompatibilitas sumber, gunakan sampel sintetis bila memungkinkan.
