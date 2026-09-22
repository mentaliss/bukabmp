import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const cloudSource=await readFile(new URL("../extension/cloud-surface.js",import.meta.url),"utf8");
const telemetry=await readFile(new URL("../extension/telemetry.js",import.meta.url),"utf8");
const adsMedia=await readFile(new URL("../extension/ads-media.js",import.meta.url),"utf8");
const adNetwork=await readFile(new URL("../extension/ad-network.js",import.meta.url),"utf8");
const popup=await readFile(new URL("../extension/popup.js",import.meta.url),"utf8");
const html=await readFile(new URL("../extension/popup.html",import.meta.url),"utf8");

function cloud(){
  const context={URL,Date,Set,Math};
  context.self=context;
  context.globalThis=context;
  vm.runInNewContext(cloudSource,context);
  return context.BMP_CLOUD_SURFACE;
}

test("creative v2 is additive and sanitizes first-party media metadata",()=>{
  const C=cloud();
  const state=C.sanitizeState({
    schema_version:1,
    ads:{
      enabled:true,
      active:true,
      campaign_id:"demo",
      creative_version:2,
      headline:"Text fallback",
      placements:{card:true,interstitial:true},
      card:{mode:"banner",asset:{id:"a".repeat(64),mime:"image/webp",bytes:3*1024*1024,width:1200,height:675}},
      interstitial:{enabled:true,mode:"video",asset:{id:"b".repeat(64),mime:"video/mp4",bytes:10*1024*1024,duration_ms:15000}},
      network:{adsonbread:true}
    }
  });
  assert.equal(state.schemaVersion,1);
  assert.equal(state.ads.creativeVersion,2);
  assert.equal(state.ads.card.mode,"banner");
  assert.equal(state.ads.card.asset.mime,"image/webp");
  assert.equal(state.ads.interstitial.mode,"video");
  assert.equal(state.ads.interstitial.asset.durationMs,15000);
  assert.equal(state.ads.network.adsonbread,true);
  assert.equal(C.sanitizeMediaAsset({id:"c".repeat(64),mime:"image/svg+xml"},"image"),null);
  assert.equal(C.sanitizeMediaAsset({id:"d".repeat(64),mime:"image/gif"},"image"),null);
});

test("media byte and duration bounds are clamped",()=>{
  const C=cloud();
  const image=C.sanitizeMediaAsset({id:"e".repeat(64),mime:"image/png",bytes:99*1024*1024},"image");
  const video=C.sanitizeMediaAsset({id:"f".repeat(64),mime:"video/webm",bytes:99*1024*1024,duration_ms:99000},"video");
  assert.equal(image.bytes,3*1024*1024);
  assert.equal(video.bytes,10*1024*1024);
  assert.equal(video.durationMs,15000);
});

test("media renderer derives only BMP first-party media endpoints",()=>{
  assert.match(adsMedia,/\/v1\/media\//);
  assert.doesNotMatch(adsMedia,/asset\?\.url|image_url/i);
  assert.match(adsMedia,/video\.muted=true/);
  assert.match(adsMedia,/video\.playsInline=true/);
  assert.match(adsMedia,/video\.loop=false/);
  assert.match(html,/object-fit:contain/);
});

test("AdsOnBread adapter is card-only, bounded, and falls back to house",()=>{
  assert.match(adNetwork,/placement:"card"/);
  assert.match(adNetwork,/REQUEST_TIMEOUT_MS=1200/);
  assert.doesNotMatch(adNetwork,/interstitial/i);
  assert.match(popup,/state\?\.ads\?\.network\?\.adsonbread/);
  assert.match(popup,/appendHouse\(\)/);
});

test("telemetry uses a separate anonymous identity and hard event allowlist",()=>{
  assert.match(telemetry,/bmpAnalyticsIdV1/);
  assert.doesNotMatch(telemetry,/bmpInstallId|telegram|member_ref|activation_token|pairing|ocr_text|pdf_filename|rbv_url/i);
  for(const event of ["extension_open","job_started","job_completed","job_failed","ad_impression","ad_click","ad_dismiss","media_render_failed"]){
    assert.match(telemetry,new RegExp(event));
  }
  assert.match(telemetry,/crypto\.randomUUID\(\)/);
  assert.match(telemetry,/keepalive:true/);
});

test("job start stays ahead of sponsor scheduling and telemetry",()=>{
  const start=popup.indexOf('send("START_JOB"');
  const started=popup.indexOf('reportTelemetry("job_started")',start);
  const schedule=popup.indexOf("scheduleJobStartedInterstitial",start);
  assert.ok(start>=0);
  assert.ok(started>start);
  assert.ok(schedule>started);
  assert.match(popup,/Math\.max\(2000/);
  assert.match(popup,/Math\.min\(5000/);
  assert.match(html,/id="adInterstitialMedia"/);
});

test("AdsOnBread is never selected for interstitial",()=>{
  const scheduleStart=popup.indexOf("async function scheduleJobStartedInterstitial");
  const scheduleEnd=popup.indexOf("function renderCloudSurface",scheduleStart);
  const block=popup.slice(scheduleStart,scheduleEnd);
  assert.doesNotMatch(block,/AD_NETWORK|adsonbread/i);
  assert.match(block,/campaignAdFromState\(state,"interstitial"\)/);
  assert.match(block,/houseAdFromState\(state\)/);
});
