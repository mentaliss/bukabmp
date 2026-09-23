# Privacy Policy

BMP Terbuka dirancang **local-first**. Dokumen ini menjelaskan perilaku **BMP Terbuka v1.1.0**, release stabil saat ini.

## Ringkasan

Halaman materi, OCR, cache PDF, penggabungan PDF, dan ekspor PDF diproses di perangkat pengguna. Backend BMP Terbuka tidak menerima password/NIM/cookie portal sumber, gambar halaman materi, teks OCR, atau PDF hasil.

BMP Terbuka tetap melakukan request jaringan untuk aktivasi komunitas, version/realtime state, telemetry pseudonymous, sponsor/advertising state dan metrics, serta Telegram/community flow.

## Penyimpanan lokal

Browser dapat menyimpan installation ID acak, analytics ID acak yang terpisah, signed activation token, pairing state sementara, draft kode BMP/rentang, status pekerjaan, cache PDF per BMP, version-policy cache, dan validated realtime/ads state.

PDF modul disimpan lokal di IndexedDB bmp-terbuka-pdf-cache pada object store pdfs. File di Downloads adalah salinan ekspor.

## Aktivasi komunitas

Extension membuat pairing menggunakan installation ID acak, versi extension, dan distribution channel. Pairing sementara memakai TTL sekitar 15 menit. Membership Telegram diperiksa saat aktivasi/re-verifikasi dan token refresh.

Backend dapat menyimpan data durable untuk fungsi bot, aktivasi, referral, Supporter, dan payment/idempotency. Data tersebut dapat mencakup Telegram user ID internal, activation ledger, referral state, Supporter entitlement, dan record transaksi yang diperlukan untuk rekonsiliasi. Data durable ini tidak berisi halaman BMP, OCR text, atau PDF hasil.

## Telemetry produk pseudonymous

Kandidat v1.1.0 membuat bmpAnalyticsIdV1, UUID acak per instalasi yang terpisah dari installation ID, Telegram identity, activation credential, dan Supporter/payment state.

Event yang di-allowlist saat ini mencakup extension open, job started/completed/failed, paid sponsor impression/click/dismiss, dan media render failure yang terbatas.

Worker mengubah analytics UUID dengan **server-side keyed HMAC** sebelum penyimpanan analytics. Raw analytics UUID bukan key penyimpanan analytics.

Telemetry tidak boleh memuat Telegram ID/username, member reference, activation/pairing secret, kode BMP, nomor/nama modul, URL reader, nama/isi PDF, OCR text, judul/isi dokumen, atau browsing history.

Aktivitas pseudonymous harian dibatasi kira-kira **180 hari**; agregat harian kira-kira **400 hari**.

## Rate limiting dan provider logs

Beberapa endpoint memakai fingerprint satu arah dari alamat IP dengan salt server untuk rate limiting. Telemetry analytics sendiri tidak memakai IP sebagai actor analytics. Cloudflare dan provider/platform lain dapat memiliki log infrastrukturnya sendiri sesuai konfigurasi dan kebijakan provider.

## Sponsor / advertising

Campaign dapat ditampilkan sebagai sponsor card atau interstitial menggunakan renderer yang sudah ada di package. Media direct campaign memakai BMP-owned first-party media ID. Arbitrary advertiser HTML, iframe, tracking pixel, atau executable JavaScript tidak dijalankan sebagai creative extension.

Metrics coarse dapat mencakup impression, click, dismiss, placement, campaign ID + revision, distribution channel, dan extension version.

Event advertising tidak membawa Telegram user ID, installation ID, activation token, kode BMP, modul/halaman, OCR text, atau PDF.

Pemilihan campaign kandidat v1.1.0 bersifat **contextual**, bukan personalized/interest-based/retargeted berdasarkan identitas pengguna, histori penggunaan, kode BMP, atau isi dokumen.

Sponsor/advertiser tidak memperoleh akses ke identitas pribadi pengguna, private activation identity, private telemetry per-user, atau arbitrary tracking capability.

## Pihak ketiga

Fungsi aplikasi berinteraksi dengan layanan yang diperlukan, termasuk Cloudflare, Telegram, browser/store, serta portal sumber yang dibuka pengguna. Masing-masing dapat memiliki log dan kebijakan platform sendiri.

BMP Terbuka tidak menjual isi materi, OCR text, atau PDF pengguna kepada advertiser dan tidak menggunakan data extension untuk personalized advertising/retargeting.
