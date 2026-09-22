# Extension Architecture

Dokumen ini menjelaskan architecture **client extension BMP Terbuka** dan batas antara code yang direview store dengan service eksternal.

```text
Chrome / Chromium
  │
  ├── authenticated reader tab
  │     └── content.js
  │           └── membaca konteks halaman dan resource yang sudah dapat diakses user
  │
  ├── background.js
  │     ├── job/state orchestration
  │     ├── safe-stop handling
  │     ├── activation API client
  │     └── distribution-aware version policy
  │
  ├── offscreen document
  │     ├── Tesseract.js/WASM (bundled)
  │     ├── Indonesian traineddata (bundled)
  │     ├── pdf-lib (bundled)
  │     └── IndexedDB PDF cache
  │
  ├── Chrome Downloads
  │     └── exported searchable PDF
  │
  └── Cloudflare Worker
        ├── activation/version data + token-v2 refresh
        ├── Telegram bot / Supporter / referral state
        ├── approved realtime cloud state
        └── validated coarse sponsor metrics
```

## Shared source, separate distribution profiles

Satu source client digunakan untuk beberapa jalur distribusi:
- `github`: manual desktop release;
- `cws`: Chrome Web Store package;
- `edge`: Microsoft Edge Add-ons package;
- `android`: existing signed CRX path.

CWS build dihasilkan dari source yang sama, tetapi menggunakan package profile sendiri. Build CWS menghapus broad `tabs` permission sementara build GitHub/Android mempertahankan baseline v1.0.5 sampai regression test membuktikan perubahan shared aman.

## Trust boundaries

### Source credentials
Credential/session sumber tetap dikelola browser dan situs sumber. Extension tidak meminta pengguna menyalin password, cookie, HAR, atau session token ke BMP Terbuka.

### Document contents
Halaman, OCR, dan PDF diproses lokal oleh extension/offscreen document. Activation API tidak digunakan untuk mengunggah document contents.

### Community activation
Extension membuat pairing melalui API eksternal, menerima signed activation token, lalu memverifikasi signature token secara lokal menggunakan public key yang terdapat di client.

Source Cloudflare Worker untuk activation/version/bot/Supporter/realtime state berada di `worker/` pada repository ini agar dapat diaudit bersama client. Secret produksi, private signing key, reviewer secret, provider account, dan nilai konfigurasi rahasia tetap berada di environment/deployment provider.

### Executable code
Semua JavaScript/WASM/model OCR yang diperlukan runtime harus berada di package extension. Dependency boleh diambil saat build, tetapi package end-user tidak boleh bergantung pada JavaScript/WASM executable yang di-host remote.

## Cloud Surface boundary

Mental model:

```text
CLOUD CONTROLS STATE AND CONTENT.
STORE PACKAGE CONTROLS EXECUTABLE CODE.
```

Cloud Surface hanya boleh mengontrol value yang lolos schema allowlist, misalnya boolean, teks, label, tanggal, HTTPS URL, dan feature flags untuk code path yang sudah dikirim di package. Remote JavaScript, arbitrary HTML execution, remote WASM, command strings yang diinterpretasikan sebagai code, dan downloaded functionality dilarang.

Schema kandidat didokumentasikan di `docs/CLOUD_SURFACE.md`.

Sponsor v1.1.0 memakai renderer yang sudah dibundel di popup. Backend hanya memilih plain creative/state yang lolos sanitizer. Event sponsor yang dikirim client bersifat coarse dan tidak membawa Telegram ID, installation ID, token aktivasi, kode BMP, atau isi dokumen.

## Update model

Build `cws` mengirim distribution channel ke version API. Remote minimum-version policy tidak boleh memblokir build CWS sampai backend memberi `store_ready=true` untuk versi yang benar-benar tersedia melalui Store. Package update CWS tetap dikelola Chrome Web Store/browser.

Build `github` dan `android` mempertahankan jalur manual yang sudah ada; `edge` memakai policy Store independen seperti `cws`.

## Failure behavior

Saat sumber mengembalikan kondisi seperti 403, 429, login response, Request Rejected, atau network error yang tidak aman untuk dilanjutkan, extension berhenti. Tidak ada blind retry/request storm.
