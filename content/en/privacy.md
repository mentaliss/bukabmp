# Privacy Policy

BMP Terbuka is designed to be **local-first**. This page describes the current stable **BMP Terbuka v1.1.0** release.

## Local document processing

Document pages, OCR text, cached PDFs, combined PDFs, and exported PDFs are processed on the user's device. The BMP Terbuka backend does not receive source-portal passwords/student IDs/cookies, document page images, OCR text, or generated PDFs.

## Network interactions

The extension still uses network services for community activation, version/realtime state, pseudonymous product telemetry, sponsor/advertising state and coarse metrics, and Telegram/community flows.

## Pseudonymous telemetry

The candidate creates a random per-installation analytics UUID separate from the installation ID, Telegram identity, activation credentials, and Supporter/payment state. The Worker transforms it with a server-side keyed HMAC before analytics storage.

Telemetry is allowlisted and must not include Telegram IDs/usernames, activation secrets, material codes, module names/numbers, reader URLs, PDF names/content, OCR text, document titles/content, or browsing history.

Daily pseudonymous activity is retained for roughly 180 days and daily aggregates for roughly 400 days.

## Advertising

Current campaign selection is contextual/non-personalized. Coarse events can include impression, click, dismiss, placement, campaign ID/revision, distribution channel, and extension version.

Advertising events do not carry Telegram user ID, installation ID, activation token, material/module/page identity, OCR text, or PDFs. Advertisers do not receive arbitrary tracking or executable JavaScript access.

## Providers

Cloudflare, Telegram, browser/store providers, and source services may maintain their own infrastructure logs and policies.