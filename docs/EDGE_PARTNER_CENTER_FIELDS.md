# Microsoft Edge Add-ons — Partner Center Fields

Status: submission copy for the current Edge candidate. Initial launch mode: **Hidden**.

## Availability

- Visibility: **Hidden**
- Markets: all available markets
- Pricing: free
- Category: Productivity
- Mature content: No

Hidden is intentional for the first certification so the published Store identity/listing can be tested from its direct listing URL before broad discovery is enabled.

## Store identity

Name:

```text
BMP Terbuka
```

Short description:

```text
Simpan materi BMP yang dapat Anda akses menjadi PDF yang dapat dicari dengan pemrosesan lokal.
```

Full description:

```text
BMP Terbuka membantu pengguna mengubah materi BMP yang sudah dapat mereka akses menjadi PDF yang dapat dicari untuk kebutuhan belajar dan offline.

OCR, penyusunan PDF, cache modul, resume, ekspor ulang, dan penggabungan PDF diproses secara lokal di perangkat. Extension tidak melewati login atau hak akses sumber dan tidak mengirim gambar halaman, teks OCR, atau PDF hasil ke layanan aktivasi.

BMP Terbuka menggunakan aktivasi komunitas untuk mengelola akses extension. Layanan aktivasi hanya menerima data operasional yang diperlukan untuk pairing, kebijakan versi, dan state/content yang aman. Executable OCR/PDF tetap dibundel di package Store.

Kandidat 1.1.0 juga dapat menampilkan sponsor card/interstitial dari plain realtime state. Sponsor tidak menerima isi dokumen; event pengukuran bersifat coarse dan tidak memuat identitas user, kode BMP, OCR text, atau PDF.

BMP Terbuka adalah proyek komunitas independen dan bukan produk resmi atau perwakilan penyedia materi.
```

Search terms:

```text
BMP
PDF
OCR
belajar
modul
```

Single purpose:

```text
Membantu pengguna mengubah materi BMP yang sudah dapat mereka akses menjadi searchable PDF yang diproses dan disimpan secara lokal untuk belajar/offline.
```

## Public URLs

Source/Homepage:

```text
https://github.com/mentaliss/bukabmp
```

Support:

```text
https://github.com/mentaliss/bukabmp/issues
```

Privacy policy:

```text
https://github.com/mentaliss/bukabmp/blob/main/PRIVACY.md
```

Before submission, merge the audited 1.1.0 privacy text to the canonical public branch and confirm the exact live Worker behavior matches it. Do not point Partner Center at a stale candidate branch.

## Logo and screenshots

Existing Store logo source:

```text
extension/icons/icon128.png
```

It is a 128×128 PNG and meets the Edge Add-ons minimum logo size.

Screenshots are optional for the initial hidden submission. Add real tested screenshots later if desired; do not use mockups that imply functionality not present in the submitted package.

## Permission explanations

### storage

Stores extension-local operational state: random installation ID, signed activation token, pending pairing state, job/draft state, cache metadata, version policy, and validated Cloud Surface cache. PDF module cache itself is stored locally in extension IndexedDB.

### downloads

Saves user-requested searchable PDF files generated locally by the extension to the browser Downloads area.

### offscreen

Runs the bundled OCR/PDF workload in an offscreen extension document. The Manifest V3 service worker is not suitable for the long-lived DOM/Worker execution required by local OCR.

### clipboardWrite

Provides a copy fallback for activation/share text in extension popup contexts, including Android/Edge contexts where Web Share or async Clipboard support can vary.

### Host: https://pustaka.ut.ac.id/*

Runs the reader integration only on the authenticated reader and accesses source resources the user can already access. The extension does not bypass source login or authorization.

### Host: https://community.bukabmp.workers.dev/*

Used for community pairing/activation, token-v2 refresh, channel-specific version policy, reviewer activation, validated realtime state/plain content, and coarse sponsor events. Sponsor events contain event/placement/campaign/revision/channel/extension-version only; they do not carry Telegram ID, install ID, activation token, BMP code, page images, OCR text, or generated PDFs.

### tabs

The Edge Store package does **not** request the broad `tabs` permission. It uses narrow host access and the Tabs API operations that do not require the broad permission.

## Remote code declaration

```text
No remote executable code is used at runtime.
```

Tesseract.js, Tesseract core WebAssembly variants, pdf-lib, and Indonesian tessdata are bundled in the Store package. Build-time downloads are pinned to known versions/immutable source and verified by expected SHA-256. The live service may send validated state/plain text and select only from action types already implemented in the package; it cannot send JavaScript, arbitrary HTML, remote WASM, remote Worker code, or new executable functionality.

## Data use summary

- source document/page processing: local device only;
- OCR text: local device only;
- generated PDFs: local device/browser Downloads only;
- module PDF cache: extension IndexedDB only;
- activation pairing: community Worker;
- version/channel policy: community Worker;
- Cloud Surface state/plain content: community Worker;
- sponsor events: coarse campaign/event metadata only;
- durable bot/activation/Supporter/referral/payment records: as documented in `PRIVACY.md`;
- no source passwords, NIM, source cookie/session, page images, OCR text, or generated PDFs are sent to the backend;
- no document/OCR content is used for advertising or profiling.

## Certification notes

Use these notes only after the exact audited 1.1.0 Worker is live and a private reviewer secret has been configured.

```text
BMP Terbuka normally processes material from a third-party authenticated reader that the user is already authorized to access. We do not provide, request, or bypass third-party credentials.

For certification, the submitted build includes a reviewer-only local OCR fixture. It uses the same bundled Tesseract/PDF pipeline without requiring access to the third-party source.

Reviewer activation:
1. Open the extension popup and start activation.
2. Copy the Pair ID shown in the popup.
3. Open https://community.bukabmp.workers.dev/review
4. Enter the Pair ID and the private reviewer code supplied below.
5. Return to the popup. The signed reviewer token will be detected automatically.
6. A "Store certification test" panel will appear.
7. Click "Jalankan sampel OCR lokal".
8. Confirm a searchable PDF is saved to Downloads and recognized text is displayed in the popup.

The reviewer path issues the normal signed installation-bound token with a short-lived store_review scope. It is not a universal client bypass and can be revoked server-side.

Reviewer code:
<PASTE STORE_REVIEWER_SECRET HERE IN PARTNER CENTER ONLY — NEVER COMMIT IT>
```

## Publication sequence

1. Deploy the exact tested production Worker commit used by the audited 1.1.0 candidate.
2. Configure Edge channel with `store_ready=false`.
3. Configure a private `STORE_REVIEWER_SECRET`.
4. Verify live pairing, `/review`, reviewer OCR sample, version policy, and Cloud Surface.
5. Upload the latest green `BMP-Terbuka-v1.1.0-EDGE.zip` only after the controlled same-listing upgrade gate is ready.
6. Paste the listing/privacy/certification fields above.
7. Submit as **Hidden**.
8. When status becomes `In the store`, capture the Edge listing URL/Store identity.
9. Test the Store edition, including Edge Canary Android install-by-ID/listing path where available.
10. Set `EXTENSION_EDGE_RELEASE_URL` to the final listing URL and then `EXTENSION_EDGE_STORE_READY=true`.
11. If a 1.0.5 Edge Store listing already exists, prove same-listing 1.0.5 → 1.1.0 preserves activation token, install ID, draft, IndexedDB PDF cache, and resume behavior. If 1.1.0 is the first Edge Store listing, record that it is a new identity and do not claim migration from the manually signed CRX.
12. Change visibility to Public only after controlled Store + authenticated real-device regression passes.
