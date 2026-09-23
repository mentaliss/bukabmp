# Changelog

Semua perubahan penting pada source extension publik dicatat di sini.

## [1.1.0] - 2026-09-23

### Added
- Activation token schema v2 dengan subject Telegram tervalidasi, refresh endpoint, dan signed Supporter snapshot.
- One-time legacy → v2 re-verification yang mempertahankan token aktif sampai replacement terverifikasi dan tidak boleh memperpendek sisa masa aktif untuk user/install yang sama.
- Badge BMP Supporter personal dari signed token.
- Realtime Cloud Surface status + sponsor state.
- Sponsor card dan delayed sponsor interstitial setelah job berhasil dimulai; fallback house inventory tetap tersedia.
- Coarse sponsor metrics (impression/click/dismiss) tanpa Telegram ID, install ID, activation token, kode BMP, OCR text, atau PDF.
- Distribution-aware build/validation untuk GitHub/manual, Android, Chrome Web Store, dan Edge Add-ons.

### Changed
- Jalur Android utama diarahkan ke Microsoft Edge Stable + Edge Add-ons; Canary tetap fallback/testing.
- Footer informasi extension sekarang membuka Security, Privacy, Responsible Use/Hak Cipta, dan Terms langsung di website resmi BMP Terbuka.
- Token-v2 yang sudah tersinkron tidak lagi menampilkan card manajemen Aktivasi komunitas; badge status akses hijau tetap tampil.
- Realtime sponsor state di-refresh ketika popup terbuka dan saat job dimulai.
- Interstitial delay dikunci pada jendela 2–5 detik dan tidak boleh menahan OCR/job.
- Activation/Supporter refresh memakai short retry/backoff agar entitlement baru tidak menunggu token lama kedaluwarsa.

### Fixed
- Mencegah replacement token saat re-verification memperpendek entitlement yang masih aktif.
- Mencegah transfer expiry floor ke Telegram account berbeda pada installation yang sama.
- Mencegah concurrent START_JOB, stale module/progress message, dan auxiliary popup error mengganggu job OCR aktif.
- Mencegah module dengan known page count disimpan sebagai PDF terpotong ketika halaman yang seharusnya ada gagal dimuat.
- Cache clear dan reviewer OCR fixture tidak lagi dapat merusak state OCR job lain.
- Offscreen detection tetap kompatibel dengan minimum Chrome 109 melalui feature detection/fallback.
- Temporary blob URL direvoke juga ketika browser download gagal.
- Remote Telegram/update URLs divalidasi sebelum dibuka.
- Ads metrics hanya dihitung untuk campaign/revision/placement yang sedang aktif; endpoint juga rate-limited.
- Image-only campaign tidak dianggap aktif sampai renderer image first-party/proxy benar-benar tersedia.

### Validation
- Source/static regression + Cloud Surface sanitizer.
- GitHub/manual package build + validation.
- Chrome Web Store package build + validation.
- Android compatibility package build + validation.
- Edge Add-ons package build + validation.
- Worker characterization/security/activation/Supporter/referral/payment tests.
- Worker bundle dry-run.
- Automated source/package validation untuk candidate final lulus sebelum release. Authenticated real-device/store upgrade tetap merupakan regression eksternal di luar CI.

## [1.0.5] - 2026-09-18

### Added
- Penyimpanan lokal PDF per BMP untuk melanjutkan proses tanpa mengulang OCR modul yang sudah selesai.
- Ringkasan penyimpanan per kode BMP, termasuk modul tersimpan, ukuran data lokal, modul yang sudah tersedia, dan modul yang masih perlu diproses.
- Opsi **Download ulang modul yang dipilih** untuk memproses ulang hanya rentang yang dipilih tanpa menghapus modul lain.
- Opsi **Buat PDF gabungan** yang sekarang bersifat opsional.
- Dukungan PDF gabungan **FULL** dari cache lengkap dan PDF gabungan rentang seperti `M3-M6` untuk pilihan parsial yang lengkap.
- Ekspor ulang satu atau beberapa PDF modul langsung dari penyimpanan lokal tanpa retrieval/OCR ulang.
- Kontrol untuk mengosongkan penyimpanan lokal hanya untuk BMP yang sedang dipilih, tanpa menghapus file yang sudah ada di folder Downloads.
- Penyimpanan draft kode BMP dan rentang modul agar popup tidak kembali ke nilai contoh saat dibuka ulang.

### Changed
- `STDA4101` sekarang hanya menjadi placeholder/contoh, bukan nilai kode BMP yang dipaksakan.
- Tombol aksi utama menyesuaikan kondisi: memproses modul yang belum ada, download ulang, membuat PDF gabungan, atau mengarahkan ke ekspor ketika rentang sudah lengkap.
- UX penyimpanan disederhanakan agar pengguna tidak perlu memahami IndexedDB atau istilah cache teknis.
- Resume tetap menjadi perilaku default: modul yang sudah tersedia dilewati dan hanya modul yang hilang dalam rentang yang diproses.
- PDF gabungan dibangun dari PDF modul yang tersimpan lokal, bukan dari file di folder Downloads.

### Fixed
- OCR berhenti tepat pada jumlah halaman yang dilaporkan reader ketika total halaman tersedia, sehingga tidak meminta halaman setelah halaman terakhir.
- Popup menampilkan kembali kode BMP, rentang, dan status pekerjaan aktif secara konsisten setelah ditutup dan dibuka ulang.
- PDF gabungan tidak dibuat jika ada gap pada rentang yang dipilih; modul yang hilang dilaporkan alih-alih diabaikan.
- Re-run pada Android tidak otomatis mengekspor ulang modul yang sudah tersimpan hanya karena tombol mulai ditekan.

### Validation
- Page-count termination pada reader-reported total: **PASS**.
- Resume cache, gap processing, redownload rentang, merge OFF, partial merge, FULL merge, re-export, dan clear per BMP: **PASS** pada test lokal.
- GitHub Actions Validate untuk source v1.0.5: **PASS**.
- Android CRX test ditandatangani dengan signing key yang sama dan extension ID tetap `lpbcndejhechedaemnjmjppjkhblkonj`.

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
