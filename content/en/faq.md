# FAQ

Use [Status & Version](https://mentaliss.github.io/bukabmp/en/status/) as the primary reference for changing facts such as Store availability.

## Version & Download

### What is the latest version?

The current stable product release is **BMP Terbuka v1.2.0**.

Chrome Desktop can use the official manual `BMP-Terbuka-v1.2.0.2-github.zip` package from GitHub Releases.

The official Edge Desktop/Android path remains Microsoft Edge Add-ons. **BMP Terbuka v1.2.0 is now live on the official Microsoft Edge Add-ons listing.**

### Where should I update?

Use the website download/update page:

https://mentaliss.github.io/bukabmp/en/download/

In short: desktop Store installations update automatically but may be delayed; manual Desktop updates must replace files in the **same Load unpacked folder** and then Reload; Edge Android users should normally wait for the automatic Store update. If choosing to reinstall on Android, create a Backup first if local data matters. PDFs already saved in Downloads/device storage remain safe.

## Backup & Restore

Backup is for personal recovery of BMP Terbuka local data and can contain locally stored study/material data. Keep it private.

Restore uses **MERGE semantics**. Backup data is restored and matching local items may be updated; unrelated local data is not automatically erased.

On Edge Android v1.2.0:

**Restore backup → BMP Terbuka restore tab → select file → restore runs in that tab.**

Keep the restore tab open until it finishes. Desktop keeps the file picker in the popup.

## Local Storage

The Storage Manager lets users view local usage, manage data per BMP, reuse/export supported data, remove data per BMP, or remove all local data when intended.

Back up data first before destructive cleanup if you still need it.

## Telegram Quiz

For a processed module with local Quiz source:

**select module → Start Telegram Quiz → continue in Telegram.**

Raw PDFs and page images are not uploaded to generate Quiz questions. Quiz source comes from text extracted and sanitized locally. When a bank needs generation, sanitized text can be used by the generation flow; the original source text is not retained server-side as a stored copy of the source material after that flow.

## Privacy & Security

Primary OCR/PDF processing is local-first. Network services are still used for activation, version state, pseudonymous telemetry, limited sponsor metrics, Supporter/payment, Telegram/community, and Quiz.

Do not send passwords, student IDs, OTPs, cookies/sessions, activation secrets, API keys, private backup files, or material you are not allowed to redistribute.

## Community

Group Terbuka is:

**A community playground for chatting, helping each other, sharing, joining activities, discussing tools, learning, and more.**

Channel: https://t.me/bukabmp

Group: https://t.me/+0pAg9ymEhWdkZmNl

Bot: https://t.me/bukabmp_bot
