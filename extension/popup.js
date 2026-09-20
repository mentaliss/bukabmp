function el(id){return document.getElementById(id)}
async function send(type, extra={}){return await chrome.runtime.sendMessage({type,...extra})}

const ACTIVATION_LONG_WAIT_MS = 90_000;
let activationChecking = false;
let latestAccess = null;
let latestVersionPolicy = null;
let latestCloudState = null;
let latestState = null;
let latestCacheInfo = {modules:[],bytes:0,totalBytes:0,detectedLastModule:null};
let latestCacheCode = "";
let cacheRefreshTimer = null;
let draftSaveTimer = null;
let lastRunning = false;
let activeFormKey = "";
let lastCompletedKey = "";

const DRAFT_KEY = "bmpDraftV105";

function normalizedCode(){return el("code").value.trim().toUpperCase()}
function validCode(value){return /^[A-Z0-9_-]{3,32}$/.test(String(value||""))}
function selectedRange(){
  const first=Number(el("startModule").value);
  const last=Number(el("maxModule").value);
  return {first,last,valid:Number.isInteger(first)&&Number.isInteger(last)&&first>=1&&last>=first&&last<=99};
}
function modulesBetween(first,last){
  const out=[];
  if(Number.isInteger(first)&&Number.isInteger(last)&&last>=first){for(let m=first;m<=last;m++)out.push(m)}
  return out;
}
function moduleLabels(modules){return modules.length?modules.map(m=>`M${m}`).join(", "):"-"}
function rangeLabel(modules){
  if(!modules.length)return "-";
  return modules.length===1?`M${modules[0]}`:`M${modules[0]}–M${modules[modules.length-1]}`;
}
function formatBytes(bytes){
  const n=Math.max(0,Number(bytes)||0);
  if(n<1024)return `${n} B`;
  if(n<1024*1024)return `${(n/1024).toFixed(n<10*1024?1:0)} KB`;
  if(n<1024*1024*1024)return `${(n/1024/1024).toFixed(n<10*1024*1024?1:0)} MB`;
  return `${(n/1024/1024/1024).toFixed(1)} GB`;
}
function setUtilityNotice(text){el("utilityNotice").textContent=text||""}

function renderCloudSurface(state){
  latestCloudState=state||null;
  const root=el("cloudSurface");
  const sponsorRoot=el("sponsorSlot");
  root.textContent="";
  sponsorRoot.textContent="";
  const sections=Array.isArray(state?.sections)?state.sections:[];
  let sponsorRendered=false;

  function appendAction(card,section,className){
    if(!section.action?.label)return;
    const button=document.createElement("button");
    button.type="button";
    button.className=className;
    button.textContent=section.action.label;
    button.addEventListener("click",async()=>{
      button.disabled=true;
      try{
        const result=await send("EXECUTE_CLOUD_ACTION",{action:section.action});
        if(!result?.ok)throw new Error(result?.error||"Aksi tidak dapat dijalankan.");
      }catch(e){
        button.textContent=String(e?.message||e).slice(0,80);
      }finally{
        setTimeout(()=>{button.disabled=false;button.textContent=section.action.label},1400);
      }
    });
    card.append(button);
  }

  for(const section of sections){
    if(section.kind==="sponsor"){
      if(sponsorRendered)continue;
      sponsorRendered=true;
      const card=document.createElement("aside");
      card.className="sponsorBanner";
      card.setAttribute("aria-label","Sponsor");

      const meta=document.createElement("div");
      meta.className="sponsorMeta";
      meta.textContent="Sponsor";
      card.append(meta);

      if(section.title){
        const title=document.createElement("div");
        title.className="sponsorTitle";
        title.textContent=section.title;
        card.append(title);
      }
      if(section.text){
        const body=document.createElement("div");
        body.className="sponsorText";
        body.textContent=section.text;
        card.append(body);
      }
      appendAction(card,section,"sponsorAction");
      sponsorRoot.append(card);
      continue;
    }

    const card=document.createElement("section");
    card.className=`cloudSection ${section.kind||"info"}`;

    if(section.title){
      const title=document.createElement("div");
      title.className="cloudTitle";
      title.textContent=section.title;
      card.append(title);
    }
    if(section.text){
      const body=document.createElement("div");
      body.className="cloudText";
      body.textContent=section.text;
      card.append(body);
    }
    appendAction(card,section,"cloudAction");
    root.append(card);
  }
}

async function refreshCloudSurface({force=false}={}){
  try{
    const r=await send("GET_CLOUD_STATE",{force});
    if(r?.ok)renderCloudSurface(r.state||null);
    else renderCloudSurface(null);
  }catch(_){
    renderCloudSurface(null);
  }
}

async function loadDraft(){
  const x=await chrome.storage.local.get(DRAFT_KEY);
  const d=x[DRAFT_KEY]||{};
  if(d.code)el("code").value=String(d.code).toUpperCase();
  if(Number.isInteger(Number(d.startModule))&&Number(d.startModule)>=1)el("startModule").value=String(Number(d.startModule));
  if(Number.isInteger(Number(d.maxModule))&&Number(d.maxModule)>=1)el("maxModule").value=String(Number(d.maxModule));
  el("redownload").checked=Boolean(d.redownload);
  el("mergePdf").checked=Boolean(d.mergeRequested);
}
async function saveDraft(){
  const range=selectedRange();
  await chrome.storage.local.set({
    [DRAFT_KEY]:{
      code:normalizedCode(),
      startModule:range.valid?range.first:1,
      maxModule:range.valid?range.last:9,
      redownload:el("redownload").checked,
      mergeRequested:el("mergePdf").checked
    }
  });
}
function scheduleDraftSave(){
  clearTimeout(draftSaveTimer);
  draftSaveTimer=setTimeout(()=>saveDraft().catch(()=>{}),180);
}
function scheduleCacheRefresh(){
  clearTimeout(cacheRefreshTimer);
  cacheRefreshTimer=setTimeout(()=>refreshCachePreview().catch(()=>{}),180);
}

function currentPlan(){
  const range=selectedRange();
  if(!range.valid)return {valid:false,selected:[],available:[],process:[],effectiveLast:null};
  const cacheMatches=latestCacheCode===normalizedCode();
  const detected=cacheMatches?latestCacheInfo.detectedLastModule:null;
  const effectiveLast=detected?Math.min(range.last,detected):range.last;
  const selected=effectiveLast>=range.first?modulesBetween(range.first,effectiveLast):[];
  const cached=new Set(cacheMatches?latestCacheInfo.modules:[]);
  const redownload=el("redownload").checked;
  const available=selected.filter(m=>cached.has(m));
  const process=redownload?selected:selected.filter(m=>!cached.has(m));
  return {valid:true,range,selected,available,process,effectiveLast,redownload,cached};
}

function checkedExportModules(){
  return [...el("exportGrid").querySelectorAll('input[type="checkbox"]:checked')]
    .map(x=>Number(x.value)).filter(Number.isInteger).sort((a,b)=>a-b);
}
function updateExportControls(){
  const checked=checkedExportModules();
  const all=latestCacheInfo.modules.length>0&&checked.length===latestCacheInfo.modules.length;
  el("selectAllExport").textContent=all?"Hapus pilihan":"Pilih semua";
  el("exportCached").disabled=Boolean(latestState?.running)||checked.length===0;
  if(!latestState?.running)el("exportCached").textContent=checked.length?`Ekspor ${checked.length} PDF`:"Ekspor yang dipilih";
}
function renderExportGrid(modules,{prefer=null}={}){
  const grid=el("exportGrid");
  const previous=new Set(checkedExportModules());
  const preferred=prefer?new Set(prefer):previous;
  grid.textContent="";
  for(const m of modules){
    const label=document.createElement("label");
    label.className="moduleChoice";
    const input=document.createElement("input");
    input.type="checkbox";
    input.value=String(m);
    input.checked=preferred.has(m);
    input.addEventListener("change",updateExportControls);
    const span=document.createElement("span");
    span.textContent=`M${m}`;
    label.append(input,span);
    grid.append(label);
  }
  updateExportControls();
}
function selectExportModules(modules){
  const wanted=new Set(modules);
  for(const input of el("exportGrid").querySelectorAll('input[type="checkbox"]')){
    input.checked=wanted.has(Number(input.value));
  }
  updateExportControls();
}

function updatePrimaryAction(){
  const button=el("start");
  const code=normalizedCode();
  const plan=currentPlan();
  const locked=Boolean(latestState?.running)||Boolean(latestVersionPolicy?.updateRequired);
  let action="process",label="Mulai",disabled=locked;
  if(!validCode(code)||!plan.valid){
    label="Mulai";
  }else if(!plan.selected.length){
    label=latestCacheInfo.detectedLastModule?`Modul tersedia sampai M${latestCacheInfo.detectedLastModule}`:"Mulai";
    disabled=true;
  }else if(plan.redownload){
    label="Download ulang modul dipilih";
  }else if(plan.process.length){
    label="Proses modul yang belum ada";
  }else if(el("mergePdf").checked){
    action="merge";
    label="Buat PDF gabungan";
  }else if(plan.available.length){
    action="export";
    label="Ekspor PDF";
  }
  button.dataset.action=action;
  button.textContent=label;
  button.disabled=disabled;
}

function setFormLocked(locked){
  for(const id of ["code","startModule","maxModule","redownload","mergePdf"]){el(id).disabled=locked}
  el("selectAllExport").disabled=locked||!latestCacheInfo.modules.length;
  el("clearCache").disabled=locked||!validCode(normalizedCode())||!latestCacheInfo.modules.length;
  updateExportControls();
  updatePrimaryAction();
}

function renderOptionHints(){
  const plan=currentPlan();
  const code=normalizedCode();
  const redHint=el("redownloadHint");
  const mergeHint=el("mergeHint");
  if(el("redownload").checked&&plan.selected.length){
    redHint.style.display="block";
    redHint.textContent=`${rangeLabel(plan.selected)} akan diproses ulang. Modul lain tidak berubah.`;
  }else{
    redHint.style.display="none";
    redHint.textContent="";
  }
  if(el("mergePdf").checked&&plan.selected.length&&validCode(code)){
    const detected=latestCacheInfo.detectedLastModule;
    const full=Boolean(detected&&plan.range.first===1&&plan.range.last>=detected);
    const filename=full
      ? `${code}_FULL_Searchable.pdf`
      : `${code}_M${plan.selected[0]}-M${plan.selected[plan.selected.length-1]}_Searchable.pdf`;
    mergeHint.style.display="block";
    mergeHint.textContent=`Hasil gabungan: ${filename}`;
  }else{
    mergeHint.style.display="none";
    mergeHint.textContent="";
  }
}

async function refreshCachePreview(){
  const code=normalizedCode();
  const range=selectedRange();
  if(!validCode(code)){
    latestCacheInfo={modules:[],bytes:0,totalBytes:0,detectedLastModule:null};
    latestCacheCode="";
    el("cacheTitle").textContent=code?"Kode BMP belum valid":"Masukkan kode BMP";
    el("cacheSummary").textContent="Data lokal BMP ini akan tampil di sini.";
    el("cacheModules").textContent="";
    el("planTitle").textContent="";
    el("planSkip").textContent="";
    el("planProcess").textContent="";
    el("storageTools").style.display="none";
    renderExportGrid([]);
    renderOptionHints();
    setFormLocked(Boolean(latestState?.running));
    return;
  }

  const r=await send("GET_CACHE_INFO",{code});
  if(!r?.ok)throw new Error(r?.error||"Penyimpanan lokal tidak dapat dibaca.");
  const modules=Array.isArray(r.modules)?r.modules.map(Number).filter(Number.isInteger).sort((a,b)=>a-b):[];
  latestCacheInfo={
    modules,bytes:Number(r.bytes||0),totalBytes:Number(r.totalBytes||0),
    detectedLastModule:Number.isInteger(Number(r.detectedLastModule))&&Number(r.detectedLastModule)>=1?Number(r.detectedLastModule):null
  };
  latestCacheCode=code;

  el("cacheTitle").textContent=code;
  const lastText=latestCacheInfo.detectedLastModule?` • modul terakhir M${latestCacheInfo.detectedLastModule}`:"";
  el("cacheSummary").textContent=modules.length
    ? `${modules.length} modul • ${formatBytes(latestCacheInfo.bytes)} tersimpan lokal${lastText}`
    : `Belum ada modul tersimpan lokal${lastText}`;
  el("cacheModules").innerHTML=modules.length
    ? `<b>Tersimpan lokal:</b> ${moduleLabels(modules)}`
    : "";

  const plan=currentPlan();
  if(range.valid&&plan.selected.length){
    el("planTitle").textContent=`Pilihan ${rangeLabel(plan.selected)}`;
    el("planSkip").innerHTML=`<b>Sudah tersedia:</b> ${moduleLabels(plan.available)}`;
    el("planProcess").innerHTML=`<b>Perlu diproses:</b> ${moduleLabels(plan.process)}`;
  }else if(range.valid&&latestCacheInfo.detectedLastModule&&range.first>latestCacheInfo.detectedLastModule){
    el("planTitle").textContent=`Pilihan M${range.first}–M${range.last}`;
    el("planSkip").innerHTML=`<b>Info:</b> BMP ini terdeteksi sampai M${latestCacheInfo.detectedLastModule}.`;
    el("planProcess").textContent="";
  }else{
    el("planTitle").textContent="";
    el("planSkip").textContent=range.valid?"":"Periksa rentang modul.";
    el("planProcess").textContent="";
  }

  el("storageTools").style.display=modules.length?"block":"none";
  el("storageMeta").textContent=modules.length
    ? `${code} memakai ${formatBytes(latestCacheInfo.bytes)} untuk menyimpan ${modules.length} PDF modul. Pilih satu atau beberapa modul untuk membuat salinan baru di Downloads tanpa OCR ulang.`
    : "";
  el("clearExplain").textContent=modules.length
    ? `Kosongkan ${formatBytes(latestCacheInfo.bytes)} data lokal ${code} jika sudah tidak diperlukan. PDF yang sudah ada di folder Downloads tidak ikut dihapus.`
    : "";
  renderExportGrid(modules);
  renderOptionHints();
  setFormLocked(Boolean(latestState?.running));
}

function formatDate(ms){
  if(!ms) return "";
  return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",year:"numeric"}).format(new Date(ms));
}
function formatElapsed(ms){
  const total=Math.max(0,Math.floor(ms/1000));
  const min=Math.floor(total/60);
  const sec=String(total%60).padStart(2,"0");
  return `${min}:${sec}`;
}
function humanStatus(s){
  const x=s.status||"IDLE";
  if(!s.running&&x==="IDLE")return["Siap","Pilih BMP dan modul yang ingin kamu proses atau ekspor."];
  if(x==="STARTING")return["Menyiapkan","Menyiapkan dokumen..."];
  if(x.startsWith("OPENING_M"))return["Membuka modul",s.progress||""];
  if(x.startsWith("DOWNLOADING_M"))return["Sedang diproses",s.progress||""];
  if(x.startsWith("OCR_FINALIZING_M"))return["Menyusun PDF","Halaman selesai. Menyusun file PDF..."];
  if(x.startsWith("M")&&x.endsWith("_PDF_READY"))return["PDF siap",s.progress||""];
  if(x==="BUILDING_FULL"||x==="BUILDING_MERGE")return["Menggabungkan PDF",s.progress||""];
  if(x==="DONE"||x==="MAX_MODULE_REACHED")return["Selesai",s.progress||"Semua modul selesai."];
  if(x==="END_CANDIDATE")return["Selesai",s.progress||"Modul terakhir terdeteksi."];
  if(x==="MISSING_GAP")return["Belum lengkap",s.progress||"Ada modul yang belum tersedia."];
  if(x==="LOGIN_REQUIRED")return["Perlu login","Sesi sumber meminta login ulang. Login kembali lalu mulai lagi."];
  if(x==="BLOCKED")return["Akses dihentikan","Server menolak permintaan. Proses dihentikan tanpa mencoba ulang."];
  if(x==="STOPPED_BY_USER")return["Dihentikan","Proses dihentikan."];
  if(x==="ERROR")return["Terjadi kendala",s.progress||"Proses tidak dapat dilanjutkan."];
  return["Sedang berjalan",s.progress||""];
}
function ocrProgress(text){
  if(!text)return{label:"",percent:null};
  const m=String(text).match(/(\d{1,3})%\s*$/);
  return{label:text,percent:m?Math.max(0,Math.min(100,Number(m[1]))):null};
}
function renderPendingActivation(a){
  const pending=a?.pending;
  const isPending=Boolean(pending&&!a.active);
  el("pairBox").style.display=isPending?"block":"none";
  el("checkActivation").style.display=isPending?"block":"none";
  el("activationWait").style.display=isPending?"block":"none";
  el("pairCode").textContent=pending?.pairId||"";

  if(!isPending){
    el("retryBox").style.display="none";
    return;
  }

  const started=Number(pending.startedAt||0);
  const elapsed=started?Date.now()-started:0;
  el("activationWaitTitle").textContent=
    activationChecking?"Memeriksa aktivasi...":"Menunggu verifikasi Telegram";
  el("activationWaitMeta").textContent=
    `${activationChecking?"Menghubungi layanan aktivasi":"Memeriksa otomatis"} • ${formatElapsed(elapsed)}`;

  const longWait=elapsed>=ACTIVATION_LONG_WAIT_MS;
  el("retryBox").style.display=longWait?"block":"none";
  if(longWait){
    el("activationText").textContent=
      "Belum selesai setelah beberapa saat. Status Telegram bisa membutuhkan waktu untuk sinkron. Coba Cek sekarang; jika masih sama, pilih Ulangi.";
  }
}
async function refreshAccess(){
  const a=await send("GET_ACCESS_STATUS");
  latestAccess=a;
  el("activationScreen").classList.toggle("active",!a.active);
  el("mainScreen").classList.toggle("active",Boolean(a.active));
  el("reviewTools").style.display=a.reviewer?"block":"none";
  if(!a.reviewer)el("reviewResult").textContent="";

  const updateBlocked=Boolean(latestVersionPolicy?.updateRequired);
  el("joinChannel").disabled=!a.configReady;
  el("joinGroup").disabled=!a.configReady;
  el("verifyTelegram").disabled=updateBlocked||!a.configReady||Boolean(a.pending);

  renderPendingActivation(a);

  if(!a.configReady){
    el("activationText").textContent="Build ini belum dikonfigurasi oleh pengelola.";
  }else if(a.pending&&!a.active){
    const started=Number(a.pending.startedAt||0);
    const elapsed=started?Date.now()-started:0;
    if(elapsed<ACTIVATION_LONG_WAIT_MS){
      el("activationText").textContent=
        "Setelah bot menyatakan aktivasi berhasil, popup akan mendeteksinya otomatis. Jika Telegram tidak membawa kode, salin kode aktivasi di atas lalu kirim ke bot.";
    }
  }else if(!a.active){
    el("activationText").textContent=
      "Aktivasi berlaku terbatas waktu dan dapat diperbarui selama kamu masih menjadi anggota komunitas.";
  }

  if(a.active&&a.expiresAt){
    el("accessBadge").textContent=`● Akses komunitas aktif hingga ${formatDate(a.expiresAt)}`;
  }
  return a;
}
async function refreshState(){
  const r=await send("GET_STATE");
  const s=r?.state||{};
  latestState=s;
  const [title,text]=humanStatus(s);
  el("statusTitle").textContent=title;
  el("statusText").textContent=text;

  if(s.running){
    const formKey=`${s.code}:${s.startModule}:${s.maxModule}:${Boolean(s.redownload)}:${Boolean(s.mergeRequested)}`;
    if(activeFormKey!==formKey){
      activeFormKey=formKey;
      el("code").value=s.code||"";
      el("startModule").value=String(s.startModule||1);
      el("maxModule").value=String(s.maxModule||9);
      el("redownload").checked=Boolean(s.redownload);
      el("mergePdf").checked=Boolean(s.mergeRequested);
      scheduleCacheRefresh();
    }
  }else{
    activeFormKey="";
  }

  const completed=s.completedModules||[];
  const completedKey=`${s.code||""}:${completed.join(",")}`;
  if(s.running&&lastCompletedKey&&completedKey!==lastCompletedKey){
    await refreshCachePreview();
  }
  lastCompletedKey=s.running?completedKey:"";
  el("completed").textContent=s.running&&completed.length
    ? `Tersimpan lokal: ${completed.map(x=>"M"+x).join(", ")}`
    : "";
  const o=ocrProgress(s.ocrProgress||"");
  if(s.running&&o.label){
    el("ocrWrap").style.display="block";
    el("ocrLabel").textContent=o.label;
    el("ocrBar").style.width=o.percent==null?"8%":`${o.percent}%`;
  }else{
    el("ocrWrap").style.display="none";
    el("ocrBar").style.width="0%";
  }
  el("stop").disabled=!s.running;
  el("stop").style.display=s.running?"block":"none";
  setFormLocked(Boolean(s.running));

  if(lastRunning&&!s.running)await refreshCachePreview();
  lastRunning=Boolean(s.running);
}

async function refreshVersion(){
  try{
    const r=await send("GET_VERSION_STATUS");
    const p=r?.policy||null;
    latestVersionPolicy=p;
    const required=Boolean(p?.updateRequired);
    const show=required||Boolean(p?.updateAvailable);
    el("updateNotice").style.display=show?"block":"none";
    el("updateTitle").textContent=required
      ? "Update BMP Terbuka diperlukan"
      : "Update BMP Terbuka tersedia";
    el("openUpdate").textContent=required?"Update sekarang":"Lihat update";
    if(show){
      const target=p.minimumVersion||p.latestVersion||"versi terbaru";
      el("updateText").textContent=required
        ? `Versi ini sudah tidak didukung. Update ke versi ${target} atau lebih baru untuk melanjutkan.`
        : `Versi ${p.latestVersion||"terbaru"} tersedia. Pemeriksaan versi dilakukan maksimal sekali setiap 24 jam.`;
    }
    await refreshAccess();
    await refreshState();
  }catch(e){
    latestVersionPolicy=null;
    el("updateNotice").style.display="none";
  }
}

function showShareNotice(message,{manualText=""}={}){
  el("shareNoticeText").textContent=message;
  el("shareNotice").style.display="block";
  const manual=el("shareManual");
  if(manualText){
    el("shareManualText").value=manualText;
    manual.style.display="block";
  }else{
    el("shareManualText").value="";
    manual.style.display="none";
  }
}

function hideShareNotice(){
  el("shareNotice").style.display="none";
  el("shareManual").style.display="none";
}

function legacyCopyText(value){
  const ta=document.createElement("textarea");
  ta.value=value;
  ta.setAttribute("readonly","");
  ta.style.position="fixed";
  ta.style.opacity="0";
  ta.style.pointerEvents="none";
  ta.style.left="-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0,ta.value.length);
  let ok=false;
  try{ok=Boolean(document.execCommand&&document.execCommand("copy"))}catch(e){}
  ta.remove();
  return ok;
}

async function copyTextRobust(value){
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(value);
      return true;
    }
  }catch(e){}
  return legacyCopyText(value);
}

async function shareBmp(){
  const a=latestAccess||await send("GET_ACCESS_STATUS");
  const url=a?.channelUrl||"https://t.me/bukabmp";
  const text="BMP Terbuka — ubah materi BMP yang sudah dapat kamu akses menjadi searchable PDF untuk belajar lebih nyaman.";
  const shareText=`${text}\n${url}`;
  const payload={title:"BMP Terbuka",text:shareText};
  hideShareNotice();

  if(typeof navigator.share==="function"){
    try{
      if(typeof navigator.canShare!=="function"||navigator.canShare(payload)){
        await navigator.share(payload);
        return;
      }
    }catch(e){
      // Some Edge Android extension popups reject Web Share (including AbortError)
      // before a native sheet is actually shown. Always continue to the fallback.
    }
  }

  if(await copyTextRobust(shareText)){
    const b=el("share");
    const old=b.textContent;
    b.textContent="Tersalin";
    showShareNotice("Share sheet tidak tersedia di popup ini. Teks + link sudah disalin dan siap ditempel.");
    setTimeout(()=>{b.textContent=old},1600);
    return;
  }

  showShareNotice(
    "Share sheet dan salin otomatis tidak tersedia. Salin teks + link di bawah secara manual.",
    {manualText:shareText}
  );
}

el("joinChannel").addEventListener("click",()=>send("OPEN_CHANNEL"));
el("channelLink").addEventListener("click",()=>send("OPEN_CHANNEL"));
el("joinGroup").addEventListener("click",()=>send("OPEN_GROUP"));
el("groupLink").addEventListener("click",()=>send("OPEN_GROUP"));
el("share").addEventListener("click",shareBmp);
el("copyShareManual").addEventListener("click",async()=>{
  const value=el("shareManualText").value;
  if(await copyTextRobust(value)){
    showShareNotice("Teks + link berhasil disalin.");
  }else{
    el("shareManualText").focus();
    el("shareManualText").select();
    showShareNotice(
      "Salin otomatis tetap tidak tersedia. Teks sudah dipilih; gunakan menu Salin dari Android.",
      {manualText:value}
    );
  }
});
el("openUpdate").addEventListener("click",()=>send("OPEN_UPDATE"));

el("runReviewSample").addEventListener("click",async()=>{
  const button=el("runReviewSample");
  button.disabled=true;
  el("reviewResult").textContent="Menjalankan OCR lokal pada sampel certification...";
  try{
    const r=await send("RUN_REVIEW_SAMPLE");
    if(!r?.ok)throw new Error(r?.error||"Sampel reviewer gagal.");
    const recognized=String(r.text||"").replace(/\s+/g," ").trim();
    el("reviewResult").textContent=recognized
      ? "PDF searchable tersimpan di Downloads. OCR terbaca: "+recognized.slice(0,180)
      : "PDF searchable tersimpan di Downloads.";
  }catch(e){
    el("reviewResult").textContent=String(e?.message||e);
  }finally{
    button.disabled=false;
  }
});

el("copyPairCode").addEventListener("click",async()=>{
  const code=el("pairCode").textContent.trim();
  if(!code)return;
  if(await copyTextRobust(code)){
    el("copyPairCode").textContent="Tersalin";
    setTimeout(()=>{el("copyPairCode").textContent="Salin kode"},1200);
  }else{
    el("activationText").textContent="Gagal menyalin otomatis. Pilih kode aktivasi lalu salin manual.";
  }
});

async function checkPendingActivation({quiet=false}={}){
  if(activationChecking)return await send("GET_ACCESS_STATUS");
  const a=await send("GET_ACCESS_STATUS");
  if(a?.active||!a?.pending)return a;

  activationChecking=true;
  el("checkActivation").disabled=true;
  renderPendingActivation(a);
  if(!quiet)el("activationText").textContent="Memeriksa status aktivasi...";

  try{
    const r=await send("CHECK_PAIRING");
    if(r?.ok&&r.result?.status==="verified"){
      return await refreshAccess();
    }
    if(r?.ok&&r.result?.status==="expired"){
      el("activationText").textContent="Sesi verifikasi kedaluwarsa. Pilih Ulangi untuk membuat sesi baru.";
      await refreshAccess();
    }
  }catch(e){
    if(!quiet){
      el("activationText").textContent=
        `Belum bisa memeriksa aktivasi: ${String(e?.message||e)}. Coba lagi sebentar.`;
    }
  }finally{
    activationChecking=false;
    el("checkActivation").disabled=false;
    await refreshAccess();
  }
  return await send("GET_ACCESS_STATUS");
}

async function beginPairing(){
  if(latestVersionPolicy?.updateRequired){
    el("activationText").textContent="Update BMP Terbuka diperlukan sebelum membuat aktivasi baru.";
    return;
  }
  el("verifyTelegram").disabled=true;
  el("activationText").textContent="Menyiapkan verifikasi...";
  try{
    const r=await send("START_PAIRING");
    if(!r?.ok)throw new Error(r?.error||"Verifikasi tidak dapat dimulai.");
    await refreshAccess();
  }catch(e){
    el("activationText").textContent=String(e?.message||e);
  }finally{
    await refreshAccess();
  }
}

el("verifyTelegram").addEventListener("click",beginPairing);
el("openTelegramAgain").addEventListener("click",async()=>{
  try{await send("OPEN_PENDING_TELEGRAM")}
  catch(e){el("activationText").textContent=String(e?.message||e)}
});
el("retryActivation").addEventListener("click",async()=>{
  el("retryActivation").disabled=true;
  el("activationText").textContent="Membuat sesi verifikasi baru...";
  try{
    await send("RESET_PAIRING");
    await beginPairing();
  }finally{
    el("retryActivation").disabled=false;
  }
});
el("checkActivation").addEventListener("click",()=>checkPendingActivation({quiet:false}));

el("start").addEventListener("click",async()=>{
  if(latestVersionPolicy?.updateRequired){
    el("statusTitle").textContent="Update diperlukan";
    el("statusText").textContent="Update BMP Terbuka ke versi yang didukung sebelum memulai proses baru.";
    return;
  }
  const code=normalizedCode();
  const range=selectedRange();
  const plan=currentPlan();
  if(!validCode(code)){
    el("statusTitle").textContent="Periksa kode BMP";
    el("statusText").textContent="Masukkan kode BMP, misalnya STDA4101.";
    return;
  }
  if(!range.valid){
    el("statusTitle").textContent="Periksa modul";
    el("statusText").textContent="Modul terakhir harus sama atau lebih besar dari modul pertama (maksimal 99).";
    return;
  }
  if(!plan.selected.length){
    el("statusTitle").textContent="Rentang tidak tersedia";
    el("statusText").textContent=latestCacheInfo.detectedLastModule
      ? `BMP ini terdeteksi sampai Modul ${latestCacheInfo.detectedLastModule}.`
      : "Tidak ada modul pada rentang tersebut.";
    return;
  }

  const action=el("start").dataset.action||"process";
  if(action==="export"){
    el("storageTools").open=true;
    selectExportModules(plan.available);
    setUtilityNotice(`${rangeLabel(plan.available)} sudah tersedia. Pilih modul lalu tekan Ekspor untuk membuat salinan baru di Downloads.`);
    el("storageTools").scrollIntoView({behavior:"smooth",block:"nearest"});
    return;
  }

  let tabId=null;
  const needsReader=plan.process.length>0;
  if(needsReader){
    const tabs=await chrome.tabs.query({active:true,currentWindow:true});
    const tab=tabs[0];
    if(!tab?.id||!tab.url?.startsWith("https://pustaka.ut.ac.id/reader/")){
      el("statusTitle").textContent="Buka reader terlebih dahulu";
      el("statusText").textContent="Ada modul yang perlu diproses. Buka halaman reader BMP pada tab aktif lalu coba lagi.";
      return;
    }
    tabId=tab.id;
  }

  el("code").value=code;
  await saveDraft();
  const res=await send("START_JOB",{
    tabId,
    code,
    startModule:range.first,
    maxModule:range.last,
    redownload:el("redownload").checked,
    mergeRequested:el("mergePdf").checked
  });
  if(!res?.ok){
    el("statusTitle").textContent="Gagal memulai";
    el("statusText").textContent=res?.error||"Terjadi kesalahan.";
  }
  await refreshState();
});

el("selectAllExport").addEventListener("click",()=>{
  const checked=checkedExportModules();
  const shouldSelect=checked.length!==latestCacheInfo.modules.length;
  for(const input of el("exportGrid").querySelectorAll('input[type="checkbox"]'))input.checked=shouldSelect;
  updateExportControls();
});

el("exportCached").addEventListener("click",async()=>{
  const code=normalizedCode();
  const modules=checkedExportModules();
  if(!validCode(code)||!modules.length)return;
  el("exportCached").disabled=true;
  try{
    for(let i=0;i<modules.length;i++){
      const moduleNo=modules[i];
      setUtilityNotice(`Mengekspor M${moduleNo} (${i+1}/${modules.length})...`);
      const r=await send("EXPORT_CACHED_MODULE",{code,module:moduleNo});
      if(!r?.ok)throw new Error(r?.error||`Ekspor Modul ${moduleNo} gagal.`);
    }
    setUtilityNotice(`${modules.length} PDF diekspor dari penyimpanan lokal tanpa OCR ulang.`);
  }catch(e){
    setUtilityNotice(String(e?.message||e));
  }finally{
    setFormLocked(Boolean(latestState?.running));
  }
});

el("clearCache").addEventListener("click",async()=>{
  const code=normalizedCode();
  if(!validCode(code)||!latestCacheInfo.modules.length)return;
  const size=formatBytes(latestCacheInfo.bytes);
  if(!confirm(`Kosongkan ${size} data lokal BMP Terbuka untuk ${code}?\n\nPDF yang sudah ada di folder Downloads tidak akan dihapus.`))return;
  el("clearCache").disabled=true;
  setUtilityNotice(`Mengosongkan data lokal ${code}...`);
  try{
    const r=await send("CLEAR_CACHE_CODE",{code});
    if(!r?.ok)throw new Error(r?.error||"Penyimpanan tidak dapat dikosongkan.");
    setUtilityNotice(`Data lokal ${code} sudah dikosongkan. PDF di Downloads tetap ada.`);
    el("storageTools").open=false;
    await refreshCachePreview();
  }catch(e){setUtilityNotice(String(e?.message||e))}
  finally{setFormLocked(Boolean(latestState?.running))}
});

for(const id of ["code","startModule","maxModule"]){
  el(id).addEventListener("input",()=>{scheduleDraftSave();renderOptionHints();updatePrimaryAction();scheduleCacheRefresh()});
}
for(const id of ["redownload","mergePdf"]){
  el(id).addEventListener("change",()=>{scheduleDraftSave();scheduleCacheRefresh();renderOptionHints();updatePrimaryAction()});
}
el("code").addEventListener("blur",()=>{
  el("code").value=normalizedCode();
  scheduleDraftSave();
  scheduleCacheRefresh();
});

el("stop").addEventListener("click",async()=>{await send("STOP_JOB");await refreshState()});
el("about").addEventListener("click",()=>chrome.tabs.create({url:chrome.runtime.getURL("about.html")}));

(async()=>{
  await loadDraft();
  await refreshCloudSurface();
  await refreshAccess();
  await refreshVersion();
  await refreshState();
  await refreshCachePreview();
  setInterval(async()=>{await refreshAccess();await refreshState()},1000);
  setInterval(()=>refreshCloudSurface().catch(()=>{}),30_000);
  setInterval(async()=>{
    const a=await send("GET_ACCESS_STATUS");
    if(a?.pending&&!a?.active)await checkPendingActivation({quiet:true});
  },2000);
})();
