# Mulai Menggunakan BMP Terbuka

BMP Terbuka membantu mengubah materi yang sudah dapat kamu akses melalui reader menjadi searchable PDF. OCR, penyimpanan hasil, penggabungan PDF, dan export berjalan di perangkat kamu.

Kalau baru pertama kali memakai BMP Terbuka, ikuti urutan di halaman ini. Tidak perlu memahami istilah teknis seperti cache, IndexedDB, atau Manifest V3 untuk mulai.

## Sebelum Mulai

Siapkan:

- perangkat Android atau komputer;
- browser yang didukung;
- akun kamu sendiri yang sudah bisa membuka reader;
- Telegram untuk aktivasi komunitas;
- koneksi internet saat mengakses reader, aktivasi, dan mengecek status versi.

Untuk status browser, Store, dan versi terbaru, lihat [Status & Versi](../status).

## 1. Instal BMP Terbuka

### Android

Gunakan **Microsoft Edge Stable** dan pasang BMP Terbuka melalui **Microsoft Edge Add-ons**.

Edge Canary bukan jalur utama. Gunakan Canary hanya bila memang sedang diminta untuk testing atau fallback.

### Desktop — Microsoft Edge

Gunakan listing resmi BMP Terbuka di **Microsoft Edge Add-ons**.

### Desktop — Google Chrome

Chrome Web Store belum menjadi jalur distribusi aktif BMP Terbuka saat ini. Untuk Chrome desktop, gunakan instalasi manual dari asset ZIP release resmi.

Jangan memilih tombol **Source code (zip)** dari GitHub. Gunakan file release BMP Terbuka yang memang dibuat untuk pengguna.

Panduan langkah demi langkah tersedia di [Instalasi & Update](install).

## 2. Aktivasi BMP Terbuka

Aktivasi dimulai dari extension.

Alur normal:

1. Buka popup BMP Terbuka.
2. Mulai proses aktivasi/verifikasi.
3. Extension membuka bot Telegram dengan kode aktivasi.
4. Selesaikan pemeriksaan komunitas di Telegram.
5. Kembali ke extension.
6. Extension akan mendeteksi hasil aktivasi.

Kalau aktivasi sudah kedaluwarsa, kamu **tidak perlu install ulang extension**. Ikuti verifikasi ulang bila extension memintanya.

Lihat penjelasan lengkap di [Aktivasi & Verifikasi](activation).

## 3. Buka BMP di Reader

Login ke portal reader melalui mekanisme normal sumber menggunakan akun kamu sendiri.

BMP Terbuka tidak meminta password, NIM, cookie, session, atau credential portal sumber.

Buka BMP yang memang bisa kamu akses, lalu biarkan tab reader tersedia selama proses berjalan.

## 4. Temukan Kode BMP

Kode BMP diambil dari parameter `modul` pada URL reader.

Contoh pola:

`.../reader/index.php?modul=XXXX...`

Gunakan nilai pada `modul=` sebagai Kode BMP.

Kode BMP tidak selalu sama dengan kode mata kuliah. Kalau extension tidak mengenali kode yang kamu masukkan, pastikan kamu mengambilnya dari URL reader BMP yang sedang dibuka.

## 5. Pilih Modul

Kamu bisa memproses seluruh modul atau hanya rentang tertentu.

Contoh:

- `M1–M9` untuk modul 1 sampai 9;
- `M3–M6` untuk hanya modul 3 sampai 6.

Pilih hanya modul yang memang kamu perlukan. Kamu tidak harus selalu memproses seluruh BMP.

## 6. Mulai Proses

Setelah Kode BMP dan range benar:

1. pastikan tab reader yang sesuai masih tersedia;
2. tekan **Mulai** dari popup BMP Terbuka;
3. extension memproses modul satu per satu;
4. halaman diproses menjadi searchable PDF secara lokal;
5. modul yang selesai disimpan di penyimpanan lokal extension.

Jangan menutup tab reader atau membersihkan data extension saat proses sedang berjalan.

Kalau proses berhenti di tengah, jangan langsung mulai dari nol. BMP Terbuka dapat melanjutkan dari modul yang sudah tersimpan.

## 7. Ambil Hasil PDF

Setelah modul selesai, hasil dapat diekspor sebagai PDF.

Kamu dapat:

- mengekspor PDF per modul;
- mengekspor ulang modul yang sudah tersimpan tanpa OCR ulang;
- membuat PDF gabungan untuk range yang lengkap;
- membuat PDF gabungan penuh bila semua modul yang dibutuhkan sudah tersedia.

File yang masuk ke folder Downloads adalah hasil export. Data yang dipakai untuk resume disimpan terpisah di penyimpanan lokal extension.

Lihat [PDF, Resume & Penyimpanan](files) untuk memahami perbedaannya.

## Kalau Proses Terhenti

Jangan langsung:

- uninstall extension;
- menghapus storage;
- menghapus semua data browser;
- menjalankan proses ulang untuk seluruh BMP.

Catat dulu:

- versi BMP Terbuka;
- Android atau Desktop;
- browser yang digunakan;
- Kode BMP;
- modul terakhir yang berhasil;
- pesan error atau screenshot bila ada.

Lalu buka [Mengatasi Masalah](troubleshooting).

## Panduan Selanjutnya

- [Instalasi & Update](install)
- [Aktivasi & Verifikasi](activation)
- [Cara Menggunakan BMP Terbuka](usage)
- [PDF, Resume & Penyimpanan](files)
- [Mengatasi Masalah](troubleshooting)
- [Status & Versi](../status)
