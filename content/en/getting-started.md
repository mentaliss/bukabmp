# Getting Started with BMP Terbuka

BMP Terbuka helps turn material you can already access through the reader into searchable PDFs. OCR, local result storage, PDF merging, and export run on your device.

If this is your first time using BMP Terbuka, follow the steps on this page in order. You do not need to understand technical terms such as cache, IndexedDB, or Manifest V3 to get started.

## Before You Start

Prepare:

- an Android device or computer;
- a supported browser;
- your own account that can already open the reader;
- Telegram for community activation;
- an internet connection while accessing the reader, activating, and checking version status.

For the latest browser, Store, and release status, see [Status & Version](../status).

## 1. Install BMP Terbuka

### Android

Use **Microsoft Edge Stable** and install BMP Terbuka through **Microsoft Edge Add-ons**.

Edge Canary is not the primary path. Use Canary only when it is specifically needed for testing or as a fallback.

### Desktop — Microsoft Edge

Use the official BMP Terbuka listing on **Microsoft Edge Add-ons**.

### Desktop — Google Chrome

Chrome Web Store is not an active BMP Terbuka distribution path yet. On Chrome desktop, use the official release ZIP and install it manually.

Do not choose GitHub's **Source code (zip)** download. Use the BMP Terbuka release asset built for users.

Step-by-step instructions are available in [Installation & Updates](install).

## 2. Activate BMP Terbuka

Activation starts from the extension.

Normal flow:

1. Open the BMP Terbuka popup.
2. Start activation/verification.
3. The extension opens the Telegram bot with an activation code.
4. Complete the community check in Telegram.
5. Return to the extension.
6. The extension detects the activation result.

If activation has expired, you **do not need to reinstall the extension**. Complete re-verification if the extension asks for it.

See [Activation & Verification](activation) for the full flow.

## 3. Open the BMP in the Reader

Sign in to the source reader through its normal login flow using your own account.

BMP Terbuka does not ask for your source-portal password, student ID, cookie, session, or other source credentials.

Open the BMP you are authorized to access and keep the reader tab available while processing runs.

## 4. Find the BMP Code

The BMP Code comes from the `modul` parameter in the reader URL.

Example pattern:

`.../reader/index.php?modul=XXXX...`

Use the value after `modul=` as the BMP Code.

The BMP Code is not always the same as the course code. If the extension does not recognize the value, make sure you copied it from the URL of the BMP currently open in the reader.

## 5. Choose Modules

You can process the full material or only a selected range.

Examples:

- `M1–M9` for modules 1 through 9;
- `M3–M6` for only modules 3 through 6.

Choose only what you need. You do not have to process the entire BMP every time.

## 6. Start Processing

After the BMP Code and range are correct:

1. make sure the matching reader tab is still available;
2. press **Start** in the BMP Terbuka popup;
3. the extension processes modules one by one;
4. pages are turned into searchable PDFs locally;
5. completed modules are saved in the extension's local storage.

Do not close the reader tab or clear extension data while processing is running.

If the process stops midway, do not immediately start from zero. BMP Terbuka can resume from modules already stored locally.

## 7. Export the PDF

After modules are complete, results can be exported as PDFs.

You can:

- export a PDF per module;
- re-export modules already stored without rerunning OCR;
- create a combined PDF for a complete range;
- create a full combined PDF when all required modules are available.

Files in Downloads are exported copies. The data used for resume is stored separately in the extension's local storage.

See [PDF, Resume & Storage](files) for the difference.

## If Processing Stops

Do not immediately:

- uninstall the extension;
- clear storage;
- clear all browser data;
- reprocess the entire BMP.

First note:

- BMP Terbuka version;
- Android or Desktop;
- browser;
- BMP Code;
- last module that completed;
- exact error text or a screenshot if available.

Then open [Troubleshooting](troubleshooting).

## Next Guides

- [Installation & Updates](install)
- [Activation & Verification](activation)
- [Using BMP Terbuka](usage)
- [PDF, Resume & Storage](files)
- [Troubleshooting](troubleshooting)
- [Status & Version](../status)
