(function(global){
  "use strict";

  const FORMAT = "bmp-terbuka-local-backup";
  const CURRENT_VERSION = 2;
  const MAX_RECORDS_PER_STORE = 500;
  const KEY_RE = /^[A-Z0-9_-]{3,32}:M(?:[1-9]|[1-9]\d)$/;

  function normalizeBytes(value){
    if(value instanceof Uint8Array)return value;
    if(value instanceof ArrayBuffer)return new Uint8Array(value);
    if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
    throw new Error("Format PDF cache tidak dikenali.");
  }

  function bytesToBase64(value){
    const bytes=normalizeBytes(value);
    let binary="";
    const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk){
      binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));
    }
    return btoa(binary);
  }

  function base64ToBytes(value){
    const raw=String(value||"");
    let binary;
    try{binary=atob(raw)}catch{throw new Error("Data PDF backup tidak valid.");}
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return bytes;
  }

  function validateKey(value,label="Key backup"){
    const key=String(value||"");
    if(!KEY_RE.test(key))throw new Error(label+" tidak valid.");
    return key;
  }

  function safeObject(value){
    return value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  }

  function validateQuizSource(value){
    if(!value||typeof value!=="object"||Number(value.schemaVersion)!==1){
      throw new Error("Source Quiz backup tidak valid.");
    }
    return value;
  }

  function validateLegacyV1Payload(payload){
    if(payload?.format!==FORMAT||Number(payload?.backup_version)!==1){
      throw new Error("Format backup BMP Terbuka tidak dikenali.");
    }
    const pdfs=Array.isArray(payload.pdfs)?payload.pdfs:[];
    const quizSources=Array.isArray(payload.quiz_sources)?payload.quiz_sources:[];
    if(pdfs.length>MAX_RECORDS_PER_STORE||quizSources.length>MAX_RECORDS_PER_STORE){
      throw new Error("Isi backup melewati batas aman.");
    }
    for(const item of pdfs){
      validateKey(item?.key,"Key PDF backup");
      base64ToBytes(item?.data_base64);
    }
    for(const item of quizSources){
      validateKey(item?.key,"Key source Quiz backup");
      validateQuizSource(item?.value);
    }
    return {
      format:FORMAT,
      backup_version:1,
      pdfs,
      quiz_sources:quizSources,
      safe_metadata:safeObject(payload.safe_metadata)
    };
  }

  function parseLegacyV1Text(text){
    let payload;
    try{payload=JSON.parse(String(text||""))}catch{throw new Error("File backup bukan JSON yang valid.");}
    return validateLegacyV1Payload(payload);
  }

  function jsonLine(value){
    return JSON.stringify(value)+"\n";
  }

  async function writeV2BackupToWritable({pdfs,quizSources,safeMetadata,createdAt,writable,onProgress}){
    if(typeof CompressionStream!=="function"){
      throw new Error("Browser ini belum mendukung backup streaming.");
    }
    if(!writable||typeof writable.write!=="function"||typeof writable.close!=="function"){
      throw new Error("Tujuan backup tidak dapat ditulis.");
    }
    const encoder=new TextEncoder();
    const stats={pdfs:0,quizSources:0};
    const metadata=safeObject(safeMetadata);

    async function* records(){
      yield jsonLine({
        type:"header",
        format:FORMAT,
        backup_version:CURRENT_VERSION,
        created_at:String(createdAt||new Date().toISOString())
      });
      yield jsonLine({type:"metadata",safe_metadata:metadata});

      for await(const row of pdfs||[]){
        if(stats.pdfs>=MAX_RECORDS_PER_STORE)throw new Error("Jumlah PDF backup melewati batas aman.");
        const key=validateKey(row?.[0],"Key PDF backup");
        const data_base64=bytesToBase64(row?.[1]);
        stats.pdfs++;
        if(typeof onProgress==="function")await onProgress({type:"pdf",key,pdfs:stats.pdfs,quizSources:stats.quizSources});
        yield jsonLine({type:"pdf",key,data_base64});
      }

      for await(const row of quizSources||[]){
        if(stats.quizSources>=MAX_RECORDS_PER_STORE)throw new Error("Jumlah source Quiz backup melewati batas aman.");
        const key=validateKey(row?.[0],"Key source Quiz backup");
        const value=validateQuizSource(row?.[1]);
        stats.quizSources++;
        if(typeof onProgress==="function")await onProgress({type:"quiz_source",key,pdfs:stats.pdfs,quizSources:stats.quizSources});
        yield jsonLine({type:"quiz_source",key,value});
      }

      yield jsonLine({type:"footer",pdfs:stats.pdfs,quiz_sources:stats.quizSources});
    }

    const iterator=records()[Symbol.asyncIterator]();
    const input=new ReadableStream({
      async pull(controller){
        const next=await iterator.next();
        if(next.done){controller.close();return;}
        controller.enqueue(encoder.encode(next.value));
      },
      async cancel(){
        if(typeof iterator.return==="function")await iterator.return();
      }
    });

    const reader=input.pipeThrough(new CompressionStream("gzip")).getReader();
    let compressedBytes=0;
    try{
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        if(!(value instanceof Uint8Array))throw new Error("Output kompresi backup tidak valid.");
        await writable.write(value);
        compressedBytes+=value.byteLength;
      }
      await writable.close();
    }catch(error){
      try{await reader.cancel(error)}catch(_){}
      try{if(typeof writable.abort==="function")await writable.abort(error)}catch(_){}
      const detail=String(error?.message||error||"unknown");
      throw new Error("Gagal membuat backup terkompresi: "+detail);
    }finally{
      try{reader.releaseLock()}catch(_){}
    }

    return {
      pdfs:stats.pdfs,
      quizSources:stats.quizSources,
      bytes:compressedBytes,
      backup_version:CURRENT_VERSION
    };
  }

  async function isGzipFile(file){
    const head=new Uint8Array(await file.slice(0,2).arrayBuffer());
    return head.length===2&&head[0]===0x1f&&head[1]===0x8b;
  }

  async function* jsonLineRecords(file){
    if(typeof DecompressionStream!=="function"){
      throw new Error("Browser ini belum mendukung restore backup streaming.");
    }
    const textStream=file.stream()
      .pipeThrough(new DecompressionStream("gzip"))
      .pipeThrough(new TextDecoderStream());
    const reader=textStream.getReader();
    let pending="";
    try{
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        pending+=String(value||"");
        while(true){
          const newline=pending.indexOf("\n");
          if(newline<0)break;
          const line=pending.slice(0,newline).trim();
          pending=pending.slice(newline+1);
          if(!line)continue;
          try{yield JSON.parse(line)}catch{throw new Error("Record backup v2 rusak.");}
        }
      }
      const tail=pending.trim();
      if(tail){
        try{yield JSON.parse(tail)}catch{throw new Error("Record backup v2 rusak.");}
      }
    }finally{
      reader.releaseLock();
    }
  }

  async function inspectV2Backup(file){
    let header=null;
    let metadata={};
    let footer=null;
    let pdfs=0;
    let quizSources=0;
    let index=0;

    for await(const record of jsonLineRecords(file)){
      index++;
      if(index===1){
        if(record?.type!=="header"||record?.format!==FORMAT||Number(record?.backup_version)!==CURRENT_VERSION){
          throw new Error("Format backup BMP Terbuka v2 tidak dikenali.");
        }
        header=record;
        continue;
      }
      if(record?.type==="metadata"){
        metadata=safeObject(record.safe_metadata);
        continue;
      }
      if(record?.type==="pdf"){
        validateKey(record.key,"Key PDF backup");
        base64ToBytes(record.data_base64);
        pdfs++;
        if(pdfs>MAX_RECORDS_PER_STORE)throw new Error("Jumlah PDF backup melewati batas aman.");
        continue;
      }
      if(record?.type==="quiz_source"){
        validateKey(record.key,"Key source Quiz backup");
        validateQuizSource(record.value);
        quizSources++;
        if(quizSources>MAX_RECORDS_PER_STORE)throw new Error("Jumlah source Quiz backup melewati batas aman.");
        continue;
      }
      if(record?.type==="footer"){
        footer=record;
        continue;
      }
      throw new Error("Tipe record backup v2 tidak dikenali.");
    }

    if(!header||!footer)throw new Error("Backup v2 tidak lengkap.");
    if(Number(footer.pdfs)!==pdfs||Number(footer.quiz_sources)!==quizSources){
      throw new Error("Jumlah record backup v2 tidak cocok.");
    }
    return {
      format:FORMAT,
      backup_version:CURRENT_VERSION,
      created_at:String(header.created_at||""),
      safe_metadata:metadata,
      pdfs,
      quizSources
    };
  }

  async function restoreV2Backup(file,{onPdf,onQuizSource,onMetadata}={}){
    const inspection=await inspectV2Backup(file);
    let metadataApplied=false;
    let pdfs=0;
    let quizSources=0;

    for await(const record of jsonLineRecords(file)){
      if(record?.type==="metadata"&&!metadataApplied){
        if(typeof onMetadata==="function")await onMetadata(safeObject(record.safe_metadata));
        metadataApplied=true;
      }else if(record?.type==="pdf"){
        const key=validateKey(record.key,"Key PDF backup");
        const bytes=base64ToBytes(record.data_base64);
        if(typeof onPdf==="function")await onPdf(key,bytes);
        pdfs++;
      }else if(record?.type==="quiz_source"){
        const key=validateKey(record.key,"Key source Quiz backup");
        const value=validateQuizSource(record.value);
        if(typeof onQuizSource==="function")await onQuizSource(key,value);
        quizSources++;
      }
    }

    if(!metadataApplied&&typeof onMetadata==="function"){
      await onMetadata(inspection.safe_metadata);
    }
    return {
      backup_version:CURRENT_VERSION,
      pdfs,
      quizSources,
      safe_metadata:inspection.safe_metadata
    };
  }

  async function detectBackupVersion(file){
    if(await isGzipFile(file)){
      const inspected=await inspectV2Backup(file);
      return Number(inspected.backup_version);
    }
    const legacy=parseLegacyV1Text(await file.text());
    return Number(legacy.backup_version);
  }

  global.BMP_LOCAL_BACKUP=Object.freeze({
    FORMAT,
    CURRENT_VERSION,
    MAX_RECORDS_PER_STORE,
    bytesToBase64,
    base64ToBytes,
    parseLegacyV1Text,
    validateLegacyV1Payload,
    writeV2BackupToWritable,
    inspectV2Backup,
    restoreV2Backup,
    detectBackupVersion,
    isGzipFile
  });
})(typeof self!=="undefined"?self:globalThis);
