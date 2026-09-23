# Using BMP Terbuka

This page explains the normal BMP Terbuka workflow after the extension is installed and activation is complete.

If you have not installed it yet, start with [Installation & Updates](install). If activation is incomplete, see [Activation & Verification](activation).

## Quick Flow

In general:

1. sign in to the reader with your own account;
2. open the BMP you want to process;
3. open the BMP Terbuka popup;
4. enter the BMP Code;
5. choose the module range;
6. press Start;
7. wait for modules to be processed;
8. export the PDFs you need.

BMP Terbuka does not grant new access to material. The extension uses a browser session that already has access.

## Open the Correct Reader

Sign in to the source portal through its normal login mechanism.

After signing in, open the BMP until the reader page works normally.

Do not send your password, student ID, cookie, or session to the BMP Terbuka bot.

## Find the BMP Code

The BMP Code comes from the `modul` parameter in the reader URL.

Example:

`.../reader/index.php?modul=XXXX...`

The value after `modul=` is the BMP Code used by the extension.

### The BMP Code Is Not Always the Course Code

Do not guess the BMP Code only from the course code.

If a course has different editions or reader structures, the extension must still use the value from the actual reader URL.

### If You Are Not Sure

Open the correct BMP in the reader, check the active tab URL, and copy the value after `modul=`.

## Choose a Module Range

BMP Terbuka can process the full BMP or only part of it.

Examples:

- `M1–M9`: modules 1 through 9;
- `M3–M6`: modules 3 through 6;
- `M2`: only module 2 where the UI supports that selection through the appropriate range.

Choose the range you need. Reprocessing the entire BMP is unnecessary when only one or two modules are affected.

## Start Processing

Before pressing **Start**:

- make sure the reader tab is still available;
- make sure the BMP Code is correct;
- make sure the module range is correct;
- make sure activation is still valid.

After Start, the extension processes modules in sequence.

## What Happens While Processing

For each module, BMP Terbuka:

- requests pages available to the active reader session;
- processes pages on the device;
- runs OCR locally;
- creates the PDF;
- saves the completed module to local extension storage;
- moves on to the next module.

If the source denies access or asks you to sign in again, the extension is designed to stop safely instead of blindly retrying.

## Progress

Progress can move through opening the module, processing pages, OCR, and saving results.

If it appears stuck, note the last visible stage before doing anything else.

Do not immediately clear storage. It may contain completed modules that can be used for resume.

## Modules Are Processed One by One

Choosing M1–M9 does not mean nine PDFs appear at once.

The extension completes modules sequentially and stores each completed module before moving to the next one.

If processing stops after M4, complete results for M1–M4 can remain available in local storage.

## Resume Processing

Resume is normal BMP Terbuka behavior.

Example:

- you selected M1–M9;
- processing completed through M4;
- the browser closed or processing stopped;
- you reopen the same BMP;
- you run M1–M9 again.

If M1–M4 are still complete in local storage, the extension skips those modules and continues with the missing ones.

You do not need to rerun OCR from M1 just because the earlier run was interrupted.

## Re-download Selected Modules

Use **Re-download selected modules** when a specific module result needs to be rebuilt.

Example:

- M1–M9 was previously processed;
- M5 has a problem;
- choose a range containing M5;
- enable the re-download option;
- reprocess only what is needed.

Do not clear the whole BMP storage just to fix one module.

## If a Module Is Incomplete

An incomplete module is not treated as complete.

If a combined-PDF range has a gap, BMP Terbuka should not silently build a result that omits the missing module.

Process or re-download the missing module first, then merge again.

## After Processing Finishes

You can:

- export a PDF per module;
- export multiple modules;
- create a combined PDF for a complete range;
- create a full combined PDF when all required modules are available;
- re-export from local storage without rerunning OCR.

See [PDF, Resume & Storage](files).

## Processing a Different BMP

Storage is separated by BMP.

When switching to another BMP:

1. open the new BMP in the reader;
2. get its BMP Code from that reader URL;
3. enter the correct BMP Code;
4. select the range;
5. start processing.

Do not reuse an old BMP Code for a different reader item.

## If an Error Occurs

Note:

- exact error text;
- the stage where it occurred;
- BMP Code;
- module/range;
- Android or Desktop;
- browser;
- BMP Terbuka version.

Then open [Troubleshooting](troubleshooting).
