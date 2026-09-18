# Extension Architecture

Dokumen ini hanya menjelaskan architecture **client extension yang open-source**.

```text
Chrome
  │
  ├── authenticated reader tab
  │     └── content.js
  │           └── membaca konteks halaman dan mengambil resource yang dapat diakses user
  │
  ├── background.js
  │     ├── job/state orchestration
  │     ├── safe-stop handling
  │     └── activation API client
  │
  ├── offscreen document
  │     ├── Tesseract.js/WASM (bundled in release)
  │     ├── Indonesian traineddata (bundled in release)
  │     └── pdf-lib (bundled in release)
  │
  └── Chrome Downloads
        └── searchable PDF
```

## Trust boundaries

### Source credentials
Credential/session sumber tetap dikelola browser dan situs sumber. Extension tidak meminta pengguna menyalin password, cookie, HAR, atau session token ke BMP Terbuka.

### Document contents
Halaman, OCR, dan PDF diproses lokal oleh extension/offscreen document. Activation API tidak digunakan untuk mengunggah document contents.

### Community activation
Extension membuat pairing melalui API eksternal, menerima signed activation token, lalu memverifikasi signature token secara lokal menggunakan public key yang terdapat di client.

Implementation, hosting, deployment, dan secret management activation service berada di luar scope repository ini.

## Failure behavior

Saat sumber mengembalikan kondisi seperti 403, 429, login response, Request Rejected, atau network error yang tidak aman untuk dilanjutkan, extension berhenti. Tidak ada blind retry/request storm.
