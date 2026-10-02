# Instalasi & Update

BMP Terbuka v1.2.0 memakai jalur instalasi yang berbeda sesuai browser. Gunakan [Status & Versi](../status) untuk kondisi distribusi terbaru.

## Jalur Resmi

- **Desktop Chrome:** package manual GitHub Release.
- **Desktop Edge:** Microsoft Edge Add-ons.
- **Android:** Microsoft Edge Stable + Microsoft Edge Add-ons.
- **Firefox:** belum didukung resmi.
- **Chrome Android:** bukan target instalasi resmi.

Versi stabil produk: **v1.2.0**.

## Desktop — Google Chrome

1. Buka GitHub Release resmi: https://github.com/mentaliss/bukabmp/releases/tag/v1.2.0
2. Download `BMP-Terbuka-v1.2.0.zip`.
3. Extract ZIP ke folder tetap.
4. Buka `chrome://extensions`.
5. Aktifkan **Developer mode**.
6. Pilih **Load unpacked** dan arahkan ke folder yang berisi `manifest.json`.
7. Buka popup BMP Terbuka dan selesaikan aktivasi.

Jangan gunakan GitHub **Source code (zip)** sebagai package extension.

### Update Chrome Manual

Untuk update:

1. download ZIP release terbaru;
2. extract package baru;
3. perbarui folder extension yang digunakan;
4. buka `chrome://extensions`;
5. tekan **Reload**;
6. buka popup dan cek versi.

**Jangan uninstall versi lama atau menghapus storage hanya untuk update normal.** Update in-place dengan identity extension yang sama dirancang mempertahankan data lokal.

## Desktop — Microsoft Edge

Gunakan listing resmi:

https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm

Instalasi dari Edge Add-ons mengikuti mekanisme update Store. Kalau v1.2.0 sudah dirilis di GitHub tetapi belum tersedia di Store, tetap gunakan versi Store yang benar-benar tersedia dan cek halaman [Status & Versi](../status).

## Android — Microsoft Edge Stable

1. Install/update Microsoft Edge Stable.
2. Buka listing BMP Terbuka di Microsoft Edge Add-ons.
3. Pasang melalui mekanisme normal Edge.
4. Buka popup BMP Terbuka.
5. Selesaikan aktivasi.
6. Login ke reader dengan akun kamu sendiri.
7. Gunakan BMP Terbuka dari Edge.

### Restore Backup di Android v1.2.0

Pada Edge Android, tombol **Pulihkan backup** tidak membuka file picker di popup.

Alurnya:

**Pulihkan backup → tab restore BMP Terbuka → pilih file backup → proses restore berjalan di tab tersebut.**

Biarkan tab restore tetap terbuka sampai proses selesai. Menutup tab restore saat proses berjalan akan menghentikan restore.

Ini adalah alur kompatibilitas Android v1.2.0 dan berbeda dari Desktop.

### Restore di Desktop

Pada Desktop, pemilihan file restore tetap dilakukan langsung dari popup extension.

## Backup sebelum perubahan besar

Kalau kamu akan menghapus data lokal, pindah perangkat, atau melakukan tindakan yang berisiko membuang cache, buat backup dulu bila data tersebut masih dibutuhkan.

Backup dapat berisi data belajar/material yang tersimpan lokal. Simpan file backup secara privat.

## Pindah Browser atau Install Ulang

Storage extension tidak otomatis berpindah antarbrowser, profil, atau perangkat.

File PDF yang sudah diexport ke Downloads tetap file biasa, tetapi cache/resume/Quiz source lokal berada pada storage extension masing-masing instalasi.

## Tutorial Lama

Video v1.0.4 masih dapat membantu memahami alur dasar, tetapi untuk v1.2.0 gunakan dokumentasi website ini.

Android: https://t.me/bukabmp/11?comment=294

Desktop: https://t.me/c/4381494564/18

## Download Resmi

https://mentaliss.github.io/bukabmp/id/download/
