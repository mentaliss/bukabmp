# Privacy Policy

BMP Terbuka dirancang **local-first**. Dokumen ini menjelaskan perilaku client extension BMP Terbuka v1.0.5/Store candidate. Klaim di bawah dibatasi pada perilaku yang dapat dibuktikan dari source client publik.

## Data materi

Extension memproses halaman materi, OCR, dan penyusunan PDF di perangkat pengguna. Activation service tidak digunakan untuk menerima:
- password atau credential portal sumber;
- NIM;
- cookie/session portal sumber;
- gambar halaman materi;
- teks OCR isi materi;
- PDF hasil.

OCR tidak menggunakan layanan OCR cloud. Tesseract.js, WebAssembly OCR, model bahasa Indonesia, dan pdf-lib dibundel di dalam release extension.

## Penyimpanan lokal PDF

Selain salinan yang diekspor melalui Chrome Downloads, v1.0.5 menyimpan PDF modul secara lokal di IndexedDB extension agar pengguna dapat:
- melanjutkan proses tanpa mengulang OCR modul yang sudah selesai;
- mengekspor ulang PDF modul;
- membuat PDF gabungan dari modul yang sudah tersedia;
- melihat ringkasan penyimpanan per BMP.

Database client saat ini bernama `bmp-terbuka-pdf-cache` dengan object store `pdfs`. Data ini berada di storage origin extension dan tidak dikirim ke activation service.

Pengguna dapat menghapus penyimpanan lokal untuk BMP yang sedang dipilih dari UI extension. Menghapus cache BMP tidak menghapus file yang sebelumnya sudah diekspor ke folder Downloads. Data extension juga dapat hilang ketika pengguna menghapus extension atau membersihkan storage extension melalui browser.

## Data lokal extension

Chrome local storage dapat menyimpan data yang diperlukan extension, termasuk:
- installation ID acak yang dibuat oleh extension;
- signed community activation token;
- status pairing/aktivasi;
- draft input dan konfigurasi proses;
- status pekerjaan yang sedang/terakhir dijalankan;
- metadata cache per BMP;
- cache kebijakan versi/update.

Installation ID bukan NIM dan bukan credential portal sumber.

## Aktivasi komunitas

Saat aktivasi, extension berkomunikasi dengan activation service dan Telegram untuk proses verifikasi komunitas. Request client dapat mencakup installation ID acak, versi extension, distribution channel, pairing identifier/poll secret, dan data yang diperlukan server untuk memverifikasi status membership Telegram.

Client menerima signed activation token dan memverifikasi signature, issuer, audience, installation ID, dan expiry token secara lokal menggunakan public key yang dibundel di extension.

Source repository client ini tidak memuat implementation, database, atau konfigurasi retention activation service. Karena itu repository ini tidak membuat klaim yang tidak dapat dibuktikan mengenai jangka retention server-side. **Sebelum submission publik CWS, operator backend harus mengisi dan mempublikasikan retention/deletion policy aktual activation service.**

## Pemeriksaan versi

Extension dapat menghubungi activation service untuk memperoleh kebijakan versi. Request mencakup versi extension dan distribution channel. Untuk build Chrome Web Store dan Edge Add-ons, remote minimum-version enforcement hanya diterapkan setelah service secara eksplisit menandai versi channel Store tersebut sebagai siap/published; package update tetap dikelola oleh browser/Store.

## Realtime state/content

Kandidat Store dapat meminta `/v1/extension-state` dengan versi extension dan distribution channel. Response yang valid hanya boleh berisi state/plain content yang lolos allowlist client, seperti section visibility, judul/teks, feature flag, dan action dari registry tetap. Payload disimpan sementara di local storage sebagai cache.

Request ini tidak memuat halaman BMP, gambar halaman, teks OCR, PDF, password, NIM, atau cookie/session portal.

## Telemetry

Client v1.0.5 tidak mengirim isi dokumen, gambar halaman, teks OCR, atau PDF hasil sebagai telemetry kepada developer.

## Cloud-controlled state/content

Arsitektur kandidat Store memperbolehkan server mengirim data/state yang tervalidasi seperti boolean, teks, label, tanggal, URL HTTPS, dan feature flag untuk code path yang sudah ada di package. Server tidak boleh mengirim JavaScript, arbitrary HTML, remote WASM, atau functionality baru untuk dieksekusi extension.

## Sharing dan penggunaan data

Client tidak menggunakan isi BMP, hasil OCR, atau PDF untuk advertising atau profiling. Jika fitur sponsor/ads ditambahkan pada release masa depan, privacy disclosure harus diperbarui sebelum fitur tersebut diaktifkan dan tetap mengikuti kebijakan Store yang relevan.

## Provider logs

Telegram, penyedia hosting activation service, GitHub, Chrome, dan penyedia sumber dapat memiliki logging mereka sendiri sesuai kebijakan masing-masing. Dokumen ini menjelaskan perilaku BMP Terbuka, bukan kebijakan platform pihak ketiga.
