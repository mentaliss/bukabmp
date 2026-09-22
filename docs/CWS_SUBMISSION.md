# Chrome Web Store Submission Pack — Candidate

Status: **candidate preparation**, not proof of Store approval.

## Product identity

Name: **BMP Terbuka**

Single purpose:

> Membantu pengguna mengubah materi BMP yang sudah dapat mereka akses menjadi searchable PDF yang diproses dan disimpan secara lokal untuk belajar/offline.

Short description candidate:

> Ubah materi BMP yang sudah dapat Anda akses menjadi searchable PDF dengan OCR lokal, resume, dan penyimpanan lokal.

Category candidate: **Productivity** — confirm against the current CWS dashboard categories at submission time.

Homepage/source URL:
- https://github.com/mentaliss/bukabmp

Support URL candidate:
- repository Issues or a dedicated public support page before submission.

Privacy policy:
- `PRIVACY.md` contains the candidate policy.
- Before submission, expose the final policy at a stable public HTTPS URL.
- Privacy policy is aligned with the current Worker/D1/KV behavior, including durable activation/Supporter/referral state and v1.1.0 sponsor metrics. Re-check it against the exact live deployment before submission.

## Permission justifications

### storage
Stores local extension state such as activation token, random installation ID, job/draft state, cache metadata, and version-policy cache.

### downloads
Exports searchable PDF files created locally by the extension to the user's Downloads folder.

### offscreen
Runs local OCR and PDF assembly in an offscreen extension document because the MV3 service worker cannot host the long-lived DOM/worker workload required by the OCR pipeline.

### clipboardWrite
Provides copy fallback for activation/share text, including browser/Android popup contexts where Web Share or async Clipboard behavior is not consistently available.

### Host: https://pustaka.ut.ac.id/*
Required to run the content script on the authenticated reader and access reader resources that the user can already access.

### Host: https://community.bukabmp.workers.dev/*
Required for community activation/pairing and version-policy data. It does not receive page images, OCR text, or generated PDFs from the client.

### tabs
**Not requested by the CWS package.** The shared source still uses the Tabs API for opening/navigating tabs, but the CWS build relies on narrow host access rather than the broad `tabs` permission for matching reader URLs.

## Remote code declaration

Runtime executable code is bundled in the extension package:
- Tesseract.js 6.0.1;
- tesseract.js-core 6.0.0 WebAssembly variants;
- pdf-lib 1.17.1;
- Indonesian tessdata pinned to an immutable upstream commit.

The build process downloads these dependencies before packaging. The installed extension does not load runtime JavaScript/WASM from a CDN.

## Data-use declaration basis

The client:
- processes document/page content locally;
- stores per-BMP module PDFs locally in extension IndexedDB;
- exports user-requested PDF copies through Chrome Downloads;
- sends activation/version/realtime-state requests to the community Worker;
- can send coarse sponsor events containing only event/placement/campaign/revision/channel/extension-version;
- does not send page images, OCR text, generated PDF content, Telegram ID, install ID, activation token, or BMP code in sponsor events;
- does not use document/OCR content for advertising or profiling.

Backend retention/record classes are documented in `PRIVACY.md`; verify the live deployment matches that source before submission.

## Reviewer test instructions — blocker before submission

The submitted extension requires community activation before starting OCR. Store reviewers need a deterministic test path that does **not** depend on an undocumented manual exception.

The Worker includes a temporary/revocable reviewer activation mechanism compatible with the normal signed-token flow. The reviewer secret must stay server-side and be provided only in the private CWS Test instructions field. Before submission, smoke-test the exact live reviewer flow.

Do not:
- hard-code a universal bypass in the public extension;
- publish reviewer secrets in this repository;
- require the reviewer to provide source-site passwords/cookies to the developer.

Reviewer flow must cover:
1. install candidate;
2. complete reviewer activation;
3. open a valid authenticated RBV reader page;
4. run at least one module;
5. observe local OCR;
6. confirm searchable PDF download;
7. reopen popup and confirm resume/cache behavior;
8. optionally export cached PDF without OCR repeat;
9. confirm network failure/blocked response safe-stops;
10. confirm v1.1.0 sponsor card/house fallback and delayed interstitial do not block OCR;
11. confirm no document/user identifier appears in sponsor event payloads.

## Screenshots still required

Capture from the tested CWS candidate, not mockups:
- main popup / BMP input;
- active OCR progress;
- completed/cache state;
- optional export/merge state.

Avoid exposing personal account data or source credentials in screenshots.

## v1.1.0 upgrade gate

Before replacing the live 1.0.5 listing, use the **same Store listing/identity** to prove an in-place 1.0.5 → 1.1.0 update preserves:
- signed activation token;
- random install ID;
- draft/range state;
- IndexedDB `bmp-terbuka-pdf-cache` / `pdfs`;
- completed module PDFs and resume behavior.

A clean install or unpacked candidate is not proof of this gate.

## Update-policy rule

CWS package sends `distribution_channel=cws` to the version endpoint. A remote minimum version is not enforced for CWS unless the backend returns `store_ready=true`. This prevents an unpublished/in-review Store version from locking existing users.

Once a new CWS version is actually published, backend may return channel-specific:
- `latest_version`;
- `minimum_version`;
- `force_after`;
- `release_url` (the final CWS listing URL);
- `store_ready=true`.

GitHub/manual and Android channels remain independent.
