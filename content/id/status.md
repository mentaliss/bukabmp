# Status & Versi BMP Terbuka

Halaman ini adalah acuan untuk **versi stabil, jalur instalasi, dan status kompatibilitas** yang dapat berubah dari waktu ke waktu.

Kalau informasi versi atau Store di halaman lain berbeda dengan halaman ini, gunakan halaman Status ini sebagai acuan dan laporkan perbedaannya.

## Versi Stabil Saat Ini

**BMP Terbuka v1.1.0**

Release date: **23 September 2026**

GitHub Release:

https://github.com/mentaliss/bukabmp/releases/latest

## Android

### Browser Utama

**Microsoft Edge Stable**

### Jalur Instalasi

**Microsoft Edge Add-ons**

https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm

### Status

Jalur Edge Stable + Edge Add-ons adalah jalur utama Android untuk v1.1.0.

Edge Canary hanya fallback/testing dan bukan jalur default.

Chrome Android bukan target instalasi resmi BMP Terbuka.

## Desktop — Microsoft Edge

### Jalur Instalasi

**Microsoft Edge Add-ons**

https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm

### Status

Microsoft Edge adalah target desktop resmi BMP Terbuka.

Release stabil produk saat ini adalah v1.1.0. Ketersediaan/update package melalui Store tetap mengikuti mekanisme review dan propagasi Microsoft.

## Desktop — Google Chrome

### Versi Stabil

**v1.1.0 melalui package manual GitHub Release**

### Chrome Web Store

**Belum tersedia sebagai jalur instalasi aktif.**

Pengguna Chrome desktop saat ini harus menggunakan asset ZIP release resmi dan memasangnya melalui Developer mode + Load unpacked.

Panduan lengkap ada di [Instalasi & Update](docs/install).

## GitHub / Instalasi Manual

### Status

**Tersedia**

### Versi

**v1.1.0**

Gunakan asset:

`BMP-Terbuka-v1.1.0.zip`

Jangan gunakan asset otomatis **Source code (zip)** sebagai package extension.

Release:

https://github.com/mentaliss/bukabmp/releases/latest

## Firefox

**Belum didukung resmi.**

Gunakan Google Chrome atau Microsoft Edge untuk desktop.

## Browser Chromium Lain

Bukan target dukungan resmi utama.

Package manual dapat bergantung pada kompatibilitas Manifest V3 dan kemampuan Load unpacked browser tersebut. Pengujian dan dokumentasi utama berfokus pada Google Chrome dan Microsoft Edge.

## Reader yang Didukung

Adapter publik BMP Terbuka V1 saat ini ditujukan untuk reader:

`https://pustaka.ut.ac.id/reader/`

Pencantuman kompatibilitas tidak berarti afiliasi, dukungan resmi, atau endorsement dari pemilik layanan.

## Aktivasi

Token aktivasi komunitas normal memiliki masa berlaku terbatas dengan basis **14 hari**.

v1.1.0 menggunakan skema token baru dan mendukung refresh untuk kondisi yang memenuhi syarat. Bila refresh tidak tersedia, extension dapat meminta re-verification.

Aktivasi kedaluwarsa tidak mengharuskan install ulang.

## Minimum Version

Kebijakan minimum version dapat berubah melalui runtime policy.

Kalau suatu versi sudah tidak didukung untuk memulai proses atau membuat aktivasi baru, extension akan menampilkan pemberitahuan update.

Jangan menebak minimum version dari nomor release lama; ikuti pesan extension dan status runtime.

## Tutorial Video

Video penggunaan yang tersedia saat ini masih bertanda **v1.0.4**:

Android:

https://t.me/bukabmp/11?comment=294

Desktop:

https://t.me/c/4381494564/18

Gunakan dokumentasi website untuk perilaku v1.1.0 yang terbaru.

## Sumber Informasi

Untuk pengguna:

- halaman Status ini untuk fakta yang berubah;
- [Instalasi & Update](docs/install) untuk langkah pemasangan;
- [Aktivasi & Verifikasi](docs/activation) untuk aktivasi;
- [Cara Menggunakan](docs/usage) untuk penggunaan;
- [Mengatasi Masalah](docs/troubleshooting) untuk error.

Untuk riwayat perubahan teknis, lihat Release Notes/Changelog di repository publik.

## Terakhir Diperbarui

**24 September 2026**
