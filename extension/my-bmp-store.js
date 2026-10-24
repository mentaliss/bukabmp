(function(global){
  "use strict";

  const DB_NAME="bmp-terbuka-pdf-cache";
  const DB_VERSION=2;
  const KEY_RE=/^([A-Z0-9_-]{3,32}):M([1-9]|[1-9]\d)$/;
  const MAX_ROWS=500;

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

  function byteSize(value){
    if(value instanceof Uint8Array)return value.byteLength;
    if(value instanceof ArrayBuffer)return value.byteLength;
    if(ArrayBuffer.isView(value))return value.byteLength;
    return 0;
  }

  function groupCacheKeys(keys){
    const map=new Map();
    for(const raw of keys){
      const key=String(raw||"");
      const match=key.match(KEY_RE);
      if(!match)continue;
      const code=match[1];
      const moduleNo=Number(match[2]);
      if(!map.has(code))map.set(code,[]);
      map.get(code).push(moduleNo);
    }
    for(const list of map.values())list.sort((a,b)=>a-b);
    return map;
  }

  function withDb(fn){
    return openDb().then(db=>fn(db).finally(()=>db.close()));
  }

  function scanPdfs(db){
    return new Promise((resolve,reject)=>{
      const rows=[];
      const tx=db.transaction("pdfs","readonly");
      const req=tx.objectStore("pdfs").openCursor();
      req.onsuccess=()=>{
        const cur=req.result;
        if(!cur)return;
        if(rows.length>MAX_ROWS){reject(new Error("Isi penyimpanan melewati batas aman."));return;}
        rows.push({key:String(cur.key||""),bytes:byteSize(cur.value)});
        cur.continue();
      };
      tx.oncomplete=()=>resolve(rows);
      tx.onerror=()=>reject(tx.error);
    });
  }

  async function listMaterials(){
    const [rows,local]=await Promise.all([
      withDb(scanPdfs),
      chrome.storage.local.get("bmpCacheMeta")
    ]);
    const meta=local.bmpCacheMeta&&typeof local.bmpCacheMeta==="object"?local.bmpCacheMeta:{};
    const grouped=groupCacheKeys(rows.map(r=>r.key));
    const materials=[];
    for(const [code,modules] of grouped){
      const entryMeta=meta[code]&&typeof meta[code]==="object"?meta[code]:{};
      materials.push({
        code,
        modules,
        bytes:rows.filter(r=>r.key.startsWith(code+":M")).reduce((sum,r)=>sum+r.bytes,0),
        detectedLastModule:Number(entryMeta.detectedLastModule)||0,
        title:String(entryMeta.title||"")
      });
    }
    materials.sort((a,b)=>a.code.localeCompare(b.code));
    return materials;
  }

  async function readPdf(key){
    if(!KEY_RE.test(key))throw new Error("Key modul tidak valid.");
    return withDb(db=>new Promise((resolve,reject)=>{
      const tx=db.transaction("pdfs","readonly");
      const req=tx.objectStore("pdfs").get(key);
      req.onsuccess=()=>{
        const value=req.result;
        if(value===undefined)return reject(new Error("Modul tidak ada di penyimpanan lokal."));
        if(value instanceof Uint8Array)resolve(new Uint8Array(value));
        else if(value instanceof ArrayBuffer)resolve(new Uint8Array(value));
        else if(ArrayBuffer.isView(value))resolve(new Uint8Array(value.buffer,value.byteOffset,value.byteLength));
        else reject(new Error("Format PDF cache tidak dikenali."));
      };
      req.onerror=()=>reject(req.error);
    }));
  }

  // Keputusan Owner 2026-10-12 (MENGGANTIKAN keputusan Item 8 2026-10-11):
  // hasil pencarian yang mekar menampilkan satu paragraf utuh yang memuat
  // hit, bukan potongan 300 char. Bila paragraf lebih panjang dari
  // maxPassageChars, jatuh ke kalimat yang memuat hit (diperluas ke kalimat
  // tetangga bila terlalu pendek). Paragraf = teks di antara 2+ baris baru
  // beruntun (antar halaman OCR digabung "\n\n"; "\n" tunggal di dalam
  // halaman bukan batas paragraf). Elipsis hanyalah penanda masih ada teks
  // di luar klip — tidak pernah memotong di tengah kalimat.
  const PASSAGE_TERMINATORS=".!?…";
  function clipPassage(text,hitStart,hitEnd,{maxPassageChars=900,minPassageChars=200}={}){
    const source=String(text||"");
    const length=source.length;
    if(!length)return "";
    const start=Math.max(0,Math.min(Number(hitStart)||0,length));
    const end=Math.max(start,Math.min(Number(hitEnd)||start,length));
    const isBlank=ch=>ch==="\n"||ch==="\r";

    // Awal paragraf yang memuat hit.
    let paraStart=0;
    let i=start;
    while(i>0){
      if(isBlank(source[i-1])){
        let j=i-1;
        while(j>=0&&isBlank(source[j]))j--;
        if(i-1-j>=2){paraStart=i;break;}
        i=j+1;
        continue;
      }
      i--;
    }
    // Akhir paragraf yang memuat hit.
    let paraEnd=length;
    i=end;
    while(i<length){
      if(isBlank(source[i])){
        let j=i;
        while(j<length&&isBlank(source[j]))j++;
        if(j-i>=2){paraEnd=i;break;}
        i=j;
        continue;
      }
      i++;
    }

    let clipStart=paraStart,clipEnd=paraEnd;
    if(paraEnd-paraStart>maxPassageChars){
      // Paragraf terlalu panjang — jatuhnya ke kalimat yang memuat hit,
      // diperluas ke kalimat tetangga selama hasil masih di bawah
      // minPassageChars. Kalimat dipisah terminator (.!?…) yang diikuti
      // spasi atau akhir paragraf.
      const para=source.slice(paraStart,paraEnd);
      const sentences=[];
      let s=0;
      for(let k=0;k<para.length;k++){
        const ch=para[k];
        const endsHere=PASSAGE_TERMINATORS.includes(ch)&&(k+1>=para.length||/\s/.test(para[k+1]));
        if(endsHere||k===para.length-1){
          let e=k+1,ee=e;
          while(ee<para.length&&/\s/.test(para[ee]))ee++;
          sentences.push({start:s,end:e});
          s=ee;
        }
      }
      if(s<para.length)sentences.push({start:s,end:para.length});
      let lo=Math.max(0,sentences.findIndex(sn=>sn.end>start-paraStart));
      let hi=lo;
      const len=()=>sentences[hi].end-sentences[lo].start;
      while(len()<minPassageChars){
        const before=lo>0?sentences[lo-1].end-sentences[lo-1].start:-1;
        const after=hi<sentences.length-1?sentences[hi+1].end-sentences[hi+1].start:-1;
        if(before<0&&after<0)break;
        if(before>=after)lo--;else hi++;
      }
      clipStart=paraStart+sentences[lo].start;
      clipEnd=paraStart+sentences[hi].end;
    }

    let cs=clipStart,ce=clipEnd;
    while(cs<ce&&/\s/.test(source[cs]))cs++;
    while(ce>cs&&/\s/.test(source[ce-1]))ce--;
    const clipped=source.slice(cs,ce);
    if(!clipped)return "";
    // Elipsis hanya bila benar-benar ada teks non-spasi di luar klip
    // (scan karakter, tanpa menyalin dokumen).
    let clippedBefore=false;
    for(let k=cs-1;k>=0;k--){if(!/\s/.test(source[k])){clippedBefore=true;break;}}
    let clippedAfter=false;
    for(let k=ce;k<length;k++){if(!/\s/.test(source[k])){clippedAfter=true;break;}}
    return (clippedBefore?"…":"")+clipped+(clippedAfter?"…":"");
  }

  // Preview ±60 char tetap menjadi baris collapsed; bagian yang mekar kini
  // `passage` berbasis paragraf/kalimat (lihat clipPassage di atas).
  function sliceHits(text,needle,{maxHits=50,previewChars=60,maxPassageChars=900,minPassageChars=200}={}){
    const source=String(text||"");
    const q=String(needle||"").trim().toLowerCase();
    if(!source||!q)return [];
    const lower=source.toLowerCase();
    const hits=[];
    let index=lower.indexOf(q);
    while(index!==-1&&hits.length<maxHits){
      const pStart=Math.max(0,index-previewChars);
      const pEnd=Math.min(source.length,index+q.length+previewChars);
      hits.push({
        index,
        preview:(pStart>0?"…":"")+source.slice(pStart,pEnd)+(pEnd<source.length?"…":""),
        passage:clipPassage(source,index,index+q.length,{maxPassageChars,minPassageChars})
      });
      index=lower.indexOf(q,index+q.length);
    }
    return hits;
  }

  // Batch 29: label "hlm. N" untuk hasil pencarian accordion. Batas halaman
  // disimpan additif oleh offscreen.js (QUIZ_LOCAL.pageBoundsForSanitizedText).
  // Modul lama tanpa pageBounds tetap tampil tanpa label — tidak pernah menebak.
  function normalizePageBounds(value){
    if(!Array.isArray(value))return [];
    return value
      .filter(b=>b&&typeof b==="object"&&Number.isFinite(Number(b.page))&&Number.isFinite(Number(b.start))&&Number(b.start)>=0)
      .map(b=>({page:Number(b.page),start:Number(b.start)}))
      .sort((a,b)=>a.start-b.start);
  }

  // Binary search: halaman yang memuat offset karakter = bounds terakhir
  // dengan start <= offset. Return null bila bounds kosong.
  function pageForOffset(bounds,offset){
    if(!Array.isArray(bounds)||!bounds.length||!Number.isFinite(offset))return null;
    let lo=0,hi=bounds.length-1,answer=null;
    while(lo<=hi){
      const mid=(lo+hi)>>1;
      if(bounds[mid].start<=offset){answer=bounds[mid].page;lo=mid+1;}else{hi=mid-1;}
    }
    return answer;
  }

  async function searchModule(key,query,options){
    if(!KEY_RE.test(key))throw new Error("Key modul tidak valid.");
    const needle=String(query||"").trim().toLowerCase();
    if(!needle)return [];
    const value=await withDb(db=>new Promise((resolve,reject)=>{
      const tx=db.transaction("quiz_sources","readonly");
      const req=tx.objectStore("quiz_sources").get(key);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    }));
    const hits=sliceHits(String(value?.sanitizedText||""),needle,options);
    const bounds=normalizePageBounds(value?.pageBounds);
    if(bounds.length){
      for(const hit of hits)hit.page=pageForOffset(bounds,hit.index);
    }
    return hits;
  }

  async function deleteCode(code){
    const normalized=String(code||"").toUpperCase();
    if(!/^[A-Z0-9_-]{3,32}$/.test(normalized))throw new Error("Kode BMP tidak valid.");
    await withDb(db=>new Promise((resolve,reject)=>{
      const tx=db.transaction(["pdfs","quiz_sources"],"readwrite");
      for(const storeName of ["pdfs","quiz_sources"]){
        const store=tx.objectStore(storeName);
        const req=store.getAllKeys();
        req.onsuccess=()=>{
          for(const key of (req.result||[])){
            if(String(key).startsWith(normalized+":M"))store.delete(key);
          }
        };
      }
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    }));
    const local=await chrome.storage.local.get("bmpCacheMeta");
    const map=local.bmpCacheMeta&&typeof local.bmpCacheMeta==="object"?{...local.bmpCacheMeta}:{};
    if(Object.prototype.hasOwnProperty.call(map,normalized)){
      delete map[normalized];
      await chrome.storage.local.set({bmpCacheMeta:map});
    }
  }

  // Hapus persis daftar key yang diberikan (snapshot dari UI saat tombol Hapus
  // ditekan). Dipakai jalur UNDO: kalau job menulis data baru untuk kode yang sama
  // dalam jendela undo, key baru itu TIDAK ikut terhapus karena tidak ada di snapshot.
  // Key yang tidak lolos KEY_RE dilewati diam-diam — tidak pernah menyentuh database.
  async function deleteKeys(keys){
    const list=Array.isArray(keys)?keys:[];
    const normalized=[];
    for(const raw of list){
      const key=String(raw||"");
      if(!KEY_RE.test(key))continue;
      if(!normalized.includes(key))normalized.push(key);
    }
    if(!normalized.length)return;
    const codes=[...new Set(normalized.map(k=>k.split(":")[0]))];
    await withDb(db=>new Promise((resolve,reject)=>{
      const tx=db.transaction(["pdfs","quiz_sources"],"readwrite");
      for(const storeName of ["pdfs","quiz_sources"]){
        const store=tx.objectStore(storeName);
        for(const key of normalized)store.delete(key);
      }
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    }));
    const local=await chrome.storage.local.get("bmpCacheMeta");
    const map=local.bmpCacheMeta&&typeof local.bmpCacheMeta==="object"?{...local.bmpCacheMeta}:{};
    let changed=false;
    for(const code of codes){
      if(Object.prototype.hasOwnProperty.call(map,code)){delete map[code];changed=true;}
    }
    if(changed)await chrome.storage.local.set({bmpCacheMeta:map});
  }

  global.BMP_MY_BMP_STORE=Object.freeze({
    groupCacheKeys,
    listMaterials,
    readPdf,
    searchModule,
    sliceHits,
    clipPassage,
    normalizePageBounds,
    pageForOffset,
    deleteCode,
    deleteKeys,
    KEY_RE
  });
})(typeof self!=="undefined"?self:globalThis);
