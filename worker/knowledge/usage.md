# Usage

## code-from-url
order: 31
title: "Ambil Kode BMP"
aliases: ["kode bmp ambil dimana","cara cari kode bmp","ambil kode bmp"]
keywords: ["kode bmp","url","modul="]

Kode BMP diambil dari URL reader RBV, yaitu nilai setelah parameter ?modul=. Contoh ...index.php?modul=BING412102 berarti Kode BMP = BING412102.

## code-not-course
order: 32
title: "Kode BMP bukan kode mata kuliah"
aliases: ["kode bmp sama kode matkul","kode mata kuliah","kode matkul"]
keywords: ["kode bmp","kode matkul","mata kuliah"]

Kode BMP tidak selalu sama dengan kode mata kuliah. Gunakan nilai ?modul= dari URL reader, bukan menebak dari kode mata kuliah.

## range
order: 35
title: "Range modul"
aliases: ["modul pertama","modul terakhir","range modul","m1 m9"]
keywords: ["range","modul pertama","modul terakhir"]

Isi modul pertama dan modul terakhir sesuai range yang ingin diproses. Contoh 1 sampai 9 berarti M1–M9.

## active-tab
order: 36
title: "Tab aktif harus reader"
aliases: ["tab aktif","buka pustaka","buka reader dulu"]
keywords: ["tab","reader","pustaka"]

Jalankan extension saat tab aktif sedang membuka reader RBV yang didukung. Kalau belum membuka pustaka.ut.ac.id/reader/, extension tidak punya konteks halaman sumber untuk diproses.

## resume
order: 37
title: "Resume proses"
aliases: ["resume","lanjut proses","melanjutkan","ga ulang dari awal","tidak ulang dari awal"]
keywords: ["resume","lanjut","ocr ulang"]

Di v1.0.5, modul yang sudah selesai disimpan lokal. Saat dijalankan lagi, modul yang sudah tersedia dilewati otomatis sehingga tidak perlu OCR ulang dari awal.

## local-storage
order: 39
title: "Apa itu penyimpanan lokal"
aliases: ["apa itu penyimpanan lokal","cache itu apa","penyimpanan bmp"]
keywords: ["penyimpanan lokal","cache","storage"]

Penyimpanan lokal adalah salinan PDF modul hasil proses di dalam storage extension. Ini dipakai untuk resume, PDF gabungan, dan ekspor ulang tanpa OCR.

## storage-vs-downloads
order: 40
title: "Penyimpanan lokal vs Downloads"
aliases: ["beda cache dan download","penyimpanan lokal downloads","cache downloads"]
keywords: ["cache","downloads","penyimpanan lokal"]

Penyimpanan lokal extension berbeda dari folder Downloads. File di Downloads adalah hasil ekspor; storage extension adalah sumber lokal untuk resume/merge/export ulang.

## export-one
order: 43
title: "Ekspor satu modul"
aliases: ["export satu modul","download satu modul","ekspor satu"]
keywords: ["export","satu modul"]

Bisa. Buka pengelolaan penyimpanan lalu pilih modul yang sudah tersimpan untuk diekspor tanpa OCR ulang.

## export-multiple
order: 44
title: "Ekspor banyak modul"
aliases: ["export beberapa modul","download banyak modul","multi export","pilih semua"]
keywords: ["export","beberapa","banyak","pilih semua"]

Bisa pilih beberapa modul sekaligus untuk diekspor ulang dari penyimpanan lokal tanpa OCR ulang.

## export-instant
order: 45
title: "Ekspor ulang cepat"
aliases: ["export instan","download ulang instan","kenapa cepat export"]
keywords: ["export","instan","cepat"]

Ekspor ulang dari penyimpanan lokal tidak menjalankan OCR/source retrieval lagi, jadi biasanya jauh lebih cepat dibanding memproses modul dari awal.

## clear-storage
order: 46
title: "Hapus cache/penyimpanan lokal"
aliases: ["bisa hapus cache","hapus cache","hapus penyimpanan lokal","kosongkan penyimpanan"]
keywords: ["hapus cache","kosongkan","penyimpanan"]

Bisa. Gunakan “Kosongkan penyimpanan BMP ini” untuk menghapus data lokal hanya untuk Kode BMP yang sedang dipilih.

## clear-storage-downloads
order: 47
title: "Hapus storage apakah hapus Downloads"
aliases: ["hapus cache file downloads","kosongkan penyimpanan hapus pdf"]
keywords: ["hapus","downloads","penyimpanan"]

Tidak. Mengosongkan penyimpanan lokal BMP tidak menghapus PDF yang sudah tersimpan di folder Downloads.

## storage-per-code
order: 48
title: "Storage per Kode BMP"
aliases: ["cache campur","ganti kode bmp","penyimpanan per kode"]
keywords: ["cache","kode bmp","ganti kode"]

Penyimpanan disusun per Kode BMP. Modul dari Kode BMP lain tidak seharusnya dianggap sebagai modul untuk kode yang sedang dipilih.

## storage-size
order: 49
title: "Ukuran penyimpanan lokal"
aliases: ["berapa ukuran cache","storage besar","penyimpanan mb"]
keywords: ["ukuran","cache","storage","mb"]

Popup v1.0.5 menampilkan ringkasan ukuran data lokal untuk Kode BMP yang dipilih. Kalau tidak lagi dibutuhkan, storage BMP itu bisa dikosongkan tanpa menghapus file Downloads.

## rerun-complete
order: 50
title: "Jalankan range yang sudah lengkap"
aliases: ["semua sudah tersedia","range sudah lengkap","klik proses lagi"]
keywords: ["sudah tersedia","lengkap","range"]

Kalau semua modul dalam range sudah tersedia lokal dan kamu tidak memilih download ulang, v1.0.5 tidak perlu OCR ulang. Kamu bisa ekspor PDF yang ada atau membuat PDF gabungan bila diinginkan.

## missing-only
order: 51
title: "Hanya modul yang hilang diproses"
aliases: ["cuma modul belum ada","modul yang hilang","skip cached"]
keywords: ["modul hilang","belum ada","skip"]

Default v1.0.5 adalah resume: modul yang sudah tersimpan dilewati, dan hanya modul yang belum tersedia dalam range yang perlu diproses.

## redownload-selected
order: 52
title: "Download ulang range tertentu"
aliases: ["download ulang modul yang dipilih","redownload range","proses ulang range"]
keywords: ["download ulang","redownload","proses ulang"]

Centang “Download ulang modul yang dipilih” lalu atur range. Hanya modul dalam range tersebut yang diproses ulang.

## redownload-preserve
order: 53
title: "Redownload tidak hapus modul lain"
aliases: ["download ulang hapus yang lain","redownload hapus cache lain"]
keywords: ["redownload","hapus","modul lain"]

Tidak. Download ulang range tertentu tidak menghapus modul lain yang sudah tersimpan di Kode BMP tersebut.

## redownload-one
order: 54
title: "Download ulang satu modul"
aliases: ["download ulang m3","ulang satu modul","redownload satu modul"]
keywords: ["download ulang","satu modul"]

Bisa. Set modul pertama dan terakhir ke nomor yang sama, misalnya 3–3, lalu aktifkan “Download ulang modul yang dipilih”.

## merge-optional
order: 55
title: "PDF gabungan opsional"
aliases: ["harus buat pdf gabungan","merge wajib","pdf gabungan opsional"]
keywords: ["gabungan","opsional","merge"]

PDF gabungan di v1.0.5 bersifat opsional. Kalau cuma butuh PDF per modul, biarkan opsi “Buat PDF gabungan” tidak dicentang.

## merge-full
order: 56
title: "PDF gabungan FULL"
aliases: ["full pdf","gabungan full","full_searchable"]
keywords: ["full","gabungan","merge"]

PDF gabungan FULL bisa dibuat ketika set modul yang dibutuhkan sudah lengkap di penyimpanan lokal.

## merge-range
order: 57
title: "PDF gabungan range"
aliases: ["gabung m3 m6","merge range","pdf m3-m6"]
keywords: ["gabung","range","m3","m6"]

Bisa membuat PDF gabungan untuk range tertentu, misalnya M3–M6, selama semua modul dalam range itu tersedia lokal.

## merge-from-storage
order: 59
title: "Merge sumbernya storage"
aliases: ["merge dari downloads","gabungan dari download","merge cache"]
keywords: ["merge","downloads","storage"]

PDF gabungan dibangun dari PDF modul yang tersimpan lokal di extension, bukan dengan membaca file di folder Downloads.

## page-count
order: 61
title: "Berhenti di halaman terakhir"
aliases: ["halaman terakhir","page count","kelebihan halaman","page terakhir"]
keywords: ["halaman terakhir","page count"]

v1.0.5 memakai jumlah halaman yang dilaporkan reader bila tersedia, sehingga proses berhenti tepat di halaman terakhir dan tidak meminta halaman setelahnya.

## progress
order: 62
title: "Progress halaman"
aliases: ["progress halaman","current total","berapa halaman"]
keywords: ["progress","halaman","total"]

Saat total halaman tersedia dari reader, progress menampilkan posisi halaman terhadap total sehingga lebih jelas prosesnya sudah sampai mana.

## downloads-not-canonical
order: 63
title: "Downloads bukan penentu selesai"
aliases: ["hapus downloads resume","downloads sumber","folder downloads cache"]
keywords: ["downloads","resume","sumber"]

Folder Downloads bukan sumber status penyelesaian. Resume v1.0.5 mengandalkan penyimpanan lokal extension; menghapus file Downloads tidak otomatis membuat modul dianggap belum selesai.

## file-location
order: 70
title: "PDF tersimpan di mana"
aliases: ["pdf dimana","hasil download dimana","file tersimpan dimana"]
keywords: ["pdf","downloads","tersimpan"]

Hasil ekspor PDF masuk ke mekanisme Downloads browser. Selain itu, v1.0.5 menyimpan salinan modul secara lokal di storage extension untuk resume/merge/export ulang.
