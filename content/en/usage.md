# Using BMP Terbuka

## Main Flow

1. sign in to the reader with your own account;
2. open material you can normally access;
3. open BMP Terbuka;
4. enter the BMP Code from the reader URL's `modul=` parameter;
5. choose the module range;
6. press **Start**;
7. wait for local processing;
8. export the PDF you need.

BMP Terbuka does not grant new access to material.

## Processing

The extension reads resources available to the current reader session, processes pages on-device, performs local OCR, builds the PDF, and stores completed module results locally.

If the source rejects access or asks for login again, processing stops safely.

## Resume & Re-download

Completed local modules can be reused. Reprocess only the affected range when one module needs to be rebuilt.

## After Processing

You can re-export modules, build a combined PDF from a complete range, create a backup, manage local storage, and start Telegram Quiz from a ready module.

## Start Telegram Quiz

For a processed module with local Quiz source:

1. select the module in the Quiz section;
2. press **Start Telegram Quiz**;
3. continue in Telegram.

Raw PDFs and page images are not uploaded for Quiz generation. Quiz source is derived from text extracted and sanitized locally.

## Backup & Restore

Use Backup before deleting local data or moving to another setup when you still need the data.

Restore uses MERGE semantics and does not automatically delete unrelated local data. See [PDF, Backup, Restore & Storage](files).

## If Something Fails

Record the version, browser/device, BMP Code, module/range, last stage, and exact error. Do not send passwords, student IDs, cookies, sessions, or other credentials.

See [Troubleshooting](troubleshooting).
