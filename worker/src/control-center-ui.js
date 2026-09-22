export function controlCenterPage() {
  return new Response(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BMP Terbuka Control Center</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;background:#f4f4f1}
*{box-sizing:border-box}body{margin:0}.hidden{display:none!important}button,input,select,textarea{font:inherit}button{cursor:pointer}
.shell{max-width:1280px;margin:auto;padding:22px}.top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}
.brand h1{font-size:22px;margin:0 0 4px}.brand p,.muted{color:#70706b;font-size:12px;margin:0}.pill{border:1px solid #d8d8d2;border-radius:999px;padding:7px 10px;background:#fff;font-size:11px}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#bbb;margin-right:6px}.dot.ok{background:#1f8a4c}.dot.warn{background:#b9770e}
.card{background:#fff;border:1px solid #dfdfd8;border-radius:14px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.03)}.login{display:grid;grid-template-columns:1fr auto;gap:9px;margin-top:12px}
input,select,textarea{width:100%;border:1px solid #d5d5cf;border-radius:8px;padding:9px 10px;background:#fff;color:#171717}textarea{min-height:84px;resize:vertical}
button{border:1px solid #d5d5cf;background:#fff;border-radius:8px;padding:8px 11px}button.primary{background:#171717;color:#fff;border-color:#171717}button.danger{border-color:#d89b9b;color:#9d2323}.small{font-size:11px;padding:6px 8px}
.grid{display:grid;grid-template-columns:190px 1fr;gap:16px}.nav{display:grid;gap:5px;align-content:start;position:sticky;top:18px}.nav button{text-align:left;border:0;background:transparent;padding:9px 10px}.nav button.active{background:#171717;color:#fff}.content{min-width:0}.panel{display:grid;gap:14px}
.panelHead{display:flex;align-items:center;justify-content:space-between;gap:10px}.panelHead h2,.card h2{font-size:15px;margin:0}.sub{font-size:11px;color:#777;margin:4px 0 0;line-height:1.5}
.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.seg{display:flex;border:1px solid #d9d9d3;border-radius:9px;overflow:hidden;background:#fff}.seg button{border:0;border-right:1px solid #e4e4df;border-radius:0;padding:7px 10px;font-size:10px}.seg button:last-child{border-right:0}.seg button.active{background:#171717;color:#fff}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.kpi{background:#fff;border:1px solid #dfdfd8;border-radius:12px;padding:13px}.kpi b{display:block;font-size:20px;letter-spacing:-.02em}.kpi span{font-size:10px;color:#777}.kpi small{display:block;color:#999;font-size:9px;margin-top:3px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.row3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.field{display:grid;gap:5px;font-size:11px}.check{display:flex;align-items:center;gap:7px;font-size:11px}.check input{width:auto}
.sectionTitle{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#777;margin:2px 0}.locked{border:1px solid #d9d9d3;background:#f4f4f1;border-radius:9px;padding:10px;font-size:11px}.locked b{float:right;font-size:9px;border:1px solid #c9c9c2;border-radius:999px;padding:2px 6px}
.preview{border:1px dashed #cfcfc7;border-radius:12px;background:#fafaf8;padding:14px;min-height:110px}.adCard{max-width:520px;border:1px solid #deded8;border-radius:12px;background:#fff;padding:12px}.adMedia{display:flex;align-items:center;justify-content:center;background:#efefec;border-radius:9px;overflow:hidden;margin:8px 0;max-height:300px}.adMedia img,.adMedia video{display:block;width:100%;height:100%;max-height:300px;object-fit:contain}.label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#777}.headline{font-weight:700;margin-top:5px}.bodyCopy{font-size:11px;line-height:1.5;color:#444;margin-top:5px}.cta{display:inline-block;margin-top:9px;font-size:10px;text-decoration:underline}.disclaimer{font-size:9px;color:#888;margin-top:7px}
.chart{width:100%;height:180px;border:1px solid #e3e3de;border-radius:10px;background:#fff}.status{font-size:10px;margin-top:7px;min-height:14px}.status.ok{color:#217442}.status.err{color:#a12828}
.history{display:grid;gap:8px}.historyItem{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;border:1px solid #e3e3dd;border-radius:9px;padding:10px}.historyItem small{color:#777}.code{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;min-height:240px}.advanced{border-top:1px solid #ecece7;padding-top:12px}.fileMeta{font-size:9px;color:#777;line-height:1.4}.readiness{display:grid;gap:8px}.readyRow{display:grid;grid-template-columns:1fr auto;align-items:center;border:1px solid #e3e3dd;border-radius:9px;padding:9px 10px}.badge{font-size:9px;border:1px solid #d6d6d0;border-radius:999px;padding:3px 7px}.badge.ready{color:#1f7d46}.badge.wait{color:#9b6b0b}
@media(max-width:900px){.grid{grid-template-columns:1fr}.nav{position:static;display:flex;overflow:auto}.nav button{white-space:nowrap}.kpis{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.shell{padding:12px}.row,.row3,.kpis{grid-template-columns:1fr}.top{display:block}.pill{margin-top:10px}.login{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="shell">
  <div class="top">
    <div class="brand"><h1>BMP Terbuka Control Center</h1><p>v0.2 · sponsor media, compact analytics, extension surface, and version readiness</p></div>
    <div class="pill"><span id="connDot" class="dot"></span><span id="connText">Locked</span></div>
  </div>

  <section id="loginCard" class="card">
    <h2>Owner authentication</h2>
    <p class="sub">Masukkan ADMIN_SETUP_TOKEN. Token hanya hidup di memory tab ini.</p>
    <div class="login"><input id="token" type="password" autocomplete="off" placeholder="ADMIN_SETUP_TOKEN"><button id="connect" class="primary">Connect</button></div>
    <div id="loginStatus" class="status"></div>
  </section>

  <div id="app" class="grid hidden">
    <nav class="nav">
      <button data-tab="overview" class="active">Overview</button>
      <button data-tab="analytics">Analytics</button>
      <button data-tab="ads">Ads</button>
      <button data-tab="extension">Extension</button>
      <button data-tab="version">Version</button>
      <button data-tab="history">History</button>
    </nav>

    <main class="content">
      <section data-panel="overview" class="panel">
        <div class="panelHead"><div><h2>Overview</h2><p class="sub">Ringkasan screenshot-friendly. Subscriber dan member adalah dua angka berbeda; overlap tidak diketahui.</p></div><div id="periodOverview" class="seg"><button data-period="24h">24H</button><button data-period="7d" class="active">7D</button><button data-period="30d">30D</button></div></div>
        <div class="kpis">
          <div class="kpi"><b id="kSubscribers">—</b><span>Subscribers</span><small>Telegram Channel</small></div>
          <div class="kpi"><b id="kMembers">—</b><span>Members</span><small>Group Terbuka</small></div>
          <div class="kpi"><b id="kTotal">—</b><span>Total Users</span><small>pseudonymous installs observed</small></div>
          <div class="kpi"><b id="kActive">—</b><span>Active Users</span><small>selected period</small></div>
          <div class="kpi"><b id="kOpens">—</b><span>Opens</span><small>extension_open</small></div>
          <div class="kpi"><b id="kJobs">—</b><span>Jobs</span><small>job_started</small></div>
          <div class="kpi"><b id="kReturning">—</b><span>Returning</span><small>active users seen earlier</small></div>
          <div class="kpi"><b id="kHealth">—</b><span>Health</span><small>completed vs failed jobs</small></div>
          <div class="kpi"><b id="kReach">—</b><span>Ad Reach</span><small>paid direct only</small></div>
          <div class="kpi"><b id="kImpressions">—</b><span>Impressions</span><small>paid direct only</small></div>
          <div class="kpi"><b id="kCtr">—</b><span>CTR</span><small>clicks / impressions</small></div>
        </div>
        <div class="row"><div class="card"><h2>Engagement</h2><canvas id="chartEngagement" class="chart"></canvas></div><div class="card"><h2>Ads</h2><canvas id="chartAds" class="chart"></canvas></div></div>
        <div id="overviewStatus" class="status"></div>
      </section>

      <section data-panel="analytics" class="panel hidden">
        <div class="panelHead"><div><h2>Analytics</h2><p class="sub">Default tetap ringkas. Filter channel hanya membaca data product telemetry anonim.</p></div></div>
        <div class="toolbar">
          <div id="periodAnalytics" class="seg"><button data-period="24h">24H</button><button data-period="7d" class="active">7D</button><button data-period="30d">30D</button></div>
          <select id="analyticsChannel" style="max-width:220px"><option value="">ALL</option><option value="github">GitHub/manual</option><option value="android">Android</option><option value="edge">Edge</option><option value="cws">Chrome/CWS</option></select>
          <button id="refreshAnalytics">Refresh</button>
        </div>
        <div class="kpis">
          <div class="kpi"><b id="aSuccess">—</b><span>Job success</span></div>
          <div class="kpi"><b id="aFailed">—</b><span>Job failed</span></div>
          <div class="kpi"><b id="aMediaFailed">—</b><span>Media render failure</span></div>
          <div class="kpi"><b id="aClicks">—</b><span>Paid clicks</span></div>
        </div>
        <details class="card"><summary>Advanced / Performance details</summary><pre id="analyticsRaw" class="code"></pre></details>
        <div id="analyticsStatus" class="status"></div>
      </section>

      <section data-panel="ads" class="panel hidden">
        <div class="panelHead"><div><h2>Ads Manager</h2><p class="sub">Direct BMP Sponsor → AdsOnBread fallback → House Ad untuk card. Interstitial tidak memakai AdsOnBread.</p></div><div class="toolbar"><select id="adsTarget" class="target"><option value="all">ALL</option><option value="github">GitHub/manual</option><option value="android">Android</option><option value="edge">Edge</option><option value="cws">Chrome/CWS</option></select></div></div>

        <div class="card">
          <div class="row3">
            <label class="check"><input id="adsEnabled" type="checkbox">Campaign ON</label>
            <label class="field">Advertiser<input id="advertiser" maxlength="96"></label>
            <label class="field">Schedule<select id="scheduleMode"><option value="now">Publish now</option><option value="scheduled">Scheduled</option></select></label>
          </div>
          <div id="scheduleFields" class="row hidden" style="margin-top:10px"><label class="field">Starts at<input id="startsAt" type="datetime-local"></label><label class="field">Ends at<input id="endsAt" type="datetime-local"></label></div>
          <div class="row" style="margin-top:10px"><label class="field">Headline<input id="headline" maxlength="120"></label><label class="field">CTA label<input id="ctaLabel" maxlength="48"></label></div>
          <label class="field" style="margin-top:10px">Body<textarea id="adBody" maxlength="700"></textarea></label>
          <div class="row" style="margin-top:10px"><label class="field">CTA URL<input id="ctaUrl" placeholder="https://"></label><label class="field">Disclaimer<input id="disclaimer" maxlength="220"></label></div>
        </div>

        <div class="row">
          <div class="card">
            <div class="sectionTitle">Card</div>
            <label class="field">Mode<select id="cardMode"><option value="text">Text</option><option value="banner">Banner</option></select></label>
            <label id="cardUploadWrap" class="field hidden" style="margin-top:9px">Upload JPG / PNG / WebP ≤ 3 MiB<input id="cardFile" type="file" accept="image/jpeg,image/png,image/webp"><span id="cardMeta" class="fileMeta">No media selected</span></label>
            <label class="check" style="margin-top:10px"><input id="networkFallback" type="checkbox" checked>AdsOnBread when direct card unavailable</label>
          </div>
          <div class="card">
            <div class="sectionTitle">Interstitial</div>
            <label class="field">Mode<select id="interstitialMode"><option value="text">Text</option><option value="image">Image</option><option value="video">Video</option></select></label>
            <label id="interstitialUploadWrap" class="field hidden" style="margin-top:9px">Upload media<input id="interstitialFile" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"><span id="interstitialMeta" class="fileMeta">No media selected</span></label>
            <div class="locked" style="margin-top:10px">Interstitial timing <strong>Random 2–5 seconds</strong><b>LOCKED</b></div>
          </div>
        </div>

        <div class="card">
          <div class="sectionTitle">Placement</div>
          <div class="toolbar"><label class="check"><input id="placeCard" type="checkbox" checked>Card</label><label class="check"><input id="placeInterstitial" type="checkbox">Interstitial</label></div>
        </div>

        <div class="card">
          <div class="sectionTitle">Fallback Ad</div>
          <p class="sub">Terpisah dari paid campaign. Tetap tersedia saat direct sponsor dan network tidak tersedia.</p>
          <div class="row" style="margin-top:10px"><label class="field">Headline<input id="houseHeadline" value="Space iklan tersedia"></label><label class="field">CTA label<input id="houseCtaLabel" value="Pasang iklan? Hubungi"></label></div>
          <div class="row" style="margin-top:10px"><label class="field">Body<input id="houseBody"></label><label class="field">CTA URL<input id="houseCtaUrl" value="https://t.me/bukabmp?direct"></label></div>
        </div>

        <div class="toolbar"><button id="loadDemo">Load Demo Creative</button><button id="previewAds">Preview</button><button id="publishAds" class="primary">Publish</button><button id="pauseAds" class="danger">Campaign OFF</button></div>
        <div class="preview"><div id="adPreview"></div></div>
        <details class="card advanced"><summary>Advanced</summary><div class="row" style="margin-top:10px"><label class="field">Campaign ID<input id="campaignId" readonly></label><label class="field">Revision<input id="revision" readonly></label></div></details>
        <div id="adsStatus" class="status"></div>
      </section>

      <section data-panel="extension" class="panel hidden">
        <div class="panelHead"><div><h2>Extension</h2><p class="sub">Surface sederhana; raw JSON tetap tersedia di Advanced.</p></div><select id="extensionTarget" class="target" style="max-width:220px"><option value="all">ALL</option><option value="github">GitHub/manual</option><option value="android">Android</option><option value="edge">Edge</option><option value="cws">Chrome/CWS</option></select></div>
        <div class="card">
          <div class="row3"><label class="check"><input id="badgeOn" type="checkbox">Status badge ON</label><label class="field">Type<select id="badgeKind"><option>info</option><option>success</option><option>warning</option><option>community</option><option>supporter</option></select></label><label class="field">Text<input id="badgeText" maxlength="160"></label></div>
        </div>
        <div class="toolbar"><button id="previewExtension">Preview</button><button id="publishExtension" class="primary">Publish</button></div>
        <div id="extensionPreview" class="preview"></div>
        <details class="card advanced"><summary>Advanced</summary><textarea id="rawStateEditor" class="code"></textarea></details>
        <div id="extensionStatus" class="status"></div>
      </section>

      <section data-panel="version" class="panel hidden">
        <div class="panelHead"><div><h2>Version</h2><p class="sub">Global latest/minimum. Minimum hanya berlaku pada channel yang ditandai Ready.</p></div></div>
        <div class="card">
          <div class="row"><label class="field">Latest version<input id="latestVersion" placeholder="current live"></label><label class="field">Minimum supported<input id="minimumGlobal" placeholder="current live"></label></div>
          <div class="row" style="margin-top:10px"><label class="field">Release URL<input id="releaseUrl" placeholder="https://"></label><label class="field">Message<input id="versionMessage"></label></div>
        </div>
        <div class="card"><div class="sectionTitle">Readiness</div><div class="readiness">
          <label class="readyRow">GitHub/manual <span><input id="readyGithub" type="checkbox"> Ready</span></label>
          <label class="readyRow">Android <span><input id="readyAndroid" type="checkbox"> Ready</span></label>
          <label class="readyRow">Edge <span><input id="readyEdge" type="checkbox"> Ready</span></label>
          <label class="readyRow">Chrome/CWS <span><input id="readyCws" type="checkbox"> Ready</span></label>
        </div></div>
        <div class="toolbar"><button id="reloadVersion">Reload</button><button id="saveVersion" class="primary">Save policy</button></div>
        <div id="effectiveVersion" class="card"></div>
        <div id="versionStatus" class="status"></div>
      </section>

      <section data-panel="history" class="panel hidden">
        <div class="panelHead"><div><h2>History</h2><p class="sub">Rollback tetap per channel supaya pemulihan eksplisit.</p></div><div class="toolbar"><select id="historyTarget" style="max-width:220px"><option value="github">GitHub/manual</option><option value="android">Android</option><option value="edge">Edge</option><option value="cws">Chrome/CWS</option></select><button id="refreshHistory">Refresh</button></div></div>
        <div id="historyList" class="history"></div>
        <div id="historyStatus" class="status"></div>
      </section>
    </main>
  </div>
</div>

<script>
(function(){
"use strict";
var authToken="";
var overviewPeriod="7d";
var analyticsPeriod="7d";
var loadedStates={};
var currentState=null;
var cardAsset=null;
var interstitialAsset=null;
var posterAsset=null;
var analyticsData=null;

function el(id){return document.getElementById(id)}
function all(sel){return Array.prototype.slice.call(document.querySelectorAll(sel))}
function status(node,text,ok){node.textContent=text||"";node.className="status "+(ok===true?"ok":ok===false?"err":"")}
function targetValue(id){return el(id).value}
function number(value){return new Intl.NumberFormat("id-ID").format(Number(value||0))}
function pct(value){return value==null?"—":Number(value).toFixed(1)+"%"}
function isoLocal(value){if(!value)return "";var d=new Date(value);if(!Number.isFinite(d.getTime()))return "";var p=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes())}
function toIso(value){if(!value)return null;var d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():null}
async function api(path,options){
  options=options||{};
  options.headers=Object.assign({},options.headers||{},{Authorization:"Bearer "+authToken});
  var r=await fetch(path,options);
  var data=await r.json().catch(function(){return {}});
  if(!r.ok)throw new Error(data.error||data.detail||("HTTP "+r.status));
  return data;
}
function baseState(){
  var source=currentState&&typeof currentState==="object"?JSON.parse(JSON.stringify(currentState)):{schema_version:1};
  source.schema_version=1;
  return source;
}
async function loadState(target){
  var data=await api("/control/api/state?distribution_channel="+encodeURIComponent(target));
  if(target==="all"){
    loadedStates=data.states||{};
    currentState=loadedStates.github||Object.values(loadedStates)[0]||{schema_version:1};
  }else{
    loadedStates[target]=data.state;
    currentState=data.state;
  }
  fillAds(currentState);
  fillExtension(currentState);
  return data;
}
function nextCampaignId(state){
  var current=String(state&&state.ads&&state.ads.campaign_id||"");
  return current||("campaign-"+Date.now().toString(36));
}
function fillAds(state){
  var ads=state&&state.ads||{};
  el("adsEnabled").checked=ads.enabled===true;
  el("advertiser").value=ads.advertiser||"";
  el("headline").value=ads.headline||"";
  el("adBody").value=ads.body||"";
  el("ctaLabel").value=ads.cta&&ads.cta.label||"";
  el("ctaUrl").value=ads.cta&&ads.cta.url||"";
  el("disclaimer").value=ads.disclaimer||"";
  el("cardMode").value=ads.card&&ads.card.mode==="banner"?"banner":"text";
  el("interstitialMode").value=ads.interstitial&&["image","video"].indexOf(ads.interstitial.mode)>=0?ads.interstitial.mode:"text";
  el("networkFallback").checked=ads.network&&ads.network.adsonbread===true;
  el("placeCard").checked=ads.placements?ads.placements.card===true:true;
  el("placeInterstitial").checked=ads.placements?ads.placements.interstitial===true:false;
  el("houseHeadline").value=ads.house&&ads.house.headline||"Space iklan tersedia";
  el("houseBody").value=ads.house&&ads.house.body||"";
  el("houseCtaLabel").value=ads.house&&ads.house.cta&&ads.house.cta.label||"Pasang iklan? Hubungi";
  el("houseCtaUrl").value=ads.house&&ads.house.cta&&ads.house.cta.url||"https://t.me/bukabmp?direct";
  el("startsAt").value=isoLocal(ads.starts_at);
  el("endsAt").value=isoLocal(ads.ends_at);
  el("scheduleMode").value=ads.starts_at||ads.ends_at?"scheduled":"now";
  el("campaignId").value=nextCampaignId(state);
  el("revision").value=String(Number(ads.revision||0)+1);
  cardAsset=ads.card&&ads.card.asset||null;
  interstitialAsset=ads.interstitial&&ads.interstitial.asset||null;
  posterAsset=ads.interstitial&&ads.interstitial.poster_asset||null;
  updateUploadVisibility();
  renderAdPreview();
}
function buildAdsState(){
  var state=baseState();
  var schedule=el("scheduleMode").value;
  var enabled=el("adsEnabled").checked;
  var advertiser=el("advertiser").value.trim();
  var headline=el("headline").value.trim();
  var body=el("adBody").value.trim();
  var cardMode=el("cardMode").value;
  var interstitialMode=el("interstitialMode").value;
  var cardPlaced=el("placeCard").checked;
  var interstitialPlaced=el("placeInterstitial").checked;
  if(enabled&&cardPlaced&&cardMode==="banner"&&!cardAsset)throw new Error("Upload banner sebelum publish.");
  if(enabled&&interstitialPlaced&&interstitialMode!=="text"&&!interstitialAsset)throw new Error("Upload media interstitial sebelum publish.");
  if(enabled&&!headline&&!body){
    var hasMedia=(cardPlaced&&cardMode==="banner"&&cardAsset)||(interstitialPlaced&&interstitialMode!=="text"&&interstitialAsset);
    if(hasMedia&&advertiser)headline=advertiser;
    else throw new Error("Isi Headline/Body. Untuk media-only, isi Advertiser agar client lama tetap punya fallback teks.");
  }
  var ctaLabel=el("ctaLabel").value.trim(),ctaUrl=el("ctaUrl").value.trim();
  if((ctaLabel&&!ctaUrl)||(!ctaLabel&&ctaUrl))throw new Error("CTA label dan CTA URL harus diisi berpasangan.");
  var starts=schedule==="scheduled"?toIso(el("startsAt").value):null;
  var ends=schedule==="scheduled"?toIso(el("endsAt").value):null;
  if(schedule==="scheduled"&&!starts&&!ends)throw new Error("Scheduled butuh Starts at atau Ends at.");
  if(starts&&ends&&Date.parse(ends)<=Date.parse(starts))throw new Error("Ends at harus setelah Starts at.");
  state.ads={
    enabled:enabled,
    campaign_id:el("campaignId").value||nextCampaignId(currentState),
    revision:Number(el("revision").value||1),
    creative_version:2,
    sponsor_label:"Sponsor",
    advertiser:advertiser,
    headline:headline,
    body:body,
    disclaimer:el("disclaimer").value.trim(),
    cta:ctaLabel&&ctaUrl?{label:ctaLabel,url:ctaUrl}:null,
    card:{mode:cardMode,asset:cardMode==="banner"?cardAsset:null},
    network:{adsonbread:el("networkFallback").checked},
    house:{sponsor_label:"Sponsor",headline:el("houseHeadline").value.trim()||"Space iklan tersedia",body:el("houseBody").value.trim(),cta:{label:el("houseCtaLabel").value.trim()||"Pasang iklan? Hubungi",url:el("houseCtaUrl").value.trim()}},
    starts_at:starts,
    ends_at:ends,
    placements:{card:cardPlaced,interstitial:interstitialPlaced},
    interstitial:{enabled:interstitialPlaced,trigger:"job_started",mode:interstitialMode,asset:interstitialMode==="text"?null:interstitialAsset,poster_asset:interstitialMode==="video"?posterAsset:null,delay_min_ms:2000,delay_max_ms:5000}
  };
  return state;
}
function mediaUrl(asset){return asset&&asset.id?"/v1/media/"+encodeURIComponent(asset.id):""}
function renderAdPreview(reportError){
  var state;
  try{state=buildAdsState()}catch(e){
    el("adPreview").textContent="";
    if(reportError)status(el("adsStatus"),e.message,false);
    return false;
  }
  var ads=state.ads||{};
  var hasDirect=Boolean(
    ads.headline||ads.body||ads.advertiser||
    (ads.card&&ads.card.asset)||
    (ads.interstitial&&ads.interstitial.asset)
  );
  var preview=ads;
  var housePreview=false;
  if(!hasDirect){
    var house=ads.house||{};
    housePreview=true;
    preview={
      sponsor_label:house.sponsor_label||"Sponsor",
      advertiser:"",
      headline:house.headline||"Space iklan tersedia",
      body:house.body||"",
      disclaimer:"",
      cta:house.cta||null,
      card:{mode:"text",asset:null},
      interstitial:{mode:"text",asset:null,poster_asset:null}
    };
  }
  var host=el("adPreview");host.textContent="";
  var card=document.createElement("div");card.className="adCard";
  var label=document.createElement("div");label.className="label";label.textContent=(preview.sponsor_label||"Sponsor")+(preview.advertiser?" · "+preview.advertiser:"");card.appendChild(label);
  var mode=preview.card&&preview.card.mode;
  if(mode==="banner"&&preview.card.asset){
    var mh=document.createElement("div");mh.className="adMedia";
    var img=document.createElement("img");img.src=mediaUrl(preview.card.asset);img.alt="Sponsor preview";mh.appendChild(img);card.appendChild(mh);
  }
  var h=document.createElement("div");h.className="headline";h.textContent=preview.headline||"Space iklan tersedia";card.appendChild(h);
  if(preview.body){var b=document.createElement("div");b.className="bodyCopy";b.textContent=preview.body;card.appendChild(b)}
  if(preview.cta){var a=document.createElement("span");a.className="cta";a.textContent=preview.cta.label;card.appendChild(a)}
  if(preview.disclaimer){var d=document.createElement("div");d.className="disclaimer";d.textContent=preview.disclaimer;card.appendChild(d)}
  if(housePreview){
    var fallbackNote=document.createElement("div");fallbackNote.className="disclaimer";
    fallbackNote.textContent=ads.network&&ads.network.adsonbread===true
      ?"Fallback preview · AdsOnBread tidak disimulasikan di Control Center"
      :"House Ad fallback preview";
    card.appendChild(fallbackNote);
  }
  host.appendChild(card);
  if(el("placeInterstitial").checked){
    var second=card.cloneNode(true);
    var oldMedia=second.querySelector(".adMedia");if(oldMedia)oldMedia.remove();
    if(preview.interstitial&&preview.interstitial.asset){
      var im=document.createElement("div");im.className="adMedia";
      if(preview.interstitial.mode==="video"){var v=document.createElement("video");v.src=mediaUrl(preview.interstitial.asset);v.muted=true;v.autoplay=true;v.loop=false;v.playsInline=true;if(preview.interstitial.poster_asset)v.poster=mediaUrl(preview.interstitial.poster_asset);im.appendChild(v)}
      else{var ii=document.createElement("img");ii.src=mediaUrl(preview.interstitial.asset);ii.alt="Interstitial preview";im.appendChild(ii)}
      second.insertBefore(im,second.children[1]||null);
    }
    var lock=document.createElement("div");lock.className="disclaimer";lock.textContent="Interstitial · Random 2–5 seconds · LOCKED";second.appendChild(lock);host.appendChild(second);
  }
  return true;
}
function updateUploadVisibility(){
  el("cardUploadWrap").classList.toggle("hidden",el("cardMode").value!=="banner");
  el("interstitialUploadWrap").classList.toggle("hidden",el("interstitialMode").value==="text");
  el("scheduleFields").classList.toggle("hidden",el("scheduleMode").value!=="scheduled");
}
function fileToBase64(file){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(String(r.result).split(",")[1]||"")};r.onerror=reject;r.readAsDataURL(file)})}
function inspectFile(file){
  return new Promise(function(resolve,reject){
    if(file.type.indexOf("image/")===0){
      var img=new Image(),url=URL.createObjectURL(file);
      img.onload=function(){URL.revokeObjectURL(url);resolve({width:img.naturalWidth,height:img.naturalHeight,duration_ms:0})};
      img.onerror=function(){URL.revokeObjectURL(url);reject(new Error("Image metadata tidak terbaca."))};img.src=url;return;
    }
    var video=document.createElement("video"),u=URL.createObjectURL(file);video.preload="metadata";
    video.onloadedmetadata=function(){var meta={width:video.videoWidth,height:video.videoHeight,duration_ms:Math.round(video.duration*1000)};URL.revokeObjectURL(u);resolve(meta)};
    video.onerror=function(){URL.revokeObjectURL(u);reject(new Error("Video metadata tidak terbaca."))};video.src=u;
  });
}
async function uploadFile(file){
  var allowed=["image/jpeg","image/png","image/webp","video/mp4","video/webm"];
  if(allowed.indexOf(file.type)<0)throw new Error("Format media tidak didukung.");
  var isVideo=file.type.indexOf("video/")===0;
  if(file.size>(isVideo?10:3)*1024*1024)throw new Error("Ukuran media melewati batas.");
  var meta=await inspectFile(file);
  if(isVideo&&meta.duration_ms>15000)throw new Error("Video maksimal 15 detik.");
  var data=await api("/control/api/media",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({mime:file.type,data_base64:await fileToBase64(file),width:meta.width,height:meta.height,duration_ms:meta.duration_ms})});
  return data.asset;
}
async function posterFromVideo(file){
  var video=document.createElement("video"),url=URL.createObjectURL(file);video.muted=true;video.playsInline=true;video.preload="auto";
  return await new Promise(function(resolve){
    var finish=function(value){URL.revokeObjectURL(url);resolve(value)};
    video.onloadeddata=function(){try{video.currentTime=Math.min(.2,Math.max(0,(video.duration||1)/4))}catch(e){}};
    video.onseeked=function(){try{var c=document.createElement("canvas");c.width=video.videoWidth||540;c.height=video.videoHeight||540;c.getContext("2d").drawImage(video,0,0,c.width,c.height);c.toBlob(function(blob){if(!blob)return finish(null);finish(new File([blob],"poster.png",{type:"image/png"}))},"image/png")}catch(e){finish(null)}};
    video.onerror=function(){finish(null)};video.src=url;
  });
}
function demoImage(width,height,name){
  return new Promise(function(resolve){
    var c=document.createElement("canvas");c.width=width;c.height=height;var x=c.getContext("2d");
    x.fillStyle="#f1f1ed";x.fillRect(0,0,width,height);x.fillStyle="#fff";x.strokeStyle="#1b1b1b";x.lineWidth=Math.max(3,width/300);var m=width*.08;x.fillRect(m,height*.12,width-m*2,height*.76);x.strokeRect(m,height*.12,width-m*2,height*.76);
    x.textAlign="center";x.fillStyle="#171717";x.font="700 "+Math.round(width*.05)+"px system-ui";x.fillText("DEMO SPONSOR",width/2,height*.43);x.font="600 "+Math.round(width*.04)+"px system-ui";x.fillText("BMP Terbuka",width/2,height*.54);x.font="400 "+Math.round(width*.026)+"px system-ui";x.fillText("Materi iklan contoh",width/2,height*.64);
    c.toBlob(function(blob){resolve(new File([blob],name,{type:"image/webp"}))},"image/webp",.86);
  });
}
async function demoVideo(){
  var c=document.createElement("canvas");c.width=540;c.height=540;var x=c.getContext("2d");var stream=c.captureStream?c.captureStream(12):null;
  if(!stream||typeof MediaRecorder==="undefined")return null;
  var mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp8")?"video/webm;codecs=vp8":"video/webm";
  var rec=new MediaRecorder(stream,{mimeType:mime});var chunks=[];rec.ondataavailable=function(e){if(e.data.size)chunks.push(e.data)};
  var done=new Promise(function(resolve){rec.onstop=function(){resolve(new File(chunks,"demo-interstitial-video-1x1.webm",{type:"video/webm"}))}});
  rec.start();var start=performance.now();
  await new Promise(function(resolve){
    function frame(now){var t=(now-start)/1000;x.fillStyle="#f1f1ed";x.fillRect(0,0,540,540);x.fillStyle="#fff";x.fillRect(45,65,450,410);x.fillStyle="#171717";x.textAlign="center";x.font="700 30px system-ui";x.fillText("DEMO SPONSOR",270,220);x.font="600 25px system-ui";x.fillText("BMP Terbuka",270,270);x.font="400 17px system-ui";x.fillText("Materi iklan contoh",270,315);x.fillRect(45,450,Math.min(450,450*t/5),4);if(t<5)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame);
  });
  rec.stop();return await done;
}
async function loadDemo(){
  status(el("adsStatus"),"Membuat dan upload demo creative…",null);
  var banner=await demoImage(1200,675,"demo-banner-16x9.webp");
  var square=await demoImage(1080,1080,"demo-interstitial-1x1.webp");
  cardAsset=await uploadFile(banner);
  interstitialAsset=await uploadFile(square);
  el("cardMode").value="banner";el("interstitialMode").value="image";el("placeCard").checked=true;el("placeInterstitial").checked=true;el("adsEnabled").checked=true;el("advertiser").value="BMP Terbuka";el("headline").value="DEMO SPONSOR";el("adBody").value="Materi iklan contoh";el("disclaimer").value="Demo creative · bukan pengiklan nyata";
  el("cardMeta").textContent=banner.name+" · "+number(banner.size)+" bytes";el("interstitialMeta").textContent=square.name+" · "+number(square.size)+" bytes";
  var video=await demoVideo().catch(function(){return null});
  if(video){
    var vAsset=await uploadFile(video);if(vAsset){interstitialAsset=vAsset;el("interstitialMode").value="video";el("interstitialMeta").textContent=video.name+" · 5s demo";}
    var poster=await posterFromVideo(video).catch(function(){return null});if(poster)posterAsset=await uploadFile(poster).catch(function(){return null});
  }
  updateUploadVisibility();renderAdPreview();status(el("adsStatus"),"Demo creative loaded. Preview dulu sebelum publish.",true);
}
function fillExtension(state){
  var badge=state&&state.status_badge||{};
  el("badgeOn").checked=badge.visible===true;el("badgeKind").value=badge.kind||"info";el("badgeText").value=badge.text||"";
  el("rawStateEditor").value=JSON.stringify(state||{schema_version:1},null,2);renderExtensionPreview();
}
function buildExtensionState(){
  var state;
  try{state=JSON.parse(el("rawStateEditor").value||"{}")}catch(e){state=baseState()}
  state.schema_version=1;
  state.status_badge={visible:el("badgeOn").checked,kind:el("badgeKind").value,text:el("badgeText").value.trim()};
  return state;
}
function renderExtensionPreview(){var s=buildExtensionState(),p=el("extensionPreview");p.textContent="";var b=document.createElement("div");b.className="adCard";b.innerHTML="<div class='label'>Status badge</div><div class='headline'></div>";b.querySelector(".headline").textContent=s.status_badge.visible?(s.status_badge.text||"—"):"OFF";var d=document.createElement("div");d.className="disclaimer";d.textContent="Type: "+s.status_badge.kind;p.appendChild(b)}
async function publishState(target,state,reason){
  return await api("/control/api/state?distribution_channel="+encodeURIComponent(target),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({state:state,reason:reason})});
}
async function loadAnalytics(period,channel){
  var query="?period="+encodeURIComponent(period)+"&channel="+encodeURIComponent(channel||"");
  var data=await api("/control/api/analytics"+query);analyticsData=data;
  var community=await api("/control/api/community");
  el("kSubscribers").textContent=community.subscribers==null?"—":number(community.subscribers);
  el("kMembers").textContent=community.members==null?"—":number(community.members);
  el("kTotal").textContent=data.available?number(data.total_users):"—";
  el("kActive").textContent=data.available?number(data.active_users):"—";
  el("kOpens").textContent=data.available?number(data.opens):"—";
  el("kJobs").textContent=data.available?number(data.jobs):"—";
  el("kReturning").textContent=data.available?pct(data.returning_percent):"—";
  el("kHealth").textContent=data.available?pct(data.health_percent):"—";
  el("kReach").textContent=data.available?number(data.ad_reach):"—";
  el("kImpressions").textContent=data.available?number(data.impressions):"—";
  el("kCtr").textContent=data.available?pct(data.ctr_percent):"—";
  el("aSuccess").textContent=data.available?pct(data.health_percent):"—";
  el("aFailed").textContent=data.available?number(data.job_failed):"—";
  el("aMediaFailed").textContent=data.available?number(data.media_render_failed):"—";
  el("aClicks").textContent=data.available?number(data.clicks):"—";
  el("analyticsRaw").textContent=JSON.stringify(data,null,2);
  drawCharts(data.series||[]);
  return data;
}
function drawChart(canvas,series,keys){
  var dpr=window.devicePixelRatio||1,w=canvas.clientWidth||500,h=canvas.clientHeight||180;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);var c=canvas.getContext("2d");c.scale(dpr,dpr);c.clearRect(0,0,w,h);c.strokeStyle="#d8d8d2";c.lineWidth=1;c.beginPath();c.moveTo(30,h-24);c.lineTo(w-10,h-24);c.stroke();
  var byDate={};series.forEach(function(r){if(keys.indexOf(r.metric)<0)return;(byDate[r.date]||(byDate[r.date]={}))[r.metric]=Number(r.value||0)});var dates=Object.keys(byDate).sort();if(!dates.length){c.fillStyle="#888";c.font="11px system-ui";c.fillText("No data yet",38,45);return}
  var max=1;dates.forEach(function(d){keys.forEach(function(k){max=Math.max(max,byDate[d][k]||0)})});var patterns=[[0],[5,3],[2,3]];keys.forEach(function(k,ki){c.setLineDash(patterns[ki%patterns.length]);c.strokeStyle="#222";c.lineWidth=1.5;c.beginPath();dates.forEach(function(d,i){var x=30+(dates.length===1?0:(w-45)*i/(dates.length-1));var y=h-24-(h-42)*(byDate[d][k]||0)/max;if(i===0)c.moveTo(x,y);else c.lineTo(x,y)});c.stroke()});c.setLineDash([]);
  c.fillStyle="#777";c.font="9px system-ui";keys.forEach(function(k,i){c.fillText(k,38+i*105,15)});
}
function drawCharts(series){drawChart(el("chartEngagement"),series,["extension_open","job_started","job_completed"]);drawChart(el("chartAds"),series,["ad_impression","ad_click"])}
function uniqueValue(values){
  var clean=values.filter(function(v){return typeof v==="string"&&v.trim()}).map(function(v){return v.trim()});
  var uniq=Array.from(new Set(clean));return uniq.length===1?uniq[0]:"";
}
function fallbackPolicyFromEffective(effective){
  var keys=Object.keys(effective||{}), rows=keys.map(function(k){return effective[k]||{}});
  var readyRows=rows.filter(function(p){return p.store_ready===true});
  return {
    latest_version:uniqueValue(rows.map(function(p){return p.latest_version||""})),
    minimum_global:uniqueValue(readyRows.map(function(p){return p.minimum_version||""})),
    release_url:uniqueValue(rows.map(function(p){return p.release_url||""})),
    message:uniqueValue(rows.map(function(p){return p.message||""})),
    readiness:{
      github:Boolean(effective&&effective.github&&effective.github.store_ready),
      android:Boolean(effective&&effective.android&&effective.android.store_ready),
      edge:Boolean(effective&&effective.edge&&effective.edge.store_ready),
      cws:Boolean(effective&&effective.cws&&effective.cws.store_ready)
    }
  };
}
async function loadVersion(){
  var data=await api("/control/api/version-policy");
  var hasOverride=Boolean(data.policy);
  var p=hasOverride?data.policy:fallbackPolicyFromEffective(data.effective||{});
  el("latestVersion").value=p.latest_version||"";el("minimumGlobal").value=p.minimum_global||"";el("releaseUrl").value=p.release_url||"";el("versionMessage").value=p.message||"";
  var r=p.readiness||{};el("readyGithub").checked=r.github===true;el("readyAndroid").checked=r.android===true;el("readyEdge").checked=r.edge===true;el("readyCws").checked=r.cws===true;
  renderEffective(data.effective||{});
  status(el("versionStatus"),hasOverride?"Global version policy loaded.":"Belum ada global override. Form menampilkan policy live saat ini; Save baru membuat override.",true);
  return data;
}
function renderEffective(effective){var host=el("effectiveVersion");host.textContent="";Object.keys(effective).forEach(function(k){var p=effective[k],row=document.createElement("div");row.className="readyRow";var text=document.createElement("span");text.textContent=k+" · latest "+(p.latest_version||"—")+" · minimum "+(p.minimum_version||"not enforced");var badge=document.createElement("span");badge.className="badge "+(p.store_ready?"ready":"wait");badge.textContent=p.store_ready?"Ready":"Waiting";row.appendChild(text);row.appendChild(badge);host.appendChild(row)})}
async function saveVersion(){
  var body={latest_version:el("latestVersion").value.trim(),minimum_global:el("minimumGlobal").value.trim(),release_url:el("releaseUrl").value.trim(),message:el("versionMessage").value.trim(),readiness:{github:el("readyGithub").checked,android:el("readyAndroid").checked,edge:el("readyEdge").checked,cws:el("readyCws").checked}};
  if(!body.latest_version||!body.minimum_global)throw new Error("Latest dan minimum wajib diisi sebelum Save.");
  var ready=Object.keys(body.readiness).filter(function(k){return body.readiness[k]});
  var summary="Simpan policy versi?\nLatest: "+body.latest_version+"\nMinimum: "+body.minimum_global+"\nReady: "+(ready.join(", ")||"tidak ada");
  if(!window.confirm(summary))throw new Error("Save dibatalkan.");
  var data=await api("/control/api/version-policy",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});renderEffective(data.effective||{});return data;
}
async function loadHistory(){
  var channel=el("historyTarget").value,data=await api("/control/api/state?distribution_channel="+encodeURIComponent(channel)),host=el("historyList");host.textContent="";
  (data.history||[]).forEach(function(item){var row=document.createElement("div");row.className="historyItem";var info=document.createElement("div");var strong=document.createElement("div");strong.textContent=item.summary||"snapshot";var small=document.createElement("small");small.textContent=new Date(item.created_at).toLocaleString()+" · "+item.reason;info.appendChild(strong);info.appendChild(small);var btn=document.createElement("button");btn.className="small";btn.textContent="Rollback";btn.onclick=async function(){if(!confirm("Rollback "+channel+" ke snapshot ini?"))return;try{await api("/control/api/rollback",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({distribution_channel:channel,history_id:item.id})});status(el("historyStatus"),"Rollback complete.",true);await loadHistory()}catch(e){status(el("historyStatus"),e.message,false)}};row.appendChild(info);row.appendChild(btn);host.appendChild(row)});
  if(!(data.history||[]).length)host.textContent="Belum ada snapshot.";
}

el("connect").onclick=async function(){
  authToken=el("token").value.trim();if(!authToken){status(el("loginStatus"),"Token diperlukan.",false);return}
  try{await api("/control/api/session");el("loginCard").classList.add("hidden");el("app").classList.remove("hidden");el("connDot").className="dot ok";el("connText").textContent="Owner session";await Promise.all([loadState("all"),loadAnalytics(overviewPeriod,""),loadVersion()]);status(el("overviewStatus"),"Live data loaded.",true)}
  catch(e){authToken="";status(el("loginStatus"),e.message,false);el("connDot").className="dot warn";el("connText").textContent="Locked"}
};
el("token").addEventListener("keydown",function(e){if(e.key==="Enter")el("connect").click()});
all(".nav button").forEach(function(btn){btn.onclick=function(){all(".nav button").forEach(function(x){x.classList.remove("active")});btn.classList.add("active");all("[data-panel]").forEach(function(p){p.classList.toggle("hidden",p.getAttribute("data-panel")!==btn.getAttribute("data-tab"))})}});
all("#periodOverview button").forEach(function(btn){btn.onclick=async function(){all("#periodOverview button").forEach(function(x){x.classList.remove("active")});btn.classList.add("active");overviewPeriod=btn.dataset.period;try{await loadAnalytics(overviewPeriod,"");status(el("overviewStatus"),"Updated.",true)}catch(e){status(el("overviewStatus"),e.message,false)}}});
all("#periodAnalytics button").forEach(function(btn){btn.onclick=function(){all("#periodAnalytics button").forEach(function(x){x.classList.remove("active")});btn.classList.add("active");analyticsPeriod=btn.dataset.period}});
el("refreshAnalytics").onclick=async function(){try{await loadAnalytics(analyticsPeriod,el("analyticsChannel").value);status(el("analyticsStatus"),"Updated.",true)}catch(e){status(el("analyticsStatus"),e.message,false)}};
["cardMode","interstitialMode","scheduleMode"].forEach(function(id){el(id).onchange=function(){updateUploadVisibility();renderAdPreview()}});
["advertiser","headline","adBody","ctaLabel","ctaUrl","disclaimer","placeCard","placeInterstitial","networkFallback","adsEnabled","houseHeadline","houseBody","houseCtaLabel","houseCtaUrl"].forEach(function(id){el(id).addEventListener("input",renderAdPreview);el(id).addEventListener("change",renderAdPreview)});
el("cardFile").onchange=async function(){var f=this.files[0];if(!f)return;try{cardAsset=await uploadFile(f);el("cardMeta").textContent=f.name+" · "+number(f.size)+" bytes";renderAdPreview();status(el("adsStatus"),"Banner uploaded.",true)}catch(e){status(el("adsStatus"),e.message,false)}};
el("interstitialFile").onchange=async function(){var f=this.files[0];if(!f)return;try{interstitialAsset=await uploadFile(f);posterAsset=null;if(f.type.indexOf("video/")===0){var poster=await posterFromVideo(f);if(poster)posterAsset=await uploadFile(poster)}el("interstitialMeta").textContent=f.name+" · "+number(f.size)+" bytes";renderAdPreview();status(el("adsStatus"),"Interstitial media uploaded.",true)}catch(e){status(el("adsStatus"),e.message,false)}};
el("loadDemo").onclick=function(){loadDemo().catch(function(e){status(el("adsStatus"),e.message,false)})};
el("previewAds").onclick=function(){if(renderAdPreview(true))status(el("adsStatus"),"Preview updated. Belum ada yang dipublish.",true)};
el("adsTarget").onchange=function(){loadState(this.value).then(function(){status(el("adsStatus"),"State loaded.",true)}).catch(function(e){status(el("adsStatus"),e.message,false)})};
el("publishAds").onclick=async function(){try{var target=targetValue("adsTarget"),data=await publishState(target,buildAdsState(),"ads_publish");if(target==="all"){loadedStates=data.states||{};currentState=loadedStates.github}else{currentState=data.state;loadedStates[target]=data.state}fillAds(currentState);status(el("adsStatus"),"Published to "+target+".",true)}catch(e){status(el("adsStatus"),e.message,false)}};
el("pauseAds").onclick=async function(){var target=targetValue("adsTarget");if(target==="all"){status(el("adsStatus"),"Pause darurat harus per channel supaya eksplisit.",false);return}try{var data=await api("/control/api/pause-ads",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({distribution_channel:target})});currentState=data.state;fillAds(currentState);status(el("adsStatus"),"Campaign OFF. House Ad tetap tersedia.",true)}catch(e){status(el("adsStatus"),e.message,false)}};

["badgeOn","badgeKind","badgeText"].forEach(function(id){el(id).addEventListener("input",renderExtensionPreview);el(id).addEventListener("change",renderExtensionPreview)});
el("extensionTarget").onchange=function(){loadState(this.value).then(function(){status(el("extensionStatus"),"State loaded.",true)}).catch(function(e){status(el("extensionStatus"),e.message,false)})};
el("previewExtension").onclick=renderExtensionPreview;
el("publishExtension").onclick=async function(){try{var target=targetValue("extensionTarget"),data=await publishState(target,buildExtensionState(),"extension_surface_publish");if(target==="all"){loadedStates=data.states||{};currentState=loadedStates.github}else{currentState=data.state;loadedStates[target]=data.state}fillExtension(currentState);status(el("extensionStatus"),"Published to "+target+".",true)}catch(e){status(el("extensionStatus"),e.message,false)}};

el("reloadVersion").onclick=function(){loadVersion().then(function(){status(el("versionStatus"),"Reloaded.",true)}).catch(function(e){status(el("versionStatus"),e.message,false)})};
el("saveVersion").onclick=function(){saveVersion().then(function(){status(el("versionStatus"),"Version policy saved. Readiness safety applied.",true)}).catch(function(e){status(el("versionStatus"),e.message,false)})};
el("refreshHistory").onclick=function(){loadHistory().catch(function(e){status(el("historyStatus"),e.message,false)})};
el("historyTarget").onchange=function(){loadHistory().catch(function(e){status(el("historyStatus"),e.message,false)})};
})();
</script>
</body>
</html>`, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' blob:; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
    }
  });
}
