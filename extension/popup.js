function el(id){return document.getElementById(id)}
async function send(type, extra={}){return await chrome.runtime.sendMessage({type,...extra})}

const ACTIVATION_LONG_WAIT_MS = 90_000;
let activationChecking = false;
let latestAccess = null;
let latestVersionPolicy = null;
let latestCloudState = null;
let latestState = null;
let latestCacheInfo = {modules:[],bytes:0,totalBytes:0,detectedLastModule:null};
let latestStorageInfo = {totalBytes:0,pdfCount:0,code:"",codeBytes:0};
let latestQuizSourceStatus = null;
let latestQuizBankStatus = null;
let latestQuizLifecycle = null;
let latestQuizCapacity = null;
let latestQuizDeviceGeneration = null;
let latestCacheCode = "";
let cacheRefreshTimer = null;
let draftSaveTimer = null;
let lastRunning = false;
let activeFormKey = "";
let lastCompletedKey = "";
let adInterstitialTimer = null;
let activeInterstitialAd = null;
let reportedCardImpressionKey = "";
let cloudRenderGeneration = 0;
const ADS_MEDIA = self.BMP_ADS_MEDIA;
const AD_NETWORK = self.BMP_AD_NETWORK;
const LOCAL_BACKUP = self.BMP_LOCAL_BACKUP;
const RESTORE_ENGINE = self.BMP_RESTORE_ENGINE;
const RESTORE_SESSION = self.BMP_RESTORE_SESSION;
const LOCAL_BACKUP_STATE_KEY = "bmpLocalBackupOperationV1";
let localBackupOperationInFlight = false;
let localBackupOperationCancelled = false;
let activeRestoreEngineSession = null;
let activeLocalBackupWritable = null;
let activeLocalBackupTemp = null;
const LOCAL_BACKUP_TEMP_DIR = "bmp-terbuka-backup-temp-v1";
let storagePersistenceAttempted = false;
let latestStorageProtection = null;
let latestAndroidRestoreState = null;

async function storageProtectionSnapshot({requestPersistence=false}={}){
  const manifestPermissions=Array.isArray(chrome.runtime.getManifest()?.permissions)
    ?chrome.runtime.getManifest().permissions
    :[];
  const manifestHasUnlimited=manifestPermissions.includes("unlimitedStorage");
  let unlimitedStorageGranted=manifestHasUnlimited;

  try{
    if(manifestHasUnlimited&&chrome.permissions?.contains){
      unlimitedStorageGranted=await chrome.permissions.contains({permissions:["unlimitedStorage"]});
    }
  }catch(_){}

  let persisted=null;
  try{
    if(typeof navigator?.storage?.persisted==="function"){
      persisted=await navigator.storage.persisted();
    }
    if(
      requestPersistence&&
      persisted!==true&&
      !storagePersistenceAttempted&&
      typeof navigator?.storage?.persist==="function"
    ){
      storagePersistenceAttempted=true;
      const granted=await navigator.storage.persist();
      if(typeof granted==="boolean")persisted=granted;
      if(typeof navigator?.storage?.persisted==="function"){
        persisted=await navigator.storage.persisted();
      }
    }
  }catch(_){}

  let usage=null;
  let quota=null;
  let usageDetails=null;
  try{
    if(typeof navigator?.storage?.estimate==="function"){
      const estimate=await navigator.storage.estimate();
      usage=Number.isFinite(Number(estimate?.usage))?Number(estimate.usage):null;
      quota=Number.isFinite(Number(estimate?.quota))?Number(estimate.quota):null;
      usageDetails=estimate?.usageDetails&&typeof estimate.usageDetails==="object"
        ?estimate.usageDetails
        :null;
    }
  }catch(_){}

  return{
    manifestHasUnlimited,
    unlimitedStorageGranted,
    persisted,
    usage,
    quota,
    usageDetails
  };
}

function assertLocalBackupOperationActive(){
  if(localBackupOperationCancelled)throw new Error("Operasi data lokal dibatalkan.");
}

function cancelLocalBackupOperation(){
  localBackupOperationCancelled=true;
  const restoreSession=activeRestoreEngineSession;
  activeRestoreEngineSession=null;
  if(restoreSession){
    try{restoreSession.cancel()}catch(_){}
  }
  const writable=activeLocalBackupWritable;
  activeLocalBackupWritable=null;
  if(writable&&typeof writable.abort==="function"){
    try{writable.abort(new Error("Backup dibatalkan karena popup ditutup."))}catch(_){}
  }
  const temp=activeLocalBackupTemp;
  activeLocalBackupTemp=null;
  if(temp?.directory&&temp?.name){
    try{temp.directory.removeEntry(temp.name).catch(()=>{})}catch(_){}
  }
}

async function localBackupTempDirectory(){
  if(typeof navigator?.storage?.getDirectory!=="function"){
    throw new Error("Browser ini belum mendukung penyimpanan sementara untuk backup besar.");
  }
  const root=await navigator.storage.getDirectory();
  return await root.getDirectoryHandle(LOCAL_BACKUP_TEMP_DIR,{create:true});
}

async function cleanupOrphanedLocalBackupTemps(directory=null){
  let dir=directory;
  try{
    if(!dir)dir=await localBackupTempDirectory();
    for await(const [name,handle] of dir.entries()){
      if(!String(name).startsWith("backup-")||handle?.kind!=="file")continue;
      try{await dir.removeEntry(name)}catch(_){}
    }
  }catch(_){}
}

async function localBackupTempSummary(){
  let count=0;
  let bytes=0;
  try{
    const dir=await localBackupTempDirectory();
    for await(const [name,handle] of dir.entries()){
      if(!String(name).startsWith("backup-")||handle?.kind!=="file")continue;
      count++;
      try{const file=await handle.getFile();bytes+=Math.max(0,Number(file.size||0))}catch(_){}
    }
  }catch(_){}
  return{count,bytes};
}

function renderStorageProtection(info){
  const box=el("storageProtection");
  if(!box)return;
  if(!info){box.textContent="";return;}
  const protectedNow=info.unlimitedStorageGranted===true||info.persisted===true;
  box.textContent=protectedNow
    ?"Penyimpanan lokal terlindungi."
    :"⚠️ Perlindungan penyimpanan lokal belum aktif. Backup besar dinonaktifkan untuk melindungi data.";
}

async function refreshStorageProtection({requestPersistence=false}={}){
  latestStorageProtection=await storageProtectionSnapshot({requestPersistence});
  const temp=await localBackupTempSummary();
  renderStorageProtection(latestStorageProtection,temp);
  return{...latestStorageProtection,temp};
}

async function localBackupPreflight(){
  const protection=await refreshStorageProtection({requestPersistence:true});
  if(protection.unlimitedStorageGranted!==true&&protection.persisted!==true){
    throw new Error("Perlindungan penyimpanan lokal belum aktif. Backup besar dinonaktifkan untuk melindungi data. Muat ulang ekstensi lalu coba lagi.");
  }
  return protection;
}

function cleanupLocalBackupTempAfterDownload(downloadId,{directory,name,url}){
  let cleaned=false;
  const cleanup=()=>{
    if(cleaned)return;
    cleaned=true;
    try{chrome.downloads.onChanged.removeListener(listener)}catch(_){}
    try{URL.revokeObjectURL(url)}catch(_){}
    directory.removeEntry(name).catch(()=>{});
  };
  const listener=delta=>{
    if(Number(delta?.id)!==Number(downloadId))return;
    const state=String(delta?.state?.current||"");
    if(state==="complete"||state==="interrupted")cleanup();
  };
  chrome.downloads.onChanged.addListener(listener);
  chrome.downloads.search({id:Number(downloadId)}).then(items=>{
    const state=String(items?.[0]?.state||"");
    if(state==="complete"||state==="interrupted")cleanup();
  }).catch(()=>{});
}

window.addEventListener("pagehide",cancelLocalBackupOperation);
const CACHE_CONSISTENCY = self.BMP_CACHE_CONSISTENCY;
const cacheRefreshGuard = CACHE_CONSISTENCY.createLatestRequestGuard();

const DRAFT_KEY = "bmpDraftV105";
let restoredQuizModule = null;

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
const UX_STATE_CLASSES=["state-waiting","state-success","state-warning","state-error","state-info"];
function setUxState(target,kind=""){
  const node=typeof target==="string"?el(target):target;
  if(!node)return;
  node.classList.remove(...UX_STATE_CLASSES,"stateSurface");
  if(kind&&UX_STATE_CLASSES.includes("state-"+kind)){
    node.classList.add("stateSurface","state-"+kind);
  }
}
function setUtilityNotice(text,kind=""){
  const node=el("utilityNotice");
  node.textContent=text||"";
  setUxState(node,text?kind:"");
}
function renderBackupCloseWarning(){
  const warning=el("backupCloseWarning");
  if(!warning)return;
  warning.style.display=localBackupOperationInFlight?"block":"none";
}
function setBackupNotice(text){
  const node=el("backupNotice");
  node.textContent=text||"";
  setUxState(node,"");
  renderBackupCloseWarning();
}
function setBackupNoticeState(text,kind=""){
  setBackupNotice(text);
  setUxState(el("backupNotice"),text?kind:"");
}

let cachedPlatformInfo=null;
let platformReady=false;
let platformResolvePromise=null;

function resolvePlatformOnce(){
  if(platformResolvePromise)return platformResolvePromise;
  platformResolvePromise=chrome.runtime.getPlatformInfo()
    .catch(()=>({os:/Android/i.test(String(navigator.userAgent||""))?"android":"unknown"}))
    .then(info=>{
      cachedPlatformInfo=info&&typeof info==="object"?info:{os:"unknown"};
      platformReady=true;
      return cachedPlatformInfo;
    });
  return platformResolvePromise;
}

function isAndroidPlatform(){
  return platformReady&&cachedPlatformInfo?.os==="android";
}

async function openAndroidRestoreTab(){
  const result=await RESTORE_SESSION.openOrFocus();
  latestAndroidRestoreState=result?.state||null;
  setBackupNoticeState(result?.reused?"Restore sudah dibuka di tab.":"Restore dibuka di tab.","info");
  applyRestoreMutationGuardUi();
  return result;
}

function androidRestoreRunning(){
  return isAndroidPlatform()&&RESTORE_SESSION.isRunning(latestAndroidRestoreState);
}

function applyRestoreMutationGuardUi(){
  const running=androidRestoreRunning();
  if(isAndroidPlatform()){
    el("restoreLocalData").textContent=latestAndroidRestoreState?.tabId?"Buka tab restore":"Pulihkan backup";
  }
  if(running){
    el("start").disabled=true;
    el("backupLocalData").disabled=true;
    el("clearCache").disabled=true;
    el("clearAllCache").disabled=true;
    setBackupNoticeState("Restore sedang berjalan di tab.","info");
  }
}

async function refreshAndroidRestoreGuard(){
  if(!isAndroidPlatform()){
    latestAndroidRestoreState=null;
    return null;
  }
  latestAndroidRestoreState=await RESTORE_SESSION.getLiveState();
  applyRestoreMutationGuardUi();
  return latestAndroidRestoreState;
}

async function requireNoActiveAndroidRestore({surface="status"}={}){
  if(!isAndroidPlatform())return true;
  latestAndroidRestoreState=await RESTORE_SESSION.getLiveState();
  if(!RESTORE_SESSION.isRunning(latestAndroidRestoreState))return true;
  applyRestoreMutationGuardUi();
  if(surface==="utility"){
    setUtilityNotice("Restore sedang berjalan di tab. Selesaikan atau hentikan restore sebelum mengubah data lokal.","info");
  }else{
    el("statusTitle").textContent="Restore sedang berjalan";
    el("statusText").textContent="Selesaikan atau hentikan restore di tab sebelum memulai proses yang mengubah data lokal.";
    setUxState(el("status"),"info");
  }
  return false;
}

function localBackupPhaseBusy(phase){
  return phase==="backing_up"||phase==="validating"||phase==="restoring"||phase==="verifying"||phase==="staging"||phase==="committing";
}

async function readLocalBackupOperation(){
  const stored=await chrome.storage.local.get(LOCAL_BACKUP_STATE_KEY);
  const state=stored?.[LOCAL_BACKUP_STATE_KEY];
  return state&&typeof state==="object"
    ?state
    :{schemaVersion:1,kind:"",phase:"idle",updatedAt:0};
}

async function writeLocalBackupOperation(patch){
  const current=await readLocalBackupOperation();
  const next={...current,...patch,schemaVersion:1,updatedAt:Date.now()};
  await chrome.storage.local.set({[LOCAL_BACKUP_STATE_KEY]:next});
  return next;
}

function localBackupNoticeText(state){
  const phase=String(state?.phase||"idle");
  const progress=String(state?.progress||"").trim();
  const error=String(state?.lastError||"").trim();
  if(phase==="idle")return "";
  if(phase==="completed")return progress||"Operasi data lokal selesai.";
  if(phase==="error")return error?((progress||"Operasi gagal.")+" "+error):(progress||"Operasi gagal.");
  return progress;
}

async function refreshLocalBackupOperation(){
  const androidState=await refreshAndroidRestoreGuard();
  const androidRunning=RESTORE_SESSION.isRunning(androidState);
  let state=await readLocalBackupOperation();
  if(localBackupPhaseBusy(String(state.phase||""))&&!localBackupOperationInFlight&&!androidRunning){
    state=await writeLocalBackupOperation({
      phase:"error",
      progress:"Operasi sebelumnya terputus sebelum selesai.",
      lastError:"Coba ulang dari popup BMP Terbuka.",
      interruptedAt:Date.now()
    });
  }
  const busy=localBackupOperationInFlight;
  el("backupLocalData").disabled=busy||Boolean(latestState?.running)||androidRunning;
  el("restoreLocalData").disabled=!platformReady||Boolean(latestState?.running)||(!isAndroidPlatform()&&busy);
  const phase=String(state?.phase||"idle");
  const backupKind=androidRunning
    ?"info"
    :localBackupPhaseBusy(phase)
      ?"waiting"
      :phase==="completed"
        ?"success"
        :phase==="error"
          ?"error"
          :phase==="cancelled"
            ?"warning"
            :"";
  setBackupNoticeState(androidRunning?"Restore sedang berjalan di tab.":localBackupNoticeText(state),backupKind);
  applyRestoreMutationGuardUi();
  return state;
}

function backupDbOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open("bmp-terbuka-pdf-cache",2);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains("pdfs"))db.createObjectStore("pdfs");
      if(!db.objectStoreNames.contains("quiz_sources"))db.createObjectStore("quiz_sources");
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

function backupStoreKeys(storeName){
  return backupDbOpen().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,"readonly");
    const req=tx.objectStore(storeName).getAllKeys();
    req.onsuccess=()=>resolve((req.result||[]).map(String));
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>db.close();
    tx.onerror=()=>{const e=tx.error;db.close();reject(e)};
  }));
}

async function backupStoreValue(storeName,key){
  const db=await backupDbOpen();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,"readonly");
    const req=tx.objectStore(storeName).get(key);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>db.close();
    tx.onerror=()=>{const e=tx.error;db.close();reject(e)};
  });
}

async function* iterateBackupStore(storeName){
  const keys=await backupStoreKeys(storeName);
  if(keys.length>LOCAL_BACKUP.MAX_RECORDS_PER_STORE){
    throw new Error("Isi backup melewati batas aman.");
  }
  for(const key of keys){
    const value=await backupStoreValue(storeName,key);
    if(value===undefined)throw new Error("Data lokal berubah saat backup dibaca. Coba backup lagi.");
    yield [key,value];
  }
}

async function createLocalBackup(){
  if(!LOCAL_BACKUP)throw new Error("Modul backup lokal tidak tersedia.");
  assertLocalBackupOperationActive();
  const protection=await localBackupPreflight();
  assertLocalBackupOperationActive();
  const local=await chrome.storage.local.get(["bmpCacheMeta",DRAFT_KEY]);
  const safeMetadata={
    bmpCacheMeta:local.bmpCacheMeta&&typeof local.bmpCacheMeta==="object"?local.bmpCacheMeta:{},
    [DRAFT_KEY]:local[DRAFT_KEY]&&typeof local[DRAFT_KEY]==="object"?local[DRAFT_KEY]:null
  };

  const directory=await localBackupTempDirectory();
  await cleanupOrphanedLocalBackupTemps(directory);
  assertLocalBackupOperationActive();

  const tempName=`backup-${Date.now()}-${crypto.randomUUID()}.jsonl.gz`;
  const handle=await directory.getFileHandle(tempName,{create:true});
  activeLocalBackupTemp={directory,name:tempName};
  let writable=null;
  let url="";
  let handedToDownloads=false;
  try{
    writable=await handle.createWritable();
    activeLocalBackupWritable=writable;
    const result=await LOCAL_BACKUP.writeV2BackupToWritable({
      pdfs:iterateBackupStore("pdfs"),
      quizSources:iterateBackupStore("quiz_sources"),
      safeMetadata,
      writable
    });
    if(activeLocalBackupWritable===writable)activeLocalBackupWritable=null;
    assertLocalBackupOperationActive();

    const file=await handle.getFile();
    if(Number(file.size)!==Number(result.bytes)){
      throw new Error("Ukuran backup sementara tidak cocok setelah kompresi.");
    }

    url=URL.createObjectURL(file);
    const date=new Date().toISOString().slice(0,10);
    const downloadId=await chrome.downloads.download({
      url,
      filename:`BMP-Terbuka-Backup-${date}.v2.jsonl.gz`,
      saveAs:true
    });
    handedToDownloads=true;
    activeLocalBackupTemp=null;
    cleanupLocalBackupTempAfterDownload(downloadId,{
      directory,
      name:tempName,
      url
    });
    const tempCleanedImmediately=await directory.removeEntry(tempName)
      .then(()=>true)
      .catch(()=>false);
    const temp=await localBackupTempSummary();
    renderStorageProtection(latestStorageProtection,temp);
    return {
      pdfs:result.pdfs,
      quizSources:result.quizSources,
      bytes:result.bytes,
      backupVersion:result.backup_version,
      protection,
      tempCleaned:tempCleanedImmediately||temp.count===0
    };
  }catch(error){
    if(activeLocalBackupWritable===writable)activeLocalBackupWritable=null;
    if(writable&&typeof writable.abort==="function"){
      try{await writable.abort(error)}catch(_){}
    }
    throw error;
  }finally{
    if(activeLocalBackupTemp?.name===tempName)activeLocalBackupTemp=null;
    if(!handedToDownloads){
      if(url){
        try{URL.revokeObjectURL(url)}catch(_){}
      }
      try{await directory.removeEntry(tempName)}catch(_){}
    }
  }
}

function localHouseAd(){
  return {
    campaignId:"",
    revision:0,
    sponsorLabel:"Sponsor",
    advertiser:"",
    headline:"Space iklan tersedia",
    body:"",
    disclaimer:"",
    cta:{label:"Pasang iklan? Hubungi",url:"https://t.me/bukabmp?direct"},
    isHouse:true
  };
}

function houseAdFromState(state){
  const house=state?.ads?.house||null;
  if(!house)return localHouseAd();
  return {
    ...localHouseAd(),
    sponsorLabel:String(house.sponsorLabel||"Sponsor"),
    headline:String(house.headline||"Space iklan tersedia"),
    body:String(house.body||""),
    cta:house.cta||localHouseAd().cta
  };
}

function campaignAdFromState(state,placement){
  const ads=state?.ads||null;
  const creative=placement==="card"?ads?.card:ads?.interstitial;
  if(
    !ads?.active||
    !ads.placements?.[placement]||
    creative?.enabled===false||
    (placement==="interstitial"&&!ads.interstitial?.enabled)
  )return null;
  return {
    campaignId:String(ads.campaignId||""),
    revision:Number(ads.revision||0),
    provider:String(ads.provider||"direct"),
    sponsorLabel:String(ads.sponsorLabel||"Sponsor"),
    advertiser:String(ads.advertiser||""),
    headline:String(creative?.headline??ads.headline??""),
    body:String(creative?.body??ads.body??""),
    disclaimer:String(creative?.disclaimer??ads.disclaimer??""),
    cta:creative?.cta??ads.cta??null,
    mediaUrl:String(creative?.mediaUrl||""),
    mode:String(creative?.mode||"text"),
    asset:creative?.asset||null,
    posterAsset:placement==="interstitial"?(creative?.posterAsset||null):null,
    isHouse:false
  };
}

async function executeAdCta(ad){
  const cta=ad?.cta;
  if(!cta?.label||!cta?.url)return false;
  const result=await send("EXECUTE_CLOUD_ACTION",{action:{
    type:"OPEN_URL",
    label:cta.label,
    url:cta.url
  }});
  if(!result?.ok)throw new Error(result?.error||"Tautan sponsor tidak dapat dibuka.");
  return true;
}

async function executeAdMedia(ad){
  const url=String(ad?.mediaUrl||ad?.cta?.url||"");
  if(!url)return false;
  const result=await send("EXECUTE_CLOUD_ACTION",{action:{
    type:"OPEN_URL",
    label:String(ad?.headline||ad?.advertiser||"Sponsor"),
    url
  }});
  if(!result?.ok)throw new Error(result?.error||"Tautan sponsor tidak dapat dibuka.");
  return true;
}

function reportTelemetry(event,dimensions={}){
  send("REPORT_TELEMETRY",{event,dimensions}).catch(()=>{});
}

function reportAdEvent(eventType,ad,placement,clickTarget=""){
  if(!ad?.campaignId)return;
  send("REPORT_AD_EVENT",{
    eventType,
    placement,
    campaignId:ad.campaignId,
    revision:Number(ad.revision||0),
    clickTarget
  }).catch(()=>{});
}

function bindMediaActivation(host,ad,placement){
  if(!host)return;
  const url=String(ad?.mediaUrl||ad?.cta?.url||"");
  host.classList.remove("clickableAdMedia");
  host.removeAttribute("role");
  host.removeAttribute("tabindex");
  host.removeAttribute("aria-label");
  host.onclick=null;
  host.onkeydown=null;
  if(!url)return;

  host.classList.add("clickableAdMedia");
  host.setAttribute("role","link");
  host.setAttribute("tabindex","0");
  host.setAttribute("aria-label","Buka tautan sponsor");
  let busy=false;
  const activate=async()=>{
    if(busy)return;
    busy=true;
    try{
      await executeAdMedia(ad);
      if(!ad?.isHouse)reportAdEvent("click",ad,placement,"media");
      if(placement==="interstitial")hideAdInterstitial({report:false});
    }catch(_){
      // Media click failures stay non-blocking; the BMP job is never coupled to ads.
    }finally{
      busy=false;
    }
  };
  host.onclick=()=>{void activate()};
  host.onkeydown=event=>{
    if(event.key!=="Enter"&&event.key!==" ")return;
    event.preventDefault();
    void activate();
  };
}

function reportVisibleCardImpression(){
  if(
    !latestAccess?.active||
    !el("mainScreen").classList.contains("active")
  ){
    reportedCardImpressionKey="";
    return;
  }
  const ad=campaignAdFromState(latestCloudState,"card");
  if(!ad){
    reportedCardImpressionKey="";
    return;
  }
  const key=ad.campaignId+":"+ad.revision;
  if(reportedCardImpressionKey===key)return;
  reportedCardImpressionKey=key;
  reportAdEvent("impression",ad,"card");
}

function hideAdInterstitial({report=true}={}){
  ADS_MEDIA?.clear?.(el("adInterstitialMedia"));
  const root=el("adInterstitial");
  root.classList.remove("visible");
  root.setAttribute("aria-hidden","true");
  if(report&&activeInterstitialAd)reportAdEvent("dismiss",activeInterstitialAd,"interstitial");
  activeInterstitialAd=null;
}

function showAdInterstitial(ad){
  const creative=ad||localHouseAd();
  activeInterstitialAd=creative;
  el("adInterstitialLabel").textContent=(creative.sponsorLabel||"Sponsor")+(creative.advertiser?" · "+creative.advertiser:"");
  el("adInterstitialAdvertiser").textContent="";
  el("adInterstitialAdvertiser").style.display="none";
  el("adInterstitialHeadline").textContent=creative.headline||"Space iklan tersedia";
  el("adInterstitialBody").textContent=creative.body||"";
  el("adInterstitialBody").style.display=creative.body?"block":"none";
  const mediaHost=el("adInterstitialMedia");
  ADS_MEDIA?.clear?.(mediaHost);
  mediaHost.style.display="none";
  if(!creative.isHouse&&creative.mode!=="text"){
    const rendered=ADS_MEDIA?.render?.(mediaHost,{apiBase:self.BMP_CONFIG?.API_BASE_URL,mode:creative.mode,asset:creative.asset,posterAsset:creative.posterAsset,onError:reason=>{ADS_MEDIA?.clear?.(mediaHost);mediaHost.style.display="none";reportTelemetry("media_render_failed",{campaign_id:creative.campaignId,placement:"interstitial",revision:Number(creative.revision||0),paid_direct:true,reason})}});
    if(rendered){
      mediaHost.style.display="flex";
      bindMediaActivation(mediaHost,creative,"interstitial");
    }else reportTelemetry("media_render_failed",{campaign_id:creative.campaignId,placement:"interstitial",revision:Number(creative.revision||0),paid_direct:true,reason:creative.mode==="video"?"video_load_failed":"image_load_failed"});
  }
  el("adInterstitialDisclaimer").textContent=creative.disclaimer||"";
  el("adInterstitialDisclaimer").style.display=creative.disclaimer?"block":"none";
  const cta=el("adInterstitialCta");
  if(creative.cta?.label&&creative.cta?.url){
    cta.textContent=creative.cta.label;
    cta.style.display="block";
  }else{
    cta.textContent="";
    cta.style.display="none";
  }
  const root=el("adInterstitial");
  root.classList.add("visible");
  root.setAttribute("aria-hidden","false");
  if(!creative.isHouse)reportAdEvent("impression",creative,"interstitial");
}

function randomDelay(min,max){
  const low=Math.max(2000,Math.min(5000,Math.floor(Number(min)||2000)));
  const high=Math.max(low,Math.min(5000,Math.floor(Number(max)||5000)));
  return low+Math.floor(Math.random()*(high-low+1));
}

async function scheduleJobStartedInterstitial(){
  clearTimeout(adInterstitialTimer);

  let state=latestCloudState;
  let creative=
    campaignAdFromState(state,"interstitial")||
    houseAdFromState(state);
  const cfg=state?.ads?.interstitial||{};
  const delay=randomDelay(cfg.delayMinMs||2000,cfg.delayMaxMs||5000);

  // Start the 2–5 second clock immediately after START_JOB succeeds.
  // A slow/unavailable backend can change the creative to the house ad,
  // but can never delay or block the running BMP job.
  adInterstitialTimer=setTimeout(()=>{
    adInterstitialTimer=null;
    showAdInterstitial(creative);
  },delay);

  try{
    const r=await send("GET_CLOUD_STATE",{force:true});
    if(r?.ok){
      state=r.state||null;
      renderCloudSurface(state);
      creative=
        campaignAdFromState(state,"interstitial")||
        houseAdFromState(state);
    }
  }catch(_){}
}

function renderCloudSurface(state){
  const renderGeneration=++cloudRenderGeneration;
  latestCloudState=state||null;
  const root=el("cloudSurface");
  const sponsorRoot=el("sponsorSlot");
  const cloudBadge=el("cloudStatusBadge");
  root.textContent="";
  sponsorRoot.textContent="";

  const badge=state?.statusBadge||null;
  if(badge?.visible&&badge.text){
    cloudBadge.textContent=badge.text;
    cloudBadge.className=`statusChip cloudStatusBadge ${badge.kind||"info"}`;
    cloudBadge.style.display="block";
  }else{
    cloudBadge.textContent="";
    cloudBadge.className="statusChip cloudStatusBadge";
    cloudBadge.style.display="none";
  }

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

  function appendSponsorContact(card,cta=null){
    const fallback=houseAdFromState(state).cta;
    const action=cta?.label&&cta?.url?cta:fallback;
    if(!action?.label||!action?.url)return;
    const contact=document.createElement("button");
    contact.type="button";
    contact.className="sponsorContact";
    contact.textContent=action.label;
    contact.addEventListener("click",async()=>{
      contact.disabled=true;
      try{
        const result=await send("EXECUTE_CLOUD_ACTION",{action:{
          type:"OPEN_URL",
          label:action.label,
          url:action.url
        }});
        if(!result?.ok)throw new Error(result?.error||"Tautan tidak dapat dibuka.");
      }catch(e){
        contact.textContent=String(e?.message||e).slice(0,80);
      }finally{
        setTimeout(()=>{contact.disabled=false;contact.textContent=action.label},1400);
      }
    });
    card.append(contact);
  }

  const cardAd=campaignAdFromState(state,"card");
  if(!cardAd)reportedCardImpressionKey="";
  if(cardAd){
    sponsorRendered=true;
    const card=document.createElement("aside");
    card.className="sponsorBanner";
    card.setAttribute("aria-label","Sponsor");

    const meta=document.createElement("div");
    meta.className="sponsorMeta";
    meta.textContent=(cardAd.sponsorLabel||"Sponsor")+(cardAd.advertiser?" · "+cardAd.advertiser:"");
    card.append(meta);
    if(cardAd.mode==="banner"&&cardAd.asset){
      const media=document.createElement("div");
      media.className="sponsorMedia sponsorMediaBanner";
      card.append(media);
      const rendered=ADS_MEDIA?.render?.(media,{apiBase:self.BMP_CONFIG?.API_BASE_URL,mode:"banner",asset:cardAd.asset,onError:reason=>{media.remove();reportTelemetry("media_render_failed",{campaign_id:cardAd.campaignId,placement:"card",revision:Number(cardAd.revision||0),paid_direct:true,reason})}});
      if(rendered){
        bindMediaActivation(media,cardAd,"card");
      }else{
        media.remove();
        reportTelemetry("media_render_failed",{campaign_id:cardAd.campaignId,placement:"card",revision:Number(cardAd.revision||0),paid_direct:true,reason:"image_load_failed"});
      }
    }
    if(cardAd.headline){
      const title=document.createElement("div");
      title.className="sponsorTitle";
      title.textContent=cardAd.headline;
      card.append(title);
    }
    if(cardAd.body){
      const body=document.createElement("div");
      body.className="sponsorText";
      body.textContent=cardAd.body;
      card.append(body);
    }
    if(cardAd.disclaimer){
      const disclaimer=document.createElement("div");
      disclaimer.className="sponsorText";
      disclaimer.textContent=cardAd.disclaimer;
      card.append(disclaimer);
    }
    if(cardAd.cta?.label&&cardAd.cta?.url){
      const button=document.createElement("button");
      button.type="button";
      button.className="sponsorAction";
      button.textContent=cardAd.cta.label;
      button.addEventListener("click",async()=>{
        button.disabled=true;
        try{
          await executeAdCta(cardAd);
          reportAdEvent("click",cardAd,"card","cta");
        }catch(e){
          button.textContent=String(e?.message||e).slice(0,80);
        }finally{
          setTimeout(()=>{button.disabled=false;button.textContent=cardAd.cta.label},1400);
        }
      });
      card.append(button);
    }
    sponsorRoot.append(card);
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
      appendSponsorContact(card);
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

  function appendHouse(){
    const house=houseAdFromState(state);
    const placeholder=document.createElement("aside");
    placeholder.className="sponsorBanner sponsorPlaceholder";
    placeholder.setAttribute("aria-label","Space sponsor tersedia");
    const meta=document.createElement("div");
    meta.className="sponsorMeta";
    meta.textContent=house.sponsorLabel||"Sponsor";
    placeholder.append(meta);
    const title=document.createElement("div");
    title.className="sponsorTitle";
    title.textContent=house.headline||"Space iklan tersedia";
    placeholder.append(title);
    appendSponsorContact(placeholder,house.cta);
    sponsorRoot.append(placeholder);
  }

  if(!sponsorRendered&&state?.ads?.network?.adsonbread===true&&AD_NETWORK?.renderCard){
    sponsorRendered=true;
    const networkHost=document.createElement("aside");
    networkHost.className="sponsorBanner sponsorNetwork";
    networkHost.setAttribute("aria-label","Sponsor");
    sponsorRoot.append(networkHost);
    AD_NETWORK.renderCard(networkHost).then(result=>{
      if(renderGeneration!==cloudRenderGeneration)return;
      if(result?.rendered===true)return;
      networkHost.remove();
      appendHouse();
    }).catch(()=>{
      if(renderGeneration!==cloudRenderGeneration)return;
      networkHost.remove();
      appendHouse();
    });
  }
  if(!sponsorRendered)appendHouse();

  reportVisibleCardImpression();
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
  restoredQuizModule=Number.isInteger(Number(d.quizModule))&&Number(d.quizModule)>=1
    ?Number(d.quizModule)
    :null;
}
async function saveDraft(){
  const range=selectedRange();
  await chrome.storage.local.set({
    [DRAFT_KEY]:{
      code:normalizedCode(),
      startModule:range.valid?range.first:1,
      maxModule:range.valid?range.last:9,
      redownload:el("redownload").checked,
      mergeRequested:el("mergePdf").checked,
      quizModule:Number.isInteger(Number(el("quizModule").value))
        ?Number(el("quizModule").value)
        :null
    }
  });
}
function scheduleDraftSave(){
  clearTimeout(draftSaveTimer);
  draftSaveTimer=setTimeout(()=>saveDraft().catch(()=>{}),180);
}
function cacheRefreshSelectionKey(){
  const range=selectedRange();
  return [
    normalizedCode(),
    Number.isInteger(range.first)?range.first:"",
    Number.isInteger(range.last)?range.last:"",
    Boolean(el("redownload")?.checked)
  ].join(":");
}
function scheduleCacheRefresh(){
  cacheRefreshGuard.invalidate();
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

function quizLifecycleActive(){
  return Boolean(latestQuizLifecycle?.active);
}
function normalizeQuizCapacity(raw){
  if(!raw||typeof raw!=="object")return null;
  const capacity=Math.max(0,Number(raw.capacity||0));
  if(!capacity)return null;
  const activeGenerations=Math.max(0,Math.min(capacity,Number(raw.activeGenerations??raw.active_generations??0)));
  const availableSlots=Math.max(0,Math.min(capacity,Number(raw.availableSlots??raw.available_slots??(capacity-activeGenerations))));
  const generationEnabled=raw.generationEnabled??raw.generation_enabled;
  return{
    capacity,
    activeGenerations,
    availableSlots,
    full:availableSlots<=0,
    slotReady:(generationEnabled!==false)&&availableSlots>0,
    generationEnabled:generationEnabled!==false,
    leaseMs:Math.max(0,Number(raw.leaseMs??raw.lease_ms??0))
  };
}
function selectedQuizIdentity(){
  return{code:normalizedCode(),module:Number(el("quizModule").value)};
}
function quizDeviceGenerationBlocksSelected(){
  if(!latestQuizDeviceGeneration?.active||latestQuizBankStatus?.ready===true)return false;
  return true;
}
function quizDefaultButtonLabel(){
  const quality=latestQuizSourceStatus?.quality||null;
  const pages=Number(latestQuizSourceStatus?.pageCount||quality?.pageCount||0);
  return quality?.level==="limited"
    ?(pages>0&&pages<=2?"Tetap gunakan":"Tetap buat Quiz")
    :"Mulai Quiz Telegram";
}
function renderQuizSlotStatus(){
  const box=el("quizSlotStatus");
  if(!box)return;
  const capacity=latestQuizCapacity;
  if(!capacity){
    box.textContent="Slot pembuatan Quiz: memeriksa...";
    return;
  }
  if(!capacity.generationEnabled){
    box.textContent="Pembuatan bank Quiz baru sedang dinonaktifkan.";
    return;
  }
  box.textContent=capacity.availableSlots>0
    ?`🟢 Slot pembuatan Quiz tersedia • ${capacity.availableSlots}/${capacity.capacity} kosong`
    :`🟡 Semua ${capacity.capacity} slot pembuatan Quiz sedang digunakan`;
}
function renderQuizSourceState(){
  const r=latestQuizSourceStatus;
  el("startQuiz").textContent=quizDefaultButtonLabel();
  if(!r){
    el("redownloadQuizModule").style.display="none";
    return;
  }
  const quality=r?.quality||null;
  const pages=Number(r?.pageCount||quality?.pageCount||0);
  el("redownloadQuizModule").style.display=(!r?.sourceAvailable||quality?.level==="invalid"||quality?.level==="limited")?"block":"none";
  if(!r?.sourceAvailable){
    el("quizNotice").textContent=`M${Number(el("quizModule").value)} belum siap untuk Quiz. Unduh ulang modul ini sekali untuk menyiapkan materi Quiz lokal.`;
  }else if(quality?.level==="invalid"){
    el("quizNotice").textContent=pages===1
      ?"⛔ Hanya 1 halaman yang terbaca. Coba unduh ulang modul."
      :`⛔ Modul terdeteksi tidak lengkap${pages?` • ${pages} halaman terbaca`:""}. Coba unduh ulang modul.`;
  }else if(quality?.level==="limited"){
    if(pages>0&&pages<=2){
      el("quizNotice").textContent=
        `⚠️ Hanya ${pages} halaman yang terbaca, tetapi materinya masih dapat digunakan. Quiz mungkin lebih pendek.`;
    }else{
      const detail=quality?.reason==="reference_heavy"
        ?"Materi yang terbaca banyak berupa daftar pustaka/referensi."
        :quality?.reason==="repetitive_text"
          ?"Materi yang terbaca banyak berisi teks berulang."
          :"Materi yang terbaca terlihat sedikit.";
      el("quizNotice").textContent=`⚠️ ${detail} Quiz mungkin memiliki lebih sedikit soal.`;
    }
  }else{
    el("quizNotice").textContent=`✓ Materi cukup${pages?` • ${pages} halaman terbaca`:""}. Quiz siap dimainkan di Telegram.`;
  }
}
function renderQuizAvailabilityState(){
  if(latestQuizLifecycle)return;
  const moduleNo=Number(el("quizModule").value);
  if(!Number.isInteger(moduleNo))return;
  if(latestQuizBankStatus?.ready===true){
    el("redownloadQuizModule").style.display="none";
    el("startQuiz").textContent="Mulai Quiz Telegram";
    el("quizNotice").textContent=`✓ Bank soal M${moduleNo} sudah tersedia. Quiz bisa langsung dimainkan.`;
    return;
  }
  if(latestQuizBankStatus?.ready===false&&latestQuizBankStatus?.generationAvailable===false){
    el("startQuiz").textContent="Mulai Quiz Telegram";
    el("quizNotice").textContent=`Bank soal M${moduleNo} belum tersedia dan pembuatan bank baru sedang dinonaktifkan.`;
    return;
  }
  if(latestQuizBankStatus?.ready===false&&quizDeviceGenerationBlocksSelected()){
    const activeModule=Number(latestQuizDeviceGeneration?.module||0);
    el("startQuiz").textContent="Menunggu proses lain...";
    el("quizNotice").textContent=activeModule===moduleNo
      ?`Bank soal M${moduleNo} sedang disiapkan. Kamu bisa memilih modul lain yang bank soalnya sudah tersedia.`
      :`Bank soal M${activeModule||"lain"} masih disiapkan. Kamu tetap bisa memainkan modul yang bank soalnya sudah tersedia.`;
    return;
  }
  if(latestQuizBankStatus?.ready===false&&latestQuizCapacity?.full){
    el("startQuiz").textContent="Menunggu slot...";
    el("quizNotice").textContent=`Semua ${latestQuizCapacity.capacity} slot pembuatan Quiz sedang digunakan. Tombol akan aktif saat slot tersedia.`;
    return;
  }
  renderQuizSourceState();
}
function updateQuizControls(){
  const hasModule=Number.isInteger(Number(el("quizModule").value));
  const locked=Boolean(latestState?.running)||Boolean(latestVersionPolicy?.updateRequired);
  const lifecycleLocked=quizLifecycleActive();
  const invalidSource=latestQuizSourceStatus?.quality?.level==="invalid";
  const needsGeneration=latestQuizBankStatus?.ready===false;
  const generationDisabled=needsGeneration&&latestQuizBankStatus?.generationAvailable===false;
  const capacityBlocked=needsGeneration&&Boolean(latestQuizCapacity?.full);
  const deviceBlocked=needsGeneration&&quizDeviceGenerationBlocksSelected();
  el("quizModule").disabled=locked||!latestCacheInfo.modules.length;
  el("startQuiz").disabled=locked||lifecycleLocked||!hasModule||invalidSource||generationDisabled||capacityBlocked||deviceBlocked;
  el("redownloadQuizModule").disabled=locked||lifecycleLocked||Boolean(latestQuizDeviceGeneration?.active)||!hasModule;
}
function renderQuizModules(modules){
  const select=el("quizModule");
  const previous=Number(select.value)||Number(restoredQuizModule)||0;
  select.textContent="";
  for(const moduleNo of modules){
    const option=document.createElement("option");
    option.value=String(moduleNo);
    option.textContent=`M${moduleNo}`;
    select.append(option);
  }
  if(modules.includes(previous))select.value=String(previous);
  if(Number.isInteger(Number(select.value)))restoredQuizModule=Number(select.value);
  el("quizCard").style.display=modules.length?"block":"none";
  if(!modules.length){
    el("quizNotice").textContent="";
    if(el("quizSlotStatus"))el("quizSlotStatus").textContent="";
  }
  updateQuizControls();
}
function renderQuizLifecycle(lifecycle){
  latestQuizLifecycle=lifecycle&&typeof lifecycle==="object"?lifecycle:null;
  if(!latestQuizLifecycle){
    renderQuizAvailabilityState();
    updateQuizControls();
    return false;
  }
  const phase=String(latestQuizLifecycle.phase||"");
  let message=String(latestQuizLifecycle.message||"");
  if(
    phase==="generating_bank"&&
    Number(latestQuizLifecycle.updatedAt||0)>0&&
    Date.now()-Number(latestQuizLifecycle.updatedAt)>=120000
  ){
    message=`Bank soal M${latestQuizLifecycle.module} masih disiapkan. Proses membutuhkan waktu lebih lama dari biasanya dan dapat berlangsung hingga sekitar 10 menit.`;
  }
  el("quizNotice").textContent=message;
  if(latestQuizLifecycle.active){
    el("startQuiz").textContent=phase==="generating_bank"?"Menyiapkan Quiz...":"Memproses Quiz...";
  }else{
    el("startQuiz").textContent="Mulai Quiz Telegram";
  }
  updateQuizControls();
  return true;
}

async function refreshQuizLifecycleStatus(){
  const code=normalizedCode();
  const moduleNo=Number(el("quizModule").value);
  if(!validCode(code)||!Number.isInteger(moduleNo)){
    latestQuizLifecycle=null;
    return false;
  }
  const r=await send("GET_QUIZ_LIFECYCLE",{code,module:moduleNo});
  if(!r?.ok)throw new Error(r?.error||"Status proses Quiz tidak dapat dibaca.");
  if(!r.lifecycle){
    latestQuizLifecycle=null;
    renderQuizAvailabilityState();
    updateQuizControls();
    return false;
  }
  return renderQuizLifecycle(r.lifecycle);
}

async function refreshQuizBankStatus(){
  const code=normalizedCode();
  const moduleNo=Number(el("quizModule").value);
  if(!validCode(code)||!Number.isInteger(moduleNo)){
    latestQuizBankStatus=null;
    return null;
  }
  const r=await send("GET_QUIZ_BANK_STATUS",{code,module:moduleNo});
  if(!r?.ok)throw new Error(r?.error||"Status bank soal tidak dapat diperiksa.");
  latestQuizBankStatus=r;
  latestQuizCapacity=normalizeQuizCapacity(r.generationCapacity)||latestQuizCapacity;
  latestQuizDeviceGeneration=r.deviceGeneration||null;
  renderQuizSlotStatus();
  renderQuizAvailabilityState();
  updateQuizControls();
  return r;
}

async function refreshQuizGenerationStatus(){
  if(el("quizCard").style.display==="none")return null;
  const r=await send("GET_QUIZ_GENERATION_STATUS");
  if(!r?.ok)throw new Error(r?.error||"Status slot Quiz tidak dapat dibaca.");
  latestQuizCapacity=normalizeQuizCapacity(r.generationCapacity)||latestQuizCapacity;
  latestQuizDeviceGeneration=r.deviceGeneration||null;
  renderQuizSlotStatus();
  renderQuizAvailabilityState();
  updateQuizControls();
  return r;
}

async function refreshQuizSourceStatus(){
  const code=normalizedCode();
  const moduleNo=Number(el("quizModule").value);
  latestQuizSourceStatus=null;
  latestQuizBankStatus=null;
  latestQuizLifecycle=null;
  el("startQuiz").textContent="Mulai Quiz Telegram";
  el("redownloadQuizModule").textContent="Unduh ulang modul ini";
  if(!validCode(code)||!Number.isInteger(moduleNo)){
    el("quizNotice").textContent="";
    updateQuizControls();
    return;
  }
  el("quizNotice").textContent=`Memeriksa kesiapan Quiz M${moduleNo}...`;
  try{
    const r=await send("GET_QUIZ_SOURCE_STATUS",{code,module:moduleNo});
    latestQuizSourceStatus=r||null;
    renderQuizSourceState();
  }catch(e){
    latestQuizSourceStatus=null;
    el("redownloadQuizModule").style.display="none";
    el("startQuiz").textContent="Mulai Quiz Telegram";
    el("quizNotice").textContent=String(e?.message||e);
  }
  await refreshQuizBankStatus().catch(()=>{});
  await refreshQuizLifecycleStatus().catch(()=>{});
  updateQuizControls();
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
  el("clearAllCache").disabled=locked||latestStorageInfo.totalBytes<=0;
  updateExportControls();
  updatePrimaryAction();
  updateQuizControls();
  applyRestoreMutationGuardUi();
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
  const selectionKey=cacheRefreshSelectionKey();
  const refreshTicket=cacheRefreshGuard.begin(selectionKey);
  const code=normalizedCode();
  const range=selectedRange();

  const r=await send("GET_CACHE_SNAPSHOT",{code});
  if(!r?.ok)throw new Error(r?.error||"Penyimpanan lokal tidak dapat dibaca.");
  if(!cacheRefreshGuard.isCurrent(refreshTicket,cacheRefreshSelectionKey()))return false;

  latestStorageInfo={
    totalBytes:Math.max(0,Number(r.totalBytes||0)),
    pdfCount:Math.max(0,Number(r.pdfCount||0)),
    code:validCode(code)?code:"",
    codeBytes:validCode(code)?Math.max(0,Number(r.codeBytes||0)):0
  };
  const hasStorage=latestStorageInfo.totalBytes>0;
  el("storageTotal").textContent=hasStorage
    ? `Total semua BMP: ${formatBytes(latestStorageInfo.totalBytes)}`
    : "Belum ada data lokal tersimpan.";
  el("clearAllExplain").textContent=hasStorage
    ? `Kosongkan ${formatBytes(latestStorageInfo.totalBytes)} data lokal dari semua BMP jika sudah tidak diperlukan. PDF yang sudah ada di folder Downloads, aktivasi, dan session tidak ikut dihapus.`
    : "";
  el("clearAllZone").style.display=hasStorage?"block":"none";

  if(!validCode(code)){
    latestCacheInfo={modules:[],bytes:0,totalBytes:0,detectedLastModule:null};
    latestCacheCode="";
    el("cacheTitle").textContent=code?"Kode BMP belum valid":"Masukkan kode BMP";
    el("cacheSummary").textContent="Data lokal BMP ini akan tampil di sini.";
    el("cacheModules").textContent="";
    el("planTitle").textContent="";
    el("planSkip").textContent="";
    el("planProcess").textContent="";
    el("currentStorageTools").style.display="none";
    el("storageTools").style.display="block";
    renderExportGrid([]);
    renderQuizModules([]);
    renderOptionHints();
    setFormLocked(Boolean(latestState?.running));
    return true;
  }

  const modules=Array.isArray(r.modules)?r.modules.map(Number).filter(Number.isInteger).sort((a,b)=>a-b):[];
  const codeBytes=latestStorageInfo.codeBytes;
  latestCacheInfo={
    modules,bytes:codeBytes,totalBytes:codeBytes,
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

  el("currentStorageTools").style.display=modules.length?"block":"none";
  el("storageTools").style.display="block";
  el("storageMeta").textContent=modules.length
    ? `${code}: ${formatBytes(latestCacheInfo.bytes)} • ${modules.length} modul tersimpan lokal. Pilih satu atau beberapa modul untuk membuat salinan baru di Downloads tanpa OCR ulang.`
    : "";
  el("clearExplain").textContent=modules.length
    ? `Kosongkan ${formatBytes(latestCacheInfo.bytes)} data lokal ${code} jika sudah tidak diperlukan. PDF yang sudah ada di folder Downloads tidak ikut dihapus.`
    : "";
  renderExportGrid(modules);
  renderQuizModules(modules);
  renderOptionHints();
  setFormLocked(Boolean(latestState?.running));
  if(modules.length)refreshQuizSourceStatus().catch(()=>{});
  return true;
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
function jobUxState(s){
  const x=String(s?.status||"IDLE");
  if(!s?.running&&x==="IDLE")return "";
  if(x==="DONE"||x==="MAX_MODULE_REACHED"||x==="END_CANDIDATE"||(x.startsWith("M")&&x.endsWith("_PDF_READY")))return "success";
  if(x==="ERROR")return "error";
  if(x==="MISSING_GAP"||x==="LOGIN_REQUIRED"||x==="BLOCKED"||x==="STOPPED_BY_USER")return "warning";
  if(s?.running)return "waiting";
  return "";
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

  const supporterBadge=el("supporterBadge");
  const supporter=a.supporter||null;
  if(
    a.active&&
    supporter?.active&&
    Number(supporter.until||0)>Date.now()
  ){
    const label=String(supporter.label||"BMP Supporter").trim()||"BMP Supporter";
    supporterBadge.textContent=`⭐ ${label} aktif hingga ${formatDate(supporter.until)}`;
    supporterBadge.style.display="inline-flex";
  }else{
    supporterBadge.textContent="";
    supporterBadge.style.display="none";
  }

  if(a.active&&!a.reviewer){
    const pendingRefresh=Boolean(a.pending);
    el("refreshActivation").disabled=Boolean(latestVersionPolicy?.updateRequired);
    if(pendingRefresh){
      el("activationManage").style.display="block";
      el("activationManageText").textContent=
        "Menunggu verifikasi ulang untuk menyinkronkan akun BMP Terbuka kamu.";
      el("activationManageCode").textContent=a.pending?.pairId
        ? `Kode verifikasi: ${a.pending.pairId}`
        : "";
      el("refreshActivation").style.display="block";
      el("refreshActivation").textContent="Buka Telegram lagi";
    }else if(a.refreshEligible){
      el("activationManage").style.display="none";
      el("activationManageText").textContent="";
      el("activationManageCode").textContent="";
      el("refreshActivation").style.display="none";
    }else{
      el("activationManage").style.display="block";
      el("activationManageText").textContent=
        "Verifikasi ulang sekali untuk memperbarui aktivasi dan menyinkronkan akun BMP Terbuka kamu. Akses yang masih aktif tetap berlaku selama proses.";
      el("activationManageCode").textContent="";
      el("refreshActivation").style.display="block";
      el("refreshActivation").textContent="Verifikasi ulang";
    }
  }else{
    el("activationManage").style.display="none";
  }

  reportVisibleCardImpression();
  return a;
}
async function refreshState(){
  const r=await send("GET_STATE");
  const s=r?.state||{};
  latestState=s;
  const [title,text]=humanStatus(s);
  el("statusTitle").textContent=title;
  el("statusText").textContent=text;
  setUxState(el("status"),jobUxState(s));

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
  el("runReviewSample").disabled=Boolean(s.running);
  setFormLocked(Boolean(s.running));

  if(lastRunning&&!s.running){
    await refreshCachePreview();
  }
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
const SUPPORT_DEEP_LINK="https://t.me/bukabmp_bot?start=support";
el("donateLink").addEventListener("click",()=>send("EXECUTE_CLOUD_ACTION",{
  action:{type:"OPEN_URL",label:"Donasi",url:SUPPORT_DEEP_LINK}
}));

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
  if(!a?.pending)return a;

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

async function refreshActivationNow({quiet=false,force=true}={}){
  const access=latestAccess||await send("GET_ACCESS_STATUS");
  if(!access?.active||access?.reviewer)return access;

  const button=el("refreshActivation");
  button.disabled=true;
  try{
    if(access.pending){
      await send("OPEN_PENDING_TELEGRAM");
      if(!quiet){
        el("activationManageText").textContent=
          "Telegram dibuka lagi. Selesaikan verifikasi lalu kembali ke popup.";
      }
      return access;
    }

    if(!access.refreshEligible){
      if(!quiet){
        el("activationManageText").textContent=
          "Menyiapkan verifikasi ulang untuk menyinkronkan akun dan aktivasi. Akses yang masih aktif tetap berlaku selama proses.";
      }
      const r=await send("START_PAIRING");
      if(!r?.ok)throw new Error(r?.error||"Verifikasi ulang tidak dapat dimulai.");
      await refreshAccess();
      return latestAccess;
    }

    if(!quiet){
      el("activationManageText").textContent="Memeriksa pembaruan aktivasi...";
    }
    const r=await send("REFRESH_ACTIVATION",{force});
    if(!r?.ok)throw new Error(r?.error||"Aktivasi belum dapat diperbarui.");
    const result=r.result||{};
    await refreshAccess();
    if(!quiet){
      el("activationManageText").textContent=result.status==="throttled"
        ? "Aktivasi sudah diperiksa baru-baru ini."
        : result.changed
          ? `Aktivasi diperbarui sampai ${formatDate(result.expiresAt)}.`
          : "Aktivasi sudah menggunakan masa berlaku terbaru.";
    }
    return latestAccess;
  }catch(e){
    if(!quiet){
      el("activationManageText").textContent=
        "Pembaruan aktivasi belum berhasil: "+String(e?.message||e);
    }
    return latestAccess;
  }finally{
    button.disabled=Boolean(latestVersionPolicy?.updateRequired);
  }
}

el("refreshActivation").addEventListener("click",()=>refreshActivationNow({
  quiet:false,
  force:true
}));

el("adInterstitialClose").addEventListener("click",()=>hideAdInterstitial());
el("adInterstitialCta").addEventListener("click",async()=>{
  const button=el("adInterstitialCta");
  const ad=activeInterstitialAd;
  if(!ad?.cta)return;
  const originalLabel=String(ad.cta.label||"Hubungi");
  button.disabled=true;
  try{
    await executeAdCta(ad);
    if(!ad.isHouse)reportAdEvent("click",ad,"interstitial","cta");
    hideAdInterstitial({report:false});
  }catch(e){
    button.textContent=String(e?.message||e).slice(0,80);
    setTimeout(()=>{
      if(activeInterstitialAd===ad)button.textContent=originalLabel;
    },1400);
  }finally{
    button.disabled=false;
  }
});

el("start").addEventListener("click",async()=>{
  if(!await requireNoActiveAndroidRestore({surface:"status"}))return;
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
    setUtilityNotice(`${rangeLabel(plan.available)} sudah tersedia. Pilih modul lalu tekan Ekspor untuk membuat salinan baru di Downloads.`,"info");
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
  el("start").disabled=true;
  try{
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
    }else{
      scheduleJobStartedInterstitial().catch(()=>{});
    }
  }catch(e){
    el("statusTitle").textContent="Gagal memulai";
    el("statusText").textContent=String(e?.message||e);
  }finally{
    await refreshState();
  }
});

el("quizModule").addEventListener("change",()=>{
  restoredQuizModule=Number(el("quizModule").value)||null;
  latestQuizSourceStatus=null;
  latestQuizBankStatus=null;
  latestQuizLifecycle=null;
  el("startQuiz").textContent="Mulai Quiz Telegram";
  el("redownloadQuizModule").style.display="none";
  scheduleDraftSave();
  refreshQuizSourceStatus().catch(()=>{});
});
el("redownloadQuizModule").addEventListener("click",()=>{
  const moduleNo=Number(el("quizModule").value);
  if(!Number.isInteger(moduleNo))return;
  el("startModule").value=String(moduleNo);
  el("maxModule").value=String(moduleNo);
  el("redownload").checked=true;
  renderOptionHints();
  updatePrimaryAction();
  el("quizNotice").textContent=`M${moduleNo} dipilih untuk diunduh ulang. Tekan “Download ulang modul dipilih”.`;
  el("start").focus();
});
el("startQuiz").addEventListener("click",async()=>{
  const code=normalizedCode();
  const moduleNo=Number(el("quizModule").value);
  if(!validCode(code)||!Number.isInteger(moduleNo))return;
  const selectionMatches=()=>normalizedCode()===code&&Number(el("quizModule").value)===moduleNo;
  if(selectionMatches()){
    el("startQuiz").disabled=true;
    el("quizNotice").textContent=`Memeriksa bank soal M${moduleNo}...`;
  }
  try{
    const bank=await send("GET_QUIZ_BANK_STATUS",{code,module:moduleNo});
    if(!bank?.ok)throw new Error(bank?.error||"Status bank soal tidak dapat diperiksa.");

    if(selectionMatches()){
      latestQuizBankStatus=bank;
      latestQuizCapacity=normalizeQuizCapacity(bank.generationCapacity)||latestQuizCapacity;
      latestQuizDeviceGeneration=bank.deviceGeneration||null;
      renderQuizSlotStatus();
    }

    if(bank.ready){
      if(selectionMatches()){
        el("startQuiz").textContent="Membuka Quiz...";
        el("quizNotice").textContent=`✓ Bank soal M${moduleNo} tersedia. Membuka Quiz di Telegram...`;
      }
    }else{
      const capacity=normalizeQuizCapacity(bank.generationCapacity);
      const activeGeneration=bank.deviceGeneration;
      if(activeGeneration?.active){
        if(selectionMatches()){
          latestQuizDeviceGeneration=activeGeneration;
          renderQuizAvailabilityState();
          updateQuizControls();
        }
        return;
      }
      if(capacity?.full){
        if(selectionMatches()){
          latestQuizCapacity=capacity;
          renderQuizSlotStatus();
          renderQuizAvailabilityState();
          updateQuizControls();
        }
        return;
      }
      if(bank.generationAvailable){
        if(selectionMatches()){
          el("startQuiz").textContent="Menyiapkan Quiz...";
          el("quizNotice").textContent=
            `Bank soal M${moduleNo} belum tersedia. Sedang menyiapkan bank soal dari materi modul. Biasanya selesai dalam 1–2 menit, tetapi pada kondisi tertentu dapat memakan waktu hingga sekitar 10 menit.`;
        }
      }else{
        throw new Error("Bank soal belum tersedia dan pembuatan bank baru sedang dinonaktifkan.");
      }
    }

    const r=await send("START_TELEGRAM_QUIZ",{code,module:moduleNo});
    if(!r?.ok){
      if(r?.activeGeneration?.active&&selectionMatches()){
        latestQuizDeviceGeneration=r.activeGeneration;
      }
      throw new Error(r?.error||"Quiz Telegram tidak dapat dimulai.");
    }
    if(selectionMatches()){
      await refreshQuizLifecycleStatus().catch(()=>{});
      el("quizNotice").textContent=r.queued
        ?r.alreadyQueued
          ?`Quiz ${code} M${moduleNo} sudah menunggu di antrian #${r.queuePosition||1}.`
          :`Quiz ${code} M${moduleNo} masuk antrian #${r.queuePosition||1}. Menunggu slot Quiz kosong.`
        :r.alreadyActive
          ?"Quiz modul ini sudah sedang berjalan. Ronde yang aktif dibuka di Telegram."
          :r.bankCreated
            ?"✓ Quiz siap. Soal baru dibuat dan ronde dibuka di Telegram."
            :"✓ Quiz siap. Soal yang sudah tersedia dipakai lagi. Ronde dibuka di Telegram.";
    }
  }catch(e){
    if(selectionMatches()){
      await refreshQuizLifecycleStatus().catch(()=>{});
      const message=String(e?.message||e);
      if(latestQuizLifecycle?.message){
        el("quizNotice").textContent=latestQuizLifecycle.message;
      }else if(message==="quiz_generation_device_busy"){
        renderQuizAvailabilityState();
      }else{
        el("quizNotice").textContent=
          message==="quiz_disabled"||message==="quiz_gameplay_disabled"
            ?"Quiz V0 belum diaktifkan oleh pengelola."
            :message==="quiz_audience_denied"
              ?"Akun Telegram ini belum mendapat akses uji coba Quiz."
              :message==="quiz_source_hash_mismatch"
                ?"Materi Quiz perlu disiapkan ulang. Coba download ulang modul ini sekali."
                :message;
      }
    }
  }finally{
    await refreshQuizGenerationStatus().catch(()=>{});
    if(selectionMatches()){
      await refreshQuizBankStatus().catch(()=>{});
      await refreshQuizLifecycleStatus().catch(()=>{});
      if(!latestQuizLifecycle)renderQuizAvailabilityState();
    }
    updateQuizControls();
  }
});

el("backupLocalData").addEventListener("click",async()=>{
  if(!await requireNoActiveAndroidRestore({surface:"utility"}))return;
  localBackupOperationCancelled=false;
  localBackupOperationInFlight=true;
  el("backupLocalData").disabled=true;
  el("restoreLocalData").disabled=true;
  setBackupNoticeState("Menyiapkan backup data lokal...","waiting");
  await writeLocalBackupOperation({
    id:`backup:${crypto.randomUUID()}`,
    kind:"backup",
    phase:"backing_up",
    progress:"Menyiapkan backup data lokal...",
    lastError:"",
    startedAt:Date.now()
  });
  try{
    const result=await createLocalBackup();
    const progress=`Backup v${result.backupVersion} siap: ${result.pdfs} PDF • ${formatBytes(result.bytes)} data lokal. Token aktivasi/session tidak ikut. Simpan file ini secara pribadi karena berisi salinan materi lokal.`;
    await writeLocalBackupOperation({phase:"completed",progress,lastError:"",completedAt:Date.now(),result});
    setBackupNoticeState(progress,"success");
  }catch(e){
    const error=String(e?.message||e);
    await writeLocalBackupOperation({phase:"error",progress:"Backup gagal.",lastError:error,failedAt:Date.now()});
    setBackupNoticeState(error,"error");
  }finally{
    localBackupOperationInFlight=false;
    await refreshLocalBackupOperation().catch(()=>{});
    await refreshStorageProtection().catch(()=>{});
  }
});

el("restoreLocalData").addEventListener("click",()=>{
  if(!platformReady){
    setBackupNoticeState("Menyiapkan jalur restore...","waiting");
    return;
  }
  if(isAndroidPlatform()){
    void openAndroidRestoreTab().catch(error=>{
      setBackupNoticeState("Tab restore tidak dapat dibuka. "+String(error?.message||error),"error");
    });
    return;
  }
  el("restoreLocalFile").value="";
  el("restoreLocalFile").click();
});
el("restoreLocalFile").addEventListener("change",async()=>{
  const file=el("restoreLocalFile").files?.[0]||null;
  if(!file)return;
  localBackupOperationCancelled=false;
  localBackupOperationInFlight=true;
  activeRestoreEngineSession=RESTORE_ENGINE.createSession();
  el("backupLocalData").disabled=true;
  el("restoreLocalData").disabled=true;
  const operationId=`restore:${crypto.randomUUID()}`;
  await writeLocalBackupOperation({
    id:operationId,
    kind:"restore",
    phase:"validating",
    progress:"Memvalidasi backup...",
    lastError:"",
    sourceName:file.name,
    sourceSize:file.size,
    startedAt:Date.now()
  });
  setBackupNoticeState("Memvalidasi backup...","waiting");
  try{
    const result=await activeRestoreEngineSession.restore(file,{
      onProgress:async progress=>{
        await writeLocalBackupOperation({phase:"restoring",progress,lastError:""});
        setBackupNoticeState(progress,"waiting");
      }
    });
    const progress=`Restore backup v${result.backupVersion} selesai: ${result.pdfs} PDF dan data lokal dipulihkan.${result.backupVersion===1?" Buat backup baru setelah ini agar memakai format terbaru.":""}`;
    await writeLocalBackupOperation({phase:"completed",progress,lastError:"",completedAt:Date.now(),result});
    setBackupNoticeState(progress,"success");
    await loadDraft();
    await refreshCachePreview();
  }catch(e){
    const error=String(e?.message||e);
    const cancelled=activeRestoreEngineSession?.isCancelled?.()===true;
    await writeLocalBackupOperation({
      phase:cancelled?"cancelled":"error",
      progress:cancelled?"Restore dihentikan.":"Restore gagal.",
      lastError:cancelled?"":error,
      failedAt:Date.now()
    });
    setBackupNoticeState(cancelled?"Restore dihentikan.":error,cancelled?"warning":"error");
  }finally{
    await send("LOCAL_CACHE_MUTATED").catch(()=>{});
    activeRestoreEngineSession=null;
    localBackupOperationInFlight=false;
    el("restoreLocalFile").value="";
    await refreshLocalBackupOperation().catch(()=>{});
  }
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
      setUtilityNotice(`Mengekspor M${moduleNo} (${i+1}/${modules.length})...`,"waiting");
      const r=await send("EXPORT_CACHED_MODULE",{code,module:moduleNo});
      if(!r?.ok)throw new Error(r?.error||`Ekspor Modul ${moduleNo} gagal.`);
    }
    setUtilityNotice(`${modules.length} PDF diekspor dari penyimpanan lokal tanpa OCR ulang.`,"success");
  }catch(e){
    setUtilityNotice(String(e?.message||e),"error");
  }finally{
    setFormLocked(Boolean(latestState?.running));
  }
});

el("clearCache").addEventListener("click",async()=>{
  if(!await requireNoActiveAndroidRestore({surface:"utility"}))return;
  const code=normalizedCode();
  if(!validCode(code)||!latestCacheInfo.modules.length)return;
  const size=formatBytes(latestCacheInfo.bytes);
  if(!confirm(`Kosongkan ${size} data lokal BMP Terbuka untuk ${code}?\n\nPDF yang sudah ada di folder Downloads tidak akan dihapus.`))return;
  el("clearCache").disabled=true;
  setUtilityNotice(`Mengosongkan data lokal ${code}...`,"warning");
  try{
    const r=await send("CLEAR_CACHE_CODE",{code});
    if(!r?.ok)throw new Error(r?.error||"Penyimpanan tidak dapat dikosongkan.");
    setUtilityNotice(`Data lokal ${code} sudah dikosongkan. PDF di Downloads tetap ada.`,"success");
    el("storageTools").open=false;
    await refreshCachePreview();
  }catch(e){setUtilityNotice(String(e?.message||e),"error")}
  finally{setFormLocked(Boolean(latestState?.running))}
});

el("clearAllCache").addEventListener("click",async()=>{
  if(!await requireNoActiveAndroidRestore({surface:"utility"}))return;
  const totalBytes=Math.max(0,Number(latestStorageInfo.totalBytes||0));
  if(totalBytes<=0)return;
  const size=formatBytes(totalBytes);
  if(!confirm(`Kosongkan ${size} seluruh data lokal BMP Terbuka dari semua kode BMP?\n\nPDF yang sudah ada di folder Downloads, aktivasi, dan session tidak akan dihapus.`))return;
  el("clearAllCache").disabled=true;
  el("clearCache").disabled=true;
  el("backupLocalData").disabled=true;
  el("restoreLocalData").disabled=true;
  setUtilityNotice("Mengosongkan seluruh penyimpanan lokal...","warning");
  try{
    const r=await send("CLEAR_ALL_CACHE");
    if(!r?.ok)throw new Error(r?.error||"Seluruh penyimpanan lokal tidak dapat dikosongkan.");
    setUtilityNotice("Semua data lokal BMP Terbuka sudah dikosongkan. PDF di Downloads, aktivasi, dan session tetap ada.","success");
    await refreshCachePreview();
  }catch(e){
    setUtilityNotice(String(e?.message||e),"error");
  }finally{
    el("backupLocalData").disabled=false;
    el("restoreLocalData").disabled=false;
    setFormLocked(Boolean(latestState?.running));
  }
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
el("securityLink").addEventListener("click",()=>chrome.tabs.create({url:"https://mentaliss.github.io/bukabmp/id/security/"}));
el("privacyLink").addEventListener("click",()=>chrome.tabs.create({url:"https://mentaliss.github.io/bukabmp/id/privacy/"}));
el("responsibleUseLink").addEventListener("click",()=>chrome.tabs.create({url:"https://mentaliss.github.io/bukabmp/id/responsible-use/"}));
el("termsLink").addEventListener("click",()=>chrome.tabs.create({url:"https://mentaliss.github.io/bukabmp/id/terms/"}));

(async()=>{
  reportTelemetry("extension_open");
  await resolvePlatformOnce();
  await refreshAndroidRestoreGuard();
  latestStorageProtection=await storageProtectionSnapshot({requestPersistence:true}).catch(()=>null);
  renderStorageProtection(latestStorageProtection);
  await cleanupOrphanedLocalBackupTemps();
  await refreshStorageProtection().catch(()=>{});
  await loadDraft();
  await refreshCloudSurface({force:true});
  await refreshAccess();
  await refreshVersion();
  if(latestAccess?.active&&latestAccess?.refreshEligible&&!latestAccess?.reviewer){
    await refreshActivationNow({quiet:true,force:false});
  }
  await refreshState();
  await refreshCachePreview();
  await refreshLocalBackupOperation();
  setInterval(async()=>{await refreshAccess();await refreshState();await refreshLocalBackupOperation();await refreshAndroidRestoreGuard()},1000);
  setInterval(()=>{
    if(el("quizCard").style.display!=="none"){
      refreshQuizLifecycleStatus().catch(()=>{});
    }
  },1500);
  setInterval(()=>{
    if(el("quizCard").style.display!=="none"){
      refreshQuizGenerationStatus().catch(()=>{});
    }
  },2000);
  // While the popup is open, keep campaign/card control near-realtime.
  // Popup open/focus always bypasses cache; periodic refresh is a light safety net.
  setInterval(()=>refreshCloudSurface({force:true}).catch(()=>{}),10_000);
  window.addEventListener("focus",()=>refreshCloudSurface({force:true}).catch(()=>{}));
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible")refreshCloudSurface({force:true}).catch(()=>{});
  });
  setInterval(async()=>{
    const a=await send("GET_ACCESS_STATUS");
    if(a?.pending)await checkPendingActivation({quiet:true});
  },2000);
})();
