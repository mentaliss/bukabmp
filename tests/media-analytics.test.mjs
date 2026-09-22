import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const cloudSource=await readFile(new URL("../extension/cloud-surface.js",import.meta.url),"utf8");
const telemetry=await readFile(new URL("../extension/telemetry.js",import.meta.url),"utf8");
const adsMedia=await readFile(new URL("../extension/ads-media.js",import.meta.url),"utf8");
const adNetwork=await readFile(new URL("../extension/ad-network.js",import.meta.url),"utf8");
const popup=await readFile(new URL("../extension/popup.js",import.meta.url),"utf8");
const background=await readFile(new URL("../extension/background.js",import.meta.url),"utf8");
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
  assert.match(telemetry,/analyticsIdPromise/);
  assert.match(telemetry,/keepalive:true/);
});

test("job start stays ahead of sponsor scheduling and lifecycle telemetry is background-owned",()=>{
  const start=popup.indexOf('send("START_JOB"');
  const schedule=popup.indexOf("scheduleJobStartedInterstitial",start);
  assert.ok(start>=0);
  assert.ok(schedule>start);
  assert.doesNotMatch(popup,/reportTelemetry\("job_(?:started|completed|failed)"\)/);
  assert.match(background,/function reportJobStateTransition/);
  assert.match(background,/reportTelemetryEvent\("job_started"\)/);
  assert.match(background,/reportTelemetryEvent\("job_completed"\)/);
  assert.match(background,/reportTelemetryEvent\("job_failed"\)/);
  const persisted=background.indexOf("await chrome.storage.local.set({bmpState: next})");
  const lifecycle=background.indexOf("reportJobStateTransition(current,next)",persisted);
  assert.ok(persisted>=0&&lifecycle>persisted);
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


test("interstitial random delay never escapes the frozen 2-5 second window",()=>{
  const match=popup.match(/function randomDelay\(min,max\)\{[^}]+\}/);
  assert.ok(match,"randomDelay implementation not found");
  const context={Math};
  vm.runInNewContext(match[0]+";this.randomDelay=randomDelay;",context);
  for(let i=0;i<10000;i++){
    const value=context.randomDelay(i%2?1:999999,i%3?999999:-1);
    assert.ok(value>=2000&&value<=5000,"delay outside frozen range: "+value);
  }
});

test("AdsOnBread adapter makes at most one provider request per popup surface",async()=>{
  let calls=0;
  const context={Promise,setTimeout,clearTimeout};
  context.self=context;
  context.globalThis=context;
  context.BMP_ADSONBREAD_SDK={async renderCard(){calls++;return {rendered:true}}};
  vm.runInNewContext(adNetwork,context);
  const first=await context.BMP_AD_NETWORK.renderCard({});
  const second=await context.BMP_AD_NETWORK.renderCard({});
  assert.equal(first.rendered,true);
  assert.equal(second.rendered,false);
  assert.equal(second.reason,"surface_already_requested");
  assert.equal(calls,1);
});

test("analytics identity replaces malformed legacy-looking IDs and serializes concurrent creation",async()=>{
  let stored="x".repeat(36),sets=0;
  const generated="9a2e4f26-5ef8-4cff-95c3-55ad55478f52";
  const context={
    Set,Promise,URL,
    crypto:{randomUUID:()=>generated},
    chrome:{
      storage:{local:{
        async get(){await Promise.resolve();return {bmpAnalyticsIdV1:stored}},
        async set(value){sets++;stored=value.bmpAnalyticsIdV1}
      }},
      runtime:{getManifest:()=>({version:"1.1.0"})}
    },
    fetch:async()=>({ok:true,status:202})
  };
  context.self=context;context.globalThis=context;
  vm.runInNewContext(telemetry,context);
  const [a,b,cId]=await Promise.all([
    context.BMP_TELEMETRY.ensureAnalyticsId(),
    context.BMP_TELEMETRY.ensureAnalyticsId(),
    context.BMP_TELEMETRY.ensureAnalyticsId()
  ]);
  assert.equal(a,generated);assert.equal(b,generated);assert.equal(cId,generated);
  assert.equal(sets,1);
});

test("media IDs must be exact immutable SHA-256 hex hashes",()=>{
  const C=cloud();
  assert.equal(C.sanitizeMediaAsset({id:"short-but-plausible-id",mime:"image/webp"},"image"),null);
  assert.match(adsMedia,/\^\[0-9a-f\]\{64\}\$\/i/);
});


test("card priority is direct then one network attempt then house fallback",()=>{
  const direct=popup.indexOf("const cardAd=campaignAdFromState(state,\"card\")");
  const network=popup.indexOf("state?.ads?.network?.adsonbread===true",direct);
  const house=popup.indexOf("if(!sponsorRendered)appendHouse()",network);
  assert.ok(direct>=0&&network>direct&&house>network);
  assert.match(popup,/if\(result\?\.rendered===true\)return;[\s\S]{0,180}appendHouse\(\)/);
  assert.match(popup,/renderGeneration!==cloudRenderGeneration/);
});

test("ads and media cannot block BMP execution authority",()=>{
  assert.doesNotMatch(background,/importScripts\([^)]*(?:ad-network|ads-media)/i);
  const start=popup.indexOf('send("START_JOB"');
  const schedule=popup.indexOf("scheduleJobStartedInterstitial().catch",start);
  assert.ok(start>=0&&schedule>start);
  assert.doesNotMatch(popup.slice(start,schedule+80),/await\s+scheduleJobStartedInterstitial/);
  assert.match(background,/msg\.type === "STOP_JOB"/);
  assert.match(background,/OCR_CANCEL_JOB/);
  assert.match(background,/setStateForRun/);
});

test("interstitial is always closable and successful CTA close does not double-count dismiss",()=>{
  assert.match(html,/id="adInterstitialClose"/);
  assert.match(popup,/adInterstitialClose"\)\.addEventListener\("click",\(\)=>hideAdInterstitial\(\)\)/);
  assert.match(popup,/hideAdInterstitial\(\{report:false\}\)/);
});

test("media metadata accepts allowed formats, preserves wrong ratios, and rejects unsupported media",()=>{
  const C=cloud();
  const hash="a".repeat(64);
  const wide=C.sanitizeMediaAsset({id:hash,mime:"image/jpeg",bytes:100,width:4000,height:300},"image");
  assert.equal(wide.width,4000);
  assert.equal(wide.height,300);
  assert.ok(C.sanitizeMediaAsset({id:hash,mime:"image/png",bytes:100},"image"));
  assert.ok(C.sanitizeMediaAsset({id:hash,mime:"image/webp",bytes:100},"image"));
  assert.ok(C.sanitizeMediaAsset({id:hash,mime:"video/mp4",bytes:100,duration_ms:15000},"video"));
  assert.ok(C.sanitizeMediaAsset({id:hash,mime:"video/webm",bytes:100,duration_ms:15000},"video"));
  assert.equal(C.sanitizeMediaAsset({id:hash,mime:"image/gif",bytes:100},"image"),null);
  assert.equal(C.sanitizeMediaAsset({id:hash,mime:"image/svg+xml",bytes:100},"image"),null);
  assert.match(html,/object-fit:contain/);
});


test("popup sponsor UI mirrors Control Center styling and collapses broken media",()=>{
  assert.match(html,/\.sponsorBanner\{padding:12px;border:1px solid #deded8;border-radius:12px/);
  assert.match(html,/\.sponsorTitle\{font-size:14px;font-weight:700/);
  assert.match(html,/\.sponsorAction\{display:inline-block;width:auto[^}]*text-decoration:underline/);
  assert.match(html,/\.sponsorMedia\{margin:8px 0;border-radius:9px;background:transparent/);
  assert.match(html,/\.adInterstitialMedia\{margin:8px 0;max-height:300px;border-radius:9px;background:transparent/);
  assert.match(html,/\.sponsorMediaAsset\{display:block;width:100%;height:auto;max-height:300px;object-fit:contain;background:transparent/);
  assert.match(popup,/media\.remove\(\);reportTelemetry\("media_render_failed"/);
  assert.match(popup,/mediaHost\.style\.display="none"/);
});

test("popup bypasses cached cloud state on open and refocus",()=>{
  assert.match(popup,/await refreshCloudSurface\(\{force:true\}\)/);
  assert.match(popup,/setInterval\(\(\)=>refreshCloudSurface\(\{force:true\}\)[\s\S]{0,80}10_000/);
  assert.match(popup,/window\.addEventListener\("focus"/);
  assert.match(popup,/visibilitychange/);
});


test("interstitial CTA and content order match preview creative",()=>{
  assert.match(html,/\.adInterstitialCta\{display:inline-block;width:auto[^}]*text-decoration:underline/);
  const headline=html.indexOf('id="adInterstitialHeadline"');
  const body=html.indexOf('id="adInterstitialBody"');
  const cta=html.indexOf('id="adInterstitialCta"');
  const disclaimer=html.indexOf('id="adInterstitialDisclaimer"');
  assert.ok(headline>=0&&body>headline&&cta>body&&disclaimer>cta);
});


test("media renderer prefers immutable first-party URLs with blob fallback",()=>{
  assert.match(adsMedia,/img\.src=src/);
  assert.match(adsMedia,/video\.src=src/);
  assert.match(adsMedia,/fetch\(url,\{method:"GET",credentials:"omit",cache:"no-store"\}\)/);
  assert.match(adsMedia,/URL\.createObjectURL\(blob\)/);
  assert.match(adsMedia,/fallbackAttempted/);
  assert.match(adsMedia,/media_http_/);
  assert.match(adsMedia,/media_mime_mismatch/);
  assert.match(adsMedia,/URL\.revokeObjectURL/);
});

test("extension CSP explicitly permits only the first-party sponsor media origin",async()=>{
  const manifest=JSON.parse(await readFile(new URL("../extension/manifest.json",import.meta.url),"utf8"));
  const csp=manifest.content_security_policy?.extension_pages||"";
  assert.match(csp,/connect-src 'self' https:\/\/community\.bukabmp\.workers\.dev/);
  assert.match(csp,/img-src 'self' data: blob: https:\/\/community\.bukabmp\.workers\.dev/);
  assert.match(csp,/media-src 'self' blob: https:\/\/community\.bukabmp\.workers\.dev/);
  assert.doesNotMatch(csp,/https:\/\/\*/);
});


test("popup loads generated config before sponsor media renderer",()=>{
  const config=html.indexOf('<script src="config.js"></script>');
  const media=html.indexOf('<script src="ads-media.js"></script>');
  const popupScript=html.indexOf('<script src="popup.js"></script>');
  assert.ok(config>=0&&media>config&&popupScript>media);
  assert.match(popup,/self\.BMP_CONFIG\?\.API_BASE_URL/);
});


test("demo creative generator has no baked-in matte",async()=>{
  const control=await readFile(new URL("../worker/src/control-center-ui.js",import.meta.url),"utf8");
  assert.doesNotMatch(control,/fillStyle="#f1f1ed"/);
  assert.doesNotMatch(control,/var m=width\*\.08/);
  assert.match(control,/strokeRect\(2,2,width-4,height-4\)/);
});
