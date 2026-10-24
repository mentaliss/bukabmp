# Privacy Policy

BMP Terbuka dirancang **local-first**. Dokumen ini menjelaskan perilaku **BMP Terbuka v1.2.0**.

## Ringkasan

Untuk alur OCR/PDF, halaman materi, OCR, cache PDF, penggabungan PDF, dan ekspor PDF diproses di perangkat pengguna. Backend BMP Terbuka tidak digunakan untuk mengunggah raw PDF hasil, gambar halaman materi, password/NIM/cookie portal sumber, atau teks OCR penuh dari alur PDF biasa.

BMP Terbuka tetap menggunakan jaringan untuk fungsi yang memang memerlukannya, termasuk aktivasi komunitas, version/realtime state, telemetry pseudonymous, sponsor/advertising state dan metrics terbatas, Telegram/community flow, Supporter/payment flow, dan Quiz Telegram.

## Penyimpanan lokal

Browser dapat menyimpan installation ID acak, analytics ID acak yang terpisah, signed activation token, pairing state sementara, draft, status pekerjaan, cache PDF per BMP, source Quiz lokal, version-policy cache, serta state lain yang diperlukan fitur lokal.

File di Downloads adalah salinan ekspor dan berbeda dari data yang masih tersimpan di storage extension.

## Backup & Restore

Backup v1.2.0 dibuat untuk pemulihan data lokal pribadi. File backup dapat mengandung data belajar/material yang sebelumnya tersimpan secara lokal.

Karena itu:
- simpan backup di tempat yang kamu percaya;
- jangan membagikan file backup ke group, bot, atau pihak lain tanpa alasan yang jelas;
- menghapus file backup tidak otomatis menghapus storage extension, dan sebaliknya.

Restore memakai **MERGE semantics**. Data dari backup dipulihkan dan item lokal yang cocok dapat diperbarui; data lokal lain yang tidak terkait tidak otomatis dihapus.

## Quiz Telegram

Untuk Quiz:
- raw PDF tidak diunggah untuk pembuatan soal;
- gambar halaman tidak diunggah;
- source Quiz berasal dari teks yang diekstrak dan disanitasi secara lokal;
- bila bank soal perlu dibuat, source teks yang sudah disanitasi dapat dipakai oleh backend/AI generation flow untuk membuat soal;
- source teks asli tersebut tidak disimpan server-side sebagai salinan materi sumber setelah flow generation.

Bank soal, status penggunaan, dan data gameplay yang diperlukan fitur Quiz dapat disimpan server-side sesuai fungsi produk.

## Aktivasi komunitas

Extension membuat pairing menggunakan installation ID acak, versi extension, dan distribution channel. Membership Telegram dapat diperiksa saat aktivasi/re-verifikasi dan token refresh.

Backend dapat menyimpan data durable untuk fungsi bot, aktivasi, referral, Supporter, payment/idempotency, support ticket, dan Quiz. Data tersebut tidak dimaksudkan sebagai storage raw PDF/page-image pengguna.

## Telemetry pseudonymous

Telemetry produk menggunakan identifier pseudonymous terpisah dari identitas Telegram dan activation credential. Payload telemetry di-allowlist dan tidak boleh berisi raw PDF, OCR text, material page image, password, cookie/session sumber, atau activation secret.

Provider/platform seperti Cloudflare, Telegram, browser/store, dan source service dapat memiliki log infrastrukturnya sendiri sesuai konfigurasi dan kebijakan masing-masing.

## Sponsor / advertising

Campaign dapat menampilkan sponsor card/interstitial melalui renderer di package extension. Arbitrary advertiser HTML, iframe, tracking pixel, atau executable JavaScript tidak digunakan sebagai creative extension.

Metrics coarse dapat mencakup impression, click, dismiss, placement, campaign ID/revision, distribution channel, dan extension version. Event advertising tidak membawa raw PDF/OCR text atau credential sumber.

## Pihak ketiga

BMP Terbuka tidak menjual isi materi, OCR text, atau PDF pengguna kepada advertiser dan tidak menggunakan isi dokumen untuk personalized advertising/retargeting.
