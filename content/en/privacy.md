# Privacy Policy

BMP Terbuka is designed to be **local-first**. This page describes **BMP Terbuka v1.2.0**.

## Local document processing

For the normal OCR/PDF workflow, document pages, OCR, cached PDFs, combined PDFs, and exported PDFs are processed on the user's device. The BMP Terbuka backend is not used to upload raw generated PDFs, source page images, source-portal passwords/student IDs/cookies, or full OCR text from the ordinary PDF flow.

Network services are still used for features that require them, including community activation, version/realtime state, pseudonymous telemetry, limited sponsor metrics, Telegram/community flows, Supporter/payment flows, and Telegram Quiz.

## Local storage

The browser can store local module PDFs, Quiz source data, drafts, job state, activation state, and other local feature data.

Files in Downloads are exported copies and are separate from extension-local storage.

## Backup & Restore

A v1.2.0 backup is intended for personal recovery of local BMP Terbuka data. The backup file can contain locally stored study/material data.

Keep backup files private and do not share them casually with the group, bot, or third parties.

Restore uses **MERGE semantics**: backup data is restored, matching local items may be updated from the backup, and unrelated local data is not automatically erased.

## Telegram Quiz

For Quiz:
- raw PDFs are not uploaded to generate questions;
- page images are not uploaded;
- Quiz source is derived from text extracted and sanitized locally;
- when a question bank must be generated, the sanitized text can be used by the backend/AI generation flow;
- the original source text is not retained server-side as a stored copy of the source material after the generation flow.

Question banks, usage state, and gameplay data required by the Quiz feature may be stored server-side.

## Activation, telemetry, and providers

Community activation, pseudonymous telemetry, support, payments, and other server-backed features can store the minimum durable state required by those features. They are not intended as raw PDF/page-image storage.

Cloudflare, Telegram, browser/store providers, and source services may maintain their own infrastructure logs and policies.

## Advertising

Sponsor surfaces use packaged renderers. Arbitrary advertiser HTML, iframe, tracking pixel, or executable JavaScript is not used as extension creative.

Coarse metrics can include impression, click, dismiss, placement, campaign ID/revision, distribution channel, and extension version. Advertising events do not carry raw PDFs/OCR text or source credentials.

BMP Terbuka does not sell user material, OCR text, or PDFs to advertisers and does not use document content for personalized advertising/retargeting.
