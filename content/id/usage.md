# Cara Menggunakan BMP Terbuka

## Alur Utama

1. login ke reader menggunakan akun kamu sendiri;
2. buka BMP yang memang dapat kamu akses;
3. buka popup BMP Terbuka;
4. masukkan Kode BMP dari parameter `modul=` pada URL reader;
5. pilih range modul;
6. tekan **Mulai**;
7. tunggu proses lokal selesai;
8. export PDF yang dibutuhkan.

BMP Terbuka tidak memberi akses baru ke materi. Extension bekerja menggunakan sesi browser yang sudah memiliki akses normal.

## Saat Proses Berjalan

Untuk setiap modul, BMP Terbuka mengambil resource yang tersedia pada sesi reader, memproses halaman di perangkat, menjalankan OCR lokal, membentuk PDF, lalu menyimpan hasil modul ke storage lokal.

Kalau sumber menolak akses atau meminta login ulang, proses berhenti dengan aman.

## Resume

Modul yang sudah selesai dan tersimpan tidak perlu diproses ulang.

Contoh: M1–M4 selesai dari target M1–M9. Saat dilanjutkan, BMP Terbuka dapat memakai M1–M4 yang sudah ada dan meneruskan modul berikutnya.

## Download Ulang

Kalau satu modul perlu dibuat ulang, gunakan download ulang hanya untuk range yang bermasalah. Jangan hapus seluruh storage bila masalah hanya terjadi pada satu modul.

## Setelah Selesai

Kamu dapat:

- export PDF per modul;
- export ulang dari storage;
- membuat PDF gabungan dari range yang lengkap;
- membuat backup data lokal;
- mengelola penyimpanan;
- memulai Quiz Telegram dari modul yang sudah siap.

## Mulai Quiz Telegram

Untuk modul yang sudah diproses dan source Quiz lokalnya tersedia:

1. pilih modul pada bagian Quiz;
2. tekan **Mulai Quiz Telegram**;
3. lanjutkan ronde di Telegram.

Untuk privasi Quiz, PDF mentah dan gambar halaman tidak dikirim. Source Quiz berasal dari teks yang diekstrak dan disanitasi secara lokal.

## Backup & Restore

Gunakan Backup bila kamu ingin menyimpan data lokal sebelum penghapusan, pindah perangkat, atau perubahan lain.

Restore memakai MERGE dan tidak otomatis menghapus data lokal lain yang tidak terkait. Detail: [PDF, Backup, Restore & Penyimpanan](files).

## Kalau Terjadi Error

Catat versi, browser/perangkat, Kode BMP, modul/range, tahap terakhir, dan teks error. Jangan kirim password, NIM, cookie, session, atau credential lain.

Lanjutkan ke [Mengatasi Masalah](troubleshooting).
