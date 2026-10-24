# Release Notes

## v1.3.0 — 24 October 2026

BMP Terbuka v1.3.0 brings the e-ink "paper ledger" redesign of MyBMP, launcher, and restore, official UT material titles in MyBMP, a Help page that replaces About, serialized Telegram Quiz generation that survives a sleeping service worker, and a set of resume/stability fixes.

### Distribution

- Chrome Desktop: v1.3.0 is available through the official GitHub/manual ZIP (`BMP-Terbuka-v1.3.0-github.zip`).
- Chrome Web Store: not publicly available yet.
- Edge Desktop/Android: the Microsoft Edge Add-ons listing currently serves **v1.2.0.2**; the **v1.3.0 Store update is in review with Microsoft** and rolls out automatically after certification.

### Important behavior

Minimum Chrome is now **114** (the real floor for the `sidePanel` permission). Restore keeps **MERGE semantics**: unrelated local data is not erased automatically.

## v1.2.0 — 2 October 2026

BMP Terbuka v1.2.0 adds Telegram Quiz, local Backup & Restore, clearer local storage management, safer restore behavior including a dedicated Edge Android restore tab, PDF/local-workflow improvements, stability fixes, and UI/UX refinements.

### Distribution

- Chrome Desktop: v1.2.0 is available through the official GitHub/manual ZIP.
- Edge Desktop/Android: **v1.2.0 is live on the official Microsoft Edge Add-ons listing** as of 3 October 2026.

### Important behavior

Restore uses **MERGE semantics**. It does not automatically erase unrelated local data.

Raw PDFs and page images are not uploaded for Telegram Quiz generation. Quiz source is derived from text extracted and sanitized locally.

For the detailed technical history, see the repository CHANGELOG.md.
