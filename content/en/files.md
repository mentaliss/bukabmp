# PDF, Resume & Storage

BMP Terbuka separates **results stored for continuing work** from **PDF files already exported to Downloads**. Understanding the difference helps you avoid unnecessary OCR work.

## How Results Are Stored

After a module finishes processing, BMP Terbuka stores the module result in extension-local storage.

That local storage is used for:

- resuming interrupted processing;
- skipping modules already completed;
- building combined PDFs;
- re-exporting without rerunning OCR;
- showing which modules are already available.

In v1.1.0, module PDFs are stored locally by the extension. This local data is not the same file as the copy you see in Downloads.

## PDF per Module

Each completed module can be available as its own PDF.

If you only need one module, you do not need to build a combined PDF.

### Export One Module

Choose a module already stored and use the available export action.

Because the PDF is already in local storage, re-exporting does not require OCR again.

### Export Multiple Modules

If several modules are available, select the modules/range you need and export them using the available options.

## Combined PDF

Combined PDFs are optional.

You can create:

- a full combined PDF when all required modules are available;
- a combined PDF for a selected range, such as M3–M6.

### The Range Must Be Complete

BMP Terbuka does not build a combined PDF as if it were complete when a module is missing inside the range.

Example:

- M3 is available;
- M4 is available;
- M5 is missing;
- M6 is available.

M3–M6 is not complete yet. Process or re-download M5 first, then create the combined PDF again.

## Resume

Resume means BMP Terbuka uses already stored modules to avoid repeating completed work.

Example:

1. you selected M1–M9;
2. processing completed through M4;
3. processing stopped;
4. later you run M1–M9 again.

If M1–M4 are still complete in local storage, those modules are skipped. The extension continues with modules that are still missing.

## When OCR Needs to Run Again

OCR needs to run again only when the required module result is no longer available in local storage or when you intentionally choose to re-download/reprocess that module.

OCR is not required again just because:

- a file in Downloads was deleted;
- you want another exported copy;
- a previous run stopped after several modules had already completed.

## Extension Local Storage

Local storage is the source used for resume, merge, and re-export behavior.

In v1.1.0, BMP Terbuka stores module PDF data per BMP locally in the browser.

You do not need to manage the internal database manually.

## Files in Downloads

Files in Downloads are **exported copies**.

Deleting a file from Downloads does not automatically remove module data still stored by the extension.

Likewise, clearing extension storage does not automatically delete PDF files already present in Downloads.

## If a Downloaded PDF Was Deleted

If the file in Downloads was deleted but the module still exists in extension storage:

1. open the matching BMP;
2. check which modules are still stored;
3. use re-export;
4. do not rerun OCR.

If local storage is also gone, the module needs to be processed again.

## Clearing BMP Storage

Use the clear-storage action only when you actually want to remove local data for that BMP.

Before clearing it, understand the effect:

- resume data for that BMP may be lost;
- PDFs that were never exported cannot be recovered from storage after deletion;
- re-export without OCR is no longer available for deleted data;
- PDF files already exported to Downloads are not deleted.

## Uninstalling the Extension

Do not uninstall as the first troubleshooting step.

Uninstalling or clearing browser data can remove extension-local storage.

If you only want to update, follow [Installation & Updates](install) without uninstalling first.

## Reinstalling

A reinstall can be treated as a new installation if the browser gives it a different extension identity/storage context.

As a result:

- activation may be required again;
- old local storage may not be available;
- resume from old data may no longer work.

Reinstall only when it is actually necessary, not as the default fix for every error.

## Moving to Another Browser or Device

Do not assume extension storage automatically moves between:

- Chrome and Edge;
- an old computer and a new computer;
- one browser profile and another;
- different extension installations.

Keep important exported PDFs somewhere you manage yourself.

## If a Module Is Missing from Storage

If only one or a few modules are missing:

1. select the correct BMP;
2. select the missing module range;
3. process/re-download only that range;
4. do not reprocess the entire BMP unless needed.

## If a Combined PDF Cannot Be Created

Check whether every module in the target range is complete.

If there is a gap, finish the missing module first.

For more diagnosis, open [Troubleshooting](troubleshooting).
