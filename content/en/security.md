# Security

## Reporting a vulnerability

Do not post sensitive vulnerability details in a public GitHub issue. Use GitHub Private Vulnerability Reporting / Security Advisories when available.

Include the affected version, browser/OS, minimal reproduction steps, impact, and a proof of concept that does not include credentials, private backup files, or copyrighted learning material.

## v1.2.0 security principles

- source credentials remain with the browser/source service;
- primary OCR/PDF processing is local-first;
- Quiz does not upload raw PDFs or page images;
- Backup files can contain locally stored study/material data and should be treated as private;
- remote state must not deliver arbitrary executable code;
- 403/429/re-authentication triggers safe stop instead of blind retry;
- normal updates should not require clearing local storage;
- production Edge updates must use the legitimate Store identity, not diagnostic/audit CRX packages.

Do not use BMP Terbuka to bypass source-side access controls, remove watermarks, perform credential abuse, or evade rate limits.
