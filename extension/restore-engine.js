(function(global){
  "use strict";

  const LOCAL_BACKUP=global.BMP_LOCAL_BACKUP;
  const DB_NAME="bmp-terbuka-pdf-cache";
  const DB_VERSION=2;
  const DRAFT_KEY="bmpDraftV105";

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains("pdfs"))db.createObjectStore("pdfs");
        if(!db.objectStoreNames.contains("quiz_sources"))db.createObjectStore("quiz_sources");
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }

  function byteView(value){
    if(value instanceof Uint8Array)return value;
    if(value instanceof ArrayBuffer)return new Uint8Array(value);
    if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
    return null;
  }

  function recordsMatch(expected,actual){
    const a=byteView(expected);
    const b=byteView(actual);
    if(a||b){
      if(!a||!b||a.byteLength!==b.byteLength)return false;
      for(let i=0;i<a.byteLength;i++)if(a[i]!==b[i])return false;
      return true;
    }
    return JSON.stringify(expected)===JSON.stringify(actual);
  }

  async function readRecord(db,storeName,key){
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,"readonly");
      const req=tx.objectStore(storeName).get(key);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
      tx.onerror=()=>reject(tx.error);
    });
  }

  function createSession(){
    let cancelled=false;
    let activeTransaction=null;

    function assertActive(){
      if(cancelled)throw new Error("Operasi data lokal dibatalkan.");
    }

    function cancel(){
      cancelled=true;
      const tx=activeTransaction;
      activeTransaction=null;
      if(tx){
        try{tx.abort()}catch(_){}
      }
    }

    async function putVerified(db,storeName,key,value){
      assertActive();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(storeName,"readwrite");
        activeTransaction=tx;
        const clear=()=>{if(activeTransaction===tx)activeTransaction=null};
        tx.objectStore(storeName).put(value,key);
        tx.oncomplete=()=>{clear();resolve()};
        tx.onerror=()=>{clear();reject(tx.error)};
        tx.onabort=()=>{clear();reject(tx.error||new Error("Restore dibatalkan."))};
      });
      assertActive();
      const readBack=await readRecord(db,storeName,key);
      assertActive();
      if(!recordsMatch(value,readBack)){
        throw new Error("Verifikasi penyimpanan lokal gagal untuk "+key+".");
      }
    }

    async function applySafeMetadata(safe){
      const metadata=safe&&typeof safe==="object"?safe:{};
      const current=await chrome.storage.local.get(["bmpCacheMeta",DRAFT_KEY]);
      const restoredMeta=metadata.bmpCacheMeta&&typeof metadata.bmpCacheMeta==="object"
        ?metadata.bmpCacheMeta
        :{};
      const currentMeta=current.bmpCacheMeta&&typeof current.bmpCacheMeta==="object"
        ?current.bmpCacheMeta
        :{};
      const write={bmpCacheMeta:{...currentMeta,...restoredMeta}};
      if(metadata[DRAFT_KEY]&&typeof metadata[DRAFT_KEY]==="object"){
        write[DRAFT_KEY]=metadata[DRAFT_KEY];
      }
      assertActive();
      await chrome.storage.local.set(write);
    }

    async function restoreLegacyV1(file,onProgress){
      const parsed=LOCAL_BACKUP.parseLegacyV1Text(await file.text());
      const db=await openDb();
      try{
        let done=0;
        const total=parsed.pdfs.length+parsed.quiz_sources.length;
        for(const item of parsed.pdfs){
          await putVerified(db,"pdfs",String(item.key),LOCAL_BACKUP.base64ToBytes(item.data_base64));
          done++;
          await onProgress?.(`Memulihkan data lokal ${done}/${total}...`);
        }
        for(const item of parsed.quiz_sources){
          await putVerified(db,"quiz_sources",String(item.key),item.value);
          done++;
          await onProgress?.(`Memulihkan data lokal ${done}/${total}...`);
        }
      }finally{
        db.close();
      }
      await applySafeMetadata(parsed.safe_metadata);
      return {backupVersion:1,pdfs:parsed.pdfs.length,quizSources:parsed.quiz_sources.length};
    }

    async function restoreV2(file,onProgress){
      const db=await openDb();
      let safeMetadata={};
      let done=0;
      try{
        const result=await LOCAL_BACKUP.restoreV2Backup(file,{
          onMetadata:async value=>{safeMetadata=value},
          onPdf:async(key,bytes)=>{
            await putVerified(db,"pdfs",key,bytes);
            done++;
            await onProgress?.(`Memulihkan data lokal... ${done} record tersimpan.`);
          },
          onQuizSource:async(key,value)=>{
            await putVerified(db,"quiz_sources",key,value);
            done++;
            await onProgress?.(`Memulihkan data lokal... ${done} record tersimpan.`);
          }
        });
        await applySafeMetadata(safeMetadata||result.safe_metadata);
        return {backupVersion:2,pdfs:result.pdfs,quizSources:result.quizSources};
      }finally{
        db.close();
      }
    }

    async function restore(file,{onProgress}={}){
      if(!file)throw new Error("Pilih file backup BMP Terbuka.");
      if(!LOCAL_BACKUP)throw new Error("Modul restore lokal tidak tersedia.");
      assertActive();
      await onProgress?.("Memvalidasi backup...");
      if(await LOCAL_BACKUP.isGzipFile(file)){
        assertActive();
        return await restoreV2(file,onProgress);
      }
      assertActive();
      return await restoreLegacyV1(file,onProgress);
    }

    return Object.freeze({
      restore,
      cancel,
      isCancelled:()=>cancelled
    });
  }

  global.BMP_RESTORE_ENGINE=Object.freeze({createSession});
})(typeof self!=="undefined"?self:globalThis);
