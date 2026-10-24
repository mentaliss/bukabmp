# Instalasi BMP Terbuka

## Persyaratan

- Desktop: Google Chrome atau Microsoft Edge yang mendukung Manifest V3.
- Android: Microsoft Edge Stable dengan dukungan extension melalui Microsoft Edge Add-ons. Edge Canary tetap menjadi jalur fallback/testing bila Stable belum kompatibel pada perangkat tertentu.
- Akun Anda sendiri pada portal reader yang didukung.
- Telegram untuk aktivasi komunitas.
- Internet saat mengakses sumber dan saat aktivasi.

OCR sudah ada di dalam paket release.

## Desktop — Chrome / Edge

1. Buka halaman **Releases** repo `mentaliss/bukabmp` dan download `BMP-Terbuka-v<VERSION>.zip`.
2. Extract ZIP ke folder tetap.
3. Buka `chrome://extensions` atau `edge://extensions`.
4. Aktifkan **Developer mode**.
5. Klik **Load unpacked** dan pilih folder hasil extract yang berisi `manifest.json`.
6. Buka popup **BMP Terbuka** dan selesaikan aktivasi Telegram.
7. Login ke portal reader dengan akun Anda sendiri, isi kode BMP + rentang modul, lalu tekan **Mulai**.

## Android — Microsoft Edge Stable

Jalur utama 1.1.0 adalah **Microsoft Edge Stable + Microsoft Edge Add-ons**.

1. Install/update **Microsoft Edge** dari Google Play. Pada sebagian listing, nama yang tampil dapat berupa **Microsoft Edge: Ekstensi / Microsoft Edge: Extensions**; itu tetap channel Edge Stable.
2. Buka listing resmi **BMP Terbuka** di Microsoft Edge Add-ons melalui Edge.
3. Tekan **Dapatkan**, lalu konfirmasi pemasangan extension.
4. Buka popup **BMP Terbuka**, selesaikan aktivasi Telegram, lalu kembali ke Edge.
5. Login ke portal reader, isi kode BMP + modul, lalu tekan **Mulai**.

Jika Edge Stable pada perangkat tertentu belum dapat memasang/menjalankan BMP Terbuka dengan benar, gunakan **Edge Canary** hanya sebagai fallback/testing.

**Chrome Android bukan jalur instalasi resmi BMP Terbuka.** Paket GitHub/manual ditujukan sementara untuk desktop Chromium non-Edge, bukan untuk Chrome Android.

Panduan Android lengkap, screenshot, dan troubleshooting tersedia melalui komunitas **Buka BMP** di Telegram.

## Aktivasi komunitas

Aktivasi hanya memeriksa keanggotaan komunitas dan tidak meminta password/NIM/cookie portal sumber. Masa aktivasi dapat diperbarui selama syarat komunitas terpenuhi.

## Update

BMP Terbuka memeriksa kebijakan versi secara berkala. Jika versi yang dipasang sudah tidak didukung, popup akan meminta update sebelum proses atau aktivasi baru dapat dimulai. Proses OCR yang sudah berjalan tidak diputus di tengah hanya karena kebijakan versi berubah.

- Instalasi dari **Edge Add-ons** mengikuti mekanisme update extension milik Edge.
- Instalasi **GitHub/manual** perlu diperbarui manual menggunakan paket release baru.
- Update in-place dengan extension ID yang sama mempertahankan storage extension, termasuk token aktivasi, draft, dan cache lokal. Pindah ke instalasi dengan extension ID berbeda dianggap instalasi baru dan storage tidak otomatis ikut pindah.
