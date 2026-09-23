# Instalasi & Update

Halaman ini menjelaskan cara memasang dan memperbarui BMP Terbuka berdasarkan perangkat dan browser.

Jalur instalasi tidak sama untuk semua browser. Untuk status distribusi terbaru, selalu cek [Status & Versi](../status).

## Pilih Perangkat dan Browser

Jalur utama saat ini:

- **Android:** Microsoft Edge Stable + Microsoft Edge Add-ons.
- **Desktop Edge:** Microsoft Edge Add-ons.
- **Desktop Chrome:** instalasi manual dari asset ZIP release resmi.
- **Firefox:** belum didukung resmi.
- **Chrome Android:** bukan target instalasi resmi.

Release stabil BMP Terbuka saat ini adalah **v1.1.0**.

## Android — Microsoft Edge Stable

### Yang Dibutuhkan

- perangkat Android;
- Microsoft Edge Stable versi terbaru yang tersedia untuk perangkat kamu;
- Telegram untuk aktivasi;
- akses normal ke reader.

### Cara Install

1. Install atau update **Microsoft Edge Stable**.
2. Buka Microsoft Edge.
3. Buka listing resmi BMP Terbuka di Microsoft Edge Add-ons.
4. Tekan tombol untuk memasang extension.
5. Konfirmasi pemasangan bila Edge meminta konfirmasi.
6. Buka daftar extension di Edge dan pastikan BMP Terbuka sudah terpasang.
7. Buka BMP Terbuka dan lanjutkan ke aktivasi.

Listing resmi Edge Add-ons:

https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm

### Setelah Install

Jangan langsung mencari Kode BMP di Telegram. Aktivasi dimulai dari popup extension.

Buka [Aktivasi & Verifikasi](activation) untuk langkah berikutnya.

### Tentang Edge Canary

Edge Canary pernah digunakan sebagai jalur Android pada versi lama dan masih dapat dipakai sebagai fallback/testing pada kondisi tertentu.

Untuk penggunaan normal saat ini, gunakan **Microsoft Edge Stable**.

## Desktop — Microsoft Edge

### Cara Install

1. Buka Microsoft Edge.
2. Buka listing BMP Terbuka di Microsoft Edge Add-ons.
3. Pasang extension melalui mekanisme normal Edge.
4. Pastikan BMP Terbuka muncul di daftar extension.
5. Pin extension ke toolbar bila ingin akses lebih cepat.
6. Buka popup BMP Terbuka dan lakukan aktivasi.

Listing resmi:

https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm

### Update di Edge

Instalasi dari Edge Add-ons mengikuti mekanisme update milik browser/store.

Kalau versi baru sudah dirilis tetapi belum muncul di perangkat kamu, cek [Status & Versi](../status). Proses review atau propagasi Store dapat berbeda dari release GitHub.

## Desktop — Google Chrome

Chrome Web Store belum menjadi jalur distribusi aktif BMP Terbuka saat ini. Karena itu, pengguna Chrome desktop memasang BMP Terbuka secara manual dari ZIP release resmi.

### 1. Download ZIP Release

Buka GitHub Releases:

https://github.com/mentaliss/bukabmp/releases/latest

Download asset bernama seperti:

`BMP-Terbuka-v1.1.0.zip`

Jangan download **Source code (zip)** atau **Source code (tar.gz)**. File tersebut dibuat otomatis oleh GitHub dan bukan package extension untuk pengguna.

### 2. Extract ZIP

Extract ZIP ke folder yang akan tetap kamu simpan.

Jangan menjalankan extension langsung dari file ZIP.

Setelah extract, pastikan folder yang akan dipilih berisi file `manifest.json`.

### 3. Buka Halaman Extension Chrome

Ketik di address bar:

`chrome://extensions`

### 4. Aktifkan Developer Mode

Aktifkan **Developer mode** di halaman Extensions.

### 5. Pilih Load Unpacked

Tekan **Load unpacked**, lalu pilih folder hasil extract yang berisi `manifest.json`.

Kalau Chrome menolak folder yang dipilih, biasanya folder yang dipilih bukan folder root extension. Masuk satu tingkat ke folder yang benar dan pastikan `manifest.json` terlihat di dalamnya.

### 6. Pastikan BMP Terbuka Aktif

Setelah berhasil dimuat:

- BMP Terbuka muncul di daftar extension;
- extension dalam kondisi aktif;
- ikon dapat dipin ke toolbar bila diinginkan.

Setelah itu lanjutkan ke [Aktivasi & Verifikasi](activation).

## Update Instalasi Manual di Chrome

Untuk instalasi manual:

1. buka [GitHub Releases](https://github.com/mentaliss/bukabmp/releases/latest);
2. download asset ZIP release terbaru;
3. extract package baru;
4. perbarui folder extension yang kamu gunakan;
5. buka `chrome://extensions`;
6. tekan **Reload** pada BMP Terbuka;
7. buka popup dan cek versi.

Update in-place dengan identitas extension yang sama biasanya mempertahankan token, draft, dan penyimpanan lokal.

Membuat instalasi baru dengan identity berbeda dapat diperlakukan browser sebagai extension yang berbeda. Karena itu jangan uninstall versi lama atau menghapus data hanya untuk melakukan update normal.

## Browser Chromium Lain

BMP Terbuka tidak menjadikan semua browser Chromium sebagai target dukungan resmi.

Kalau sebuah browser mendukung extension Manifest V3 dan **Load unpacked**, package manual secara teknis dapat dimuat, tetapi dokumentasi dan pengujian utama difokuskan pada Google Chrome dan Microsoft Edge.

Kalau kamu menggunakan browser lain dan mengalami masalah, sebutkan nama browser dan versinya saat meminta bantuan.

## Firefox

Firefox belum menjadi browser yang didukung resmi BMP Terbuka.

Untuk desktop gunakan Google Chrome atau Microsoft Edge. Untuk Android gunakan Microsoft Edge Stable.

## Pindah Browser atau Install Ulang

Penyimpanan hasil BMP berada di storage lokal extension.

Karena itu:

- file PDF yang sudah diekspor ke Downloads tetap merupakan file biasa;
- data resume/cache di extension tidak boleh diasumsikan ikut pindah ke browser lain;
- uninstall extension atau menghapus data browser dapat menghapus penyimpanan lokal extension;
- kalau storage lokal hilang, modul yang dibutuhkan mungkin perlu diproses ulang.

Kalau tujuan kamu hanya update, jangan uninstall lebih dulu.

## Tutorial Video

Video yang tersedia saat ini masih dibuat pada alur **v1.0.4**.

Android:

https://t.me/bukabmp/11?comment=294

Desktop:

https://t.me/c/4381494564/18

Video tersebut masih dapat membantu memahami alur dasar, tetapi tampilan dan beberapa perilaku v1.1.0 sudah berubah. Untuk langkah terbaru gunakan dokumentasi di website ini.

## Download Resmi

Halaman download:

https://mentaliss.github.io/bukabmp/id/download/

GitHub Releases:

https://github.com/mentaliss/bukabmp/releases/latest

Microsoft Edge Add-ons:

https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm

## Setelah Instalasi

Lanjutkan ke [Aktivasi & Verifikasi](activation).
