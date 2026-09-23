# Instalasi BMP Terbuka

## Persyaratan

- Microsoft Edge Desktop atau Android untuk jalur utama Microsoft Edge Add-ons.
- Desktop Chromium lain yang kompatibel untuk jalur manual yang didukung.
- Akun Anda sendiri pada portal reader yang didukung.
- Telegram untuk aktivasi komunitas.
- Internet saat mengakses sumber dan aktivasi.

OCR sudah dibundel di package release.

## Microsoft Edge — Desktop

Jalur utama adalah **Microsoft Edge Add-ons**.

1. Buka website/download page resmi BMP Terbuka.
2. Ikuti tautan Microsoft Edge Add-ons yang sudah diverifikasi.
3. Pasang extension melalui mekanisme normal Edge.
4. Buka popup BMP Terbuka dan selesaikan aktivasi komunitas.
5. Login ke portal reader dengan akun Anda sendiri dan gunakan extension.

Sampai URL listing resmi diverifikasi, dokumentasi tidak boleh mengarang atau menebak listing ID.

## Microsoft Edge — Android

Jalur utama adalah **Microsoft Edge Stable + Microsoft Edge Add-ons**.

1. Install/update Microsoft Edge Stable.
2. Buka listing resmi BMP Terbuka di Microsoft Edge Add-ons melalui Edge.
3. Tekan Dapatkan dan konfirmasi pemasangan.
4. Selesaikan aktivasi komunitas.
5. Login ke reader dengan akun Anda sendiri.

Edge Canary tetap fallback/testing bila diperlukan. **Chrome Android bukan target instalasi resmi BMP Terbuka.**

## Manual / supported Chromium

Untuk browser desktop yang didukung tetapi tidak memakai Edge Add-ons:

1. Buka GitHub Releases.
2. Download asset build bernama seperti BMP-Terbuka-v<VERSION>.zip.
3. Jangan gunakan GitHub **Source code (zip)** sebagai paket instalasi.
4. Extract ke folder tetap.
5. Buka halaman extensions browser dan aktifkan Developer mode.
6. Load unpacked folder yang berisi manifest.json.

Karena v1.1.0 masih **Unreleased**, jangan menganggap asset stable v1.1.0 sudah tersedia.

## Update

- Instalasi Store mengikuti mekanisme update extension milik browser/store.
- Instalasi manual perlu diperbarui menggunakan package release baru.
- Update in-place dengan extension identity yang sama biasanya mempertahankan token, draft, dan cache lokal; instalasi dengan identity berbeda diperlakukan sebagai instalasi baru.
