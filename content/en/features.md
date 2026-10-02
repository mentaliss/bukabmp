# BMP Terbuka v1.2.0 Features

## Searchable PDF

OCR makes text in the resulting PDF searchable.

## Local-first processing

OCR, PDF assembly, local cache, and primary export processing run on the device.

## Resume & local reuse

Completed modules can be reused for resume, re-export, and combined PDFs without rerunning OCR from the beginning.

## Combined PDF

Build a combined PDF from a complete range. Missing modules are not silently skipped.

## Local Storage Manager

View local storage usage, manage stored BMP data, reuse/export supported local material, remove data per BMP, or remove all local data when intended.

## Backup & Restore

Backup preserves BMP Terbuka local data for personal recovery.

Restore uses **MERGE** semantics: backup data is restored, matching local items may be updated from the backup, and unrelated local data is not automatically erased.

## Edge Android Restore

On Edge Android, restore runs in a dedicated BMP Terbuka restore tab for file-picker compatibility. Desktop keeps restore selection in the popup.

## Telegram Quiz

For a processed module with local Quiz source:

**select module → Start Telegram Quiz → continue in Telegram.**

Raw PDFs and page images are not uploaded for Quiz generation. Quiz source comes from text extracted and sanitized locally.

## Safe stop

BMP Terbuka stops when the source rejects access, asks for login again, or otherwise cannot be safely continued.

## Community + Supporter

The community is a general conversation and activity space. Supporter is optional and does not change the material privacy boundary.
