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
2. Download `BMP-Terbuka-v1.2.0.2-github.zip`.
3. Extract ZIP ke folder tetap.
4. Buka `chrome://extensions`.
5. Aktifkan **Developer mode**.
6. Pilih **Load unpacked** dan arahkan ke folder yang berisi `manifest.json`.
7. Buka popup BMP Terbuka dan selesaikan aktivasi.

Jangan gunakan GitHub **Source code (zip)** sebagai package extension.

### Chrome Web Store — Coming soon

Chrome Web Store **belum tersedia untuk publik**. Kalau nanti sudah tersedia, instalasi Store akan update otomatis, tetapi update Store tidak selalu masuk secara instan. Di desktop, kamu dapat membuka halaman Ekstensi dan memakai tombol **Update** jika tersedia; Developer mode mungkin perlu diaktifkan sementara.

### Update Chrome Manual

Instalasi **Load unpacked** tidak mengunduh update otomatis. Tombol **Reload** di `chrome://extensions` hanya memuat ulang file yang sudah ada di folder extension.

Untuk update tanpa mengganti identity/storage lokal:

1. download ZIP release terbaru;
2. extract ZIP baru ke folder sementara;
3. buka folder tetap yang sebelumnya kamu pilih saat **Load unpacked**;
4. ganti/overwrite isi folder tetap tersebut dengan isi package release terbaru;
5. pastikan `manifest.json` dari versi baru berada di folder yang sama;
6. buka `chrome://extensions`;
7. tekan **Reload** pada BMP Terbuka;
8. buka popup dan pastikan nomor versi sudah berubah.

**Jangan uninstall versi lama, jangan Remove lalu Load unpacked dari folder lain, dan jangan menghapus storage hanya untuk update normal.** Gunakan folder/path extension yang sama agar instalasi lokal tetap konsisten.

## Desktop — Microsoft Edge

Gunakan listing resmi:

https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm

**BMP Terbuka v1.2.0 sudah live di Microsoft Edge Add-ons** untuk Desktop dan Android. Instalasi dari Store mengikuti mekanisme update normal Microsoft Edge.

Update Store di desktop biasanya otomatis, tetapi bisa terlambat. Kalau ingin mengecek lebih cepat, buka `edge://extensions` lalu gunakan **Update** jika tersedia. Developer mode mungkin perlu diaktifkan sementara. Jangan uninstall/reinstall untuk update Store normal.

Cek [Status & Versi](../status) untuk status distribusi terbaru.

## Android — Microsoft Edge Stable

1. Install/update Microsoft Edge Stable.
2. Buka listing BMP Terbuka di Microsoft Edge Add-ons.
3. Pasang melalui mekanisme normal Edge.
4. Buka popup BMP Terbuka.
5. Selesaikan aktivasi.
6. Login ke reader dengan akun kamu sendiri.
7. Gunakan BMP Terbuka dari Edge.

### Update Edge Android

Untuk Edge Android, **tunggu automatic Store update** adalah pilihan yang direkomendasikan. Update dapat membutuhkan waktu dan Edge Android tidak menyediakan tombol Update desktop yang sama praktisnya.

Kalau tidak ingin menunggu dan memilih reinstall, **WAJIB buat Backup BMP Terbuka terlebih dahulu** jika ingin mempertahankan data lokal. Menghapus/reinstall extension dapat menghapus data lokal extension.

Setelah reinstall:
- lakukan aktivasi/pairing lagi bila diminta;
- Restore backup;
- Restore tetap memakai **MERGE**.

**PDF yang sudah tersimpan di folder Downloads/perangkat tetap aman** dan tidak ikut terhapus hanya karena extension direinstall.

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

## Tutorial instalasi saat ini

Video instalasi terbaru untuk **Desktop + Android**:

https://t.me/bukabmp/32

Video ini adalah tutorial visual. Untuk langkah tertulis dan status jalur instalasi terbaru, tetap gunakan dokumentasi website ini.

## Download Resmi

https://mentaliss.github.io/bukabmp/id/download/
