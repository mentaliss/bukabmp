# Aktivasi & Verifikasi

BMP Terbuka menggunakan aktivasi komunitas untuk menghubungkan pengguna dengan jalur update, security notice, support, dan komunitas.

Aktivasi tidak meminta password atau credential portal reader.

## Aktivasi Pertama Kali

Aktivasi dimulai dari popup BMP Terbuka.

### 1. Buka Extension

Setelah BMP Terbuka terpasang, buka popup extension.

Kalau belum aktif, extension akan menampilkan alur aktivasi/verifikasi.

### 2. Mulai Verifikasi Telegram

Tekan tombol aktivasi dari extension.

Extension akan membuka bot Telegram dengan kode pairing sementara.

Kode tersebut menghubungkan instalasi extension dengan proses verifikasi. Jangan membagikan kode aktivasi kepada orang lain.

### 3. Selesaikan Pemeriksaan Komunitas

Bot dapat meminta kamu memastikan keanggotaan pada channel/group yang dibutuhkan.

Ikuti petunjuk bot sampai verifikasi selesai.

### 4. Kembali ke Extension

Setelah bot menyatakan verifikasi berhasil, kembali ke browser dan buka popup BMP Terbuka.

Extension memeriksa hasil pairing secara otomatis.

Kalau status belum berubah, beri waktu sebentar lalu buka ulang popup. Jangan langsung uninstall extension.

## Kalau Telegram Tidak Membawa Kode

Kalau deep-link Telegram terbuka tetapi kode tidak ikut terbawa:

1. kembali ke popup extension;
2. salin kode aktivasi yang ditampilkan;
3. buka bot BMP Terbuka;
4. gunakan jalur verifikasi manual yang ditampilkan oleh extension/bot.

Jangan mengetik kode aktivasi milik orang lain.

## Masa Berlaku Aktivasi

Token aktivasi komunitas normal memiliki masa berlaku terbatas. Jalur release BMP Terbuka saat ini menggunakan masa aktivasi dasar sekitar **14 hari**.

Tujuannya bukan memaksa pengguna install ulang, tetapi memastikan status akses dapat diperbarui dari waktu ke waktu.

## Kalau Aktivasi Kedaluwarsa

Kamu **tidak perlu install ulang BMP Terbuka**.

Yang perlu dilakukan adalah memperbarui atau memverifikasi akses bila extension memintanya.

Pada v1.1.0, token aktivasi generasi baru mendukung refresh untuk kondisi yang memenuhi syarat. Kalau refresh tidak dapat dilakukan, extension dapat meminta verifikasi ulang melalui Telegram.

## Verifikasi Ulang

Verifikasi ulang digunakan bila:

- token sudah kedaluwarsa;
- token lama perlu dipindahkan ke skema token baru;
- status komunitas perlu dicek lagi;
- extension memang meminta proses verifikasi.

Untuk migrasi token lama ke token v1.1.0, proses re-verification dirancang agar token aktif yang masih valid tidak langsung dibuang sebelum replacement tervalidasi.

## Aktivasi Setelah Update

Update normal tidak seharusnya membuat kamu menghapus extension.

Kalau extension yang sama diperbarui in-place dan penyimpanan browser tetap ada, token serta state lokal biasanya tetap tersedia.

Kalau kamu uninstall, memasang identity extension yang berbeda, atau menghapus storage browser, instalasi dapat dianggap baru dan perlu aktivasi lagi.

## Aktivasi dan Supporter Pass

Supporter Pass tidak wajib untuk menggunakan fitur inti BMP Terbuka.

Setiap pembayaran Supporter memberi bonus target masa aktivasi **+14 hari**, dengan batas maksimum target aktivasi **60 hari**.

Pada v1.1.0, status Supporter dapat disinkronkan melalui mekanisme token/refresh yang didukung. Token yang sudah tersimpan di perangkat tidak selalu berubah pada detik yang sama dengan pembayaran; entitlement baru diterapkan saat refresh atau penerbitan token berikutnya berhasil.

Detail paket dan aturan pembayaran ada di [Supporter Pass](supporter).

## Kalau Aktivasi Gagal

### Kode Kedaluwarsa

Kode pairing bersifat sementara.

Kalau terlalu lama atau dinyatakan expired, mulai lagi dari popup extension untuk membuat sesi baru.

### Telegram Tidak Terbuka

Salin kode dari popup bila opsi tersebut tersedia, lalu buka bot secara manual.

Bot resmi:

https://t.me/bukabmp_bot

### Sudah Join tapi Belum Terdeteksi

Pastikan kamu join menggunakan akun Telegram yang sama dengan akun yang melakukan verifikasi.

Setelah join, kembali ke bot dan ulangi pemeriksaan yang tersedia. Bila tetap gagal, jangan keluar-masuk group berulang kali; minta bantuan dengan menyebutkan tahap yang gagal.

### Bot Bilang Berhasil tapi Extension Belum Aktif

Coba:

1. kembali ke browser;
2. buka ulang popup;
3. pastikan koneksi internet tersedia;
4. tunggu pemeriksaan pairing selesai;
5. bila status tetap tidak berubah, buat laporan masalah.

### Extension Meminta Verifikasi Lagi

Ini tidak berarti extension harus diinstall ulang.

Selesaikan re-verification dari popup. Kalau kejadian berulang dalam waktu singkat, laporkan versi extension, browser, platform, dan screenshot pesan yang tampil.

## Jangan Kirim Data Sensitif

Untuk bantuan aktivasi, jangan mengirim:

- password;
- OTP;
- cookie;
- session;
- activation token;
- pairing secret;
- credential lain;
- NIM bila tidak benar-benar diperlukan.

Bot atau admin tidak perlu menerima credential portal reader untuk memperbaiki aktivasi BMP Terbuka.

## Masih Bermasalah?

Lihat [Mengatasi Masalah](troubleshooting) atau gunakan jalur bantuan di [Bot & Komunitas](bot).
