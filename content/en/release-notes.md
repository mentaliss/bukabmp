# Release Notes

## v1.2.0 — 2 October 2026

BMP Terbuka v1.2.0 adds Telegram Quiz, local Backup & Restore, clearer local storage management, safer restore behavior including a dedicated Edge Android restore tab, PDF/local-workflow improvements, stability fixes, and UI/UX refinements.

### Distribution

- Chrome Desktop: v1.2.0 is available through the official GitHub/manual ZIP.
- Edge Desktop/Android: **v1.2.0 is live on the official Microsoft Edge Add-ons listing** as of 3 October 2026.

### Important behavior

Restore uses **MERGE semantics**. It does not automatically erase unrelated local data.

Raw PDFs and page images are not uploaded for Telegram Quiz generation. Quiz source is derived from text extracted and sanitized locally.

For the detailed technical history, see the repository CHANGELOG.md.
