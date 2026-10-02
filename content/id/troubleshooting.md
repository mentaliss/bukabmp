# Mengatasi Masalah

Jangan langsung uninstall, menghapus storage, atau mengulang seluruh BMP. Banyak masalah bisa diperiksa tanpa membuang hasil yang sudah selesai.

## Sebelum Memperbaiki

Catat:

- versi BMP Terbuka;
- Android atau Desktop;
- browser;
- Kode BMP;
- modul/range;
- tahap terakhir;
- teks error;
- screenshot bila ada.

Jangan kirim password, NIM, cookie, session, token, OTP, atau credential lain.

## Failed to Fetch / Reader Error

Pastikan reader dapat dibuka normal, login masih valid, Kode BMP sesuai URL, dan tab reader yang benar tersedia.

Kalau sumber memberi Request Rejected, 403, 429, atau meminta login ulang, jangan melakukan retry agresif atau teknik bypass. Pulihkan akses normal ke sumber terlebih dahulu.

## Proses Berhenti di Tengah

Jangan mulai dari nol. Modul yang sudah selesai dan tersimpan dapat dipakai untuk resume.

Kalau satu modul tertentu bermasalah, proses/download ulang hanya range yang diperlukan.

## PDF Gabungan Gagal

Periksa gap. Semua modul dalam range target harus tersedia. Jika M5 hilang dari M3–M6, selesaikan M5 dulu.

## File Downloads Hilang

Kalau data modul masih ada di storage extension, export ulang. Tidak perlu OCR ulang hanya karena salinan Downloads terhapus.

## Backup

Kalau backup gagal:

- pastikan tidak ada operasi data lokal lain yang sedang berjalan;
- jangan tutup popup selama backup masih diproses;
- coba lagi setelah operasi sebelumnya selesai;
- jangan hapus storage sebelum kamu yakin backup yang dibutuhkan sudah aman.

Backup dapat mengandung data belajar/material lokal. Jangan kirim file backup ke group atau bot.

## Restore Desktop

Di Desktop, **Pulihkan backup** membuka file picker dari popup.

Kalau file tidak dapat dipilih, reload extension dan pastikan kamu memakai v1.2.0 sebelum mencoba langkah destruktif lain.

## Restore Edge Android

Di Edge Android, file picker **tidak** dibuka dari popup.

Gunakan:

**Pulihkan backup → tab restore BMP Terbuka → pilih file di tab tersebut.**

Biarkan tab restore tetap terbuka. Menutup tab saat restore berjalan menghentikan proses.

Kalau menekan Pulihkan backup hanya memfokuskan tab restore yang sudah ada, gunakan tab tersebut—jangan membuka banyak tab restore.

## Restore tidak menghapus data lain

Restore memakai MERGE. Data backup dipulihkan dan item yang cocok dapat diperbarui, tetapi data lokal lain yang tidak terkait tidak otomatis dihapus.

## Setelah Update Ada Masalah

Sebelum uninstall:

1. cek versi;
2. reload extension;
3. buka ulang popup;
4. pastikan package terbaru benar-benar terpasang;
5. jangan menghapus storage sebelum memastikan data lokal memang penyebabnya.

## Quiz Telegram

Kalau tombol Quiz belum siap, pastikan modul sudah selesai diproses dan source Quiz lokal tersedia. Untuk bank yang sudah ada, Quiz dapat memakai kembali bank tersebut tanpa membuat ulang materi.

Kalau Telegram Quiz bermasalah, laporkan Kode BMP, modul, tahap status, dan screenshot tanpa membagikan PDF/material.

## Masih Belum Selesai?

Gunakan [Bot & Komunitas](bot). Dokumentasi website dan halaman Status tetap menjadi acuan utama.
