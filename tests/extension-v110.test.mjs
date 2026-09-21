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

test("job start schedules sponsor only after START_JOB succeeds", () => {
  const start = popup.indexOf('el("start").addEventListener');
  const end = popup.indexOf('el("selectAllExport")', start);
  const block = popup.slice(start, end);
  const requestAt = block.indexOf('send("START_JOB"');
  const scheduleAt = block.indexOf("scheduleJobStartedInterstitial");
  assert.ok(requestAt >= 0);
  assert.ok(scheduleAt > requestAt);
  assert.match(block, /if\(!res\?\.ok\)/);
  assert.match(block, /else\{\s*scheduleJobStartedInterstitial/);
});

test("interstitial countdown starts before realtime fetch so backend latency cannot delay the ad", () => {
  const start = popup.indexOf("async function scheduleJobStartedInterstitial");
  const end = popup.indexOf("function renderCloudSurface", start);
  const block = popup.slice(start, end);
  const timerAt = block.indexOf("setTimeout");
  const fetchAt = block.indexOf('send("GET_CLOUD_STATE"');
  assert.ok(timerAt >= 0);
  assert.ok(fetchAt > timerAt);
  assert.match(block, /delayMinMs\|\|2000/);
  assert.match(block, /delayMaxMs\|\|5000/);
});

test("synced activation keeps status card but hides redundant manual refresh CTA", () => {
  const start = popup.indexOf("if(a.active&&!a.reviewer)");
  const end = popup.indexOf("return a;", start);
  const block = popup.slice(start, end);
  assert.match(block, /Akun dan aktivasi sudah tersinkron/);
  assert.match(block, /refreshActivation"\)\.style\.display="none"/);
  assert.match(block, /refreshActivation"\)\.style\.display="block"/);
});

test("popup exposes current realtime surfaces and Edge Stable Android path", () => {
  assert.match(popupHtml, /id="refreshActivation"/);
  assert.match(popup, /REFRESH_ACTIVATION/);
  assert.match(popup, /Verifikasi ulang/);
  assert.match(popup, /menyinkronkan akun BMP Terbuka/);
  assert.match(popup, /Akun dan aktivasi sudah tersinkron/);
  assert.doesNotMatch(popup, /Aktifkan pembaruan/);
  assert.doesNotMatch(popup, /token lama/);
  assert.match(popupHtml, /id="cloudStatusBadge"/);
  assert.match(popupHtml, /id="supporterBadge"/);
  assert.match(popupHtml, /id="sponsorSlot"/);
  assert.ok(
    popupHtml.indexOf('id="sponsorSlot"') <
    popupHtml.indexOf('id="activationManage"')
  );
  assert.match(popupHtml, /id="adInterstitial"/);
  assert.match(popupHtml, /id="adInterstitialClose"/);
  assert.match(popupHtml, /id="adInterstitialCta"/);
  assert.match(popup, /scheduleJobStartedInterstitial/);
  assert.match(popup, /GET_CLOUD_STATE/);
  assert.match(popup, /force:true/);
  assert.match(popup, /delayMinMs\|\|2000/);
  assert.match(popup, /delayMaxMs\|\|5000/);
  assert.match(popup, /Space iklan tersedia/);
  assert.match(popup, /Pasang iklan\? Hubungi/);
  assert.match(background, /REPORT_AD_EVENT/);
  assert.match(background, /\/v1\/ad-event/);
  assert.match(popup, /refreshActivation"\)\.style\.display="none"/);
  assert.match(install, /Android — Microsoft Edge Stable/);
  assert.match(install, /Chrome Android bukan jalur instalasi resmi/);
});
