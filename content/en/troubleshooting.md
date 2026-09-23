# Troubleshooting

This page helps you choose a safe next step when BMP Terbuka does not behave as expected.

Do not immediately uninstall, clear storage, or reprocess the entire BMP. Many issues can be checked without discarding completed work.

## Before Trying to Fix Anything

First note:

- BMP Terbuka version;
- Android or Desktop;
- browser;
- BMP Code;
- module range;
- last module that completed;
- exact error text;
- the stage where it happened;
- a screenshot if available.

Do not send passwords, student IDs, cookies, sessions, tokens, OTPs, or other credentials.

## Failed to Fetch

**Failed to Fetch** can appear at different stages, so it does not have one universal diagnosis.

The most important detail is **where it appears**.

### Failed to Fetch During Activation

Check:

- internet connection;
- whether Telegram can open;
- whether the pairing session is still valid;
- whether the extension still shows the same activation code.

If the pairing session expired, start a new activation session from the extension popup.

Do not share activation tokens or pairing secrets when asking for help.

### Failed to Fetch When Pressing Start

Check:

- you are signed in to the reader through the source's normal login flow;
- the correct reader tab is still available;
- the reader page itself loads normally;
- the BMP Code matches the reader currently open;
- extension activation is still valid.

If the reader itself cannot be accessed, resolve the source-access problem first.

If the reader works normally but BMP Terbuka still fails when Start is pressed, report the version, browser, BMP Code, and screenshot/error text.

### Failed to Fetch While a Module Is Processing

Note the module and last stage that completed.

Do not clear storage. Completed modules may still be available for resume.

Open the same BMP again and retry the same range after confirming the reader works normally.

If the failure repeatedly happens on the same module, report that module specifically.

## Start Does Not Run

Check:

- activation is still valid;
- the BMP Code is not empty and matches the reader;
- the module range is valid;
- the correct reader tab is open;
- another BMP process is not already active.

If the popup shows another message, treat that exact message as the main clue.

## Processing Stops Midway

Do not start from zero.

Example: M1–M4 completed, then processing stopped before M5.

Recommended steps:

1. make sure the reader can still be opened;
2. reopen BMP Terbuka;
3. use the same BMP Code;
4. run the same range;
5. let the extension skip complete modules and continue the missing ones.

If local storage was already cleared, resume from the old results is no longer possible.

## A Module Did Not Download

If only one module is missing:

1. check whether other modules completed normally;
2. check whether the missing module appears incomplete;
3. select a range containing that module;
4. re-download/reprocess only the affected range;
5. do not delete other completed modules.

If the same module keeps failing at the same point, report the module and exact last error.

## There Is a Gap Between Modules

A gap means a module is missing between modules that are already available.

Example: M1, M2, M4, and M5 are available, but M3 is missing.

Complete M3 before building M1–M5 as a combined PDF.

BMP Terbuka should not silently produce a combined file that omits the missing module.

## A PDF Does Not Appear

Check:

- the module actually completed;
- the result still exists in local storage;
- you used the export action;
- the browser did not block the download.

If local storage still has the module, try re-export before rerunning OCR.

## Combined PDF Is Not Created

The first thing to check is whether the selected range is complete.

Make sure every module inside the merge range is available.

If one module is missing, process that module first, then merge again.

## A PDF File in Downloads Was Deleted

If the Downloads copy was deleted but extension-local storage still exists, use re-export.

You do not need to rerun OCR just to create another file copy.

See [PDF, Resume & Storage](files).

## Request Rejected

If the source returns **Request Rejected**, BMP Terbuka is designed to stop rather than force its way past the server rejection.

Recommended steps:

- stop repeated attempts;
- confirm your normal login session is still valid;
- open the reader manually and see whether the source itself works;
- try again after source access is normal;
- report it if rejection continues during normal authorized access.

BMP Terbuka does not use stealth techniques, token forgery, IP rotation, or blind retries to bypass source restrictions.

## HTTP 403 / Access Denied

HTTP 403 means the source rejected the request.

Do not use aggressive retry loops.

Check whether:

- your login session is still active;
- the material opens normally in the reader;
- the source is currently limiting access.

If normal browser access is also denied, BMP Terbuka cannot create new access rights.

## HTTP 429 / Too Many Requests

HTTP 429 usually indicates source-side rate limiting.

Stop repeated retries and wait before trying again.

Do not use multiple retries, IP rotation, or techniques intended to evade rate limits.

## The Reader Asks You to Sign In Again

Sign in again through the official source page using your own account.

BMP Terbuka does not ask for and does not need your password/student ID to perform the login.

Once the reader works normally again, continue with the same BMP.

## The Reader Cannot Be Opened

If the reader itself cannot be opened normally, resolve the source/access issue first.

BMP Terbuka only works with resources made available to a user session that already has access.

## The Extension Does Not Appear in Chrome

For manual installation:

1. open `chrome://extensions`;
2. make sure Developer mode is enabled;
3. check whether BMP Terbuka appears in the extension list;
4. if not, choose **Load unpacked**;
5. select the folder containing `manifest.json`.

Do not select the ZIP file itself.

## The Extension Does Not Appear in Edge

If installed from Edge Add-ons:

- open the Edge extension list;
- make sure BMP Terbuka is installed and enabled;
- pin it to the toolbar if useful.

If the Store reports that the extension is unavailable for a device, check [Status & Version](../status).

## Problems After Updating

Before uninstalling:

1. check the installed version;
2. reload the extension;
3. reopen the popup;
4. make sure the browser is using the newest package;
5. do not clear storage before confirming local data is actually the cause.

For manual Chrome installs, see the update section in [Installation & Updates](install).

## Activation Problems

Activation issues are covered in detail in [Activation & Verification](activation).

Remember: expired activation does not mean you need to reinstall the extension.

## Useful Information When Asking for Support

Send:

- a screenshot of the error;
- BMP Terbuka version;
- Android or Desktop;
- browser;
- stage where the problem appears;
- exact error text;
- BMP Code/module range if relevant to a processing bug.

Do not send credentials or secrets.

## Still Not Solved?

Use [Bot & Community](bot) to ask for help.

If a bot answer conflicts with the documentation or Status page, use the documentation and Status page as the primary reference and report the discrepancy.
