# Edge Worker Deployment Gate — v1.1.0

Edge 1.1.0 tidak boleh dipublikasikan sampai **exact audited `cloudflare-worker-prod` commit** yang menjadi base candidate sudah live dan smoke-tested.

Source Worker berada di `worker/`. Secret/private authority tetap di provider environment.

## Preserve existing production authority

Jangan recreate/rotate hanya demi release 1.1.0:
- `PAIRINGS` KV;
- `BOT_DB` D1;
- signing private JWK;
- Telegram bot/webhook secrets;
- admin/reviewer secrets;
- existing channel/group IDs.

Rotation atau binding replacement adalah perubahan authority terpisah dan bukan bagian release extension.

## Edge channel before publication

Selama candidate/draft/review:

```text
EXTENSION_EDGE_LATEST_VERSION=<current actually available Store version>
EXTENSION_EDGE_MINIMUM_VERSION=<current actually available minimum>
EXTENSION_EDGE_STORE_READY=false
EXTENSION_EDGE_RELEASE_URL=<current listing URL if known>
```

Jangan set `store_ready=true` karena package sudah di-upload. Set true hanya ketika version target benar-benar tersedia dari listing Edge.

## Reviewer secret

```text
STORE_REVIEWER_SECRET=<private strong random value>
```

Secret:
- tidak boleh committed;
- tidak boleh masuk package extension;
- tidak boleh ada di screenshot/public docs;
- hanya boleh masuk provider secret + private certification notes.

## Required live smoke

### Health

```text
GET /health
```

Pastikan live response melaporkan capability yang dipakai kandidat:
- token-v2 activation refresh;
- realtime extension state;
- realtime ads contract;
- ad-event ingest + rate limit + campaign validation;
- reviewer activation.

Version string live harus cocok dengan audited production Worker, bukan commit lama.

### Activation compatibility

Uji:
- existing 1.0.5 activation tetap valid;
- fresh pair 1.1.0;
- one-time legacy→v2 re-verification;
- replacement tidak memperpendek sisa token aktif;
- expiry preservation hanya berlaku untuk Telegram member + install yang sama;
- token-v2 refresh;
- membership failure safe;
- Supporter snapshot/bonus refresh.

### Realtime ads

Uji:
- default/house state;
- active scheduled campaign;
- card update saat popup terbuka;
- interstitial setelah successful START_JOB, 2–5 detik;
- ads failure tidak menahan OCR;
- fabricated/stale campaign metric di-ignore;
- event payload tidak membawa user/document identifier.

### Reviewer flow

1. Start pair dari Store candidate.
2. Buka `/review`.
3. Masukkan Pair ID + private reviewer secret.
4. Confirm signed `store_review` token.
5. Jalankan local OCR fixture.
6. Confirm searchable PDF tersimpan.
7. Confirm normal user tidak mendapat reviewer controls.

## Same-listing upgrade gate

Sebelum Public rollout:
1. gunakan listing/identity Edge yang sama dengan live 1.0.5;
2. lakukan controlled update ke 1.1.0;
3. buktikan tetap ada:
   - `bmpCommunityToken`;
   - `bmpInstallId`;
   - draft/range state;
   - IndexedDB `bmp-terbuka-pdf-cache` / `pdfs`;
   - PDF module cache;
   - resume behavior;
4. lakukan token-v2 re-verification dan pastikan sisa expiry tidak berkurang;
5. lakukan authenticated RBV OCR → PDF → download → resume.

Clean install, unpacked ZIP, atau extension dengan identity berbeda **bukan** bukti gate ini.

## Post-publication

Hanya setelah version 1.1.0 benar-benar tersedia dari Edge Add-ons dan controlled regression lulus:

```text
EXTENSION_EDGE_LATEST_VERSION=1.1.0
EXTENSION_EDGE_RELEASE_URL=<final Edge listing URL>
EXTENSION_EDGE_STORE_READY=true
```

Naikkan `EXTENSION_EDGE_MINIMUM_VERSION` hanya sesuai rollout policy yang memang sudah dapat dipenuhi user dari Store.

## Rollback

Jika backend/store regression gagal:
1. rollback Worker ke immediately previous known-good deployment bila backend penyebabnya;
2. keep `EXTENSION_EDGE_STORE_READY=false`;
3. jangan naikkan minimum version;
4. jangan replace live extension listing;
5. simpan failed candidate/evidence untuk diagnosis; jangan blind retry produksi.
