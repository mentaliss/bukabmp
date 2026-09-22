# Privacy Policy

BMP Terbuka dirancang **local-first**. Dokumen ini menjelaskan perilaku client extension BMP Terbuka v1.0.5 Store candidate dan perilaku backend Store-control V11 yang harus sudah live sebelum candidate disubmit ke Store.

## Data materi

Extension memproses halaman materi, OCR, dan penyusunan PDF di perangkat pengguna. Community/activation service tidak digunakan untuk menerima:
- password atau credential portal sumber;
- NIM;
- cookie/session portal sumber;
- gambar halaman materi;
- teks OCR isi materi;
- PDF hasil.

OCR tidak menggunakan layanan OCR cloud. Tesseract.js, WebAssembly OCR, model bahasa Indonesia, dan pdf-lib dibundel di dalam release extension.

## Penyimpanan lokal PDF

Selain salinan yang diekspor melalui browser Downloads, extension menyimpan PDF modul secara lokal di IndexedDB extension agar pengguna dapat:
- melanjutkan proses tanpa mengulang OCR modul yang sudah selesai;
- mengekspor ulang PDF modul;
- membuat PDF gabungan dari modul yang sudah tersedia;
- melihat ringkasan penyimpanan per BMP.

Database client saat ini bernama `bmp-terbuka-pdf-cache` dengan object store `pdfs`. Data ini berada di storage origin extension dan tidak dikirim ke community/activation service.

Pengguna dapat menghapus penyimpanan lokal untuk BMP yang sedang dipilih dari UI extension. Menghapus cache BMP tidak menghapus file yang sebelumnya sudah diekspor ke Downloads. Data extension juga dapat hilang ketika pengguna menghapus extension atau membersihkan storage extension melalui browser.

## Data lokal extension

Browser extension local storage dapat menyimpan data operasional, termasuk:
- installation ID acak yang dibuat oleh extension;
- signed community activation token;
- status pairing/aktivasi;
- draft input dan konfigurasi proses;
- status pekerjaan yang sedang/terakhir dijalankan;
- metadata cache per BMP;
- cache kebijakan versi/update;
- cache Cloud Surface yang telah divalidasi.

Installation ID bukan NIM dan bukan credential portal sumber.

## Aktivasi komunitas dan retention

Pada backend Store-control V11, sesi pairing disimpan sementara di Cloudflare KV namespace yang digunakan layanan komunitas. Record pairing berisi data operasional seperti installation ID acak, versi extension, distribution channel, hash poll secret, status, dan waktu pembuatan. Setelah verifikasi, record sementara juga dapat memuat signed activation token.

Pairing record memakai TTL **15 menit** dan kedaluwarsa otomatis.

Untuk membatasi abuse pada pembuatan pairing, service dapat membuat fingerprint satu arah dari alamat IP request menggunakan salt rahasia. Counter rate-limit tersebut memakai TTL **60 detik**. Nilai IP mentah tidak disimpan dalam KV record rate-limit itu.

Membership Telegram diperiksa ketika aktivasi dilakukan. Ordinary community activation pada backend Store-control V11 tidak membuat record identitas Telegram jangka panjang setelah sesi pairing berakhir. Signed community token yang diterima extension disimpan lokal di browser dan normalnya berlaku **14 hari**.

## Store reviewer activation

Store reviewer menggunakan jalur khusus yang tetap menghasilkan signed token normal, terikat ke installation ID dan diverifikasi client dengan public key yang dibundel.

- reviewer secret hanya dikonfigurasi server-side dan tidak dimasukkan ke package extension atau repository publik;
- rate-limit reviewer menggunakan fingerprint satu arah dari IP dengan TTL **10 menit**;
- reviewer token memiliki masa berlaku maksimum **24 jam**;
- reviewer token membawa scope `store_review` sehingga panel certification lokal hanya terlihat oleh reviewer yang telah diverifikasi.

Panel certification memproses fixture gambar yang dibuat lokal di extension melalui engine OCR/PDF yang sama. Fixture tersebut bukan materi BMP asli dan tidak membutuhkan credential sumber.

## Pemeriksaan versi

Extension dapat menghubungi community service untuk memperoleh kebijakan versi. Request mencakup versi extension dan distribution channel.

Chrome Web Store dan Edge Add-ons memakai policy channel terpisah. Remote minimum-version enforcement untuk channel Store hanya diterapkan setelah service menandai channel tersebut `store_ready=true`, sehingga versi yang masih draft atau dalam review tidak mengunci pengguna.

## Realtime state/content

Store candidate dapat meminta `/v1/extension-state` dengan versi extension dan distribution channel. Response hanya boleh berisi state/plain content yang lolos allowlist client, seperti section visibility, judul/teks, feature flag, dan action dari registry tetap. Payload disimpan sementara di local storage sebagai cache sesuai TTL server yang dibatasi client.

Request ini tidak memuat halaman BMP, gambar halaman, teks OCR, PDF, password, NIM, atau cookie/session portal.

Server tidak boleh mengirim JavaScript, arbitrary HTML, remote WASM, executable Worker URL, atau functionality baru untuk dieksekusi extension.

## Fitur Supporter/Support Bot terpisah

Community service juga dapat melayani fitur Telegram Supporter/Support Bot yang dipicu pengguna secara terpisah dari fungsi inti extension. Pada backend candidate yang diaudit:
- draft invoice Supporter memakai TTL **24 jam**;
- konteks troubleshooting Supporter memakai TTL **6 jam**;
- counter kuota AI memakai TTL **48 jam**;
- record entitlement Supporter, pilihan Supporter Wall, dan bukti/idempotency pembayaran dapat disimpan tanpa TTL otomatis selama diperlukan untuk menjalankan entitlement, pilihan publikasi, dan pencatatan transaksi.

Supporter bersifat opsional dan bukan syarat untuk fungsi OCR/PDF inti. Data Supporter tidak berisi halaman materi, OCR text, atau PDF hasil. Pengelola harus menangani permintaan koreksi/penghapusan data yang dapat dihapus tanpa merusak kewajiban transaksi atau pencegahan duplikasi pembayaran.

## Telemetry dan logging

Client tidak mengirim isi dokumen, gambar halaman, teks OCR, atau PDF hasil sebagai telemetry kepada developer.

Cloudflare, Telegram, GitHub, Microsoft Edge, browser, dan penyedia sumber dapat menghasilkan log platform mereka sendiri sesuai konfigurasi/kebijakan masing-masing. Retention log platform yang tidak dikendalikan langsung oleh source BMP Terbuka tidak dinyatakan sebagai retention record aplikasi di atas.

## Sharing dan penggunaan data

Client tidak menggunakan isi BMP, hasil OCR, atau PDF untuk advertising atau profiling. Fitur sponsor/ads tidak termasuk dalam initial Edge Store candidate.

Jika fitur sponsor/ads ditambahkan pada release masa depan, privacy disclosure dan Store listing harus diperbarui sebelum fitur tersebut diaktifkan.

## v1.1.0 candidate: anonymous product analytics and sponsor media

The candidate adds compact anonymous product telemetry for extension opens, job lifecycle health, and paid-direct sponsor delivery. A random per-installation `bmpAnalyticsIdV1` is separate from `bmpInstallId`, activation credentials, Telegram identity, and Supporter/payment state. The Worker transforms the incoming analytics ID with an independent server-side HMAC key (`TELEMETRY_HASH_KEY`) before analytics storage; the raw analytics ID is not used as the stored actor identifier. Per-day pseudonymous activity is bounded to roughly 180 days and daily aggregate metrics to roughly 13 months; the minimal actor-hash index supports unique-install and returning-user definitions without retaining the raw analytics UUID.

Telemetry is strictly product-usage data. It must not include Telegram IDs or usernames, member references, activation or pairing credentials, `bmpInstallId`, BMP codes, module names/numbers, RBV URLs, PDF names/content, OCR text, document titles/content, or browsing history. Telemetry delivery is failure-tolerant and BMP processing does not depend on it.

Direct sponsor media is uploaded through the owner Control Center and stored under BMP-owned first-party media IDs. The extension does not render arbitrary advertiser-controlled media URLs. The AdsOnBread production SDK/account remains an external release gate; remote executable JavaScript is not permitted by this integration.

