# PDF, Backup, Restore & Penyimpanan

BMP Terbuka menyimpan hasil tertentu secara lokal agar proses dapat dilanjutkan tanpa mengulang OCR yang tidak perlu.

## Penyimpanan Lokal

Data lokal dapat dipakai untuk:

- resume proses;
- melewati modul yang sudah selesai;
- export ulang;
- membuat PDF gabungan;
- menjalankan fitur lain yang membutuhkan data modul lokal.

File di folder Downloads adalah **salinan hasil export**. Menghapus file Downloads tidak otomatis menghapus data yang masih tersimpan di extension.

## Storage Manager

Di v1.2.0 kamu dapat menggunakan pengelolaan penyimpanan untuk:

- melihat penggunaan storage lokal;
- melihat data BMP yang tersedia;
- export/reuse data yang didukung;
- menghapus data per BMP;
- menghapus seluruh data lokal bila memang diinginkan.

Sebelum penghapusan yang destruktif, buat backup bila data tersebut masih diperlukan.

## PDF per Modul & Export Ulang

Modul yang sudah selesai dapat diexport lagi tanpa mengulang OCR selama data lokalnya masih tersedia.

## PDF Gabungan

PDF gabungan hanya dibuat dari range yang lengkap.

Contoh: M3, M4, dan M6 tersedia tetapi M5 hilang. Range M3–M6 belum lengkap. Proses ulang M5 dulu, lalu buat PDF gabungan lagi.

## Resume

Kalau M1–M4 sudah selesai dan tersimpan, menjalankan kembali M1–M9 dapat melewati M1–M4 dan melanjutkan modul yang belum tersedia.

## Backup

Backup menyimpan data lokal BMP Terbuka untuk **pemulihan pribadi**.

File backup dapat memuat data belajar/material yang tersimpan lokal. Karena itu:

- simpan backup di tempat yang kamu percaya;
- jangan membagikannya sembarangan;
- perlakukan backup seperti data pribadi milikmu sendiri.

## Restore = MERGE

Restore **bukan** “reset semua data” dan bukan “replace seluruh database”.

Perilakunya:

- data dari backup dipulihkan;
- item lokal yang cocok dapat diperbarui oleh isi backup;
- data lokal lain yang tidak terkait tidak otomatis dihapus.

Setelah restore selesai, cek data yang tersedia sebelum melakukan penghapusan manual.

## Restore di Desktop

Di Desktop, tekan **Pulihkan backup** dari popup lalu pilih file backup melalui file picker.

## Restore di Edge Android

Di Edge Android:

**Pulihkan backup → tab restore BMP Terbuka → pilih file → restore berjalan di tab itu.**

Biarkan tab tersebut terbuka sampai selesai. Menutup tab restore saat proses berjalan akan menghentikan proses.

## Pindah Browser/Perangkat

Storage tidak otomatis berpindah antara Chrome dan Edge, perangkat berbeda, profil berbeda, atau instalasi extension dengan identity berbeda.

Gunakan backup bila kamu perlu menyimpan data lokal sebelum perubahan besar.

## Kalau Data Sudah Dihapus

Data yang sudah dihapus dari storage extension tidak dapat dipakai lagi untuk resume/export instan. Modul perlu diproses ulang bila sumber lokalnya tidak ada lagi.

Untuk diagnosis, buka [Mengatasi Masalah](troubleshooting).
