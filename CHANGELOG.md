# Changelog

Semua perubahan penting pada source extension publik dicatat di sini.

## [1.0.4] - 2026-09-17

### Added
- Dukungan runtime Android melalui **Microsoft Edge Canary**, termasuk alur instalasi CRX yang telah diuji.
- Tombol **Bagikan** pada popup dengan Web Share bila tersedia dan fallback salin teks/link bila share sheet tidak didukung.
- Pemeriksaan versi ke backend dengan cache maksimal 24 jam dan banner update di popup.
- Fondasi **mandatory update**: versi di bawah minimum supported version tidak dapat memulai proses baru atau membuat aktivasi baru.

### Changed
- Masa berlaku token aktivasi komunitas baru menjadi **14 hari**.
- Popup mobile menggunakan lebar yang lebih sesuai dengan bottom sheet Edge Canary.
- Handoff/navigasi antar halaman modul diperkuat untuk event lifecycle Edge Canary Android.
- Mandatory update tidak memutus proses OCR yang sudah berjalan; enforcement diterapkan sebelum proses/aktivasi baru.

### Fixed
- Fallback **Bagikan** tetap bekerja ketika Web Share Android gagal/ditolak sebelum share sheet tampil.
- Memperbaiki kondisi Android yang dapat berhenti pada status **Membuka modul** karena event tab/navigation tidak terkirim seperti desktop.
- Perhitungan policy update diterapkan ulang terhadap versi runtime saat cache dibaca, sehingga status mandatory update lama tidak tersangkut setelah extension di-upgrade.

### Validation
- Android final regression: activation → M1 → OCR → PDF → download → searchable **PASS**.
- Mandatory-update gate pada versi lama **PASS**.
- v1.0.4 normal path setelah force-update foundation **PASS**.

## [1.0.2] - 2026-09-14

### Fixed
- Regenerate seluruh icon extension dari master logo final untuk memperbaiki asset `icon128.png` yang tampil rusak pada GitHub.
- Menyamakan kembali icon 16, 32, 48, dan 128 px dari sumber master yang sama.
- Tidak ada perubahan pada alur akses, OCR, PDF, atau community activation.

## [1.0.1] - 2026-09-14

### Changed
- Mengganti seluruh icon extension dengan identitas visual buku monokrom BMP Terbuka.
- Menampilkan logo baru pada popup dan halaman informasi extension.
- Menambahkan logo resmi ke README repository publik.
- Tidak ada perubahan pada alur akses, OCR, PDF, atau community activation.

## [1.0.0] - 2026-09-13

### Added
- Brand publik **BMP Terbuka**.
- Searchable PDF per modul dan PDF gabungan.
- OCR lokal self-contained pada release.
- OCR progress mengikuti halaman aktif.
- Safe-stop untuk 403/429/login ulang/Request Rejected.
- Watermark sumber dipertahankan.
- Community activation: **Buka BMP** + **Group Terbuka**.
- Signed activation token yang diverifikasi lokal.
- Fallback Telegram dengan kode aktivasi yang dapat disalin.
- Popup memeriksa activation pairing secara otomatis setiap 2 detik.
- Loading/timer aktivasi dan opsi recovery setelah menunggu lama.
- Privacy, security, responsible-use, contribution, dan release documentation.
