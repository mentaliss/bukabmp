# Instalasi BMP Terbuka

Panduan pengguna yang paling lengkap tersedia di website: https://mentaliss.github.io/bukabmp/id/docs/install/

Untuk versi stabil dan status Store terbaru, gunakan: https://mentaliss.github.io/bukabmp/id/status/

## Persyaratan

- Microsoft Edge Desktop atau Android untuk jalur utama Microsoft Edge Add-ons.
- Google Chrome Desktop untuk jalur manual dari package ZIP release resmi.
- Akun Anda sendiri pada portal reader yang didukung.
- Telegram untuk aktivasi komunitas.
- Internet saat mengakses sumber dan aktivasi.

OCR sudah dibundel di package release.

## Microsoft Edge — Desktop

Jalur utama adalah **Microsoft Edge Add-ons**.

1. Buka listing BMP Terbuka di Microsoft Edge Add-ons: https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm
2. Pasang extension melalui mekanisme normal Edge.
3. Pastikan BMP Terbuka aktif pada daftar extension.
4. Buka popup BMP Terbuka dan selesaikan aktivasi komunitas.
5. Login ke portal reader dengan akun Anda sendiri dan gunakan extension.

Release stabil produk saat ini adalah **v1.2.0**, dan **v1.2.0 sudah live di Microsoft Edge Add-ons** untuk Desktop dan Android.

## Microsoft Edge — Android

Jalur utama adalah **Microsoft Edge Stable + Microsoft Edge Add-ons**.

1. Install/update Microsoft Edge Stable.
2. Buka listing resmi BMP Terbuka di Microsoft Edge Add-ons melalui Edge.
3. Tekan Dapatkan dan konfirmasi pemasangan.
4. Selesaikan aktivasi komunitas.
5. Login ke reader dengan akun Anda sendiri.

Edge Canary tetap fallback/testing bila diperlukan. **Chrome Android bukan target instalasi resmi BMP Terbuka.**

## Google Chrome — Desktop

**Chrome Web Store belum menjadi jalur instalasi aktif BMP Terbuka saat ini.**

Untuk Chrome desktop, gunakan package manual dari GitHub Releases.

1. Buka https://github.com/mentaliss/bukabmp/releases/latest
2. Download asset build resmi yang tercantum pada release.
3. Jangan gunakan GitHub **Source code (zip)** atau **Source code (tar.gz)** sebagai package instalasi.
4. Extract ZIP ke folder tetap.
5. Buka `chrome://extensions`.
6. Aktifkan **Developer mode**.
7. Tekan **Load unpacked**.
8. Pilih folder hasil extract yang berisi `manifest.json`.
9. Pastikan BMP Terbuka muncul dan aktif.

Release manual stabil saat ini adalah **v1.2.0**. Gunakan asset build `BMP-Terbuka-v1.2.0.2-github.zip`.

## Browser Chromium Lain

Browser Chromium lain bukan target dukungan resmi utama.

Package manual dapat bergantung pada kompatibilitas Manifest V3 dan kemampuan Load unpacked browser tersebut. Dokumentasi dan pengujian utama difokuskan pada Google Chrome dan Microsoft Edge.

## Firefox

Firefox belum didukung resmi.

Gunakan Google Chrome atau Microsoft Edge pada desktop.

## Update

- Instalasi Edge Add-ons mengikuti mekanisme update extension milik browser/store. Update biasanya otomatis tetapi tidak selalu instan. Di desktop, gunakan tombol **Update** dari halaman Extensions jika tersedia; Developer mode mungkin perlu diaktifkan sementara.
- Di Edge Android, tunggu automatic Store update adalah pilihan yang direkomendasikan. Jika memilih reinstall agar lebih cepat, buat Backup BMP Terbuka dulu bila ingin mempertahankan data lokal. PDF yang sudah tersimpan di Downloads/perangkat tetap aman.
- Instalasi manual Chrome **tidak mengunduh update saat tombol Reload ditekan**. Download ZIP release baru, extract ke folder sementara, lalu ganti/overwrite isi folder yang sama yang sebelumnya dipilih lewat **Load unpacked**. Setelah file baru berada di folder tersebut, buka `chrome://extensions` dan tekan **Reload**.
- Pertahankan folder/path extension yang sama untuk update manual. Jangan Remove lalu Load unpacked dari folder lain hanya untuk update normal.
- Update in-place dengan extension identity yang sama biasanya mempertahankan token, draft, dan cache lokal.
- Uninstall atau instalasi dengan identity berbeda dapat diperlakukan sebagai instalasi baru dan dapat kehilangan storage lokal.

Jangan uninstall extension hanya untuk melakukan update normal.
