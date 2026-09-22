# Sponsor Surface — v1.1.0

Status: kandidat v1.1.0, **disabled by default untuk paid campaign** sampai state backend mengaktifkannya. House inventory tetap tersedia.

BMP Terbuka memiliki dua sponsor surface yang seluruh renderernya berada di package extension:

1. **Sponsor card** di popup utama.
2. **Sponsor interstitial** setelah user berhasil memulai job.

## Invariant UX

- Label sponsor selalu terlihat.
- Jika tidak ada campaign aktif, card memakai house inventory seperti **Space iklan tersedia** dan CTA kontak.
- Setelah `START_JOB` sukses, interstitial dijadwalkan secara acak dalam jendela **2–5 detik**.
- Job/OCR dimulai lebih dulu. Fetch/render sponsor tidak boleh menahan job.
- User tetap memiliki tombol tutup interstitial; browser popup juga tetap tunduk pada lifecycle browser.
- Tidak ada sponsor yang diinjeksi ke halaman sumber.

## Realtime control

Backend dapat mengubah tanpa release extension:
- campaign ID + revision;
- jadwal start/end;
- sponsor label / advertiser;
- headline/body/disclaimer plain text;
- HTTPS CTA;
- card/interstitial placement;
- house-ad copy + contact CTA;
- delay interstitial, tetapi client/backend tetap meng-clamp ke 2–5 detik.

Popup yang terbuka meminta fresh state setiap 30 detik dan job trigger melakukan fresh fetch lagi.

## Safety boundary

v1.1.0 tidak merender:
- remote HTML;
- JavaScript/WASM;
- iframe;
- tracking pixel;
- media dari URL arbitrary milik advertiser.

Image/video sponsor hanya dirender dari media ID berbasis content hash yang diunggah melalui Control Center, divalidasi Worker, disimpan di BMP-owned R2, lalu dilayani dari endpoint first-party `/v1/media/:id`. Field legacy `image_url` tetap disanitasi untuk kompatibilitas schema tetapi tidak dipakai sebagai sumber media v1.1.0.

Semua dynamic text masuk melalui `textContent`. CTA harus HTTPS dan melewati sanitizer client.

## Event metrics

Campaign aktif dapat mengirim coarse event:
- impression;
- click;
- dismiss.

Payload hanya:
- event type;
- placement;
- campaign ID;
- revision;
- distribution channel;
- extension version.

Tidak ada Telegram user ID, install ID, activation token, kode BMP, modul, halaman, OCR text, atau PDF.

Backend:
- rate-limits event ingest;
- memvalidasi event terhadap campaign/revision/placement yang sedang aktif;
- mengabaikan stale/fabricated campaign event.

## House inventory

House inventory adalah fallback wajib UI ketika tidak ada paid campaign atau backend state tidak tersedia. Default lokal:

```text
Sponsor
Space iklan tersedia
Pasang iklan? Hubungi
```

Backend boleh mengubah copy/CTA house inventory secara realtime, tetapi local fallback tetap ada agar surface tidak menjadi card kosong.


## v1.1.0 media contract

Direct paid sponsor creative remains declarative JSON. Creative version 2 is additive: legacy text fields remain the fallback, while card creative may reference a BMP-owned banner asset and interstitial creative may reference a BMP-owned image or video asset. The extension derives media URLs only from its configured BMP Worker origin and a validated media ID.

Card priority is Direct BMP Sponsor → AdsOnBread fallback → House Ad. Interstitial priority is Direct BMP Sponsor → House Ad; AdsOnBread is never an interstitial. Media failures fall back without blocking START_JOB, OCR, cache writes, downloads, STOP, or popup resume. The interstitial clock remains random 2–5 seconds and begins only after START_JOB succeeds.

Image media accepts JPEG, PNG, and WebP up to 3 MiB. SVG and GIF are rejected. Video accepts MP4 and WebM up to 10 MiB and 15 seconds, uses muted inline autoplay, does not loop indefinitely, remains closable, and uses `object-fit: contain`.

The repository includes a local AdsOnBread test adapter for no-fill/failure behavior. A live vendor SDK is not claimed here; before release it must be obtained under the provider terms, vendorized locally, reviewed, and reflected in privacy/store disclosures.
