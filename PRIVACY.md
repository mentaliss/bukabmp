# Privacy Policy

BMP Terbuka dirancang **local-first**.

## Data materi

Extension memproses halaman materi, OCR, dan penyusunan PDF di perangkat pengguna. Activation service tidak digunakan untuk menerima:
- password atau credential portal sumber;
- NIM;
- cookie/session portal sumber;
- gambar halaman materi;
- teks OCR isi materi;
- PDF hasil.

PDF hasil disimpan melalui Chrome Downloads.

## Data lokal extension

Chrome local storage dapat menyimpan data yang diperlukan extension, termasuk:
- installation ID acak;
- signed community activation token;
- status pairing/aktivasi;
- konfigurasi dan status proses yang sedang dijalankan.

## Aktivasi komunitas

Saat aktivasi, extension berkomunikasi dengan activation service dan Telegram untuk proses verifikasi komunitas. Data yang diperlukan untuk proses ini dapat mencakup installation ID acak, pairing identifier, identitas Telegram yang diperlukan untuk verifikasi membership, dan hasil status membership.

Detail implementasi internal activation service tidak merupakan bagian dari source repository extension ini.

## Telemetry

V1 tidak mengirim telemetry isi dokumen atau teks OCR ke developer.

## OCR

Release resmi membawa Tesseract.js/WASM dan model bahasa di dalam paket. OCR tidak mengunggah halaman ke layanan OCR cloud.

## Provider logs

Telegram, penyedia hosting activation service, GitHub, Chrome, dan penyedia sumber dapat memiliki logging mereka sendiri sesuai kebijakan masing-masing. Dokumen ini menjelaskan perilaku BMP Terbuka, bukan kebijakan platform pihak ketiga.
