# Installation & Updates

BMP Terbuka v1.2.0 uses different installation paths depending on the browser. Check [Status & Version](../status) for current distribution state.

## Official Paths

- **Desktop Chrome:** manual GitHub Release package.
- **Desktop Edge:** Microsoft Edge Add-ons.
- **Android:** Microsoft Edge Stable + Microsoft Edge Add-ons.
- **Firefox:** not officially supported.
- **Chrome Android:** not an official target.

Stable product version: **v1.2.0**.

## Desktop — Google Chrome

1. Open the official release: https://github.com/mentaliss/bukabmp/releases/tag/v1.2.0
2. Download `BMP-Terbuka-v1.2.0.zip`.
3. Extract it into a stable folder.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Choose **Load unpacked** and select the folder containing `manifest.json`.
7. Open BMP Terbuka and complete activation.

Do not use GitHub's **Source code (zip)** as the extension package.

### Manual Chrome Update

A **Load unpacked** installation does not download updates automatically. **Reload** in `chrome://extensions` only reloads the files already present in the extension folder.

To update without changing the local extension identity/storage:

1. download the newest official ZIP;
2. extract the new ZIP to a temporary folder;
3. open the same stable folder you originally selected with **Load unpacked**;
4. replace/overwrite that folder's contents with the new release package;
5. make sure the new `manifest.json` is in that same folder;
6. open `chrome://extensions`;
7. press **Reload** on BMP Terbuka;
8. open the popup and confirm the version changed.

**Do not uninstall the old version, Remove it and Load unpacked from another folder, or clear storage just for a normal update.** Keep using the same extension folder/path.

## Desktop — Microsoft Edge

Use the official listing:

https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm

**BMP Terbuka v1.2.0 is now live on Microsoft Edge Add-ons** for Desktop and Android. Store installations follow the normal Microsoft Edge update mechanism. Check [Status & Version](../status) for the latest distribution state.

## Android — Microsoft Edge Stable

Install/update Edge Stable, open the official BMP Terbuka listing in Edge Add-ons, install normally, open the popup, complete activation, and use the reader through Edge.

### Restoring a Backup on Android v1.2.0

On Edge Android, **Restore backup** does not open the file picker inside the extension popup.

The flow is:

**Restore backup → BMP Terbuka restore tab → select the backup file → restore runs in that tab.**

Keep the restore tab open until the process finishes. Closing it while restore is running stops the restore process.

### Restore on Desktop

Desktop keeps the direct popup file-picker flow.

## Backup before destructive changes

Create a backup before deleting local data, moving devices, or making another change that could discard local results if you still need them.

A backup can contain locally stored study/material data. Keep it private.

## Moving Browser or Device

Extension storage does not automatically move between browsers, profiles, or devices.

## Official Download Page

https://mentaliss.github.io/bukabmp/id/download/
