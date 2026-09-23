# FAQ

This page answers the most common quick questions. For complete steps, use the linked user guides.

If version or Store availability changes, [Status & Version](https://mentaliss.github.io/bukabmp/en/status/) is the primary reference.

## General

### What is BMP Terbuka?

BMP Terbuka is an open-source browser extension that helps turn material you can already access through the reader into searchable PDFs for study.

OCR, PDF assembly, local storage, merge, and export run on your device.

### Is BMP Terbuka an official institutional product?

No.

BMP Terbuka is an independent community project. Compatibility with a reader or platform does not imply affiliation, endorsement, or official support from that service owner.

### Is BMP Terbuka free?

Core BMP Terbuka features remain free.

Supporter Pass is optional digital support that adds bot/support benefits; it does not lock the extension's core features.

### Do I need Python, BAT files, or desktop Tesseract?

No.

Official BMP Terbuka releases include the OCR runtime required by the extension.

### What is the latest version?

The current stable release is **v1.1.0**.

Because Store/channel availability can change, check [Status & Version](https://mentaliss.github.io/bukabmp/en/status/) for the latest details.

## Installation & Browsers

### Where is the official download?

Microsoft Edge Desktop and Android use the official Microsoft Edge Add-ons listing.

Google Chrome desktop currently uses the official release ZIP from GitHub Releases.

Open [Installation & Updates](https://mentaliss.github.io/bukabmp/en/docs/install/) for complete steps.

### How do I install on Android?

Use **Microsoft Edge Stable + Microsoft Edge Add-ons**.

Edge Canary is fallback/testing only, not the primary path.

### How do I install on Microsoft Edge desktop?

Install BMP Terbuka through Microsoft Edge Add-ons, then open the extension popup and complete activation.

### How do I install on Google Chrome desktop?

Chrome Web Store is not an active BMP Terbuka installation path yet.

Download the official release ZIP, extract it, open `chrome://extensions`, enable Developer mode, then choose **Load unpacked** and select the folder containing `manifest.json`.

Do not use GitHub's **Source code (zip)** as the extension package.

### Is Chrome Web Store available?

Not as an active installation path yet.

Chrome desktop users currently install from the official release ZIP manually.

Check [Status & Version](https://mentaliss.github.io/bukabmp/en/status/) for current availability.

### Can I use Firefox?

Not officially yet.

Use Google Chrome or Microsoft Edge on desktop.

### Can I use Chrome on Android?

Chrome Android is not an official BMP Terbuka installation target.

Use Microsoft Edge Stable on Android.

### Why not Edge Canary anymore?

The primary Android path for v1.1.0 is Microsoft Edge Stable + Microsoft Edge Add-ons.

Canary remains available only as fallback/testing when needed.

### How do I update?

Installs from Edge Add-ons follow the browser/store update flow.

Manual Chrome installs are updated with the new release package and then reloaded from `chrome://extensions`.

Do not uninstall first just to perform a normal update.

### Will updating remove my local data?

An in-place update with the same extension identity usually preserves tokens, drafts, and local storage.

Uninstalling, clearing browser data, or installing a build with a different identity can remove local storage.

## Activation

### Why is Telegram required?

The community gate keeps users connected to compatibility updates, security notices, support, and discussion.

Activation starts from the extension and continues through the Telegram bot.

### How long does activation last?

A normal community activation token has a limited lifetime with a base period of about **14 days**.

v1.1.0 supports refresh when eligible.

### If activation expires, do I need to reinstall?

No.

Activation can be refreshed or verified again without reinstalling. If the extension requests re-verification, follow the popup flow.

### Why does the extension ask me to verify again?

The token may have expired, access status may need to be refreshed, or an older token may need to move to the newer token scheme.

Re-verification is not the same as reinstalling.

### Telegram opens but the code is missing. What should I do?

Return to the extension popup and use the copy-code option if available, then follow the manual verification path shown by the bot/extension.

Do not share activation tokens or pairing secrets.

See [Activation & Verification](https://mentaliss.github.io/bukabmp/en/docs/activation/).

## Usage

### What is a BMP Code?

The BMP Code is the value used by the reader to identify the BMP.

It comes from the `modul` parameter in the reader URL and is not always the same as the course code.

### Where do I find the BMP Code?

Open the correct BMP in the reader and check the URL.

Use the value after `modul=`.

### Can I process only selected modules?

Yes.

Choose the range you need, such as M3–M6. You do not have to process the whole BMP.

### Why do PDFs appear one by one?

BMP Terbuka processes modules sequentially.

Each completed module is stored before the extension moves to the next one.

### If processing stops, do I have to start from the beginning?

No, as long as completed modules are still available in extension-local storage.

Run the same range again. Complete stored modules are skipped and processing continues with missing modules.

### Can I re-download only one module?

Yes.

Use the re-download option for the affected module/range. Do not clear all storage just to repair one module.

See [Using BMP Terbuka](https://mentaliss.github.io/bukabmp/en/docs/usage/).

## PDF & Storage

### Can BMP Terbuka make one combined PDF?

Yes, when the selected range is complete.

Combined PDF creation is optional.

### Can I combine only M3–M6?

Yes, if M3, M4, M5, and M6 are all complete in local storage.

### Why was the combined PDF not created?

Check whether a module is missing inside the selected range.

BMP Terbuka does not create a supposedly complete merge while silently skipping a gap.

### I deleted a PDF from Downloads. Do I need to run OCR again?

Not if the module still exists in extension-local storage.

Use re-export.

### What is the difference between Downloads and extension storage?

Files in Downloads are exported copies.

Extension-local storage keeps the module results used for resume, merge, and re-export.

Deleting one does not automatically delete the other.

### What happens if I clear extension storage?

Resume data and locally stored module results can be lost.

PDF files already exported to Downloads are not deleted.

See [PDF, Resume & Storage](https://mentaliss.github.io/bukabmp/en/docs/files/).

## Errors & Troubleshooting

### What does Failed to Fetch mean?

It can happen at different stages, so there is no single universal diagnosis.

Note whether it appears during activation, when pressing Start, or while a module is being processed.

Open [Troubleshooting](https://mentaliss.github.io/bukabmp/en/docs/troubleshooting/) for stage-specific checks.

### Request Rejected or 403 appears. Why does BMP Terbuka stop instead of retrying?

BMP Terbuka is not designed to force its way past a server rejection.

It stops instead of using blind retries or bypass techniques.

### I see HTTP 429. What should I do?

Stop repeated retries and wait before trying again.

BMP Terbuka does not use techniques intended to evade source-side rate limits.

### One module did not download. What should I do?

Check which modules are still stored, then reprocess/re-download only the affected range.

If the same module keeps failing at the same point, report that module and the exact last error.

### The reader asks me to sign in again. Does the bot need my password/student ID?

No.

Sign in again through the official source page using your own account. Do not send your password, student ID, cookie, or session to the bot/admin.

## Privacy & Security

### Are my password or student ID sent to BMP Terbuka?

Not as part of the extension flow.

The extension does not ask for the source-portal password/student ID.

### Are document pages, OCR text, or generated PDFs uploaded to the backend?

Not as part of the OCR/PDF workflow.

Document pages, OCR, cached PDFs, merge, and export run on the user's device.

The extension still makes network requests for features that genuinely need external services, such as activation, version/realtime state, pseudonymous telemetry, and limited sponsor metrics.

### Does BMP Terbuka remove watermarks?

No.

BMP Terbuka preserves source watermarks.

### What information should I send when asking for help?

Send the extension version, platform/browser, problem stage, BMP Code/module when relevant, exact error text, and a screenshot with sensitive data removed.

Do not send passwords, OTPs, cookies, sessions, activation tokens, pairing secrets, or other credentials.

### Can sponsors see user data?

Sponsors/advertisers do not receive personal user identity, private activation identity, BMP/OCR/PDF content, or arbitrary tracking JavaScript capability.

Current campaign selection is contextual/non-personalized.

See the Privacy Policy for complete details.

## Bot & Community

### How do I ask the bot in Group Terbuka?

Use `/ask` followed by the question, mention `@bukabmp_bot`, or reply to a bot message.

The bot is not intended to answer every group conversation automatically.

### Is the AI bot the primary source of truth?

No.

The website/docs and Status page are the primary references. AI helps find or explain information and can misunderstand a question.

If AI conflicts with Docs/Status, follow Docs/Status and report the discrepancy.

### What is the regular AI quota?

The current bot configuration allows up to **6 AI questions per day** on the regular path.

Active Supporters receive unlimited AI while their entitlement remains active.

### Where do I join the community?

Buka BMP channel:

https://t.me/bukabmp

Group Terbuka:

https://t.me/+0pAg9ymEhWdkZmNl

Bot:

https://t.me/bukabmp_bot

See [Bot & Community](https://mentaliss.github.io/bukabmp/en/docs/bot/).

## Supporter Pass

### What is Supporter Pass?

Supporter Pass is optional digital support. BMP Terbuka's core features remain free.

### What packages are available?

Currently:

- 2 Stars / 1 day;
- 50 Stars / 30 days.

Both are one-time purchases, not automatic subscriptions.

### What are the Supporter benefits?

Current benefits include bot DM + unlimited AI, priority support, longer troubleshooting context, a group tag when Telegram permissions allow it, optional Supporter Wall visibility, and an activation target bonus.

### Payment succeeded but Supporter is not active. Should I pay again?

No.

Do not pay again. Use `/paysupport` and explain the transaction problem.

See [BMP Supporter Pass](https://mentaliss.github.io/bukabmp/en/docs/supporter/).

## Open Source

### What is open source?

The browser extension, public tooling, public documentation, and public website source are available in the BMP Terbuka repository.

The production Worker, bot/backend, Control Center, private database/deployment material, secrets, and private signing material are not published.

### Can I fork it?

Published source uses **GPL-3.0**.

Forking and modification follow the rights and obligations of that license. The BMP Terbuka name, logo, and branding are not automatically licensed as trademarks just because the source code uses GPL.

See Open-source License, Trademark, and Contributing before redistributing a fork.

## Still Cannot Find the Answer?

Start with [BMP Terbuka Guides](https://mentaliss.github.io/bukabmp/en/docs/) or open [Troubleshooting](https://mentaliss.github.io/bukabmp/en/docs/troubleshooting/).
