export function controlCenterPage() {
  return new Response(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BMP Terbuka Control Center</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#161616;background:#f4f4f1}
*{box-sizing:border-box}
body{margin:0;min-height:100vh}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
.shell{max-width:1180px;margin:0 auto;padding:24px}
.top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:20px}
.brand h1{font-size:24px;margin:0 0 4px}.brand p{margin:0;color:#666;font-size:13px}
.pill{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid #d7d7d2;border-radius:999px;background:#fff;font-size:12px;font-weight:700}
.dot{width:8px;height:8px;border-radius:50%;background:#aaa}.dot.ok{background:#16863a}.dot.warn{background:#c47b08}
.grid{display:grid;grid-template-columns:240px minmax(0,1fr);gap:18px}
.nav,.card{background:#fff;border:1px solid #dddcd6;border-radius:14px;box-shadow:0 4px 18px rgba(0,0,0,.035)}
.nav{padding:12px;height:max-content;position:sticky;top:16px}
.nav button{width:100%;border:0;background:transparent;text-align:left;padding:10px 11px;border-radius:9px;font-size:13px}
.nav button.active{background:#111;color:#fff}.nav button:hover:not(.active){background:#f3f3ef}
.content{display:grid;gap:16px}
.card{padding:18px}.card h2{font-size:16px;margin:0 0 5px}.sub{font-size:12px;color:#70706b;margin:0 0 16px;line-height:1.5}
.row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
label{display:grid;gap:6px;font-size:11px;font-weight:750;color:#51514d;text-transform:uppercase;letter-spacing:.045em}
input,select,textarea{width:100%;border:1px solid #d8d8d2;background:#fff;border-radius:9px;padding:9px 10px;color:#171717;outline:none;text-transform:none;letter-spacing:normal;font-weight:500}
textarea{min-height:90px;resize:vertical;line-height:1.45}
input:focus,select:focus,textarea:focus{border-color:#777;box-shadow:0 0 0 3px rgba(0,0,0,.045)}
.check{display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:normal;font-size:12px;font-weight:650}.check input{width:16px}
.sep{height:1px;background:#ecece8;margin:17px 0}
.actions{display:flex;flex-wrap:wrap;gap:8px}.primary,.secondary,.danger{border-radius:9px;padding:9px 12px;font-size:12px;font-weight:750}
.primary{border:1px solid #111;background:#111;color:#fff}.secondary{border:1px solid #d2d2cd;background:#fff;color:#222}.danger{border:1px solid #d6a6a6;background:#fff5f5;color:#9c2222}
.status{font-size:12px;min-height:18px;margin-top:10px}.status.ok{color:#18733a}.status.err{color:#a62323}
.login{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;max-width:600px}
.hidden{display:none!important}
.preview{background:#fafaf7;border:1px solid #e0e0da;border-radius:12px;padding:14px;display:grid;gap:9px}
.mock{width:min(100%,360px);background:#fff;border:1px solid #dadad4;border-radius:12px;padding:12px;box-shadow:0 8px 26px rgba(0,0,0,.06)}
.badge{display:none;width:max-content;max-width:100%;font-size:11px;font-weight:700;padding:6px 8px;border-radius:999px;background:#eaf6ec;color:#1d7132}.badge.show{display:block}
.sponsor{border:1px dashed #cfcfc8;border-radius:9px;padding:9px;margin-top:8px}.meta{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#777}.headline{font-size:12px;font-weight:800;margin-top:4px}.bodycopy{font-size:11px;color:#555;line-height:1.45;margin-top:4px;white-space:pre-wrap}.cta{display:inline-block;margin-top:7px;font-size:10px;text-decoration:underline;color:#333}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.kpi{border:1px solid #e2e2dd;border-radius:10px;padding:11px}.kpi b{display:block;font-size:16px}.kpi span{font-size:10px;color:#777}
.history{display:grid;gap:8px}.historyItem{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #e4e4df;border-radius:9px;padding:9px 10px}.historyItem small{color:#777}.historyItem button{border:1px solid #d4d4ce;background:#fff;border-radius:7px;padding:6px 8px;font-size:10px}
.code{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;background:#111;color:#eee;border-radius:10px;padding:12px;white-space:pre-wrap;max-height:360px;overflow:auto}
.help{font-size:11px;color:#666;line-height:1.55}
@media(max-width:820px){.grid{grid-template-columns:1fr}.nav{position:static;display:flex;overflow:auto}.nav button{white-space:nowrap;width:auto}.row,.row3,.kpis{grid-template-columns:1fr 1fr}.shell{padding:14px}}
@media(max-width:520px){.row,.row3,.kpis{grid-template-columns:1fr}.top{display:block}.top .pill{margin-top:10px}}
</style>
</head>
<body>
<div class="shell">
  <div class="top">
    <div class="brand">
      <h1>BMP Terbuka Control Center</h1>
      <p>Private operator console · realtime extension surface + sponsor campaign</p>
    </div>
    <div class="pill"><span id="connDot" class="dot"></span><span id="connText">Locked</span></div>
  </div>

  <div id="loginCard" class="card" style="margin-bottom:16px">
    <h2>Owner authentication</h2>
    <p class="sub">Masukkan ADMIN_SETUP_TOKEN. Token hanya disimpan di memory tab ini dan tidak ditanam di halaman.</p>
    <div class="login">
      <input id="token" type="password" autocomplete="off" placeholder="ADMIN_SETUP_TOKEN">
      <button id="connect" class="primary">Connect</button>
    </div>
    <div id="loginStatus" class="status"></div>
  </div>

  <div id="app" class="grid hidden">
    <div class="nav">
      <button data-tab="overview" class="active">Overview</button>
      <button data-tab="surface">Extension Surface</button>
      <button data-tab="ads">Ads Manager</button>
      <button data-tab="history">History / Rollback</button>
      <button data-tab="raw">Raw State</button>
    </div>

    <main class="content">
      <section data-panel="overview" class="card">
        <h2>Overview</h2>
        <p class="sub">Live state per distribution channel. Store version policy is read-only here.</p>
        <div class="row">
          <label>Distribution channel
            <select id="channel">
              <option value="github">GitHub / manual</option>
              <option value="android">Android</option>
              <option value="cws">Chrome Web Store</option>
              <option value="edge" selected>Microsoft Edge Add-ons</option>
            </select>
          </label>
          <label>Actions
            <div class="actions">
              <button id="reload" class="secondary">Refresh live</button>
              <button id="publishTop" class="primary">Publish state</button>
            </div>
          </label>
        </div>
        <div class="sep"></div>
        <div class="kpis">
          <div class="kpi"><b id="kWorker">—</b><span>Worker</span></div>
          <div class="kpi"><b id="kLatest">—</b><span>Latest version</span></div>
          <div class="kpi"><b id="kMinimum">—</b><span>Minimum</span></div>
          <div class="kpi"><b id="kStore">—</b><span>Store ready</span></div>
        </div>
        <div class="sep"></div>
        <div class="preview">
          <strong style="font-size:12px">Popup surface preview</strong>
          <div class="mock">
            <div id="previewBadge" class="badge"></div>
            <div id="previewSponsor" class="sponsor">
              <div id="previewSponsorMeta" class="meta">Sponsor</div>
              <div id="previewSponsorHeadline" class="headline">Space iklan tersedia</div>
              <div id="previewSponsorBody" class="bodycopy"></div>
              <div id="previewSponsorCta" class="cta">Pasang iklan? Hubungi</div>
            </div>
          </div>
        </div>
        <div id="globalStatus" class="status"></div>
      </section>

      <section data-panel="surface" class="card hidden">
        <h2>Extension Surface</h2>
        <p class="sub">Status badge dan cloud sections berubah realtime tanpa release extension. Semua input disanitize lagi oleh Worker saat publish.</p>
        <div class="row3">
          <label class="check"><input id="badgeVisible" type="checkbox"> Show status badge</label>
          <label>Badge kind
            <select id="badgeKind">
              <option>info</option><option>success</option><option>warning</option><option>community</option><option>supporter</option>
            </select>
          </label>
          <label>Badge text<input id="badgeText" maxlength="160" placeholder="Contoh: Maintenance selesai"></label>
        </div>
        <div class="sep"></div>
        <div class="row">
          <label class="check"><input id="featureSupporter" type="checkbox"> Supporter card feature</label>
          <label class="check"><input id="featureCommunity" type="checkbox"> Community banner feature</label>
        </div>
        <div class="sep"></div>
        <label>Cloud sections JSON
          <textarea id="sectionsJson" spellcheck="false" placeholder='[{"id":"notice","visible":true,"kind":"info","title":"Info","text":"...","action":null}]'></textarea>
        </label>
        <p class="help">Allowed renderer tetap plain text + allowlisted action. HTML/JS dari backend tidak pernah dieksekusi.</p>
        <div class="actions">
          <button class="primary publish">Publish surface</button>
          <button class="secondary validate">Validate only</button>
        </div>
        <div class="status panelStatus"></div>
      </section>

      <section data-panel="ads" class="card hidden">
        <h2>Ads Manager</h2>
        <p class="sub">Paid campaign, house inventory, placement, schedule, dan interstitial delay dikontrol realtime.</p>
        <div class="row3">
          <label class="check"><input id="adsEnabled" type="checkbox"> Paid campaign enabled</label>
          <label>Campaign ID<input id="campaignId" maxlength="64" placeholder="campaign-2026-09"></label>
          <label>Revision<input id="revision" type="number" min="0" step="1" value="0"></label>
        </div>
        <div class="row3" style="margin-top:12px">
          <label>Sponsor label<input id="sponsorLabel" maxlength="32" value="Sponsor"></label>
          <label>Advertiser<input id="advertiser" maxlength="96" placeholder="Nama sponsor"></label>
          <label>Headline<input id="headline" maxlength="120" placeholder="Headline campaign"></label>
        </div>
        <div style="margin-top:12px">
          <label>Body<textarea id="adBody" maxlength="700"></textarea></label>
        </div>
        <div class="row" style="margin-top:12px">
          <label>Disclaimer<input id="disclaimer" maxlength="220" placeholder="Konten berbayar / disclaimer"></label>
          <label>CTA label<input id="ctaLabel" maxlength="48" placeholder="Lihat selengkapnya"></label>
        </div>
        <div style="margin-top:12px"><label>CTA HTTPS URL<input id="ctaUrl" type="url" placeholder="https://..."></label></div>
        <div class="row" style="margin-top:12px">
          <label>Starts at<input id="startsAt" type="datetime-local"></label>
          <label>Ends at<input id="endsAt" type="datetime-local"></label>
        </div>
        <div class="sep"></div>
        <div class="row3">
          <label class="check"><input id="placeCard" type="checkbox"> Popup card</label>
          <label class="check"><input id="placeInterstitial" type="checkbox"> Interstitial</label>
          <label class="check"><input id="interstitialEnabled" type="checkbox"> Interstitial enabled</label>
        </div>
        <div class="row" style="margin-top:12px">
          <label>Delay minimum (ms)<input id="delayMin" type="number" min="2000" max="5000" value="2000"></label>
          <label>Delay maximum (ms)<input id="delayMax" type="number" min="2000" max="5000" value="5000"></label>
        </div>
        <div class="sep"></div>
        <h2 style="font-size:13px">House inventory</h2>
        <p class="sub">Fallback wajib saat paid campaign tidak aktif / backend state gagal.</p>
        <div class="row3">
          <label>Label<input id="houseLabel" maxlength="32" value="Sponsor"></label>
          <label>Headline<input id="houseHeadline" maxlength="120" value="Space iklan tersedia"></label>
          <label>CTA label<input id="houseCtaLabel" maxlength="48" value="Pasang iklan? Hubungi"></label>
        </div>
        <div class="row" style="margin-top:12px">
          <label>Body<textarea id="houseBody" maxlength="420"></textarea></label>
          <label>CTA HTTPS URL<input id="houseCtaUrl" type="url" value="https://t.me/bukabmp?direct"></label>
        </div>
        <div class="sep"></div>
        <div class="actions">
          <button class="primary publish">Publish campaign</button>
          <button class="secondary validate">Validate only</button>
          <button id="pauseAds" class="danger">Emergency pause paid ads</button>
        </div>
        <div class="status panelStatus"></div>
      </section>

      <section data-panel="history" class="card hidden">
        <h2>History / Rollback</h2>
        <p class="sub">Setiap publish dari Control Center membuat snapshot sebelum state baru ditulis. Maksimal 20 entri per channel.</p>
        <div id="historyList" class="history"></div>
        <div class="actions" style="margin-top:12px"><button id="refreshHistory" class="secondary">Refresh history</button></div>
        <div class="status panelStatus"></div>
      </section>

      <section data-panel="raw" class="card hidden">
        <h2>Sanitized live state</h2>
        <p class="sub">Ini state yang benar-benar dibaca extension setelah server-side sanitizer.</p>
        <pre id="rawState" class="code">{}</pre>
        <div class="actions" style="margin-top:12px">
          <button id="copyRaw" class="secondary">Copy JSON</button>
          <button class="secondary validate">Validate current form</button>
        </div>
        <div class="status panelStatus"></div>
      </section>
    </main>
  </div>
</div>

<script>
(function(){
  var authToken = '';
  var loadedState = null;
  var workerVersion = '';
  var historyItems = [];

  function el(id){ return document.getElementById(id); }
  function qsAll(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function channel(){ return el('channel').value; }
  function setStatus(node,msg,ok){
    node.textContent = msg || '';
    node.className = 'status ' + (msg ? (ok ? 'ok' : 'err') : '');
  }
  function authHeaders(extra){
    var out = {'Authorization':'Bearer ' + authToken};
    if(extra) Object.keys(extra).forEach(function(k){ out[k]=extra[k]; });
    return out;
  }
  async function api(path, options){
    var opts = options || {};
    opts.headers = authHeaders(opts.headers || {});
    var res = await fetch(path, opts);
    var data = await res.json().catch(function(){ return {}; });
    if(!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }
  function isoToLocal(value){
    if(!value) return '';
    var d = new Date(value);
    if(!Number.isFinite(d.getTime())) return '';
    var off = d.getTimezoneOffset();
    return new Date(d.getTime()-off*60000).toISOString().slice(0,16);
  }
  function localToIso(value){
    if(!value) return null;
    var d = new Date(value);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  function safeJson(value,fallback){
    try { return JSON.parse(value); } catch(e) { return fallback; }
  }

  function fillForm(state){
    loadedState = state || {};
    var badge = loadedState.status_badge || {};
    el('badgeVisible').checked = badge.visible === true;
    el('badgeKind').value = badge.kind || 'info';
    el('badgeText').value = badge.text || '';
    var features = loadedState.features || {};
    el('featureSupporter').checked = features.supporter_card === true;
    el('featureCommunity').checked = features.community_banner === true;
    el('sectionsJson').value = JSON.stringify(loadedState.sections || [], null, 2);

    var ads = loadedState.ads || {};
    el('adsEnabled').checked = ads.enabled === true;
    el('campaignId').value = ads.campaign_id || '';
    el('revision').value = Number(ads.revision || 0);
    el('sponsorLabel').value = ads.sponsor_label || 'Sponsor';
    el('advertiser').value = ads.advertiser || '';
    el('headline').value = ads.headline || '';
    el('adBody').value = ads.body || '';
    el('disclaimer').value = ads.disclaimer || '';
    el('ctaLabel').value = ads.cta && ads.cta.label ? ads.cta.label : '';
    el('ctaUrl').value = ads.cta && ads.cta.url ? ads.cta.url : '';
    el('startsAt').value = isoToLocal(ads.starts_at);
    el('endsAt').value = isoToLocal(ads.ends_at);
    el('placeCard').checked = !!(ads.placements && ads.placements.card);
    el('placeInterstitial').checked = !!(ads.placements && ads.placements.interstitial);
    el('interstitialEnabled').checked = !!(ads.interstitial && ads.interstitial.enabled);
    el('delayMin').value = Number(ads.interstitial && ads.interstitial.delay_min_ms || 2000);
    el('delayMax').value = Number(ads.interstitial && ads.interstitial.delay_max_ms || 5000);

    var house = ads.house || {};
    el('houseLabel').value = house.sponsor_label || 'Sponsor';
    el('houseHeadline').value = house.headline || 'Space iklan tersedia';
    el('houseBody').value = house.body || '';
    el('houseCtaLabel').value = house.cta && house.cta.label ? house.cta.label : 'Pasang iklan? Hubungi';
    el('houseCtaUrl').value = house.cta && house.cta.url ? house.cta.url : 'https://t.me/bukabmp?direct';
    renderPreview(loadedState);
    el('rawState').textContent = JSON.stringify(loadedState,null,2);
  }

  function buildState(){
    var next = JSON.parse(JSON.stringify(loadedState || {}));
    next.schema_version = 1;
    next.status_badge = {
      visible: el('badgeVisible').checked,
      kind: el('badgeKind').value,
      text: el('badgeText').value
    };
    next.features = {
      supporter_card: el('featureSupporter').checked,
      community_banner: el('featureCommunity').checked
    };
    var sections = safeJson(el('sectionsJson').value, null);
    if(!Array.isArray(sections)) throw new Error('Cloud sections JSON harus berupa array JSON.');
    next.sections = sections;
    var cta = el('ctaLabel').value.trim() && el('ctaUrl').value.trim()
      ? {label:el('ctaLabel').value.trim(),url:el('ctaUrl').value.trim()}
      : null;
    var houseCta = el('houseCtaLabel').value.trim() && el('houseCtaUrl').value.trim()
      ? {label:el('houseCtaLabel').value.trim(),url:el('houseCtaUrl').value.trim()}
      : null;
    next.ads = {
      enabled: el('adsEnabled').checked,
      campaign_id: el('campaignId').value.trim(),
      revision: Math.max(0,Number(el('revision').value || 0)),
      sponsor_label: el('sponsorLabel').value.trim(),
      advertiser: el('advertiser').value.trim(),
      headline: el('headline').value.trim(),
      body: el('adBody').value.trim(),
      disclaimer: el('disclaimer').value.trim(),
      image_url: '',
      cta: cta,
      house: {
        sponsor_label: el('houseLabel').value.trim(),
        headline: el('houseHeadline').value.trim(),
        body: el('houseBody').value.trim(),
        cta: houseCta
      },
      starts_at: localToIso(el('startsAt').value),
      ends_at: localToIso(el('endsAt').value),
      placements: {
        card: el('placeCard').checked,
        interstitial: el('placeInterstitial').checked
      },
      interstitial: {
        enabled: el('interstitialEnabled').checked,
        trigger: 'job_started',
        delay_min_ms: Number(el('delayMin').value || 2000),
        delay_max_ms: Number(el('delayMax').value || 5000)
      }
    };
    return next;
  }

  function renderPreview(state){
    var s = state || buildState();
    var b = s.status_badge || {};
    el('previewBadge').textContent = b.text || '';
    el('previewBadge').className = 'badge' + (b.visible && b.text ? ' show' : '');
    var ads = s.ads || {};
    var paid = ads.active === true && ads.placements && ads.placements.card;
    var house = ads.house || {};
    el('previewSponsorMeta').textContent = paid ? (ads.sponsor_label || 'Sponsor') : (house.sponsor_label || 'Sponsor');
    el('previewSponsorHeadline').textContent = paid ? (ads.headline || '') : (house.headline || 'Space iklan tersedia');
    el('previewSponsorBody').textContent = paid ? (ads.body || '') : (house.body || '');
    var action = paid ? ads.cta : house.cta;
    el('previewSponsorCta').textContent = action && action.label ? action.label : '';
    el('previewSponsorCta').style.display = action && action.label ? 'inline-block' : 'none';
  }

  function renderHistory(){
    var root = el('historyList');
    root.innerHTML = '';
    if(!historyItems.length){
      root.textContent = 'Belum ada snapshot Control Center untuk channel ini.';
      return;
    }
    historyItems.forEach(function(item){
      var row = document.createElement('div');
      row.className = 'historyItem';
      var copy = document.createElement('div');
      var title = document.createElement('strong');
      title.textContent = item.reason || 'publish';
      title.style.fontSize = '11px';
      var small = document.createElement('small');
      small.style.display='block';
      small.textContent = new Date(item.created_at).toLocaleString() + ' · ' + (item.summary || item.id);
      copy.appendChild(title); copy.appendChild(small);
      var btn = document.createElement('button');
      btn.textContent = 'Rollback';
      btn.addEventListener('click', async function(){
        if(!confirm('Rollback channel ' + channel() + ' ke snapshot ini? Current state akan disnapshot dulu.')) return;
        btn.disabled = true;
        try{
          var data = await api('/control/api/rollback',{
            method:'POST',
            headers:{'content-type':'application/json'},
            body:JSON.stringify({distribution_channel:channel(),history_id:item.id})
          });
          fillForm(data.state);
          historyItems = data.history || [];
          renderHistory();
          setStatus(el('globalStatus'),'Rollback published.',true);
        }catch(e){
          setStatus(el('globalStatus'),e.message,false);
        }finally{ btn.disabled=false; }
      });
      row.appendChild(copy); row.appendChild(btn); root.appendChild(row);
    });
  }

  async function loadState(){
    setStatus(el('globalStatus'),'Loading...',true);
    var data = await api('/control/api/state?distribution_channel=' + encodeURIComponent(channel()));
    workerVersion = data.worker_version || '';
    historyItems = data.history || [];
    fillForm(data.state || {});
    renderHistory();
    var vp = data.version_policy || {};
    el('kWorker').textContent = workerVersion || '—';
    el('kLatest').textContent = vp.latest_version || '—';
    el('kMinimum').textContent = vp.minimum_version || '—';
    el('kStore').textContent = vp.store_ready === true ? 'YES' : 'NO';
    setStatus(el('globalStatus'),'Live state loaded for ' + channel() + '.',true);
  }

  async function validateForm(){
    var state = buildState();
    var data = await api('/control/api/validate?distribution_channel=' + encodeURIComponent(channel()),{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(state)
    });
    renderPreview(data.state);
    el('rawState').textContent = JSON.stringify(data.state,null,2);
    return data.state;
  }

  async function publish(reason){
    var state = buildState();
    var data = await api('/control/api/state?distribution_channel=' + encodeURIComponent(channel()),{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({state:state,reason:reason || 'control_center_publish'})
    });
    loadedState = data.state;
    historyItems = data.history || [];
    fillForm(data.state);
    renderHistory();
    setStatus(el('globalStatus'),'Published to ' + channel() + '.',true);
  }

  el('connect').addEventListener('click', async function(){
    authToken = el('token').value.trim();
    if(!authToken){ setStatus(el('loginStatus'),'Token diperlukan.',false); return; }
    try{
      var s = await api('/control/api/session');
      el('app').classList.remove('hidden');
      el('loginCard').classList.add('hidden');
      el('connDot').className='dot ok';
      el('connText').textContent='Owner session';
      workerVersion = s.worker_version || '';
      await loadState();
    }catch(e){
      authToken='';
      el('connDot').className='dot warn';
      el('connText').textContent='Locked';
      setStatus(el('loginStatus'),e.message,false);
    }
  });
  el('token').addEventListener('keydown',function(e){ if(e.key==='Enter') el('connect').click(); });
  el('channel').addEventListener('change',function(){ loadState().catch(function(e){setStatus(el('globalStatus'),e.message,false);}); });
  el('reload').addEventListener('click',function(){ loadState().catch(function(e){setStatus(el('globalStatus'),e.message,false);}); });
  el('refreshHistory').addEventListener('click',function(){ loadState().catch(function(e){setStatus(el('globalStatus'),e.message,false);}); });
  el('publishTop').addEventListener('click',function(){ publish('overview_publish').catch(function(e){setStatus(el('globalStatus'),e.message,false);}); });
  qsAll('.publish').forEach(function(btn){ btn.addEventListener('click',function(){ publish('control_center_publish').catch(function(e){setStatus(btn.closest('.card').querySelector('.panelStatus'),e.message,false);}); }); });
  qsAll('.validate').forEach(function(btn){ btn.addEventListener('click',async function(){ var status=btn.closest('.card').querySelector('.panelStatus'); try{ await validateForm(); setStatus(status,'Validation PASS. Tidak ada state yang ditulis.',true); }catch(e){ setStatus(status,e.message,false); } }); });
  el('pauseAds').addEventListener('click',async function(){
    if(!confirm('Pause paid campaign untuk channel ' + channel() + '? House ad tetap aktif.')) return;
    try{
      var data=await api('/control/api/pause-ads',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({distribution_channel:channel()})
      });
      loadedState=data.state; historyItems=data.history||[]; fillForm(data.state); renderHistory();
      setStatus(el('globalStatus'),'Paid ads paused. House inventory tetap tersedia.',true);
    }catch(e){ setStatus(el('globalStatus'),e.message,false); }
  });
  el('copyRaw').addEventListener('click',async function(){ try{ await navigator.clipboard.writeText(el('rawState').textContent); }catch(e){} });
  qsAll('input,select,textarea').forEach(function(node){
    if(node.id==='token'||node.id==='channel') return;
    node.addEventListener('input',function(){ try{renderPreview(buildState());}catch(e){} });
    node.addEventListener('change',function(){ try{renderPreview(buildState());}catch(e){} });
  });
  qsAll('.nav button').forEach(function(btn){
    btn.addEventListener('click',function(){
      qsAll('.nav button').forEach(function(x){x.classList.remove('active');});
      btn.classList.add('active');
      qsAll('[data-panel]').forEach(function(p){p.classList.toggle('hidden',p.getAttribute('data-panel')!==btn.getAttribute('data-tab'));});
    });
  });
})();
</script>
</body>
</html>`, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
    }
  });
}
