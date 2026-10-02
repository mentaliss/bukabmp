# Troubleshooting

Do not immediately uninstall, clear storage, or reprocess the entire BMP. Many issues can be checked without discarding completed work.

## Before Troubleshooting

Record the BMP Terbuka version, platform, browser, BMP Code, module/range, last stage, exact error, and a screenshot when useful.

Do not send passwords, student IDs, cookies, sessions, tokens, OTPs, or other credentials.

## Reader / Fetch Errors

Make sure the reader opens normally, login is still valid, the BMP Code matches the URL, and the correct reader tab is available.

For Request Rejected, 403, 429, or login redirects, do not use aggressive retries or bypass techniques. Restore normal source access first.

## Interrupted Processing

Do not restart from zero. Completed local modules may still be reusable.

Reprocess only the affected range when one module is missing.

## Combined PDF Failure

Check for gaps. Every module in the target range must exist.

## Missing Downloads File

If local module data still exists, re-export it instead of rerunning OCR.

## Backup

If Backup fails, wait for other local-data operations to finish, keep the popup open while Backup is running, and do not delete storage until the needed backup is safely available.

Backup files can contain local study/material data. Do not send them to the group or bot.

## Restore on Desktop

Desktop **Restore backup** opens the file picker from the popup.

## Restore on Edge Android

The file picker is **not** opened from the popup.

Use:

**Restore backup → BMP Terbuka restore tab → select the file there.**

Keep the restore tab open. Closing it while restore runs stops the process.

If the button focuses an existing restore tab, use that tab instead of opening duplicates.

## Restore does not erase unrelated data

Restore uses MERGE semantics. Backup data is restored and matching items may be updated, while unrelated local data is not automatically deleted.

## Telegram Quiz

If Quiz is not ready, confirm the module finished processing and a local Quiz source exists. Report problems with the BMP Code, module, status stage, and screenshot without sharing the PDF/material.

## Still Stuck?

Use [Bot & Community](bot). Website documentation and Status remain the primary product reference.
