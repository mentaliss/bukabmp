# FAQ

## Apakah perlu Python atau Tesseract desktop?
Tidak. Release resmi membawa OCR runtime di dalam extension.

## Apakah perlu menjalankan BAT?
Tidak untuk end-user.

## Kenapa harus join Telegram?
V1 memakai community gate agar pengguna berada di kanal update kompatibilitas, security notice, support, dan diskusi.

## Apakah Telegram atau activation service menerima materi saya?
Activation flow tidak digunakan untuk mengunggah gambar halaman, teks OCR, atau PDF hasil.

## Apakah password/NIM dikirim ke developer?
Tidak. Extension tidak meminta password/NIM portal sumber.

## Apakah watermark dihapus?
Tidak. BMP Terbuka sengaja mempertahankan watermark dari sumber.

## Extension berhenti pada Request Rejected/403. Kenapa tidak retry?
Karena BMP Terbuka tidak dirancang untuk memaksa melewati penolakan server. Selesaikan login/akses melalui mekanisme normal sumber.

## Kenapa output disebut FULL_CANDIDATE pada kondisi tertentu?
Jika extension menyimpulkan akhir karena modul berikutnya tidak tersedia, itu indikator, bukan bukti absolut. Bila user sendiri menentukan modul terakhir pada UI, hasil gabungan menggunakan nama `FULL_Searchable.pdf`.

## Apa yang open-source?
Chrome extension BMP Terbuka, build tooling extension, dan dokumentasi publik di repository ini menggunakan GPL-3.0. Activation service, infrastructure, dan website source tidak termasuk dalam repository open-source ini.

## Apakah community gate bisa diubah pada fork?
Source client bersifat open-source, jadi fork dapat mengubah perilaku client. Community gate bukan klaim DRM absolut.

## Apakah ini produk resmi institusi?
Tidak. BMP Terbuka adalah proyek komunitas independen.
