(function(global){
  "use strict";

  const KEY="bmpAndroidRestoreSessionV1";
  const RESTORE_URL=chrome.runtime.getURL("restore.html");
  const OPENING_STALE_MS=15_000;

  function area(){
    return chrome.storage.session||chrome.storage.local;
  }

  async function read(){
    const stored=await area().get(KEY);
    const value=stored?.[KEY];
    return value&&typeof value==="object"?value:null;
  }

  async function write(value){
    await area().set({[KEY]:value});
    return value;
  }

  async function removeIfOwned(ownerToken){
    const current=await read();
    if(!current||current.ownerToken!==ownerToken)return false;
    await area().remove(KEY);
    return true;
  }

  function isRestoreUrl(url){
    return String(url||"").startsWith(RESTORE_URL);
  }

  function ownerFromUrl(url){
    try{
      const parsed=new URL(String(url||""));
      return parsed.pathname.endsWith("/restore.html")
        ?String(parsed.searchParams.get("owner")||"")
        :"";
    }catch(_){
      return "";
    }
  }

  async function getTab(tabId){
    if(!Number.isInteger(Number(tabId)))return null;
    try{
      const tab=await chrome.tabs.get(Number(tabId));
      return tab&&isRestoreUrl(tab.url)?tab:null;
    }catch(_){
      return null;
    }
  }

  async function findRestoreTabs(){
    const tabs=await chrome.tabs.query({});
    return (tabs||[]).filter(tab=>Number.isInteger(tab?.id)&&isRestoreUrl(tab?.url));
  }

  async function focusTab(tabId){
    const tab=await getTab(tabId);
    if(!tab)return null;
    try{await chrome.tabs.update(tab.id,{active:true})}catch(_){}
    if(Number.isInteger(tab.windowId)){
      try{await chrome.windows.update(tab.windowId,{focused:true})}catch(_){}
    }
    return tab;
  }

  async function recoverStale(){
    const current=await read();
    if(!current)return null;

    const tab=await getTab(current.tabId);
    if(tab)return current;

    if(
      current.status==="opening"&&
      !Number.isInteger(Number(current.tabId))&&
      Date.now()-Number(current.updatedAt||current.startedAt||0)<=OPENING_STALE_MS
    ){
      return current;
    }

    const again=await read();
    if(
      again&&
      again.ownerToken===current.ownerToken&&
      Number(again.tabId||0)===Number(current.tabId||0)
    ){
      await area().remove(KEY);
    }
    return null;
  }

  async function adoptExistingTab(tab){
    if(!tab?.id)return null;
    const ownerToken=ownerFromUrl(tab.url)||crypto.randomUUID();
    const current=await recoverStale();
    if(current?.tabId&&Number(current.tabId)!==Number(tab.id)){
      const currentTab=await getTab(current.tabId);
      if(currentTab)return current;
    }
    const next={
      schemaVersion:1,
      ownerToken,
      tabId:Number(tab.id),
      status:"idle",
      startedAt:Number(current?.startedAt||Date.now()),
      updatedAt:Date.now()
    };
    await write(next);
    return next;
  }

  async function closeDuplicateTabs(keepTabId){
    const tabs=await findRestoreTabs();
    const extras=tabs.filter(tab=>Number(tab.id)!==Number(keepTabId)).map(tab=>tab.id);
    if(extras.length){
      try{await chrome.tabs.remove(extras)}catch(_){}
    }
  }

  async function openOrFocus(){
    const live=await recoverStale();
    if(live?.tabId){
      const tab=await focusTab(live.tabId);
      if(tab){
        await closeDuplicateTabs(tab.id);
        return {reused:true,tab,state:live};
      }
    }

    const existing=await findRestoreTabs();
    if(existing.length){
      const chosen=existing[0];
      const state=await adoptExistingTab(chosen);
      await focusTab(chosen.id);
      await closeDuplicateTabs(chosen.id);
      return {reused:true,tab:chosen,state};
    }

    const ownerToken=crypto.randomUUID();
    const opening={
      schemaVersion:1,
      ownerToken,
      tabId:null,
      status:"opening",
      startedAt:Date.now(),
      updatedAt:Date.now()
    };
    await write(opening);

    const tab=await chrome.tabs.create({
      url:RESTORE_URL+"?owner="+encodeURIComponent(ownerToken),
      active:true
    });

    const current=await read();
    if(!current||current.ownerToken!==ownerToken){
      if(tab?.id){
        try{await chrome.tabs.remove(tab.id)}catch(_){}
      }
      const latest=await recoverStale();
      if(latest?.tabId){
        const focused=await focusTab(latest.tabId);
        if(focused)return {reused:true,tab:focused,state:latest};
      }
      throw new Error("Sesi restore digantikan sebelum tab siap.");
    }

    const next={...current,tabId:Number(tab.id),status:"idle",updatedAt:Date.now()};
    await write(next);
    await closeDuplicateTabs(tab.id);
    return {reused:false,tab,state:next};
  }

  async function claimPage(ownerToken,tabId){
    if(!ownerToken||!Number.isInteger(Number(tabId)))return null;
    const current=await read();
    if(current&&current.ownerToken!==ownerToken)return null;
    const next={
      schemaVersion:1,
      ownerToken,
      tabId:Number(tabId),
      status:current?.status==="running"?"running":"idle",
      startedAt:Number(current?.startedAt||Date.now()),
      updatedAt:Date.now()
    };
    await write(next);
    return next;
  }

  async function updateIfOwned(ownerToken,tabId,patch){
    const current=await read();
    if(
      !current||
      current.ownerToken!==ownerToken||
      Number(current.tabId)!==Number(tabId)
    )return null;
    const next={...current,...patch,updatedAt:Date.now()};
    await write(next);
    return next;
  }

  async function startRun(ownerToken,tabId){
    return await updateIfOwned(ownerToken,tabId,{
      status:"running",
      startedAt:Date.now(),
      lastError:""
    });
  }

  async function finish(ownerToken,tabId,status,patch={}){
    if(!["completed","failed","cancelled","idle"].includes(status)){
      throw new Error("Status restore tidak valid.");
    }
    return await updateIfOwned(ownerToken,tabId,{status,...patch});
  }

  async function getLiveState(){
    return await recoverStale();
  }

  function isRunning(state){
    return Boolean(state&&state.status==="running");
  }

  global.BMP_RESTORE_SESSION=Object.freeze({
    KEY,
    RESTORE_URL,
    openOrFocus,
    claimPage,
    startRun,
    finish,
    getLiveState,
    isRunning,
    focusTab,
    removeIfOwned
  });
})(typeof self!=="undefined"?self:globalThis);
