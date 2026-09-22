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
- remote image creative.

Field `image_url` boleh ada di contract untuk forward compatibility, tetapi image-only campaign tidak dianggap active pada v1.1.0.

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
