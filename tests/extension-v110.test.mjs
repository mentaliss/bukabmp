import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const manifest = JSON.parse(await readFile(
  new URL("../extension/manifest.json", import.meta.url),
  "utf8"
));
const background = await readFile(
  new URL("../extension/background.js", import.meta.url),
  "utf8"
);
const popup = await readFile(
  new URL("../extension/popup.js", import.meta.url),
  "utf8"
);
const popupHtml = await readFile(
  new URL("../extension/popup.html", import.meta.url),
  "utf8"
);
const offscreen = await readFile(
  new URL("../extension/offscreen.js", import.meta.url),
  "utf8"
);
const install = await readFile(
  new URL("../docs/INSTALL.md", import.meta.url),
  "utf8"
);

test("1.1.0 source line is explicit and unreleased", () => {
  assert.equal(manifest.version, "1.1.0");
  assert.equal(manifest.version_name, "1.1.0");
});

test("1.1.0 keeps existing local authority keys for in-place updates", () => {
  for (const key of [
    "bmpCommunityToken",
    "bmpInstallId",
    "bmpState",
    "bmpCacheMeta"
  ]) {
    assert.match(background, new RegExp(key));
  }
  assert.match(popup, /const DRAFT_KEY = "bmpDraftV105"/);
  assert.match(offscreen, /bmp-terbuka-pdf-cache/);

  const installedStart = background.indexOf(
    "chrome.runtime.onInstalled.addListener"
  );
  const installedEnd = background.indexOf(
    "chrome.tabs.onUpdated.addListener",
    installedStart
  );
  const installedBlock = background.slice(installedStart, installedEnd);
  assert.doesNotMatch(
    installedBlock,
    /chrome\.storage\.local\.(?:clear|remove)/
  );
});

test("activation refresh verifies replacement before swapping stored token", () => {
  const start = background.indexOf(
    "async function refreshActivation"
  );
  const end = background.indexOf(
    "function viewerUrl",
    start
  );
  const block = background.slice(start, end);
  const verifyAt = block.indexOf(
    "await verifyCommunityToken(data.token)"
  );
  const saveAt = block.indexOf(
    "bmpCommunityToken: data.token"
  );
  assert.ok(verifyAt >= 0);
  assert.ok(saveAt > verifyAt);
  assert.match(block, /nextExpiry \+ 1000 < previousExpiry/);
});

test("legacy re-verification does not delete the active token", () => {
  const start = background.indexOf(
    'if (msg.type === "START_PAIRING")'
  );
  const end = background.indexOf(
    'if (msg.type === "CHECK_PAIRING")',
    start
  );
  const block = background.slice(start, end);
  assert.match(block, /bmpPendingPair/);
  assert.doesNotMatch(block, /bmpCommunityToken/);
});

test("popup exposes refresh UX and Edge Stable is the Android primary path", () => {
  assert.match(popupHtml, /id="refreshActivation"/);
  assert.match(popup, /REFRESH_ACTIVATION/);
  assert.match(popup, /Aktifkan pembaruan 1\.1\.0/);
  assert.match(install, /Android — Microsoft Edge Stable/);
  assert.match(install, /Chrome Android bukan jalur instalasi resmi/);
});
