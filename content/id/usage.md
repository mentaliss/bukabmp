# Cara Menggunakan BMP Terbuka

Halaman ini menjelaskan alur penggunaan BMP Terbuka setelah extension terpasang dan aktivasi sudah selesai.

Kalau belum install, mulai dari [Instalasi & Update](install). Kalau belum aktif, buka [Aktivasi & Verifikasi](activation).

## Alur Singkat

Secara umum:

1. login ke reader menggunakan akun kamu sendiri;
2. buka BMP yang ingin diproses;
3. buka popup BMP Terbuka;
4. masukkan Kode BMP;
5. pilih range modul;
6. tekan Mulai;
7. tunggu modul diproses;
8. export PDF yang dibutuhkan.

BMP Terbuka tidak memberi akses baru ke materi. Extension bekerja menggunakan sesi browser yang memang sudah memiliki akses.

## Membuka Reader yang Benar

Login ke portal reader melalui mekanisme normal sumber.

Setelah login, buka BMP yang ingin kamu gunakan sampai halaman reader dapat dibaca secara normal.

Jangan mengirim password, NIM, cookie, atau session ke bot BMP Terbuka.

## Menemukan Kode BMP

Kode BMP diambil dari parameter `modul` pada URL reader.

Contoh pola URL:

`.../reader/index.php?modul=XXXX...`

Nilai setelah `modul=` itulah yang digunakan sebagai Kode BMP.

### Kode BMP Bukan Selalu Kode Mata Kuliah

Jangan menebak Kode BMP hanya dari kode mata kuliah.

Kalau mata kuliah memiliki edisi atau struktur reader berbeda, nilai yang digunakan extension tetap harus mengikuti URL reader yang sedang dibuka.

### Kalau Ragu

Buka kembali BMP yang benar di reader, lihat URL tab aktif, lalu ambil nilai `modul=`.

## Memilih Range Modul

BMP Terbuka dapat memproses seluruh BMP atau sebagian range.

Contoh:

- `M1–M9`: modul 1 sampai 9;
- `M3–M6`: modul 3 sampai 6;
- `M2`: hanya modul 2 jika UI mendukung pilihan tersebut melalui range yang sesuai.

Pilih range sesuai kebutuhan. Memproses ulang seluruh BMP tidak diperlukan kalau masalah hanya terjadi pada satu atau dua modul.

## Memulai Proses

Sebelum menekan **Mulai**:

- pastikan tab reader masih tersedia;
- pastikan Kode BMP benar;
- pastikan range modul benar;
- pastikan aktivasi masih valid.

Setelah menekan **Mulai**, extension mengerjakan modul secara berurutan.

## Apa yang Terjadi Saat Proses Berjalan

Untuk setiap modul, BMP Terbuka:

- meminta halaman yang memang tersedia pada sesi reader;
- memproses halaman di perangkat;
- menjalankan OCR lokal;
- membentuk PDF;
- menyimpan hasil modul ke penyimpanan lokal extension;
- melanjutkan ke modul berikutnya.

Kalau sumber menolak akses atau meminta login ulang, extension dirancang untuk berhenti dengan aman daripada melakukan blind retry.

## Progress

Progress dapat berubah dari tahap membuka modul, memproses halaman, OCR, sampai menyimpan hasil.

Kalau terlihat berhenti, catat tahap terakhir sebelum melakukan tindakan lain.

Jangan langsung menghapus storage karena storage tersebut dapat berisi modul yang sudah selesai dan berguna untuk resume.

## Modul Diproses Satu per Satu

Kalau kamu memilih M1–M9, bukan berarti sembilan PDF muncul sekaligus.

Extension menyelesaikan modul secara berurutan. Modul yang selesai disimpan sebelum melanjutkan ke modul berikutnya.

Karena itu, kalau proses berhenti setelah M4, hasil M1–M4 yang sudah lengkap dapat tetap tersedia di penyimpanan lokal.

## Melanjutkan Proses

Resume adalah perilaku normal BMP Terbuka.

Contoh:

- kamu memilih M1–M9;
- proses selesai sampai M4;
- browser tertutup atau proses berhenti;
- kamu membuka kembali BMP yang sama;
- jalankan M1–M9 lagi.

Kalau M1–M4 masih lengkap di storage lokal, extension melewati modul tersebut dan melanjutkan modul yang belum tersedia.

Kamu tidak perlu mengulang OCR dari M1 hanya karena proses sebelumnya terputus.

## Download Ulang Modul Tertentu

Gunakan **Download ulang modul yang dipilih** kalau hasil modul tertentu perlu dibuat ulang.

Contoh:

- M1–M9 sudah pernah diproses;
- M5 bermasalah;
- pilih range yang mencakup M5;
- aktifkan opsi download ulang;
- proses ulang hanya bagian yang dibutuhkan.

Jangan menghapus seluruh penyimpanan BMP hanya untuk memperbaiki satu modul.

## Kalau Ada Modul yang Belum Lengkap

Modul yang belum lengkap tidak dianggap selesai.

Kalau sebuah range untuk PDF gabungan memiliki gap, BMP Terbuka tidak seharusnya diam-diam membuat hasil gabungan yang kehilangan modul tersebut.

Proses atau download ulang modul yang hilang dulu, lalu coba merge kembali.

## Setelah Proses Selesai

Kamu dapat:

- export PDF per modul;
- memilih beberapa modul untuk export;
- membuat PDF gabungan untuk range yang lengkap;
- membuat PDF gabungan penuh bila seluruh modul yang diperlukan tersedia;
- export ulang dari storage tanpa OCR lagi.

Penjelasan lengkap ada di [PDF, Resume & Penyimpanan](files).

## Memproses BMP yang Berbeda

Storage dipisahkan berdasarkan BMP.

Saat beralih ke BMP lain:

1. buka reader BMP baru;
2. ambil Kode BMP dari URL reader BMP tersebut;
3. masukkan Kode BMP yang benar;
4. pilih range;
5. mulai proses.

Jangan menggunakan Kode BMP lama untuk reader yang berbeda.

## Kalau Terjadi Error

Catat:

- teks error;
- tahap saat error muncul;
- Kode BMP;
- modul/range;
- Android atau Desktop;
- browser;
- versi BMP Terbuka.

Lalu buka [Mengatasi Masalah](troubleshooting).
