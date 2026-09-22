import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const background = await readFile(new URL("../extension/background.js", import.meta.url), "utf8");
const popup = await readFile(new URL("../extension/popup.js", import.meta.url), "utf8");
const contentScript = await readFile(new URL("../extension/content.js", import.meta.url), "utf8");
const offscreen = await readFile(new URL("../extension/offscreen.js", import.meta.url), "utf8");
const configTemplate = await readFile(new URL("../extension/config.template.js", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));

test("legacy-to-v2 pairing preserves the current activation defensively", () => {
  const start = background.slice(
    background.indexOf("async function startPairing"),
    background.indexOf("async function checkPairing")
  );
  const check = background.slice(
    background.indexOf("async function checkPairing"),
    background.indexOf("async function refreshActivation")
  );
  assert.match(start, /current_token/);
  assert.match(start, /bmpCommunityToken/);
  assert.match(check, /currentExpiry/);
  assert.match(check, /nextExpiry \+ 1000 < currentExpiry/);
  assert.match(check, /Token lama tetap dipakai/);
});

test("remote navigation is validated before tabs are opened", () => {
  assert.match(background, /function safeHttpsUrl/);
  assert.match(background, /function safeTelegramUrl/);
  assert.match(background, /hostname\.toLowerCase\(\) === "t\.me"/);
  assert.match(background, /releaseUrl: safeHttpsUrl\(data\.release_url\)/);
  const start = background.slice(
    background.indexOf("async function startPairing"),
    background.indexOf("async function checkPairing")
  );
  assert.match(start, /const deepLink = safeTelegramUrl\(data\.deep_link\)/);
  assert.match(start, /chrome\.tabs\.create\(\{url: deepLink\}\)/);
  assert.doesNotMatch(start, /chrome\.tabs\.create\(\{url: data\.deep_link\}\)/);
});

test("Chrome 109 offscreen path feature detects getContexts", () => {
  assert.equal(manifest.minimum_chrome_version, "109");
  assert.match(background, /typeof chrome\.runtime\.getContexts === "function"/);
  assert.match(background, /self\.clients\.matchAll/);
});

test("job orchestration rejects concurrent starts and stale module traffic", () => {
  assert.match(background, /startJobClaimRunId/);
  assert.match(background, /Proses lain sedang disiapkan/);
  assert.match(background, /existingJob\.running/);
  assert.match(background, /Proses lain masih berjalan/);
  assert.match(background, /status: "PREPARING"/);
  assert.match(background, /assertCurrentRun/);
  assert.match(background, /Tab proses bukan halaman reader BMP yang didukung/);
  assert.match(background, /mod !== Number\(state\.currentModule\)/);
  assert.match(background, /Pesan OCR berasal dari modul lama/);
  assert.match(background, /JOB_ERROR_MESSAGE_TYPES/);
});

test("known page count cannot finalize a truncated module", () => {
  assert.match(contentScript, /if \(totalPages\)/);
  assert.match(contentScript, /Modul tidak disimpan agar PDF tidak terpotong/);
  assert.match(contentScript, /resp\.status >= 500/);
});

test("page count must stabilize and generic fractions are ignored", () => {
  assert.match(contentScript, /stableReads/);
  assert.match(contentScript, /No stable count|transient toolbar value/);
  assert.match(contentScript, /if \(!\/page\|halaman\|viewer\|toolbar\|pager\/i\.test\(context\)\) continue/);
});

test("OCR generation IDs isolate stop/restart races across all layers", () => {
  assert.match(background, /runId: state\.runId/);
  assert.match(background, /String\(msg\.runId \|\| ""\) !== String\(state\.runId \|\| ""\)/);
  assert.match(contentScript, /activeRunId/);
  assert.match(background, /type: "STOP_MODULE"/);
  assert.match(contentScript, /msg\.type === "STOP_MODULE"/);
  assert.match(contentScript, /const stillActive = \(\) => Boolean\(runId\) && activeRunId === runId/);
  assert.match(offscreen, /activeJobRunId/);
  assert.match(offscreen, /currentPdfRunId/);
  assert.match(offscreen, /ownsActivePdf/);
  assert.match(offscreen, /OCR_CANCEL_JOB/);
});

test("cache and reviewer operations are isolated from active OCR", () => {
  assert.match(background, /Penyimpanan lokal tidak bisa dibersihkan saat proses BMP masih berjalan/);
  assert.match(background, /Selesaikan atau hentikan proses BMP sebelum menjalankan sampel reviewer/);
  assert.match(offscreen, /currentModuleKey\.startsWith\(code \+ ":M"\)/);
  assert.match(offscreen, /clearPdfOwnedBy/);
  assert.match(offscreen, /currentPdf\s*!==\s*pdf|currentPdf\s*===\s*pdf/);
});

test("download completion and failure both revoke temporary blob URLs", () => {
  const block = background.slice(
    background.indexOf("async function saveBlobUrl"),
    background.indexOf("async function runReviewerSample")
  );
  assert.match(block, /const revoke = \(\) => chrome\.runtime\.sendMessage/);
  assert.match(block, /type: "REVOKE_BLOB_URL"/);
  assert.match(block, /const cleanup = \(\) =>/);
  assert.match(block, /revoke\(\)/);
  assert.match(block, /catch \(error\)[\s\S]*revoke\(\)/);
});

test("stale persisted jobs have a safe recovery path", () => {
  assert.match(background, /async function recoverStaleRunningState\(\{forceInterrupt = false\}/);
  assert.match(background, /recoverStaleRunningState\(\{forceInterrupt: true\}\)/);
  assert.match(background, /runId: ""/);
  assert.match(background, /status: "INTERRUPTED"/);
});

test("v1.0.5 token authority and local storage identity stay frozen", () => {
  const expectedModulus="wvJqzOrXWp1XEAWZwhCM9MaI5kZwGVMa4DbJhFHSiVt6-SSLXrBZs-CPOP8EBCi6E7CTNbpmkKXK4S4Ubn9Jdwq11qHFfkBOIC9KWFeFlB2ZxaKqmEjaZsL-NI_Zyb09bPpB6Dz8k21jg1wwBl7sJP3-fphhvKvZKbdOCsWEeGJnWjFOhPbASoZuthefV9Z96TC9_BnZDsytKWqthktACV1HViXO2RVzY_Jzntqo3ccZx1atlIPhhQzI1h9tl-AOiIvzkxtmSjjsXPfnEBbgpQz0fkziRunHNjLAVyIRYtfNv7kYGtmLrIaYShb4y6Wi33KVEKkzDrFMa8LPtRWFWQ";
  assert.ok(configTemplate.includes(expectedModulus));
  assert.match(configTemplate, /TOKEN_ISSUER: "bmp-terbuka-community"/);
  assert.match(configTemplate, /TOKEN_AUDIENCE: "bmp-terbuka-extension"/);
  assert.equal("key" in manifest, false);
  for(const key of ["bmpCommunityToken","bmpInstallId","bmpState","bmpCacheMeta"]) assert.match(background,new RegExp(key));
  assert.match(popup,/bmpDraftV105/);
  assert.match(offscreen,/indexedDB\.open\("bmp-terbuka-pdf-cache", 1\)/);
  assert.match(offscreen,/createObjectStore\("pdfs"\)/);
  assert.doesNotMatch(offscreen,/deleteDatabase/);
});

test("start click and sponsor timer are locally bounded", () => {
  const startAt=popup.indexOf('el("start").addEventListener');
  const stopAt=popup.indexOf('el("stop").addEventListener',startAt);
  const block=popup.slice(startAt,stopAt);
  assert.ok(block.indexOf('el("start").disabled=true') < block.indexOf('send("START_JOB"'));
  const delay=popup.slice(popup.indexOf("function randomDelay"),popup.indexOf("async function scheduleJobStartedInterstitial"));
  assert.match(delay,/Math\.max\(2000/);
  assert.match(delay,/Math\.min\(5000/);
});


test("finalization and merge use the validated job snapshot rather than mutable global state", () => {
  assert.match(background, /async function finishModule\(state, mod, pages\)/);
  assert.match(background, /finishModule\(state, mod, msg\.pages\)/);
  assert.match(background, /async function buildMergedPdf\(state, firstModule, lastModule/);
  assert.match(background, /buildMergedPdf\(state, target\.first, target\.last/);
});

test("START_JOB error cleanup cannot kill a later generation", () => {
  const catchAt = background.lastIndexOf("})().catch(async e =>");
  const block = background.slice(catchAt);
  assert.match(block, /messageRunId/);
  assert.match(block, /sameRun/);
  assert.doesNotMatch(block, /msg\?\.type === "START_JOB" \|\| sameRun/);
});


test("all long-lived job mutations are generation-scoped", () => {
  assert.match(background, /const cancelledRunIds = new Set\(\)/);
  assert.match(background, /async function setStateForRun/);
  assert.match(background, /async function requireActiveRun/);
  assert.match(background, /setDetectedLastModuleForRun/);
  assert.match(background, /offscreenMaintenanceClaim/);
  assert.match(background, /status: "BUILDING_MERGE"/);
});

test("blob URLs live until download settles, with a long fallback", () => {
  const start = background.indexOf("async function saveBlobUrl");
  const end = background.indexOf("async function runReviewerSample", start);
  const block = background.slice(start, end);
  assert.match(block, /chrome\.downloads\.onChanged\.addListener/);
  assert.match(block, /chrome\.downloads\.onChanged\.removeListener/);
  assert.match(block, /chrome\.downloads\.search\(\{id\}\)/);
  assert.match(block, /5 \* 60 \* 1000/);
  assert.doesNotMatch(block, /15000/);
});

test("reviewer and cache maintenance cannot race a job preparation", () => {
  assert.match(background, /let offscreenMaintenanceClaim = ""/);
  const startJob = background.slice(
    background.indexOf('if (msg.type === "START_JOB")'),
    background.indexOf('if (msg.type === "STOP_JOB")')
  );
  assert.match(startJob, /startJobClaimRunId \|\| offscreenMaintenanceClaim/);
  const reviewer = background.slice(
    background.indexOf('if (msg.type === "RUN_REVIEW_SAMPLE")'),
    background.indexOf('if (msg.type === "GET_CACHE_INFO")')
  );
  assert.match(reviewer, /offscreenMaintenanceClaim/);
  const clear = background.slice(
    background.indexOf('if (msg.type === "CLEAR_CACHE_CODE")'),
    background.indexOf('if (msg.type === "GET_STATE")')
  );
  assert.match(clear, /startJobClaimRunId \|\| offscreenMaintenanceClaim/);
});

test("detected-last metadata is committed only by the active generation", () => {
  assert.match(background, /async function setDetectedLastModuleForRun/);
  assert.match(background, /await activeRunState\(runId\)/);
  assert.match(background, /cancelledRunIds\.has\(String\(runId \|\| ""\)\)/);
});
