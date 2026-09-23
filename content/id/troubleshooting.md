# Mengatasi Masalah

Halaman ini membantu menentukan langkah yang aman ketika BMP Terbuka tidak bekerja seperti yang diharapkan.

Jangan langsung uninstall, menghapus storage, atau mengulang seluruh BMP. Banyak masalah dapat diperiksa tanpa membuang hasil yang sudah selesai.

## Sebelum Mencoba Memperbaiki

Catat dulu:

- versi BMP Terbuka;
- Android atau Desktop;
- browser yang digunakan;
- Kode BMP;
- range modul;
- modul terakhir yang berhasil;
- teks error persis;
- tahap saat error muncul;
- screenshot bila ada.

Jangan kirim password, NIM, cookie, session, token, OTP, atau credential lain.

## Failed to Fetch

Pesan **Failed to Fetch** tidak selalu mempunyai satu penyebab.

Hal terpenting adalah mengetahui **muncul di tahap mana**.

### Failed to Fetch saat Aktivasi

Periksa:

- koneksi internet;
- apakah Telegram dapat dibuka;
- apakah sesi pairing masih berlaku;
- apakah extension masih menampilkan kode aktivasi yang sama.

Kalau pairing sudah kedaluwarsa, mulai sesi aktivasi baru dari popup extension.

Jangan membagikan activation token atau pairing secret saat meminta bantuan.

### Failed to Fetch saat Menekan Mulai

Periksa:

- kamu sudah login ke reader melalui mekanisme normal sumber;
- tab reader yang benar masih tersedia;
- halaman reader dapat dibuka secara normal di browser;
- Kode BMP sesuai dengan reader yang sedang dibuka;
- aktivasi extension masih valid.

Kalau reader sendiri sedang tidak bisa diakses, selesaikan masalah akses reader terlebih dahulu.

Kalau reader dapat dibuka normal tetapi BMP Terbuka tetap gagal saat Mulai, catat versi, browser, Kode BMP, dan screenshot error lalu laporkan.

### Failed to Fetch saat Modul Sedang Diproses

Catat modul dan tahap terakhir yang berhasil.

Jangan menghapus storage. Modul yang sudah lengkap mungkin masih dapat digunakan untuk resume.

Buka kembali BMP yang sama dan coba melanjutkan range yang sama setelah memastikan reader dapat diakses normal.

Kalau error selalu terjadi pada modul yang sama, laporkan modul tersebut secara spesifik.

## Tombol Mulai Tidak Berjalan

Periksa:

- aktivasi masih valid;
- Kode BMP tidak kosong dan sesuai reader;
- range modul masuk akal;
- tab reader yang benar terbuka;
- tidak ada proses BMP lain yang masih aktif.

Kalau popup menampilkan pesan lain, gunakan teks pesan tersebut sebagai petunjuk utama.

## Proses Berhenti di Tengah

Jangan mulai dari nol.

Contoh: M1–M4 sudah selesai lalu proses berhenti sebelum M5.

Yang sebaiknya dilakukan:

1. pastikan reader masih dapat dibuka;
2. buka kembali BMP Terbuka;
3. gunakan Kode BMP yang sama;
4. jalankan range yang sama;
5. biarkan extension melewati modul yang sudah lengkap dan melanjutkan yang belum selesai.

Kalau storage lokal sudah dihapus, resume dari hasil lama memang tidak lagi tersedia.

## Modul Tidak Terdownload

Kalau hanya satu modul tidak tersedia:

1. cek apakah modul lain selesai normal;
2. cek apakah modul yang hilang muncul sebagai belum lengkap;
3. pilih range yang mencakup modul tersebut;
4. gunakan download ulang hanya untuk modul/range yang bermasalah;
5. jangan menghapus modul lain yang sudah selesai.

Kalau modul tetap gagal pada titik yang sama, laporkan modul dan error terakhir.

## Ada Gap pada Modul

Gap berarti ada modul hilang di antara modul yang sudah tersedia.

Contoh: M1, M2, M4, M5 tersedia tetapi M3 tidak.

Selesaikan M3 dulu sebelum membuat PDF gabungan M1–M5.

BMP Terbuka tidak seharusnya membuat merge lengkap dengan diam-diam melewati modul yang hilang.

## PDF Tidak Muncul

Periksa:

- modul sudah benar-benar selesai;
- hasil masih tersedia di storage lokal;
- kamu sudah menjalankan fungsi export;
- browser tidak memblokir download.

Kalau storage masih ada, coba export ulang sebelum melakukan OCR ulang.

## PDF Gabungan Tidak Dibuat

Penyebab yang perlu diperiksa pertama adalah range yang belum lengkap.

Pastikan semua modul di dalam range merge sudah tersedia.

Kalau hanya satu modul hilang, proses ulang modul itu saja lalu coba merge lagi.

## File PDF di Downloads Hilang

Kalau file Downloads terhapus tetapi storage lokal extension masih ada, gunakan export ulang.

Tidak perlu OCR ulang hanya untuk membuat salinan file baru.

Lihat [PDF, Resume & Penyimpanan](files).

## Request Rejected

Kalau source menampilkan **Request Rejected**, BMP Terbuka dirancang untuk berhenti daripada mencoba memaksa melewati penolakan server.

Yang sebaiknya dilakukan:

- hentikan percobaan berulang;
- pastikan sesi login normal masih valid;
- buka reader secara manual dan lihat apakah sumber sendiri dapat diakses;
- coba lagi setelah kondisi sumber normal;
- laporkan bila terjadi terus pada akses yang normal.

BMP Terbuka tidak menggunakan stealth, pemalsuan token, IP rotation, atau blind retry untuk melewati penolakan sumber.

## HTTP 403 / Akses Ditolak

HTTP 403 berarti permintaan ditolak oleh sumber.

Jangan menjalankan retry agresif.

Periksa apakah:

- sesi login masih aktif;
- materi memang dapat dibuka melalui reader;
- sumber sedang membatasi akses.

Kalau akses normal melalui browser juga ditolak, BMP Terbuka tidak dapat membuat hak akses baru.

## HTTP 429 / Too Many Requests

HTTP 429 biasanya menunjukkan rate limiting dari sumber.

Hentikan percobaan berulang dan tunggu sebelum mencoba lagi.

Jangan memakai banyak retry, rotasi IP, atau teknik untuk menghindari rate limit.

## Reader Meminta Login Lagi

Login kembali melalui halaman resmi sumber menggunakan akun kamu sendiri.

BMP Terbuka tidak meminta dan tidak perlu menerima password/NIM untuk melakukan login.

Setelah reader kembali dapat diakses, lanjutkan BMP yang sama.

## Reader Tidak Bisa Dibuka

Kalau reader sendiri tidak dapat dibuka secara normal, masalah tersebut harus diselesaikan di sisi akses/source terlebih dahulu.

BMP Terbuka hanya bekerja dengan resource yang diberikan kepada sesi pengguna yang sudah berhak mengaksesnya.

## Extension Tidak Muncul di Chrome

Untuk instalasi manual:

1. buka `chrome://extensions`;
2. pastikan Developer mode aktif;
3. pastikan BMP Terbuka ada di daftar extension;
4. kalau belum ada, pilih **Load unpacked**;
5. pilih folder yang berisi `manifest.json`.

Jangan memilih file ZIP langsung.

## Extension Tidak Muncul di Edge

Kalau memasang dari Edge Add-ons:

- buka daftar extension Edge;
- pastikan BMP Terbuka terpasang dan aktif;
- pin ke toolbar bila ingin mudah dibuka.

Kalau Store menyatakan belum tersedia untuk perangkat tertentu, cek [Status & Versi](../status).

## Setelah Update Ada Masalah

Sebelum uninstall:

1. cek versi yang terpasang;
2. reload extension;
3. buka ulang popup;
4. pastikan browser sudah memakai package terbaru;
5. jangan menghapus storage sebelum memastikan masalah memang berasal dari data lokal.

Untuk Chrome manual, lihat bagian update di [Instalasi & Update](install).

## Aktivasi Bermasalah

Masalah aktivasi dibahas lebih lengkap di [Aktivasi & Verifikasi](activation).

Ingat: aktivasi kedaluwarsa tidak berarti kamu harus install ulang extension.

## Informasi yang Berguna Saat Meminta Bantuan

Kirim:

- screenshot error;
- versi BMP Terbuka;
- Android atau Desktop;
- browser;
- Kode BMP bila relevan untuk bug proses;
- modul/range yang bermasalah;
- tahap saat masalah muncul.

Jangan kirim credential atau data rahasia.

## Masih Belum Selesai?

Gunakan [Bot & Komunitas](bot) untuk meminta bantuan.

Kalau jawaban bot berbeda dengan dokumentasi atau halaman Status, gunakan dokumentasi dan Status sebagai acuan utama lalu laporkan perbedaannya.
