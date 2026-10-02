"use strict";

const LOCAL_OPERATION_KEY="bmpLocalBackupOperationV1";
const RESTORE_SESSION=self.BMP_RESTORE_SESSION;
const restoreFile=document.getElementById("restoreFile");
const statusBox=document.getElementById("status");
const warning=document.getElementById("runningWarning");
const cancelButton=document.getElementById("cancel");
const closeButton=document.getElementById("close");

const ownerToken=String(new URL(location.href).searchParams.get("owner")||"");
let tabId=null;
let claimed=false;
let activeSession=null;
let running=false;

const RESTORE_UX_STATES=["state-waiting","state-success","state-warning","state-error","state-info"];
function setRestoreStatus(text,kind=""){
  statusBox.textContent=text;
  statusBox.classList.remove(...RESTORE_UX_STATES);
  if(kind&&RESTORE_UX_STATES.includes("state-"+kind))statusBox.classList.add("state-"+kind);
}

function setRunning(value){
  running=Boolean(value);
  restoreFile.disabled=!claimed||running;
  cancelButton.disabled=!running;
  warning.style.display=running?"block":"none";
}

async function writeOperation(patch){
  const current=(await chrome.storage.local.get(LOCAL_OPERATION_KEY))?.[LOCAL_OPERATION_KEY];
  const base=current&&typeof current==="object"?current:{schemaVersion:1};
  await chrome.storage.local.set({
    [LOCAL_OPERATION_KEY]:{...base,...patch,schemaVersion:1,updatedAt:Date.now()}
  });
}

async function readerJobRunning(){
  try{
    const response=await chrome.runtime.sendMessage({type:"GET_STATE"});
    return Boolean(response?.state?.running??response?.running);
  }catch(_){
    return false;
  }
}

async function notifyLocalCacheMutated(){
  try{await chrome.runtime.sendMessage({type:"LOCAL_CACHE_MUTATED"})}catch(_){}
}

async function claimOwnership(){
  if(!ownerToken){
    setRestoreStatus("Sesi restore tidak valid. Tutup tab ini lalu buka Pulihkan backup dari popup BMP Terbuka.","error");
    return false;
  }
  const tab=await chrome.tabs.getCurrent();
  tabId=Number(tab?.id);
  if(!Number.isInteger(tabId)){
    setRestoreStatus("Tab restore tidak dapat dikenali. Buka ulang Pulihkan backup dari popup.","error");
    return false;
  }
  const state=await RESTORE_SESSION.claimPage(ownerToken,tabId);
  if(!state){
    setRestoreStatus("Sesi restore ini sudah tidak aktif. Tutup tab ini lalu buka ulang dari popup.","warning");
    return false;
  }
  claimed=true;
  restoreFile.disabled=false;
  setRestoreStatus("Pilih file backup BMP Terbuka untuk memulai restore.");
  return true;
}

async function runRestore(file){
  if(!file||running||!claimed)return;

  if(await readerJobRunning()){
    setRestoreStatus("Selesaikan proses BMP yang sedang berjalan sebelum memulihkan backup.","warning");
    restoreFile.value="";
    return;
  }

  const ownership=await RESTORE_SESSION.startRun(ownerToken,tabId);
  if(!ownership){
    claimed=false;
    setRunning(false);
    setRestoreStatus("Sesi restore kehilangan kepemilikan. Tutup tab ini lalu buka ulang dari popup.","error");
    return;
  }

  activeSession=self.BMP_RESTORE_ENGINE.createSession();
  setRunning(true);
  const operationId=`restore-tab:${ownerToken}`;
  await writeOperation({
    id:operationId,
    kind:"restore",
    phase:"validating",
    progress:"Memvalidasi backup...",
    lastError:"",
    sourceName:file.name,
    sourceSize:file.size,
    startedAt:Date.now(),
    ownerToken
  });
  setRestoreStatus("Memvalidasi backup...","waiting");

  try{
    const result=await activeSession.restore(file,{
      onProgress:async progress=>{
        setRestoreStatus(progress,"waiting");
        await writeOperation({phase:"restoring",progress,lastError:""});
      }
    });
    const progress=`Restore backup v${result.backupVersion} selesai: ${result.pdfs} PDF dan data lokal dipulihkan.${result.backupVersion===1?" Buat backup baru setelah ini agar memakai format terbaru.":""}`;
    await writeOperation({phase:"completed",progress,lastError:"",completedAt:Date.now(),result});
    await RESTORE_SESSION.finish(ownerToken,tabId,"completed",{completedAt:Date.now()});
    setRestoreStatus(progress,"success");
  }catch(error){
    const message=String(error?.message||error);
    const cancelled=activeSession?.isCancelled?.()===true;
    const phase=cancelled?"cancelled":"error";
    const progress=cancelled?"Restore dihentikan.":"Restore gagal.";
    await writeOperation({
      phase,
      progress,
      lastError:cancelled?"":message,
      failedAt:Date.now()
    }).catch(()=>{});
    await RESTORE_SESSION.finish(
      ownerToken,
      tabId,
      cancelled?"cancelled":"failed",
      {lastError:cancelled?"":message,failedAt:Date.now()}
    ).catch(()=>{});
    setRestoreStatus(cancelled?"Restore dihentikan.":`Restore gagal. ${message}`,cancelled?"warning":"error");
  }finally{
    await notifyLocalCacheMutated();
    activeSession=null;
    setRunning(false);
    restoreFile.value="";
  }
}

restoreFile.addEventListener("change",()=>{
  const file=restoreFile.files?.[0]||null;
  if(file)void runRestore(file);
});

cancelButton.addEventListener("click",()=>{
  activeSession?.cancel?.();
  void RESTORE_SESSION.finish(ownerToken,tabId,"cancelled",{cancelledAt:Date.now()});
  setRestoreStatus("Menghentikan restore...","warning");
});

closeButton.addEventListener("click",async()=>{
  if(running){
    activeSession?.cancel?.();
    await RESTORE_SESSION.finish(ownerToken,tabId,"cancelled",{cancelledAt:Date.now()}).catch(()=>{});
  }
  await RESTORE_SESSION.removeIfOwned(ownerToken).catch(()=>{});
  window.close();
});

window.addEventListener("pagehide",()=>{
  if(running){
    activeSession?.cancel?.();
    void RESTORE_SESSION.finish(ownerToken,tabId,"cancelled",{cancelledAt:Date.now()});
  }
});

void claimOwnership();
