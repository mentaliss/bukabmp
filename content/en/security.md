# Security

BMP Terbuka publishes the browser-extension client and public build/release tooling. Production backend implementation, operational infrastructure, and secrets are not part of the public repository.

## Reporting a vulnerability

Do not post sensitive vulnerability details in a public GitHub issue. Use GitHub Private Vulnerability Reporting / Security Advisories when available.

Useful reports include the affected version, browser/OS, minimal reproduction steps, impact, and a proof of concept that does not include credentials or copyrighted learning material.

## Security principles

- source credentials remain with the browser/source service;
- document pages, OCR, and PDFs are local-first;
- remote state is allowlisted and cannot deliver arbitrary executable code;
- access denials such as 403/429/re-authentication cause a safe stop rather than blind retry;
- private backend internals and secrets are intentionally excluded from the public repository.