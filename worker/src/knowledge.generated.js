// GENERATED FILE. Source of truth: worker/knowledge/*.md
// Run: node scripts/build-knowledge.mjs
export const SUPPORT_KB = Object.freeze([
  {
    "id": "about",
    "title": "Apa itu BMP Terbuka",
    "aliases": [
      "apa itu bmp terbuka",
      "bmp terbuka itu apa",
      "fungsi bmp terbuka"
    ],
    "keywords": [
      "bmp terbuka",
      "fungsi"
    ],
    "answer": "BMP Terbuka adalah extension komunitas independen untuk membantu mengubah materi BMP yang memang sudah bisa kamu akses menjadi searchable PDF untuk belajar pribadi/offline. OCR dan penyusunan PDF dilakukan lokal di perangkat."
  },
  {
    "id": "independent",
    "title": "Apakah resmi dari UT",
    "aliases": [
      "produk resmi ut",
      "resmi dari ut",
      "afiliasi ut"
    ],
    "keywords": [
      "resmi",
      "afiliasi",
      "universitas terbuka"
    ],
    "answer": "BMP Terbuka adalah proyek komunitas independen dan bukan produk resmi atau perwakilan pihak lain."
  },
  {
    "id": "supported-site",
    "title": "Website yang didukung",
    "aliases": [
      "bisa untuk web lain",
      "website lain",
      "situs lain",
      "selain pustaka ut",
      "selain rbv"
    ],
    "keywords": [
      "web lain",
      "website",
      "situs",
      "rbv",
      "pustaka"
    ],
    "answer": "Saat ini BMP Terbuka hanya punya adapter untuk reader RBV di https://pustaka.ut.ac.id/reader/. Belum ada dukungan untuk website/reader lain."
  },
  {
    "id": "rbv-only",
    "title": "Harus di halaman RBV",
    "aliases": [
      "ekstensi ga jalan",
      "extension tidak jalan",
      "tombol ga jalan",
      "tidak bereaksi",
      "belum buka rbv"
    ],
    "keywords": [
      "ekstensi ga jalan",
      "extension ga jalan",
      "pustaka ut",
      "rbv",
      "reader"
    ],
    "answer": "Sebelum mulai, buka/login ke reader RBV yang didukung di pustaka.ut.ac.id/reader/ pada tab aktif. Kalau extension dijalankan saat belum berada di reader yang didukung, proses tidak bisa mengambil modul."
  },
  {
    "id": "normal-login",
    "title": "Harus login normal",
    "aliases": [
      "harus login",
      "perlu login",
      "login dulu"
    ],
    "keywords": [
      "login",
      "akun"
    ],
    "answer": "Iya. Gunakan akunmu sendiri dan login ke portal/reader melalui mekanisme normal. BMP Terbuka tidak menyediakan bypass akses."
  },
  {
    "id": "internet",
    "title": "Perlu internet",
    "aliases": [
      "butuh internet",
      "offline bisa",
      "tanpa internet"
    ],
    "keywords": [
      "internet",
      "offline"
    ],
    "answer": "Internet tetap diperlukan saat membuka sumber/RBV dan saat aktivasi komunitas. OCR/PDF dikerjakan lokal setelah halaman sumber berhasil diambil."
  },
  {
    "id": "ocr-local",
    "title": "OCR lokal",
    "aliases": [
      "ocr dikirim server",
      "ocr online",
      "pdf diupload",
      "dokumen diupload"
    ],
    "keywords": [
      "ocr",
      "lokal",
      "upload",
      "server"
    ],
    "answer": "OCR dan penyusunan PDF dilakukan lokal di perangkat. Activation service tidak dipakai untuk mengunggah gambar halaman, teks OCR, atau PDF hasil."
  },
  {
    "id": "watermark",
    "title": "Watermark",
    "aliases": [
      "watermark dihapus",
      "hapus watermark",
      "watermark"
    ],
    "keywords": [
      "watermark"
    ],
    "answer": "BMP Terbuka mempertahankan watermark dari sumber dan tidak menyediakan fitur penghapusan watermark."
  },
  {
    "id": "latest",
    "title": "Versi terbaru",
    "aliases": [
      "versi terbaru",
      "latest version",
      "update terbaru",
      "download terbaru"
    ],
    "keywords": [
      "versi",
      "latest",
      "update",
      "1.0.5"
    ],
    "answer": "Versi terbaru yang didokumentasikan bot ini adalah v1.0.5. Download selalu dari https://github.com/mentaliss/bukabmp/releases/latest"
  },
  {
    "id": "release-package",
    "title": "Paket release resmi",
    "aliases": [
      "download yang mana",
      "paket yang mana",
      "source code zip",
      "release zip"
    ],
    "keywords": [
      "release",
      "zip",
      "source code"
    ],
    "answer": "Gunakan asset dari GitHub Releases, bukan “Source code ZIP”. Desktop memakai ZIP extension; Android memakai paket Android-CRX."
  },
  {
    "id": "install-overview",
    "title": "Cara install BMP Terbuka",
    "aliases": [
      "cara install",
      "cara instal",
      "cara pasang",
      "install bmp terbuka",
      "instal bmp terbuka",
      "pasang bmp terbuka"
    ],
    "keywords": [
      "install",
      "instal",
      "pasang"
    ],
    "answer": "Instalasi tergantung platform. Android: Microsoft Edge Canary + paket Android-CRX, tutorial teks https://t.me/bukabmp/11?comment=168. Desktop: Google Chrome atau Microsoft Edge, download ZIP release → extract → Developer mode → Load unpacked. Release terbaru: https://github.com/mentaliss/bukabmp/releases/latest"
  },
  {
    "id": "android-support",
    "title": "Android didukung",
    "aliases": [
      "support android",
      "bisa android",
      "android bisa",
      "hp android"
    ],
    "keywords": [
      "android",
      "support"
    ],
    "answer": "Bisa di Android melalui Microsoft Edge Canary dengan dukungan pemasangan extension/CRX yang tersedia pada build/perangkatmu."
  },
  {
    "id": "android-edge-canary",
    "title": "Browser Android",
    "aliases": [
      "browser android",
      "edge canary android",
      "chrome android",
      "firefox android"
    ],
    "keywords": [
      "android",
      "edge canary",
      "chrome",
      "firefox"
    ],
    "answer": "Jalur Android yang didukung saat ini adalah Microsoft Edge Canary. Chrome/Firefox Android bukan target instalasi resmi BMP Terbuka saat ini."
  },
  {
    "id": "android-install",
    "title": "Tutorial instalasi Android",
    "aliases": [
      "cara install android",
      "instal android",
      "install android",
      "pasang android"
    ],
    "keywords": [
      "android",
      "install",
      "instal",
      "crx"
    ],
    "answer": "Tutorial instalasi Android (teks): https://t.me/bukabmp/11?comment=168\n\nGunakan paket Android-CRX dari release terbaru: https://github.com/mentaliss/bukabmp/releases/latest"
  },
  {
    "id": "android-video-v104",
    "title": "Video penggunaan Android v1.0.4",
    "aliases": [
      "video android",
      "tutorial video android",
      "cara pakai android"
    ],
    "keywords": [
      "android",
      "video",
      "tutorial"
    ],
    "answer": "Video penggunaan Android yang tersedia dibuat untuk v1.0.4: https://t.me/bukabmp/11?comment=294\n\nUntuk perubahan fitur v1.0.5, ketik /tutorial atau /fitur."
  },
  {
    "id": "desktop-support",
    "title": "Desktop didukung",
    "aliases": [
      "support desktop",
      "bisa desktop",
      "pc laptop"
    ],
    "keywords": [
      "desktop",
      "pc",
      "laptop"
    ],
    "answer": "Desktop resmi mendukung Google Chrome atau Microsoft Edge yang mendukung Manifest V3."
  },
  {
    "id": "desktop-browsers-summary",
    "title": "Browser desktop yang didukung",
    "aliases": [
      "support chrome firefox edge",
      "chrome firefox edge",
      "browser desktop apa",
      "browser apa yang support",
      "browser yang didukung"
    ],
    "keywords": [
      "chrome",
      "firefox",
      "edge",
      "browser",
      "desktop"
    ],
    "answer": "Di desktop, target resmi BMP Terbuka adalah Google Chrome dan Microsoft Edge yang mendukung Manifest V3. Firefox tidak didukung resmi saat ini; browser Chromium lain juga belum menjadi target dukungan resmi."
  },
  {
    "id": "chrome-desktop",
    "title": "Chrome desktop",
    "aliases": [
      "support chrome",
      "bisa chrome",
      "google chrome"
    ],
    "keywords": [
      "chrome",
      "desktop"
    ],
    "answer": "Google Chrome desktop didukung. Install lewat ZIP release → extract → chrome://extensions → Developer mode → Load unpacked."
  },
  {
    "id": "edge-desktop",
    "title": "Edge desktop",
    "aliases": [
      "support edge",
      "bisa edge desktop",
      "microsoft edge desktop"
    ],
    "keywords": [
      "edge",
      "desktop"
    ],
    "answer": "Microsoft Edge desktop didukung. Install lewat ZIP release → extract → edge://extensions → Developer mode → Load unpacked."
  },
  {
    "id": "firefox-desktop",
    "title": "Firefox desktop",
    "aliases": [
      "support firefox",
      "bisa firefox",
      "bisa di firefox",
      "firefox bisa",
      "firefox desktop",
      "mozilla firefox"
    ],
    "keywords": [
      "firefox",
      "desktop"
    ],
    "answer": "Firefox bukan browser desktop yang didukung resmi saat ini. Target desktop resmi BMP Terbuka adalah Google Chrome dan Microsoft Edge dengan Manifest V3."
  },
  {
    "id": "other-chromium",
    "title": "Browser Chromium lain",
    "aliases": [
      "brave bisa",
      "opera bisa",
      "vivaldi bisa",
      "chromium lain"
    ],
    "keywords": [
      "brave",
      "opera",
      "vivaldi",
      "chromium"
    ],
    "answer": "Browser Chromium lain belum menjadi target dukungan resmi. Yang didokumentasikan dan diuji sebagai target desktop adalah Google Chrome dan Microsoft Edge."
  },
  {
    "id": "desktop-video-v104",
    "title": "Video penggunaan Desktop v1.0.4",
    "aliases": [
      "video desktop",
      "tutorial video desktop",
      "cara pakai desktop"
    ],
    "keywords": [
      "desktop",
      "video",
      "tutorial"
    ],
    "answer": "Video penggunaan Desktop yang tersedia dibuat untuk v1.0.4: https://t.me/c/4381494564/18\n\nUntuk alur dan fitur baru v1.0.5, ketik /tutorial atau /fitur."
  },
  {
    "id": "desktop-install",
    "title": "Cara install Desktop",
    "aliases": [
      "cara install desktop",
      "install chrome",
      "install edge",
      "load unpacked"
    ],
    "keywords": [
      "desktop",
      "install",
      "load unpacked"
    ],
    "answer": "Desktop: download ZIP release → extract ke folder tetap → buka chrome://extensions atau edge://extensions → aktifkan Developer mode → Load unpacked → pilih folder yang berisi manifest.json."
  },
  {
    "id": "join-group",
    "title": "Cara join Group Terbuka",
    "aliases": [
      "cara join grup",
      "join group",
      "gabung grup",
      "group terbuka",
      "link grup",
      "link group"
    ],
    "keywords": [
      "join",
      "group",
      "grup",
      "telegram"
    ],
    "answer": "Buka https://t.me/bukabmp/13. Jika Telegram membuka posting komunitas, buka komentar/diskusinya lalu tekan Join/Gabung pada Group Terbuka. Setelah masuk, kamu bisa mention @bukabmp_bot, reply pesan bot, atau ketik /ask diikuti pertanyaan."
  },
  {
    "id": "activation",
    "title": "Aktivasi komunitas",
    "aliases": [
      "cara aktivasi",
      "aktivasi komunitas",
      "verifikasi telegram"
    ],
    "keywords": [
      "aktivasi",
      "verifikasi",
      "telegram"
    ],
    "answer": "Aktivasi dilakukan dari popup BMP Terbuka lalu diverifikasi lewat Telegram. Bot mengecek keanggotaan komunitas dan mengembalikan token aktivasi yang diverifikasi extension."
  },
  {
    "id": "activation-expired",
    "title": "Aktivasi kedaluwarsa",
    "aliases": [
      "aktivasi expired",
      "aktivasi habis",
      "kedaluwarsa",
      "expired activation"
    ],
    "keywords": [
      "aktivasi",
      "expired",
      "kedaluwarsa"
    ],
    "answer": "Kalau aktivasi kedaluwarsa, buka popup dan lakukan verifikasi komunitas lagi. Selama syarat komunitas terpenuhi, aktivasi bisa diperbarui."
  },
  {
    "id": "activation-old-version",
    "title": "Aktivasi gagal karena versi lama",
    "aliases": [
      "versi tidak didukung",
      "update required",
      "aktivasi gagal versi"
    ],
    "keywords": [
      "aktivasi",
      "versi",
      "update"
    ],
    "answer": "Kalau versi extension sudah di bawah minimum yang didukung backend, aktivasi baru akan meminta update dulu. Ambil versi terbaru di https://github.com/mentaliss/bukabmp/releases/latest"
  },
  {
    "id": "rules",
    "title": "Rules group",
    "aliases": [
      "rules",
      "aturan grup",
      "aturan group"
    ],
    "keywords": [
      "rules",
      "aturan"
    ],
    "answer": "Cek rules Group Terbuka lewat Rose dengan command /rules. Jangan membagikan credential atau materi yang tidak boleh didistribusikan."
  },
  {
    "id": "privacy-credentials",
    "title": "Jangan kirim credential",
    "aliases": [
      "boleh kirim nim",
      "boleh kirim password",
      "cookie",
      "session token",
      "credential"
    ],
    "keywords": [
      "nim",
      "password",
      "cookie",
      "session",
      "token",
      "credential"
    ],
    "answer": "Jangan kirim password, NIM, cookie, session/token, atau credential lain ke bot/group. Untuk troubleshooting cukup screenshot, versi, platform, Kode BMP, dan modul yang bermasalah."
  },
  {
    "id": "bug-report",
    "title": "Format laporan kendala",
    "aliases": [
      "cara lapor bug",
      "lapor error",
      "lapor kendala",
      "bug report"
    ],
    "keywords": [
      "bug",
      "error",
      "kendala",
      "lapor"
    ],
    "answer": "Biar gampang dicek, kirim: screenshot error/posisi terakhir, versi BMP Terbuka, Android/Desktop, Kode BMP, dan modul yang bermasalah. Jangan kirim password, NIM, cookie, session/token, atau credential."
  },
  {
    "id": "code-from-url",
    "title": "Ambil Kode BMP",
    "aliases": [
      "kode bmp ambil dimana",
      "cara cari kode bmp",
      "ambil kode bmp"
    ],
    "keywords": [
      "kode bmp",
      "url",
      "modul="
    ],
    "answer": "Kode BMP diambil dari URL reader RBV, yaitu nilai setelah parameter ?modul=. Contoh ...index.php?modul=BING412102 berarti Kode BMP = BING412102."
  },
  {
    "id": "code-not-course",
    "title": "Kode BMP bukan kode mata kuliah",
    "aliases": [
      "kode bmp sama kode matkul",
      "kode mata kuliah",
      "kode matkul"
    ],
    "keywords": [
      "kode bmp",
      "kode matkul",
      "mata kuliah"
    ],
    "answer": "Kode BMP tidak selalu sama dengan kode mata kuliah. Gunakan nilai ?modul= dari URL reader, bukan menebak dari kode mata kuliah."
  },
  {
    "id": "bmp-not-found",
    "title": "BMP/modul tidak muncul",
    "aliases": [
      "bmp ga muncul",
      "bmp tidak muncul",
      "modul tidak tersedia",
      "modul ga muncul"
    ],
    "keywords": [
      "bmp",
      "modul",
      "tidak tersedia",
      "ga muncul"
    ],
    "answer": "Paling sering karena Kode BMP salah atau range modul yang dipilih tidak tersedia. Buka BMP tersebut di reader, salin nilai ?modul= dari URL, lalu pastikan modulnya memang bisa dibuka dengan akunmu."
  },
  {
    "id": "wrong-code",
    "title": "Salah Kode BMP",
    "aliases": [
      "salah kode",
      "kode salah",
      "invalid kode bmp"
    ],
    "keywords": [
      "kode",
      "salah",
      "invalid"
    ],
    "answer": "Kalau Kode BMP salah, extension tidak bisa menemukan modul yang dimaksud. Ambil ulang Kode BMP langsung dari URL reader RBV."
  },
  {
    "id": "range",
    "title": "Range modul",
    "aliases": [
      "modul pertama",
      "modul terakhir",
      "range modul",
      "m1 m9"
    ],
    "keywords": [
      "range",
      "modul pertama",
      "modul terakhir"
    ],
    "answer": "Isi modul pertama dan modul terakhir sesuai range yang ingin diproses. Contoh 1 sampai 9 berarti M1–M9."
  },
  {
    "id": "active-tab",
    "title": "Tab aktif harus reader",
    "aliases": [
      "tab aktif",
      "buka pustaka",
      "buka reader dulu"
    ],
    "keywords": [
      "tab",
      "reader",
      "pustaka"
    ],
    "answer": "Jalankan extension saat tab aktif sedang membuka reader RBV yang didukung. Kalau belum membuka pustaka.ut.ac.id/reader/, extension tidak punya konteks halaman sumber untuk diproses."
  },
  {
    "id": "resume",
    "title": "Resume proses",
    "aliases": [
      "resume",
      "lanjut proses",
      "melanjutkan",
      "ga ulang dari awal",
      "tidak ulang dari awal"
    ],
    "keywords": [
      "resume",
      "lanjut",
      "ocr ulang"
    ],
    "answer": "Di v1.0.5, modul yang sudah selesai disimpan lokal. Saat dijalankan lagi, modul yang sudah tersedia dilewati otomatis sehingga tidak perlu OCR ulang dari awal."
  },
  {
    "id": "interrupted-module",
    "title": "Proses terputus di tengah modul",
    "aliases": [
      "browser ketutup",
      "edge ketutup",
      "chrome ketutup",
      "mati di tengah modul",
      "proses terhenti tengah"
    ],
    "keywords": [
      "terhenti",
      "ketutup",
      "tengah modul"
    ],
    "answer": "Yang aman untuk resume adalah modul yang sudah selesai dan sudah tersimpan lokal. Kalau proses terputus saat satu modul belum selesai, modul yang sedang berjalan itu mungkin perlu diproses lagi."
  },
  {
    "id": "local-storage",
    "title": "Apa itu penyimpanan lokal",
    "aliases": [
      "apa itu penyimpanan lokal",
      "cache itu apa",
      "penyimpanan bmp"
    ],
    "keywords": [
      "penyimpanan lokal",
      "cache",
      "storage"
    ],
    "answer": "Penyimpanan lokal adalah salinan PDF modul hasil proses di dalam storage extension. Ini dipakai untuk resume, PDF gabungan, dan ekspor ulang tanpa OCR."
  },
  {
    "id": "storage-vs-downloads",
    "title": "Penyimpanan lokal vs Downloads",
    "aliases": [
      "beda cache dan download",
      "penyimpanan lokal downloads",
      "cache downloads"
    ],
    "keywords": [
      "cache",
      "downloads",
      "penyimpanan lokal"
    ],
    "answer": "Penyimpanan lokal extension berbeda dari folder Downloads. File di Downloads adalah hasil ekspor; storage extension adalah sumber lokal untuk resume/merge/export ulang."
  },
  {
    "id": "deleted-download",
    "title": "File Downloads terhapus",
    "aliases": [
      "file kehapus bisa download ulang",
      "pdf kehapus",
      "file download kehapus",
      "hapus file downloads"
    ],
    "keywords": [
      "file kehapus",
      "pdf kehapus",
      "download ulang",
      "export"
    ],
    "answer": "Bisa. Kalau PDF modul masih ada di penyimpanan lokal extension, tinggal ekspor ulang dan hasilnya praktis instan karena tidak perlu OCR lagi."
  },
  {
    "id": "deleted-local-storage",
    "title": "Penyimpanan lokal terhapus",
    "aliases": [
      "cache kehapus",
      "storage kehapus",
      "penyimpanan lokal kehapus"
    ],
    "keywords": [
      "cache kehapus",
      "storage kehapus"
    ],
    "answer": "Kalau data penyimpanan lokal extension sudah dihapus dan file itu tidak lagi ada sebagai cache BMP, fitur resume/export instan tidak punya sumber lokal lagi. Modul tersebut perlu diproses ulang bila dibutuhkan."
  },
  {
    "id": "export-one",
    "title": "Ekspor satu modul",
    "aliases": [
      "export satu modul",
      "download satu modul",
      "ekspor satu"
    ],
    "keywords": [
      "export",
      "satu modul"
    ],
    "answer": "Bisa. Buka pengelolaan penyimpanan lalu pilih modul yang sudah tersimpan untuk diekspor tanpa OCR ulang."
  },
  {
    "id": "export-multiple",
    "title": "Ekspor banyak modul",
    "aliases": [
      "export beberapa modul",
      "download banyak modul",
      "multi export",
      "pilih semua"
    ],
    "keywords": [
      "export",
      "beberapa",
      "banyak",
      "pilih semua"
    ],
    "answer": "Bisa pilih beberapa modul sekaligus untuk diekspor ulang dari penyimpanan lokal tanpa OCR ulang."
  },
  {
    "id": "export-instant",
    "title": "Ekspor ulang cepat",
    "aliases": [
      "export instan",
      "download ulang instan",
      "kenapa cepat export"
    ],
    "keywords": [
      "export",
      "instan",
      "cepat"
    ],
    "answer": "Ekspor ulang dari penyimpanan lokal tidak menjalankan OCR/source retrieval lagi, jadi biasanya jauh lebih cepat dibanding memproses modul dari awal."
  },
  {
    "id": "clear-storage",
    "title": "Hapus cache/penyimpanan lokal",
    "aliases": [
      "bisa hapus cache",
      "hapus cache",
      "hapus penyimpanan lokal",
      "kosongkan penyimpanan"
    ],
    "keywords": [
      "hapus cache",
      "kosongkan",
      "penyimpanan"
    ],
    "answer": "Bisa. Gunakan “Kosongkan penyimpanan BMP ini” untuk menghapus data lokal hanya untuk Kode BMP yang sedang dipilih."
  },
  {
    "id": "clear-storage-downloads",
    "title": "Hapus storage apakah hapus Downloads",
    "aliases": [
      "hapus cache file downloads",
      "kosongkan penyimpanan hapus pdf"
    ],
    "keywords": [
      "hapus",
      "downloads",
      "penyimpanan"
    ],
    "answer": "Tidak. Mengosongkan penyimpanan lokal BMP tidak menghapus PDF yang sudah tersimpan di folder Downloads."
  },
  {
    "id": "storage-per-code",
    "title": "Storage per Kode BMP",
    "aliases": [
      "cache campur",
      "ganti kode bmp",
      "penyimpanan per kode"
    ],
    "keywords": [
      "cache",
      "kode bmp",
      "ganti kode"
    ],
    "answer": "Penyimpanan disusun per Kode BMP. Modul dari Kode BMP lain tidak seharusnya dianggap sebagai modul untuk kode yang sedang dipilih."
  },
  {
    "id": "storage-size",
    "title": "Ukuran penyimpanan lokal",
    "aliases": [
      "berapa ukuran cache",
      "storage besar",
      "penyimpanan mb"
    ],
    "keywords": [
      "ukuran",
      "cache",
      "storage",
      "mb"
    ],
    "answer": "Popup v1.0.5 menampilkan ringkasan ukuran data lokal untuk Kode BMP yang dipilih. Kalau tidak lagi dibutuhkan, storage BMP itu bisa dikosongkan tanpa menghapus file Downloads."
  },
  {
    "id": "rerun-complete",
    "title": "Jalankan range yang sudah lengkap",
    "aliases": [
      "semua sudah tersedia",
      "range sudah lengkap",
      "klik proses lagi"
    ],
    "keywords": [
      "sudah tersedia",
      "lengkap",
      "range"
    ],
    "answer": "Kalau semua modul dalam range sudah tersedia lokal dan kamu tidak memilih download ulang, v1.0.5 tidak perlu OCR ulang. Kamu bisa ekspor PDF yang ada atau membuat PDF gabungan bila diinginkan."
  },
  {
    "id": "missing-only",
    "title": "Hanya modul yang hilang diproses",
    "aliases": [
      "cuma modul belum ada",
      "modul yang hilang",
      "skip cached"
    ],
    "keywords": [
      "modul hilang",
      "belum ada",
      "skip"
    ],
    "answer": "Default v1.0.5 adalah resume: modul yang sudah tersimpan dilewati, dan hanya modul yang belum tersedia dalam range yang perlu diproses."
  },
  {
    "id": "redownload-selected",
    "title": "Download ulang range tertentu",
    "aliases": [
      "download ulang modul yang dipilih",
      "redownload range",
      "proses ulang range"
    ],
    "keywords": [
      "download ulang",
      "redownload",
      "proses ulang"
    ],
    "answer": "Centang “Download ulang modul yang dipilih” lalu atur range. Hanya modul dalam range tersebut yang diproses ulang."
  },
  {
    "id": "redownload-preserve",
    "title": "Redownload tidak hapus modul lain",
    "aliases": [
      "download ulang hapus yang lain",
      "redownload hapus cache lain"
    ],
    "keywords": [
      "redownload",
      "hapus",
      "modul lain"
    ],
    "answer": "Tidak. Download ulang range tertentu tidak menghapus modul lain yang sudah tersimpan di Kode BMP tersebut."
  },
  {
    "id": "redownload-one",
    "title": "Download ulang satu modul",
    "aliases": [
      "download ulang m3",
      "ulang satu modul",
      "redownload satu modul"
    ],
    "keywords": [
      "download ulang",
      "satu modul"
    ],
    "answer": "Bisa. Set modul pertama dan terakhir ke nomor yang sama, misalnya 3–3, lalu aktifkan “Download ulang modul yang dipilih”."
  },
  {
    "id": "merge-optional",
    "title": "PDF gabungan opsional",
    "aliases": [
      "harus buat pdf gabungan",
      "merge wajib",
      "pdf gabungan opsional"
    ],
    "keywords": [
      "gabungan",
      "opsional",
      "merge"
    ],
    "answer": "PDF gabungan di v1.0.5 bersifat opsional. Kalau cuma butuh PDF per modul, biarkan opsi “Buat PDF gabungan” tidak dicentang."
  },
  {
    "id": "merge-full",
    "title": "PDF gabungan FULL",
    "aliases": [
      "full pdf",
      "gabungan full",
      "full_searchable"
    ],
    "keywords": [
      "full",
      "gabungan",
      "merge"
    ],
    "answer": "PDF gabungan FULL bisa dibuat ketika set modul yang dibutuhkan sudah lengkap di penyimpanan lokal."
  },
  {
    "id": "merge-range",
    "title": "PDF gabungan range",
    "aliases": [
      "gabung m3 m6",
      "merge range",
      "pdf m3-m6"
    ],
    "keywords": [
      "gabung",
      "range",
      "m3",
      "m6"
    ],
    "answer": "Bisa membuat PDF gabungan untuk range tertentu, misalnya M3–M6, selama semua modul dalam range itu tersedia lokal."
  },
  {
    "id": "merge-gap",
    "title": "Merge gagal karena ada gap",
    "aliases": [
      "pdf gabungan tidak jadi",
      "merge tidak jadi",
      "ada gap",
      "modul bolong"
    ],
    "keywords": [
      "merge",
      "gap",
      "bolong",
      "tidak jadi"
    ],
    "answer": "Kalau ada modul yang belum tersedia dalam range yang dipilih, PDF gabungan tidak dibuat sampai range tersebut lengkap. Ini sengaja supaya modul yang hilang tidak diam-diam dilewati."
  },
  {
    "id": "merge-from-storage",
    "title": "Merge sumbernya storage",
    "aliases": [
      "merge dari downloads",
      "gabungan dari download",
      "merge cache"
    ],
    "keywords": [
      "merge",
      "downloads",
      "storage"
    ],
    "answer": "PDF gabungan dibangun dari PDF modul yang tersimpan lokal di extension, bukan dengan membaca file di folder Downloads."
  },
  {
    "id": "deleted-download-merge",
    "title": "File Downloads hilang tapi mau merge",
    "aliases": [
      "file download kehapus masih bisa merge",
      "pdf downloads hilang gabung"
    ],
    "keywords": [
      "downloads",
      "kehapus",
      "merge"
    ],
    "answer": "Kalau modulnya masih ada di penyimpanan lokal extension, file Downloads yang terhapus tidak menghalangi merge. Merge memakai data lokal extension."
  },
  {
    "id": "page-count",
    "title": "Berhenti di halaman terakhir",
    "aliases": [
      "halaman terakhir",
      "page count",
      "kelebihan halaman",
      "page terakhir"
    ],
    "keywords": [
      "halaman terakhir",
      "page count"
    ],
    "answer": "v1.0.5 memakai jumlah halaman yang dilaporkan reader bila tersedia, sehingga proses berhenti tepat di halaman terakhir dan tidak meminta halaman setelahnya."
  },
  {
    "id": "progress",
    "title": "Progress halaman",
    "aliases": [
      "progress halaman",
      "current total",
      "berapa halaman"
    ],
    "keywords": [
      "progress",
      "halaman",
      "total"
    ],
    "answer": "Saat total halaman tersedia dari reader, progress menampilkan posisi halaman terhadap total sehingga lebih jelas prosesnya sudah sampai mana."
  },
  {
    "id": "downloads-not-canonical",
    "title": "Downloads bukan penentu selesai",
    "aliases": [
      "hapus downloads resume",
      "downloads sumber",
      "folder downloads cache"
    ],
    "keywords": [
      "downloads",
      "resume",
      "sumber"
    ],
    "answer": "Folder Downloads bukan sumber status penyelesaian. Resume v1.0.5 mengandalkan penyimpanan lokal extension; menghapus file Downloads tidak otomatis membuat modul dianggap belum selesai."
  },
  {
    "id": "403",
    "title": "Error 403",
    "aliases": [
      "403",
      "forbidden"
    ],
    "keywords": [
      "403",
      "forbidden"
    ],
    "answer": "Kalau reader memberi 403, BMP Terbuka berhenti. Selesaikan login/akses melalui mekanisme normal sumber lalu coba lagi; bot tidak memberi cara bypass."
  },
  {
    "id": "429",
    "title": "Error 429",
    "aliases": [
      "429",
      "too many requests"
    ],
    "keywords": [
      "429",
      "rate limit"
    ],
    "answer": "Kalau reader memberi 429, BMP Terbuka safe-stop dan tidak melakukan blind retry. Tunggu kondisi akses normal lalu coba lagi."
  },
  {
    "id": "request-rejected",
    "title": "Request Rejected",
    "aliases": [
      "request rejected",
      "support id"
    ],
    "keywords": [
      "request rejected",
      "support id"
    ],
    "answer": "Kalau muncul Request Rejected, proses sengaja berhenti. Jangan mencoba bypass/stealth; selesaikan akses secara normal dan coba lagi nanti."
  },
  {
    "id": "login-redirect",
    "title": "Minta login ulang",
    "aliases": [
      "login ulang",
      "ke halaman login",
      "session habis"
    ],
    "keywords": [
      "login ulang",
      "session",
      "login"
    ],
    "answer": "Kalau reader mengarahkan ke login ulang atau sesi habis, login kembali secara normal di reader lalu mulai lagi. Modul yang sudah selesai dan masih tersimpan lokal tetap bisa dipakai untuk resume."
  },
  {
    "id": "safe-stop",
    "title": "Kenapa tidak retry otomatis",
    "aliases": [
      "kenapa berhenti",
      "kok ga retry",
      "retry otomatis"
    ],
    "keywords": [
      "retry",
      "berhenti",
      "safe stop"
    ],
    "answer": "Safe-stop memang desain BMP Terbuka saat sumber menolak akses. Extension tidak melakukan blind retry terhadap 403/429/login/Request Rejected."
  },
  {
    "id": "no-bypass",
    "title": "Bypass blokir",
    "aliases": [
      "bypass waf",
      "bypass blokir",
      "stealth",
      "spoof cookie"
    ],
    "keywords": [
      "bypass",
      "waf",
      "stealth",
      "spoof"
    ],
    "answer": "BMP Terbuka tidak menyediakan teknik bypass WAF/blokir, stealth, spoofing cookie/token, IP rotation, atau cara memaksa akses yang ditolak sumber."
  },
  {
    "id": "file-location",
    "title": "PDF tersimpan di mana",
    "aliases": [
      "pdf dimana",
      "hasil download dimana",
      "file tersimpan dimana"
    ],
    "keywords": [
      "pdf",
      "downloads",
      "tersimpan"
    ],
    "answer": "Hasil ekspor PDF masuk ke mekanisme Downloads browser. Selain itu, v1.0.5 menyimpan salinan modul secara lokal di storage extension untuk resume/merge/export ulang."
  },
  {
    "id": "uninstall-extension",
    "title": "Hapus atau uninstall extension",
    "aliases": [
      "hapus ekstensi",
      "cara hapus ekstensi",
      "hapus extension",
      "cara hapus extension",
      "uninstall ekstensi",
      "uninstall extension",
      "hapus bmp terbuka"
    ],
    "keywords": [
      "hapus ekstensi",
      "hapus extension",
      "uninstall"
    ],
    "answer": "Bisa. Hapus/uninstall BMP Terbuka dari halaman extensions browser. Perlu diingat, menghapus extension atau data browser dapat menghilangkan penyimpanan lokal BMP di extension; PDF yang sudah diekspor ke Downloads tidak ikut terhapus."
  },
  {
    "id": "reinstall-extension",
    "title": "Reinstall dan storage",
    "aliases": [
      "reinstall extension cache",
      "hapus extension data",
      "install ulang data"
    ],
    "keywords": [
      "reinstall",
      "hapus extension",
      "storage"
    ],
    "answer": "Jangan mengandalkan storage lokal tetap ada setelah extension dihapus/reinstall atau data browser dibersihkan. Kalau datanya hilang, resume/export instan dari storage itu juga hilang."
  },
  {
    "id": "update-v104-v105",
    "title": "Tutorial v1.0.4 vs v1.0.5",
    "aliases": [
      "tutorial 1.0.4",
      "video versi lama",
      "beda tutorial"
    ],
    "keywords": [
      "tutorial",
      "1.0.4",
      "1.0.5"
    ],
    "answer": "Video Android/Desktop yang ditautkan bot dibuat pada v1.0.4, jadi tampilan/fitur penyimpanan v1.0.5 bisa berbeda. Untuk penggunaan v1.0.5 gunakan /tutorial dan /fitur sebagai acuan terbaru."
  },
  {
    "id": "current-v105-tutorial",
    "title": "Tutorial penggunaan v1.0.5",
    "aliases": [
      "tutorial 1.0.5",
      "cara pakai 1.0.5",
      "penggunaan v1.0.5"
    ],
    "keywords": [
      "tutorial",
      "1.0.5",
      "cara pakai"
    ],
    "answer": "Ketik /tutorial untuk tutorial penggunaan v1.0.5 langsung dari bot. Tutorial itu mencakup Kode BMP, range modul, resume, redownload, PDF gabungan, ekspor ulang, dan penyimpanan lokal."
  },
  {
    "id": "help-human",
    "title": "Kalau bot tidak tahu",
    "aliases": [
      "bot ga tau",
      "jawaban tidak membantu",
      "masih error",
      "butuh admin"
    ],
    "keywords": [
      "bot",
      "admin",
      "member",
      "bantu"
    ],
    "answer": "Kalau jawaban bot belum menyelesaikan masalah, kirim detail kendala di Group Terbuka: https://t.me/bukabmp/13. Jika link membuka posting komunitas, buka komentar/diskusinya lalu tekan Join/Gabung. Sertakan screenshot, versi, platform, Kode BMP, dan modul yang bermasalah."
  },
  {
    "id": "greeting",
    "title": "Sapaan",
    "aliases": [
      "halo",
      "hai",
      "hi"
    ],
    "keywords": [
      "halo",
      "hai"
    ],
    "answer": "Halo 👋 Tanya aja soal instalasi, Kode BMP, Android/Desktop, aktivasi, error, atau fitur v1.0.5. Gunakan menu Bantuan/Ekstensi atau tanyakan langsung ke BMP Terbuka Assistant di Group Terbuka."
  },
  {
    "id": "features-v105",
    "title": "Fitur utama v1.0.5",
    "aliases": [
      "fitur bmp",
      "fitur 1.0.5",
      "fitur terbaru",
      "apa saja fiturnya"
    ],
    "keywords": [
      "fitur",
      "1.0.5",
      "resume",
      "storage",
      "merge"
    ],
    "answer": "Fitur utama v1.0.5: resume dari penyimpanan lokal, ringkasan modul/ukuran storage per Kode BMP, download ulang hanya range yang dipilih, PDF gabungan FULL atau range, proteksi gap saat merge, ekspor ulang tanpa OCR, hapus storage per BMP tanpa menghapus Downloads, dan page-count yang berhenti di halaman terakhir reader."
  },
  {
    "id": "ai-quota",
    "title": "Kuota BMP Terbuka Assistant",
    "aliases": [
      "kuota ai",
      "sisa kuota",
      "berapa kali ai",
      "limit ai",
      "ai unlimited"
    ],
    "keywords": [
      "kuota",
      "ai",
      "assistant",
      "supporter"
    ],
    "answer": "Akun reguler mendapat maksimal 6 pertanyaan AI per hari. Jawaban FAQ yang cocok dengan basis pengetahuan tidak memakai kuota AI. Supporter aktif dan akun khusus mendapat akses AI unlimited sesuai status akun saat itu."
  },
  {
    "id": "supporter-pass-help",
    "title": "Bantuan Supporter Pass",
    "aliases": [
      "supporter pass",
      "status supporter",
      "cara supporter",
      "supporter wall",
      "terms supporter"
    ],
    "keywords": [
      "supporter",
      "status",
      "terms",
      "wall"
    ],
    "answer": "Kelola Supporter Pass lewat menu Supporter di DM bot. Di sana tersedia status Supporter, paket, terms, Supporter Wall, dan alur pembayaran. Informasi dinamis seperti status aktif dan masa berlaku dibaca langsung dari akunmu."
  },
  {
    "id": "supporter-payment-help",
    "title": "Bantuan pembayaran Supporter",
    "aliases": [
      "pembayaran supporter bermasalah",
      "stars sudah bayar",
      "supporter belum aktif",
      "payment supporter"
    ],
    "keywords": [
      "supporter",
      "pembayaran",
      "stars",
      "payment"
    ],
    "answer": "Kalau pembayaran Telegram Stars terdeteksi tetapi Supporter belum aktif, jangan bayar ulang. Buka menu Supporter di DM bot dan gunakan bantuan pembayaran agar transaksi bisa diperiksa. Jangan kirim password, OTP, token, cookie, atau data kartu."
  }
]);
