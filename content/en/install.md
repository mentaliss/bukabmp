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
2. Download `BMP-Terbuka-v1.2.0.2-github.zip`.
3. Extract it into a stable folder.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Choose **Load unpacked** and select the folder containing `manifest.json`.
7. Open BMP Terbuka and complete activation.

Do not use GitHub's **Source code (zip)** as the extension package.

### Chrome Web Store — Coming soon

Chrome Web Store is **not publicly available yet**. When it becomes available, Store installations will update automatically, but Store delivery is not always immediate. On desktop, you can open the Extensions page and use **Update** when available; Developer mode may need to be enabled temporarily.

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

**BMP Terbuka v1.2.0 is now live on Microsoft Edge Add-ons** for Desktop and Android. Store installations follow the normal Microsoft Edge update mechanism.

Desktop Store updates are normally automatic, but delivery can be delayed. To check sooner, open `edge://extensions` and use **Update** when available. Developer mode may need to be enabled temporarily. Do not uninstall/reinstall for a normal Store update.

Check [Status & Version](../status) for the latest distribution state.

## Android — Microsoft Edge Stable

Install/update Edge Stable, open the official BMP Terbuka listing in Edge Add-ons, install normally, open the popup, complete activation, and use the reader through Edge.

### Updating Edge Android

For Edge Android, **waiting for the automatic Store update** is the recommended path. Delivery can take time, and Edge Android does not provide the same convenient desktop-style Update button.

If you do not want to wait and choose to reinstall, **create a BMP Terbuka Backup first** if you want to preserve local data. Removing/reinstalling the extension can erase extension-local data.

After reinstalling:
- activate/pair again if needed;
- Restore the backup;
- Restore remains **MERGE**.

**PDF files already saved in Downloads/device storage remain safe** and are not removed just because the extension is reinstalled.

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

## Current Installation Tutorial

The current visual installation tutorial covers **Desktop + Android**:

https://t.me/bukabmp/32

The Telegram video is a visual supplement. Use this website for the current written installation steps and distribution status.

## Official Download Page

https://mentaliss.github.io/bukabmp/en/download/
