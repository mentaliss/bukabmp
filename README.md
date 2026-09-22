<p align="center">
  <img src="extension/icons/icon128.png" width="170" alt="BMP Terbuka">
</p>

<h1 align="center">BMP Terbuka</h1>

<p align="center"><strong>Materi yang dapat kamu akses, lebih nyaman untuk kamu pelajari.</strong></p>

BMP Terbuka adalah extension Chrome komunitas yang membantu pengguna mengubah materi BMP yang **sudah dapat mereka akses dengan akun mereka sendiri** menjadi **searchable PDF** untuk belajar pribadi/offline.

## Scope open-source repository

Repository ini mempublikasikan **source Chrome extension BMP Terbuka**, build tooling, dan dokumentasi publik yang diperlukan untuk membangun serta meninjau extension.

Yang termasuk source terbuka di repo ini:
- `extension/` — source extension Manifest V3;
- `worker/` — source Cloudflare Worker untuk aktivasi, version policy, Telegram bot, Supporter, dan realtime extension state/ads;
- `tools/` — validator dan release builder extension;
- dokumentasi penggunaan, kontribusi, privasi, keamanan, dan responsible use.

Yang **tidak** dipublikasikan di repository:
- secret produksi, private signing key, Telegram bot token, reviewer secret, atau credential operator;
- nilai konfigurasi operasional yang bersifat rahasia;
- private signing pipeline/key untuk jalur Android CRX;
- dashboard/account provider dan konfigurasi deployment di luar source yang memang ada di repo.

Public endpoint, protocol values, public verification key, dan source Worker yang diperlukan untuk audit dapat terlihat di repository. Secret dan authority produksi tetap berada di environment/provider, bukan di package extension.

## Karakteristik utama

- OCR dan penyusunan PDF dilakukan **lokal di perangkat**.
- Release resmi membawa Tesseract.js/WASM, model bahasa Indonesia, dan pdf-lib secara lokal.
- Extension **tidak meminta atau menyimpan** password, NIM, atau cookie sumber.
- Watermark sumber **tidak dihapus atau dimodifikasi**.
- Saat sumber menolak akses (`403`, `429`, login ulang, `Request Rejected`), proses berhenti tanpa blind retry.
- Aktivasi komunitas menggunakan **Buka BMP** dan **Group Terbuka**.
- Mendukung desktop Chromium dan jalur Android utama melalui **Microsoft Edge Stable + Microsoft Edge Add-ons**. Edge Canary tetap menjadi fallback/testing.

## Instalasi

Gunakan paket dari **GitHub Releases**, bukan Source code ZIP.

### Desktop — Chrome / Edge

1. Download asset `BMP-Terbuka-v<VERSION>.zip` dari Releases.
2. Extract ZIP.
3. Buka `chrome://extensions` atau `edge://extensions`.
4. Aktifkan **Developer mode**.
5. Klik **Load unpacked** dan pilih folder hasil extract yang berisi `manifest.json`.
6. Buka popup BMP Terbuka dan selesaikan aktivasi Telegram.

### Android — Microsoft Edge Stable

1. Install/update **Microsoft Edge** dari Google Play.
2. Buka listing BMP Terbuka di **Microsoft Edge Add-ons** melalui Edge.
3. Tekan **Dapatkan** dan konfirmasi pemasangan.
4. Buka popup BMP Terbuka dan selesaikan aktivasi Telegram.
5. Login ke portal reader dengan akun Anda sendiri, isi kode BMP + modul, lalu tekan **Mulai**.

Pada sebagian listing Google Play, Edge Stable dapat tampil sebagai **Microsoft Edge: Ekstensi / Microsoft Edge: Extensions**. Edge Canary dipertahankan sebagai fallback/testing, bukan jalur utama user umum.

Desktop Chromium non-Edge sementara menggunakan paket GitHub/manual. Chrome Android bukan target instalasi resmi.

Panduan Android yang lebih detail, screenshot, dan troubleshooting dipusatkan di komunitas **Buka BMP** di Telegram.

Tidak perlu Python, BAT, Tesseract desktop, F12/DevTools, HAR, atau copy-paste cookie.

Lihat [Panduan Instalasi](docs/INSTALL.md) dan [FAQ](docs/FAQ.md).

## Community activation

Dari sudut pandang extension:

```text
Extension
  → membuat pairing sementara
  → membuka Telegram untuk verifikasi komunitas
  → menerima signed activation token dari activation API
  → memverifikasi signature token secara lokal
```

Public verification key berada di client. Private signing material tidak berada di repository ini.

Activation service tidak digunakan untuk mengunggah materi, gambar halaman, teks OCR, atau PDF hasil.

## Build

Source checkout tidak membawa binary OCR besar. Release builder mengambil dependency yang dipin **saat build** lalu memasukkannya ke ZIP sehingga end-user tidak menjalankan OCR JavaScript dari CDN.

```bash
npm run validate

BMP_API_BASE_URL="https://community.bukabmp.workers.dev" \
BMP_TELEGRAM_CHANNEL_URL="https://t.me/bukabmp" \
BMP_TELEGRAM_GROUP_URL="https://t.me/+0pAg9ymEhWdkZmNl" \
npm run build:release
```

Lihat [docs/RELEASE.md](docs/RELEASE.md).

## Responsible use

BMP Terbuka **tidak memberikan hak akses maupun hak redistribusi**. Gunakan hanya untuk materi yang memang dapat Anda akses dan sesuai hak/izin yang berlaku.

Project ini sengaja tidak menyediakan fingerprint spoofing, IP rotation, pemalsuan cookie/token keamanan sumber, blind retry terhadap blokir, atau penghapusan watermark.

Baca [RESPONSIBLE_USE.md](RESPONSIBLE_USE.md).

## Komunitas

- **Channel:** [Buka BMP](https://t.me/bukabmp)
- **Group:** [Group Terbuka](https://t.me/+0pAg9ymEhWdkZmNl)
- **Bot aktivasi:** [@bukabmp_bot](https://t.me/bukabmp_bot)

## Lisensi

Source BMP Terbuka yang dipublikasikan di repository ini: **GPL-3.0**. Dependency pihak ketiga tetap menggunakan lisensinya masing-masing; lihat [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

Komponen eksternal yang tidak berada di repository ini tidak otomatis termasuk dalam lisensi repository ini.

## Independensi

BMP Terbuka adalah proyek komunitas independen. Project ini tidak berafiliasi dengan atau mewakili institusi maupun penyedia layanan yang kompatibel dengannya.
