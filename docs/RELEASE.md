# Extension Release Process

Repository ini membangun **satu shared extension source** untuk beberapa jalur distribusi.

## Tujuan release

End-user release harus:
- self-contained;
- tidak memerlukan BAT/Python/Tesseract desktop;
- tidak menjalankan OCR JavaScript/WASM dari CDN saat runtime;
- membawa konfigurasi public activation API yang diperlukan client;
- mencatat provenance vendor yang dibundel.

## Local validation

Source:

```bash
npm run validate
```

## GitHub/manual build

Development:

```bash
npm run build
```

Production/manual:

```bash
BMP_API_BASE_URL="https://..." \
BMP_TELEGRAM_CHANNEL_URL="https://t.me/..." \
BMP_TELEGRAM_GROUP_URL="https://t.me/..." \
npm run build:release
```

Output tetap kompatibel dengan pipeline v1.0.5:

```text
dist/BMP-Terbuka-v<VERSION>/
```

## Store candidates

Chrome Web Store:

```bash
BMP_API_BASE_URL="https://community.bukabmp.workers.dev" \
BMP_TELEGRAM_CHANNEL_URL="https://t.me/bukabmp" \
BMP_TELEGRAM_GROUP_URL="https://t.me/..." \
npm run build:cws
npm run validate:cws
```

Output:

```text
dist/cws/BMP-Terbuka-v<VERSION>/
```

Microsoft Edge Add-ons:

```bash
BMP_API_BASE_URL="https://community.bukabmp.workers.dev" \
BMP_TELEGRAM_CHANNEL_URL="https://t.me/bukabmp" \
BMP_TELEGRAM_GROUP_URL="https://t.me/..." \
npm run build:edge
npm run validate:edge
```

Output:

```text
dist/edge/BMP-Terbuka-v<VERSION>/
```

Store builds:
- set channel to `cws` or `edge`;
- remove broad `tabs` permission from the packaged manifest;
- keep the shared runtime source unchanged;
- bundle OCR/PDF dependencies locally;
- verify every fetched vendor against known-good SHA-256;
- pin Indonesian tessdata to an immutable upstream commit and digest.

For Store upload, zip the **contents** of that directory so `manifest.json` is at ZIP root:

```bash
VERSION=$(node -p "require('./extension/manifest.json').version")
(
  cd "dist/cws/BMP-Terbuka-v${VERSION}"
  zip -qr "../../BMP-Terbuka-v${VERSION}-CWS.zip" .
)
```

The `Store and Compatibility Candidate` GitHub Actions workflow automatically validates source, builds and validates `github`, `android`, `cws`, and `edge` profiles, creates flat-root CWS/Edge ZIPs, generates checksums, and uploads both Store artifacts.

## GitHub release

Existing GitHub release behavior remains:
1. update changelog/version when a real release is approved;
2. tag `v<VERSION>`;
3. `release.yml` validates source;
4. builds the self-contained manual package;
5. creates ZIP/checksum and GitHub Release.

## Rilis lokal dari Windows (jalur utama sejak 2026-10-24)

GitHub Actions bisa tidak tersedia (mis. limit billing akun). Rilis tetap bisa
dijalankan penuh dari mesin Windows Owner; CI hanya bukti tambahan, bukan syarat.

Semua perintah di bawah dijalankan dari root repo, PowerShell:

```powershell
$env:BMP_API_BASE_URL="https://community.bukabmp.workers.dev"
$env:BMP_TELEGRAM_CHANNEL_URL="https://t.me/bukabmp"
$env:BMP_TELEGRAM_GROUP_URL="https://t.me/+0pAg9ymEhWdkZmNl"

npm run validate            # validasi + suite cloud
npm run test:worker         # suite worker
npm run build:release       # paket manual (GitHub)
npm run package:github      # zip + receipt (source_dirty wajib false)
```

Untuk Store (opsional, kapan saja):

```powershell
npm run build:cws ; npm run validate:cws ; npm run package:cws
npm run build:edge ; npm run validate:edge ; npm run package:edge
```

Deploy backend (tetap manual, tidak pernah otomatis dari push):

```powershell
npx wrangler deployments list                                        # catat versi aktif untuk rollback
npx wrangler d1 migrations apply bmp-terbuka-bot-v2 --remote         # migrasi tertunda
npx wrangler d1 execute bmp-terbuka-bot-v2 --remote --command="SELECT id,name FROM d1_migrations ORDER BY id;"
npx wrangler deploy
npx wrangler deployments list                                        # versi baru tercatat
```

Konfigurasi Worker ada di `worker/wrangler.jsonc` (worker `community`, D1
`bmp-terbuka-bot-v2`); jalankan perintah `wrangler` dari folder `worker/`.

Rilis GitHub tanpa `release.yml`:

```powershell
git tag v1.3.0
git push origin v1.3.0
gh release create v1.3.0 --title "BMP Terbuka v1.3.0" --notes-file CHANGELOG.md "dist/BMP-Terbuka-v1.3.0-github.zip"
```

`npm run package:github` menaruh paket di `dist/BMP-Terbuka-v<VERSION>/` beserta
zip `dist/BMP-Terbuka-v<VERSION>-github.zip` dan receipt bertanda `source_dirty`.

Kalau `release.yml` berjalan (billing sehat), langkah terakhir ini otomatis dan
gate ancestry tetap menolak tag yang bukan ancestor `main`.

Store candidate work must not change the Android signing key or require CWS/Edge Store IDs to match the existing Android CRX ID. The public repository does not contain the private Android signing pipeline/key, so CI proves source/package compatibility only; signed-CRX regression remains an external controlled step.

## Sinkron ke repo publik `bukabmp`

`bmp-terbuka-private` adalah monorepo kanonik; `mentaliss/bukabmp` hanya berisi
bagian open-source + situs. Saat rilis, yang disalin ke repo publik:

- `extension/**` (seluruh source extension, termasuk `manifest.json` versi baru);
- `tools/**` (build/validate/package);
- dokumen publik: `README.md`, `PRIVACY.md`, `SECURITY.md`, `CHANGELOG.md`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `RESPONSIBLE_USE.md`,
  `THIRD_PARTY_LICENSES.md`, `LICENSE`, `package.json`;
- `docs/**` untuk dokumen yang memang publik.

Yang **tidak** ikut: `worker/**`, `tests/**`, `docs/internal/**`, `mockups/**`,
`dist/**`, `AGENTS.md`, `.agentsroom/`, `.mcp.json`.

Repo publik punya isi yang tidak ada di sini (`site/`, `content/`, `promo-video/`,
`release/`) — jangan pernah menghapus atau menimpanya dengan `--delete` polos.

Alur aman:

```powershell
# di repo publik, branch main, worktree bersih
git -C C:\Users\mnurc\Projects\bukabmp status --short
Copy-Item C:\Users\mnurc\Projects\bukabmp-private\extension\* C:\Users\mnurc\Projects\bukabmp\extension\ -Recurse -Force
Copy-Item C:\Users\mnurc\Projects\bukabmp-private\tools\* C:\Users\mnurc\Projects\bukabmp\tools\ -Recurse -Force
git -C C:\Users\mnurc\Projects\bukabmp diff --stat      # tinjau, jangan buta
npm --prefix C:\Users\mnurc\Projects\bukabmp run validate
```

Halaman kebijakan privasi yang dipakai Store adalah versi di situs publik
(my.vleee.net, sumber `content/*/privacy.md` + `PRIVACY.md`), jadi wording di
sana harus sama dengan `PRIVACY.md` repo ini setiap kali klaim privasi berubah.

## 1.1.0 release gates

Sebelum 1.1.0 dinyatakan siap:
- token lama dari versi sebelum 1.1.0 tetap dapat dipakai sampai kedaluwarsa;
- token legacy dapat melakukan one-time re-verification tanpa menghapus token aktif sebelum token baru terverifikasi;
- refresh token 1.1.0 tidak memperpanjang masa aktivasi tanpa entitlement server;
- bonus Supporter yang sudah tercatat dapat diterapkan melalui refresh;
- update in-place 1.0.5 → 1.1.0 mempertahankan token, IndexedDB PDF cache, draft, dan state;
- Edge Stable Android menjalani regression activation → OCR → PDF → download → resume → refresh activation;
- setelah token v2 tersinkron, status akses hijau tetap tampil tetapi card manajemen aktivasi tidak lagi memenuhi popup;
- sponsor card dan interstitial membaca campaign realtime dari backend tanpa update extension;
- START_JOB harus sudah berhasil sebelum timer interstitial dimulai; interstitial tampil dalam jendela 2–5 detik dan kegagalan ads tidak boleh menahan OCR/job;
- tanpa campaign aktif atau saat fetch ads gagal, house-ad `Space iklan tersedia` tetap tersedia;
- event ads tidak mengirim Telegram ID, install ID, token aktivasi, kode BMP, atau data dokumen;
- GitHub/manual, Android, CWS, dan Edge package semuanya lolos build + validator kandidat;
- Edge Canary hanya fallback/testing;
- store listing 1.1.0 harus sudah tersedia sebelum minimum-version policy memaksa user update;
- listing Store + privacy disclosure harus menyebut sponsor card/interstitial secara akurat;
- campaign Store harus contextual/non-personalized dan tidak boleh memakai identitas pengguna, histori penggunaan, kode BMP, atau isi dokumen untuk targeting;
- creative/CTA campaign harus ditinjau terhadap kebijakan advertising/content channel distribusinya sebelum diaktifkan; primary purpose extension tetap OCR/PDF, bukan advertising.

## Manual smoke test

Before distribution:
- activation succeeds;
- activation refresh succeeds without extending entitlement by itself;
- legacy token one-time re-verification succeeds;
- M1 produces searchable PDF;
- OCR progress advances;
- page-count termination works;
- resume skips completed OCR;
- redownload selected range works;
- cache export works without OCR repeat;
- optional FULL/range merge works only with complete ranges;
- BMP-scoped cache clear works;
- 403/429/login/Request Rejected causes safe stop;
- Worker outage fails safely;
- pembayaran Supporter lalu membuka kembali popup memperbarui snapshot Supporter/bonus token v2 tanpa menghapus token lama saat refresh gagal;
- synced activation tidak menampilkan card manajemen aktivasi; badge akses tetap tampil;
- campaign sponsor dapat diganti dari backend dan card mengikuti state baru saat popup terbuka;
- setelah START_JOB sukses, interstitial campaign/house-ad tampil pada jendela 2–5 detik tanpa memblokir job;
- no-campaign dan backend ads outage tetap menampilkan house-ad lokal;
- runtime OCR does not load executable code from CDN.

CWS and Edge additionally require clean-install testing and reviewer activation instructions. Automated CI does not substitute for a real authenticated RBV/browser regression.
