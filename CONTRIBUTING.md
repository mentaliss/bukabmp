# Contributing

Kontribusi repository ini dibatasi pada **Chrome extension BMP Terbuka**, build/release tooling extension, dan dokumentasi publik terkait extension.

## Diterima

- perbaikan OCR/PDF;
- UX/accessibility;
- reliability dan safe-stop;
- compatibility fix yang tetap menggunakan akses sah user;
- privacy/security hardening pada extension;
- test/build tooling extension;
- dokumentasi pengguna dan developer extension.

## Di luar scope repository

- implementation atau deployment activation service;
- infrastructure/server operations;
- website/landing page source.

Jangan membuka PR yang menambahkan:
- fingerprint spoofing/stealth;
- IP rotation untuk menghindari blokir;
- brute/blind retry;
- pemalsuan credential/cookie/token keamanan sumber;
- credential theft/sharing;
- penghapusan watermark;
- distribusi materi yang diambil.

## Pull request

1. Jelaskan masalah dan perubahan.
2. Jalankan `npm run validate`.
3. Jangan commit secret, token privat, private signing key, credential, atau materi berhak cipta.
4. Untuk perubahan kompatibilitas sumber, gunakan sampel sintetis bila memungkinkan.
