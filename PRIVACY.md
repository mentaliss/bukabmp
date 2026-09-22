# Privacy Policy

BMP Terbuka dirancang **local-first**. Dokumen ini menjelaskan perilaku source extension dan Cloudflare Worker yang digunakan kandidat v1.1.0.

## Data materi

Extension memproses halaman materi, OCR, cache PDF, penggabungan PDF, dan ekspor PDF di perangkat pengguna. Backend BMP Terbuka tidak menerima:
- password atau credential portal sumber;
- NIM;
- cookie/session portal sumber;
- gambar halaman materi;
- teks OCR isi materi;
- PDF hasil.

OCR tidak menggunakan layanan OCR cloud. Tesseract.js, WebAssembly OCR, model bahasa Indonesia, dan pdf-lib dibundel di package release.

## Penyimpanan lokal extension

Browser dapat menyimpan data operasional di storage origin extension, antara lain:
- installation ID acak yang dibuat extension;
- signed community activation token;
- status pairing sementara;
- draft kode BMP/rentang dan opsi proses;
- status pekerjaan;
- metadata cache per BMP;
- version-policy cache;
- validated realtime state/ads cache.

PDF modul disimpan lokal di IndexedDB `bmp-terbuka-pdf-cache`, object store `pdfs`, dengan key per BMP seperti `CODE:M1`. File di Downloads hanyalah salinan ekspor. Mengosongkan cache satu BMP tidak menghapus file yang sudah diekspor.

Update **in-place dengan extension identity yang sama** mempertahankan storage browser menurut model extension Chromium. Uninstall, pembersihan storage browser, atau instalasi dengan identity berbeda dapat menghilangkan/memisahkan data tersebut.

## Aktivasi komunitas

Extension membuat pairing ke backend dengan:
- installation ID acak;
- versi extension;
- distribution channel;
- pada one-time legacy→v2 re-verification, current signed activation token dapat dikirim kembali ke backend agar sisa masa aktif tidak dipendekkan.

Backend memverifikasi token tersebut secara kriptografis. Token invalid, expired, atau dari install berbeda tidak memberi expiry floor. Untuk expiry-preservation, member reference satu arah juga harus cocok dengan akun Telegram yang melakukan verifikasi.

Pairing sementara disimpan di Cloudflare KV dengan TTL **15 menit**. Record pairing dapat memuat installation ID, version/channel, hash poll secret, status, timestamp, expiry floor/member reference tervalidasi, dan setelah sukses signed activation token untuk diambil client selama TTL tersebut.

Membership Telegram diperiksa saat aktivasi/re-verifikasi dan token refresh. Signed activation token disimpan oleh extension, terikat ke installation ID, dan diverifikasi lokal menggunakan public key.

## Durable account/activation data

Backend v1.1.0 juga menggunakan D1/KV untuk fungsi bot, aktivasi, referral, dan Supporter. Bergantung feature gate produksi, data berikut dapat disimpan lebih lama daripada sesi pairing:
- Telegram user ID internal untuk user bot;
- first/last activation timestamp dan activation count;
- opaque referral code dan referral/qualification state;
- Supporter entitlement dan target masa aktivasi;
- payment/idempotency records yang dibutuhkan untuk mencegah kredit ganda dan merekonsiliasi transaksi;
- pilihan Supporter Wall dan state operasional terkait.

Data durable tersebut tidak berisi halaman BMP, gambar materi, teks OCR, atau PDF hasil. Source saat ini tidak memberi TTL otomatis untuk seluruh record D1 tersebut; retention mengikuti kebutuhan operasional/transaksi sampai ada proses penghapusan/migrasi yang berlaku.

## Supporter dan Support Bot

Supporter bersifat opsional dan bukan syarat untuk OCR/PDF inti. Source saat ini menggunakan beberapa record sementara:
- draft invoice Supporter: TTL **24 jam**;
- konteks troubleshooting Supporter: TTL **6 jam**;
- counter kuota AI: TTL **48 jam**.

Entitlement, payment/idempotency, referral, dan activation ledger dapat bersifat durable sebagaimana dijelaskan di atas.

## Rate limiting dan anti-abuse

Beberapa endpoint memakai fingerprint satu arah dari alamat IP dengan salt server:
- pair start: counter TTL **60 detik**;
- ad-event ingest: counter TTL **60 detik**;
- reviewer activation: counter TTL **10 menit**.

Source aplikasi tidak menyimpan IP mentah di record counter tersebut. Infrastruktur Cloudflare dapat memiliki log platform tersendiri sesuai konfigurasi/provider.

## Pemeriksaan versi dan realtime state

Extension dapat meminta:
- `/v1/version` dengan versi extension + distribution channel;
- `/v1/extension-state` dengan versi extension + distribution channel.

Realtime state berisi plain state/content yang melewati allowlist client. Backend tidak dapat mengirim JavaScript, arbitrary HTML, remote WASM, remote Worker, atau functionality baru untuk dieksekusi extension.

Untuk channel Store, remote minimum-version enforcement hanya berlaku setelah backend menandai channel tersebut `store_ready=true`.

## Sponsor / ads v1.1.0

Kandidat v1.1.0 memiliki sponsor card dan sponsor interstitial yang dirender oleh code yang sudah ada di package. Campaign dapat mengubah plain text, label, HTTPS CTA, jadwal, placement, dan delay yang dibatasi client/backend. Tidak ada remote HTML/JavaScript/iframe/tracking pixel. Image-only campaign tidak diaktifkan pada v1.1.0.

Jika tidak ada campaign aktif atau state tidak tersedia, extension dapat menampilkan house inventory seperti **Space iklan tersedia** dengan CTA kontak yang aman.

Untuk campaign aktif, extension dapat mengirim event coarse:
- `impression`, `click`, atau `dismiss`;
- placement (`card` / `interstitial`);
- campaign ID + revision;
- distribution channel;
- extension version.

Event ads **tidak** memuat Telegram user ID, installation ID, activation token, kode BMP, nama modul, halaman, OCR text, atau PDF. Backend memvalidasi event terhadap campaign/revision/placement yang sedang aktif sebelum menghitungnya. Jika Analytics Engine tersedia, field coarse tersebut dapat dicatat di sana; source juga dapat menulis event coarse ke log Worker. Retention log/Analytics Engine mengikuti konfigurasi/provider yang berlaku.

Isi BMP/OCR/PDF tidak digunakan untuk advertising atau profiling.

Pemilihan campaign v1.1.0 bersifat **contextual pada distribution channel/campaign state**, bukan berdasarkan identitas pengguna, histori penggunaan, kode BMP, isi dokumen, atau profil personal. BMP Terbuka tidak menggunakan atau mentransfer data pengguna extension untuk personalized/interest-based/retargeted advertising.

Karena sponsor adalah bagian dari pengalaman runtime, listing Store dan privacy disclosure untuk release yang memuat fitur ini harus menjelaskan keberadaan sponsor card/interstitial secara akurat.

## Store reviewer

Reviewer Store memakai signed token normal yang terikat installation ID dan diverifikasi client. Reviewer secret tetap server-side dan tidak masuk package/repository.

Reviewer token memiliki masa berlaku maksimum **24 jam** dan scope `store_review`. Reviewer-only OCR fixture dibuat lokal dan bukan materi BMP asli.

## Sharing dan pihak ketiga

Fungsi aplikasi berinteraksi dengan layanan yang memang diperlukan, termasuk Cloudflare untuk backend, Telegram untuk komunitas/bot, browser/store untuk extension distribution, dan portal sumber yang dibuka pengguna. Masing-masing penyedia dapat memiliki log/kebijakan platform sendiri.

BMP Terbuka tidak menjual isi materi, OCR text, atau PDF pengguna kepada advertiser.

Penggunaan data oleh BMP Terbuka mengikuti pembatasan penggunaan yang dijelaskan di kebijakan ini; data pengguna extension tidak ditransfer, digunakan, atau dijual untuk personalized advertising atau retargeting.
