# Troubleshooting

## bmp-not-found
order: 33
title: "BMP/modul tidak muncul"
aliases: ["bmp ga muncul","bmp tidak muncul","modul tidak tersedia","modul ga muncul"]
keywords: ["bmp","modul","tidak tersedia","ga muncul"]

Paling sering karena Kode BMP salah atau range modul yang dipilih tidak tersedia. Buka BMP tersebut di reader, salin nilai ?modul= dari URL, lalu pastikan modulnya memang bisa dibuka dengan akunmu.

## wrong-code
order: 34
title: "Salah Kode BMP"
aliases: ["salah kode","kode salah","invalid kode bmp"]
keywords: ["kode","salah","invalid"]

Kalau Kode BMP salah, extension tidak bisa menemukan modul yang dimaksud. Ambil ulang Kode BMP langsung dari URL reader RBV.

## interrupted-module
order: 38
title: "Proses terputus di tengah modul"
aliases: ["browser ketutup","edge ketutup","chrome ketutup","mati di tengah modul","proses terhenti tengah"]
keywords: ["terhenti","ketutup","tengah modul"]

Yang aman untuk resume adalah modul yang sudah selesai dan sudah tersimpan lokal. Kalau proses terputus saat satu modul belum selesai, modul yang sedang berjalan itu mungkin perlu diproses lagi.

## deleted-download
order: 41
title: "File Downloads terhapus"
aliases: ["file kehapus bisa download ulang","pdf kehapus","file download kehapus","hapus file downloads"]
keywords: ["file kehapus","pdf kehapus","download ulang","export"]

Bisa. Kalau PDF modul masih ada di penyimpanan lokal extension, tinggal ekspor ulang dan hasilnya praktis instan karena tidak perlu OCR lagi.

## deleted-local-storage
order: 42
title: "Penyimpanan lokal terhapus"
aliases: ["cache kehapus","storage kehapus","penyimpanan lokal kehapus"]
keywords: ["cache kehapus","storage kehapus"]

Kalau data penyimpanan lokal extension sudah dihapus dan file itu tidak lagi ada sebagai cache BMP, fitur resume/export instan tidak punya sumber lokal lagi. Modul tersebut perlu diproses ulang bila dibutuhkan.

## merge-gap
order: 58
title: "Merge gagal karena ada gap"
aliases: ["pdf gabungan tidak jadi","merge tidak jadi","ada gap","modul bolong"]
keywords: ["merge","gap","bolong","tidak jadi"]

Kalau ada modul yang belum tersedia dalam range yang dipilih, PDF gabungan tidak dibuat sampai range tersebut lengkap. Ini sengaja supaya modul yang hilang tidak diam-diam dilewati.

## deleted-download-merge
order: 60
title: "File Downloads hilang tapi mau merge"
aliases: ["file download kehapus masih bisa merge","pdf downloads hilang gabung"]
keywords: ["downloads","kehapus","merge"]

Kalau modulnya masih ada di penyimpanan lokal extension, file Downloads yang terhapus tidak menghalangi merge. Merge memakai data lokal extension.

## 403
order: 64
title: "Error 403"
aliases: ["403","forbidden"]
keywords: ["403","forbidden"]

Kalau reader memberi 403, BMP Terbuka berhenti. Selesaikan login/akses melalui mekanisme normal sumber lalu coba lagi; bot tidak memberi cara bypass.

## 429
order: 65
title: "Error 429"
aliases: ["429","too many requests"]
keywords: ["429","rate limit"]

Kalau reader memberi 429, BMP Terbuka safe-stop dan tidak melakukan blind retry. Tunggu kondisi akses normal lalu coba lagi.

## request-rejected
order: 66
title: "Request Rejected"
aliases: ["request rejected","support id"]
keywords: ["request rejected","support id"]

Kalau muncul Request Rejected, proses sengaja berhenti. Jangan mencoba bypass/stealth; selesaikan akses secara normal dan coba lagi nanti.

## login-redirect
order: 67
title: "Minta login ulang"
aliases: ["login ulang","ke halaman login","session habis"]
keywords: ["login ulang","session","login"]

Kalau reader mengarahkan ke login ulang atau sesi habis, login kembali secara normal di reader lalu mulai lagi. Modul yang sudah selesai dan masih tersimpan lokal tetap bisa dipakai untuk resume.

## safe-stop
order: 68
title: "Kenapa tidak retry otomatis"
aliases: ["kenapa berhenti","kok ga retry","retry otomatis"]
keywords: ["retry","berhenti","safe stop"]

Safe-stop memang desain BMP Terbuka saat sumber menolak akses. Extension tidak melakukan blind retry terhadap 403/429/login/Request Rejected.

## no-bypass
order: 69
title: "Bypass blokir"
aliases: ["bypass waf","bypass blokir","stealth","spoof cookie"]
keywords: ["bypass","waf","stealth","spoof"]

BMP Terbuka tidak menyediakan teknik bypass WAF/blokir, stealth, spoofing cookie/token, IP rotation, atau cara memaksa akses yang ditolak sumber.
