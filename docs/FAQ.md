# FAQ

Halaman ini menjawab pertanyaan singkat yang paling sering muncul. Untuk langkah lengkap, gunakan halaman Panduan yang ditautkan pada jawaban.

Kalau informasi versi atau ketersediaan Store berubah, [Status & Versi](https://mentaliss.github.io/bukabmp/id/status/) menjadi acuan utama.

## Umum

### Apa itu BMP Terbuka?

BMP Terbuka adalah browser extension open-source yang membantu mengubah materi yang sudah dapat kamu akses melalui reader menjadi searchable PDF untuk belajar.

OCR, penyusunan PDF, cache, merge, dan export berjalan lokal di perangkat.

### Apakah BMP Terbuka produk resmi institusi?

Tidak.

BMP Terbuka adalah proyek komunitas independen. Dukungan terhadap reader atau platform tertentu tidak berarti afiliasi, endorsement, atau dukungan resmi dari pemilik layanan tersebut.

### Apakah BMP Terbuka gratis?

Fitur inti BMP Terbuka tetap gratis.

Supporter Pass tersedia sebagai dukungan digital opsional dan memberi benefit tambahan pada bot/support, bukan mengunci fungsi inti extension.

### Apakah perlu Python, BAT, atau Tesseract desktop?

Tidak.

Release resmi BMP Terbuka membawa OCR runtime yang dibutuhkan di dalam package extension.

### Versi terbaru sekarang berapa?

Release stabil saat ini adalah **v1.1.0**.

Karena status Store dan channel dapat berubah, cek [Status & Versi](https://mentaliss.github.io/bukabmp/id/status/) untuk detail terbaru.

## Instalasi & Browser

### Di mana download resmi BMP Terbuka?

Microsoft Edge Desktop dan Android menggunakan listing resmi Microsoft Edge Add-ons.

Google Chrome desktop saat ini menggunakan asset ZIP release resmi dari GitHub Releases.

Buka [Instalasi & Update](https://mentaliss.github.io/bukabmp/id/docs/install/) untuk langkah lengkap.

### Bagaimana cara install di Android?

Gunakan **Microsoft Edge Stable + Microsoft Edge Add-ons**.

Edge Canary hanya fallback/testing, bukan jalur utama.

### Bagaimana cara install di Microsoft Edge desktop?

Pasang BMP Terbuka melalui Microsoft Edge Add-ons, lalu buka popup extension dan selesaikan aktivasi.

### Bagaimana cara install di Google Chrome desktop?

Chrome Web Store belum menjadi jalur instalasi aktif BMP Terbuka.

Download asset ZIP release resmi, extract, buka `chrome://extensions`, aktifkan Developer mode, lalu pilih **Load unpacked** pada folder yang berisi `manifest.json`.

Jangan gunakan GitHub **Source code (zip)** sebagai package extension.

### Apakah Chrome Web Store sudah tersedia?

Belum sebagai jalur instalasi aktif.

Pengguna Chrome desktop saat ini menggunakan instalasi manual dari ZIP release resmi.

Cek [Status & Versi](https://mentaliss.github.io/bukabmp/id/status/) untuk status terbaru.

### Bisa pakai Firefox?

Belum didukung resmi.

Gunakan Google Chrome atau Microsoft Edge untuk desktop.

### Bisa pakai Chrome Android?

Chrome Android bukan target instalasi resmi BMP Terbuka saat ini.

Untuk Android gunakan Microsoft Edge Stable.

### Kenapa bukan Edge Canary lagi?

Jalur Android utama v1.1.0 adalah Microsoft Edge Stable + Microsoft Edge Add-ons.

Canary tetap dapat dipakai untuk fallback/testing bila memang diperlukan.

### Bagaimana cara update?

Instalasi dari Edge Add-ons mengikuti mekanisme update browser/store.

Instalasi manual Chrome diperbarui menggunakan package release baru lalu extension di-reload dari halaman `chrome://extensions`.

Jangan uninstall lebih dulu hanya untuk update normal.

### Kalau update, apakah data lokal hilang?

Update in-place dengan identity extension yang sama biasanya mempertahankan token, draft, dan storage lokal.

Uninstall, menghapus data browser, atau membuat instalasi dengan identity berbeda dapat menghilangkan storage lokal.

## Aktivasi

### Kenapa harus Telegram?

Community gate dipakai untuk menjaga jalur komunikasi terkait update kompatibilitas, security notice, support, dan diskusi.

Aktivasi dimulai dari extension dan dilanjutkan melalui bot Telegram.

### Berapa lama aktivasi berlaku?

Token aktivasi komunitas normal memiliki masa berlaku terbatas dengan basis sekitar **14 hari**.

v1.1.0 mendukung refresh untuk kondisi yang memenuhi syarat.

### Kalau aktivasi habis, apakah harus install ulang?

Tidak.

Verifikasi atau refresh aktivasi dilakukan tanpa reinstall. Kalau extension meminta re-verification, ikuti alur dari popup.

### Kenapa extension minta verifikasi lagi?

Kemungkinan karena token sudah kedaluwarsa, status perlu diperbarui, atau token lama perlu dipindahkan ke skema token yang lebih baru.

Re-verification tidak sama dengan install ulang.

### Telegram terbuka tapi kode tidak ikut terbawa. Bagaimana?

Kembali ke popup extension dan gunakan opsi salin kode bila tersedia, lalu ikuti jalur verifikasi manual yang ditampilkan bot/extension.

Jangan membagikan activation token atau pairing secret.

Baca [Aktivasi & Verifikasi](https://mentaliss.github.io/bukabmp/id/docs/activation/).

## Penggunaan

### Apa itu Kode BMP?

Kode BMP adalah nilai yang dipakai reader untuk mengidentifikasi BMP.

Nilainya diambil dari parameter `modul` pada URL reader dan tidak selalu sama dengan kode mata kuliah.

### Di mana menemukan Kode BMP?

Buka BMP yang benar di reader lalu lihat URL.

Gunakan nilai setelah `modul=`.

### Bisa memproses modul tertentu saja?

Bisa.

Pilih range yang dibutuhkan, misalnya M3–M6. Kamu tidak harus selalu memproses seluruh BMP.

### Kenapa PDF muncul satu per satu?

BMP Terbuka memproses modul secara berurutan.

Modul yang selesai disimpan sebelum extension melanjutkan ke modul berikutnya.

### Kalau proses berhenti, harus mulai dari awal?

Tidak selama modul yang sudah selesai masih tersedia di storage lokal extension.

Jalankan kembali range yang sama. Modul lengkap yang sudah tersimpan akan dilewati dan proses dapat dilanjutkan.

### Bisa download ulang satu modul saja?

Bisa.

Gunakan fitur download ulang untuk range/modul yang memang bermasalah. Jangan menghapus seluruh storage hanya untuk memperbaiki satu modul.

Baca [Cara Menggunakan BMP Terbuka](https://mentaliss.github.io/bukabmp/id/docs/usage/).

## PDF & Penyimpanan

### Apakah bisa membuat satu PDF gabungan?

Bisa jika range yang ingin digabung lengkap.

PDF gabungan bersifat opsional.

### Bisa gabungkan hanya M3–M6?

Bisa jika M3, M4, M5, dan M6 semuanya tersedia lengkap di storage.

### Kenapa PDF gabungan tidak dibuat?

Periksa apakah ada modul yang hilang di dalam range.

BMP Terbuka tidak membuat merge seolah-olah lengkap jika ada gap.

### File PDF di Downloads terhapus. Harus OCR ulang?

Tidak jika modul masih tersedia di storage lokal extension.

Gunakan export ulang.

### Apa bedanya Downloads dan storage extension?

File di Downloads adalah salinan hasil export.

Storage extension menyimpan data modul yang digunakan untuk resume, merge, dan export ulang.

Menghapus salah satunya tidak otomatis menghapus yang lain.

### Apa yang terjadi kalau saya hapus storage?

Data resume dan hasil modul lokal yang ada di storage tersebut dapat hilang.

File yang sudah diexport ke Downloads tidak ikut terhapus.

Baca [PDF, Resume & Penyimpanan](https://mentaliss.github.io/bukabmp/id/docs/files/).

## Error & Troubleshooting

### Failed to Fetch artinya apa?

Pesan tersebut dapat muncul di beberapa tahap, jadi tidak mempunyai satu diagnosis universal.

Catat apakah muncul saat aktivasi, saat menekan Mulai, atau ketika modul sedang diproses.

Buka [Mengatasi Masalah](https://mentaliss.github.io/bukabmp/id/docs/troubleshooting/) untuk langkah berdasarkan tahap.

### Request Rejected atau 403 muncul. Kenapa BMP Terbuka tidak retry terus?

BMP Terbuka tidak dirancang untuk memaksa melewati penolakan server.

Extension berhenti agar tidak melakukan blind retry atau teknik bypass.

### Muncul HTTP 429. Harus bagaimana?

Hentikan retry berulang dan tunggu sebelum mencoba lagi.

BMP Terbuka tidak menggunakan teknik untuk menghindari rate limiting.

### Modul tertentu tidak terdownload. Apa yang dilakukan?

Cek modul yang masih tersimpan, lalu proses/download ulang hanya range yang bermasalah.

Kalau modul selalu gagal pada titik yang sama, laporkan modul dan teks error terakhir.

### Reader minta login lagi. Apakah bot perlu password/NIM saya?

Tidak.

Login kembali melalui halaman resmi sumber menggunakan akun kamu sendiri. Jangan kirim password, NIM, cookie, atau session ke bot/admin.

## Privasi & Keamanan

### Apakah password atau NIM dikirim ke BMP Terbuka?

Tidak untuk flow extension.

Extension tidak meminta password/NIM portal sumber.

### Apakah materi, OCR, atau PDF diunggah ke backend?

Tidak untuk flow OCR/PDF.

Halaman materi, OCR, cache PDF, merge, dan export diproses di perangkat.

Extension tetap melakukan request jaringan untuk fungsi yang memang membutuhkan layanan eksternal seperti aktivasi, version/realtime state, telemetry pseudonymous, dan sponsor metrics terbatas.

### Apakah watermark dihapus?

Tidak.

BMP Terbuka mempertahankan watermark dari sumber.

### Data apa yang boleh saya kirim saat minta bantuan?

Kirim versi extension, platform/browser, tahap error, Kode BMP/modul bila relevan, teks error, dan screenshot yang sudah dibersihkan dari data sensitif.

Jangan kirim password, OTP, cookie, session, activation token, pairing secret, atau credential lain.

### Apakah sponsor dapat melihat data pengguna?

Sponsor/advertiser tidak mendapatkan akses ke identitas pribadi pengguna, activation identity, isi BMP/OCR/PDF, atau arbitrary tracking JavaScript.

Campaign kandidat saat ini bersifat contextual/non-personalized.

Baca Privacy Policy untuk detail lengkap.

## Bot & Komunitas

### Bagaimana cara bertanya ke bot di Group Terbuka?

Gunakan `/ask` diikuti pertanyaan, mention `@bukabmp_bot`, atau reply ke pesan bot.

Bot tidak dimaksudkan untuk menjawab seluruh percakapan group secara otomatis.

### Bot AI itu sumber kebenaran utama?

Tidak.

Website/docs dan halaman Status adalah acuan utama. AI membantu mencari/menjelaskan informasi dan dapat salah memahami pertanyaan.

Kalau jawaban AI berbeda dengan docs/Status, ikuti docs/Status dan laporkan perbedaannya.

### Berapa kuota AI reguler?

Konfigurasi bot saat ini menyediakan sampai **6 pertanyaan AI per hari** untuk jalur reguler.

Supporter aktif mendapat AI unlimited selama entitlement berlaku.

### Di mana join komunitas?

Channel Buka BMP:

https://t.me/bukabmp

Group Terbuka:

https://t.me/+0pAg9ymEhWdkZmNl

Bot:

https://t.me/bukabmp_bot

Baca [Bot & Komunitas](https://mentaliss.github.io/bukabmp/id/docs/bot/).

## Supporter Pass

### Apa itu Supporter Pass?

Supporter Pass adalah dukungan digital opsional. Fitur inti BMP Terbuka tetap gratis.

### Paketnya apa saja?

Saat ini:

- 2 Stars / 1 hari;
- 50 Stars / 30 hari.

Keduanya one-time, bukan subscription otomatis.

### Apa benefit Supporter?

Benefit saat ini mencakup DM bot + AI unlimited, priority support, konteks troubleshooting lebih panjang, tag group bila Telegram mendukung, Supporter Wall opsional, dan bonus target aktivasi.

### Pembayaran berhasil tapi Supporter belum aktif. Harus bayar lagi?

Tidak.

Jangan bayar ulang. Gunakan `/paysupport` dan jelaskan masalah transaksi.

Baca [BMP Supporter Pass](https://mentaliss.github.io/bukabmp/id/docs/supporter/).

## Open Source

### Apa yang open-source?

Browser extension, public tooling, dokumentasi publik, dan source website publik tersedia di repository BMP Terbuka.

Worker produksi, bot/backend, Control Center, private database/deployment material, secret, dan signing material privat tidak dipublikasikan.

### Boleh fork?

Source yang dipublikasikan di repository menggunakan **GPL-3.0**.

Fork dan modifikasi source mengikuti hak dan kewajiban lisensi tersebut. Nama, logo, dan branding BMP Terbuka tidak otomatis ikut dilisensikan sebagai trademark hanya karena source code menggunakan GPL.

Lihat halaman Open-source License, Trademark, dan Contributing sebelum mendistribusikan fork.

## Masih Tidak Menemukan Jawaban?

Mulai dari [Panduan BMP Terbuka](https://mentaliss.github.io/bukabmp/id/docs/) atau buka [Mengatasi Masalah](https://mentaliss.github.io/bukabmp/id/docs/troubleshooting/).
