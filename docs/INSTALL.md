# Instalasi BMP Terbuka

## Persyaratan

- Desktop: Google Chrome atau Microsoft Edge yang mendukung Manifest V3.
- Android: Microsoft Edge Canary dengan dukungan pemasangan extension/CRX yang tersedia pada build/perangkat Anda.
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

## Android — Microsoft Edge Canary

1. Install/update **Microsoft Edge Canary**.
2. Aktifkan dukungan pemasangan extension/CRX pada pengaturan developer/eksperimental yang tersedia.
3. Download paket Android/CRX BMP Terbuka dari GitHub Releases dan pasang melalui fitur install extension Edge Canary.
4. Buka popup **BMP Terbuka**, selesaikan aktivasi Telegram, lalu kembali ke Edge Canary.
5. Login ke portal reader, isi kode BMP + modul, lalu tekan **Mulai**.

Panduan Android lengkap, screenshot, dan troubleshooting tersedia melalui komunitas **Buka BMP** di Telegram.

## Aktivasi komunitas

Aktivasi hanya memeriksa keanggotaan komunitas dan tidak meminta password/NIM/cookie portal sumber. Masa aktivasi dapat diperbarui selama syarat komunitas terpenuhi.

## Update

BMP Terbuka memeriksa kebijakan versi secara berkala. Jika versi yang dipasang sudah tidak didukung, popup akan meminta update sebelum proses atau aktivasi baru dapat dimulai. Proses OCR yang sudah berjalan tidak diputus di tengah hanya karena kebijakan versi berubah.
