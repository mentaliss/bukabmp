# FAQ

## Apakah perlu Python, BAT, atau Tesseract desktop?
Tidak. Release resmi membawa OCR runtime di dalam extension.

## Apakah password/NIM dikirim ke BMP Terbuka?
Tidak. Extension tidak meminta password/NIM portal sumber.

## Apakah materi, OCR, atau PDF saya diunggah ke backend?
Tidak untuk flow OCR/PDF. Extension tetap melakukan request jaringan untuk aktivasi, version/realtime state, telemetry pseudonymous, dan sponsor metrics yang terbatas. Lihat [PRIVACY.md](../PRIVACY.md).

## Kenapa harus join Telegram?
Community gate dipakai untuk kanal update kompatibilitas, security notice, support, dan diskusi.

## Apakah watermark dihapus?
Tidak. BMP Terbuka mempertahankan watermark dari sumber.

## Extension berhenti pada Request Rejected/403. Kenapa tidak retry?
Karena BMP Terbuka tidak dirancang untuk memaksa melewati penolakan server.

## Di mana download resminya?
Edge Desktop dan Edge Android akan diarahkan ke Microsoft Edge Add-ons setelah listing resmi terverifikasi. Jalur manual memakai asset ZIP hasil build di GitHub Releases, bukan Source code (zip). v1.1.0 masih **Unreleased**.

## Apa yang open-source?
Browser extension, public tooling, dokumentasi publik, dan source website publik berada/akan berada di repository ini. Worker produksi, bot/backend, Control Center, private database/deployment material, dan secret tidak dipublikasikan.

## Apakah sponsor bisa melihat data pengguna?
Tidak. Sponsorship/advertising tidak memberi akses ke identitas pribadi, activation identity, isi BMP/OCR/PDF, atau arbitrary third-party tracking. Campaign kandidat saat ini contextual/non-personalized.

## Apakah ini produk resmi institusi?
Tidak. BMP Terbuka adalah proyek komunitas independen.
