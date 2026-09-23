# PDF, Resume & Penyimpanan

BMP Terbuka memisahkan **hasil yang disimpan untuk melanjutkan proses** dari **file PDF yang sudah kamu export ke Downloads**. Memahami perbedaan ini penting supaya kamu tidak mengulang OCR tanpa perlu.

## Bagaimana Hasil Disimpan

Setelah sebuah modul selesai diproses, BMP Terbuka menyimpan hasil modul di penyimpanan lokal extension.

Penyimpanan lokal ini dipakai untuk:

- melanjutkan proses yang terputus;
- melewati modul yang sudah selesai;
- membuat PDF gabungan;
- export ulang tanpa OCR;
- melihat modul mana yang sudah tersedia.

Pada implementasi v1.1.0, PDF modul disimpan secara lokal oleh extension. Data ini bukan file yang sama dengan salinan yang kamu lihat di folder Downloads.

## PDF per Modul

Setiap modul yang selesai dapat tersedia sebagai PDF sendiri.

Kalau kamu hanya membutuhkan satu modul, kamu tidak harus membuat PDF gabungan.

### Export Satu Modul

Pilih modul yang sudah tersimpan lalu gunakan fungsi export yang tersedia di extension.

Karena PDF sudah ada di storage lokal, export ulang tidak perlu mengulang OCR.

### Export Beberapa Modul

Kalau beberapa modul sudah tersedia, pilih modul/range yang dibutuhkan lalu export sesuai opsi yang tersedia.

## PDF Gabungan

PDF gabungan bersifat opsional.

Kamu dapat membuat:

- PDF gabungan penuh bila seluruh modul yang diperlukan tersedia;
- PDF gabungan untuk range tertentu, misalnya M3–M6.

### Syarat Range Harus Lengkap

BMP Terbuka tidak membuat PDF gabungan seolah-olah lengkap kalau ada modul yang hilang di dalam range.

Contoh:

- M3 tersedia;
- M4 tersedia;
- M5 hilang;
- M6 tersedia.

Range M3–M6 belum lengkap. Proses atau download ulang M5 dulu, lalu buat PDF gabungan lagi.

## Resume

Resume berarti BMP Terbuka menggunakan modul yang sudah tersimpan untuk menghindari pekerjaan ulang.

Contoh:

1. kamu memilih M1–M9;
2. proses selesai sampai M4;
3. proses berhenti;
4. kemudian kamu menjalankan M1–M9 lagi.

Kalau M1–M4 masih lengkap di storage lokal, modul itu dilewati. Extension melanjutkan modul yang belum tersedia.

## Kapan OCR Harus Diulang

OCR perlu dilakukan lagi bila hasil modul yang dibutuhkan memang tidak lagi tersedia di penyimpanan lokal atau kamu sengaja memilih download ulang modul tersebut.

OCR tidak perlu diulang hanya karena:

- file di Downloads terhapus;
- kamu ingin export salinan PDF lagi;
- proses sebelumnya berhenti setelah beberapa modul selesai.

## Penyimpanan Lokal Extension

Penyimpanan lokal adalah authority untuk fitur resume, merge, dan export ulang.

Di v1.1.0, extension menyimpan cache PDF per BMP secara lokal di browser.

Kamu tidak perlu mengelola database internal tersebut secara manual.

## File di Downloads

File di folder Downloads adalah **salinan hasil export**.

Menghapus file dari Downloads tidak otomatis menghapus data modul yang masih ada di extension.

Sebaliknya, menghapus storage extension tidak otomatis menghapus file PDF yang sudah ada di Downloads.

## File Downloads Terhapus

Kalau file PDF di Downloads terhapus tetapi modul masih tersedia di storage extension:

1. buka BMP yang sesuai;
2. cek modul yang masih tersimpan;
3. gunakan export ulang;
4. tidak perlu OCR ulang.

Kalau storage lokal juga sudah hilang, modul perlu diproses ulang.

## Mengosongkan Penyimpanan BMP

Gunakan fungsi hapus/kosongkan penyimpanan hanya kalau kamu memang ingin membuang data lokal BMP tersebut.

Sebelum menghapus, pahami akibatnya:

- data resume untuk BMP tersebut dapat hilang;
- PDF yang belum diexport tidak lagi bisa diambil dari storage;
- export ulang tanpa OCR tidak lagi tersedia untuk data yang sudah dihapus;
- file PDF yang sudah ada di Downloads tidak ikut dihapus.

## Uninstall Extension

Jangan uninstall sebagai langkah troubleshooting pertama.

Uninstall atau penghapusan data browser dapat menghilangkan storage lokal extension.

Kalau kamu hanya ingin memperbarui versi, ikuti [Instalasi & Update](install) tanpa menghapus extension terlebih dahulu.

## Install Ulang

Install ulang dapat dianggap sebagai instalasi baru bila browser memberikan identity/storage yang berbeda.

Akibatnya:

- aktivasi mungkin perlu dilakukan lagi;
- storage lokal lama mungkin tidak tersedia;
- resume dari data lama mungkin tidak bisa digunakan.

Karena itu install ulang hanya dilakukan kalau memang diperlukan, bukan sebagai solusi default untuk semua error.

## Pindah Browser atau Perangkat

Jangan menganggap storage extension otomatis berpindah antara:

- Chrome dan Edge;
- komputer lama dan komputer baru;
- satu profil browser dan profil lain;
- instalasi extension yang berbeda.

Simpan file PDF penting yang sudah diexport di tempat yang kamu kelola sendiri.

## Kalau Modul Hilang dari Storage

Kalau hanya satu atau beberapa modul yang hilang:

1. pilih BMP yang benar;
2. pilih range modul yang hilang;
3. gunakan proses/download ulang untuk range tersebut;
4. jangan proses ulang seluruh BMP bila tidak perlu.

## Kalau PDF Gabungan Tidak Bisa Dibuat

Periksa apakah semua modul dalam range target sudah lengkap.

Kalau ada gap, selesaikan modul yang hilang dulu.

Untuk diagnosis lebih lengkap, buka [Mengatasi Masalah](troubleshooting).
