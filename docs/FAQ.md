# FAQ

Untuk fakta yang dapat berubah seperti versi dan status Store, gunakan [Status & Versi](https://mentaliss.github.io/bukabmp/id/status/) sebagai acuan utama.

## Versi & Download

### Versi terbaru berapa?

Release stabil produk saat ini adalah **BMP Terbuka v1.2.0**.

Chrome Desktop dapat memakai package manual resmi `BMP-Terbuka-v1.2.0.zip` dari GitHub Release.

Untuk Edge Desktop/Android, jalur resmi tetap Microsoft Edge Add-ons. **BMP Terbuka v1.2.0 sekarang sudah live di listing resmi Microsoft Edge Add-ons.**

### Di mana update?

Gunakan halaman website:

https://mentaliss.github.io/bukabmp/id/download/

Website ini menjadi tujuan update utama dan menjelaskan jalur sesuai platform.

## Instalasi

### Chrome Desktop

Download ZIP release resmi, extract, buka `chrome://extensions`, aktifkan Developer mode, lalu **Load unpacked** dari folder yang berisi `manifest.json`.

Jangan gunakan GitHub **Source code (zip)**.

### Edge Android/Desktop

Gunakan listing resmi Microsoft Edge Add-ons:

https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm

Edge Canary hanya fallback/testing. Chrome Android bukan target instalasi resmi.

## Backup & Restore

### Apa isi Backup?

Backup dibuat untuk pemulihan data lokal BMP Terbuka dan dapat mengandung data belajar/material yang tersimpan lokal. Simpan secara privat dan jangan kirim file backup ke group/bot.

### Apakah Restore menghapus data lokal lain?

Tidak secara otomatis.

Restore memakai **MERGE**:
- data backup dipulihkan;
- item lokal yang cocok dapat diperbarui;
- data lokal lain yang tidak terkait tidak otomatis dihapus.

### Bagaimana Restore di Android?

Pada Edge Android v1.2.0:

**Pulihkan backup → tab restore BMP Terbuka → pilih file → restore berjalan di tab tersebut.**

Biarkan tab restore terbuka sampai selesai. Menutupnya ketika proses berjalan menghentikan restore.

### Desktop?

Desktop tetap memilih file restore langsung dari popup.

## Penyimpanan

Storage Manager membantu melihat penggunaan storage, mengelola data BMP lokal, export/reuse data yang didukung, menghapus data per BMP, dan menghapus seluruh data lokal bila memang diinginkan.

Buat backup dulu sebelum penghapusan destruktif jika datanya masih dibutuhkan.

## Quiz Telegram

### Cara mulai?

Setelah modul diproses dan source Quiz lokal tersedia:

**pilih modul → Mulai Quiz Telegram → lanjutkan di Telegram.**

### Apakah PDF dikirim ke server untuk Quiz?

Raw PDF dan gambar halaman tidak diunggah untuk pembuatan Quiz.

Source Quiz berasal dari teks yang diekstrak dan disanitasi secara lokal. Saat bank perlu dibuat, teks yang sudah disanitasi dapat dipakai oleh generation flow. Source teks asli tidak disimpan server-side sebagai salinan materi sumber setelah flow generation.

## Privasi

OCR/PDF utama diproses local-first. Extension tetap memakai jaringan untuk aktivasi, version state, telemetry pseudonymous, sponsor metrics terbatas, Supporter/payment, Telegram/community, dan Quiz yang memang memerlukan backend.

Jangan kirim password, NIM, OTP, cookie/session, activation secret, API key, file backup, atau materi yang tidak boleh didistribusikan.

## Komunitas

Group Terbuka adalah:

**Playground komunitas buat ngobrol, saling bantu, berbagi, ikut aktivitas, bahas tools, belajar, dan lainnya.**

Channel: https://t.me/bukabmp

Group: https://t.me/+0pAg9ymEhWdkZmNl

Bot: https://t.me/bukabmp_bot

## Troubleshooting

Jangan uninstall atau hapus storage sebagai langkah pertama. Catat versi, platform/browser, Kode BMP, modul/range, tahap terakhir, error, dan screenshot yang sudah dibersihkan dari data sensitif.

Panduan lengkap:

https://mentaliss.github.io/bukabmp/id/docs/troubleshooting/
