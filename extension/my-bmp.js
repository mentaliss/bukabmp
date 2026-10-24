(function(global){
  "use strict";

  // Pure helpers (no DOM) diekspos untuk tests/my-bmp.test.mjs.
  function filterMaterialsByCode(materials,query){
    const list=Array.isArray(materials)?materials.slice():[];
    const needle=String(query||"").trim().toLowerCase();
    if(!needle)return list;
    return list.filter(item=>{
      const code=String(item&&item.code||"").toLowerCase();
      const title=String(item&&item.title||"").toLowerCase();
      return code.includes(needle)||title.includes(needle);
    });
  }

  function escapeHtmlFragment(value){
    return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  // Highlight needle di teks MENTAH dulu, baru escape per potongan — bold tidak pernah
  // memotong entity (&amp; dsb.) dan needle tidak pernah dianggap regex.
  function highlightSnippet(snippet,needle){
    const text=String(snippet||"");
    const query=String(needle||"").trim().toLowerCase();
    if(!query)return escapeHtmlFragment(text);
    const lower=text.toLowerCase();
    let out="";
    let pos=0;
    let index=lower.indexOf(query,pos);
    while(index!==-1){
      out+=escapeHtmlFragment(text.slice(pos,index))
        +"<b>"+escapeHtmlFragment(text.slice(index,index+query.length))+"</b>";
      pos=index+query.length;
      index=lower.indexOf(query,pos);
    }
    return out+escapeHtmlFragment(text.slice(pos));
  }

  // Batas waktu jendela UNDO (detik) + format pesannya (Batch 2 — keputusan Owner 2026-10-11).
  const UNDO_WINDOW_SECONDS=8;

  function undoMessage(code,secondsLeft){
    return "Data "+code+" dihapus. Batalkan ("+secondsLeft+" detik)";
  }

  // Modul default saat materi dibuka (audit Batch 4 — diekstrak murni agar
  // fallback detectedLastModule bisa dites). Perilaku identik dengan sebelumnya:
  // forceModule valid → detectedLastModule (hanya jika tersimpan) → modul terakhir.
  function pickDefaultModule(material,forceModule){
    const modules=material&&Array.isArray(material.modules)?material.modules:[];
    if(forceModule&&modules.includes(forceModule))return forceModule;
    const detected=Number(material&&material.detectedLastModule)||0;
    if(detected&&modules.includes(detected))return detected;
    return modules.at(-1)||0;
  }

  // Keputusan Owner 2026-10-12 (Batch 14): notice kualitas sumber quiz —
  // teks setara sidepanel (popup.js renderQuizSourceState) supaya konsisten.
  // Modul anomali (teks minim/halaman tunggal) harus memberi info jelas,
  // bukan UI yang membeku tanpa pesan.
  function quizSourceNotice(source,moduleNo){
    if(!source||source.ok!==true)return "";
    const quality=source.quality||null;
    const pages=Number((quality&&quality.pageCount)||source.pageCount||0);
    const m=Number(moduleNo)||0;
    if(!source.sourceAvailable)return "M"+m+" belum siap untuk Quiz. Unduh ulang sekali untuk menyiapkan materi.";
    if(quality&&quality.level==="invalid"){
      return pages===1
        ?"⛔ Hanya 1 halaman yang terbaca. Coba unduh ulang modul."
        :"⛔ Modul terdeteksi tidak lengkap"+(pages?" • "+pages+" halaman terbaca":"")+". Coba unduh ulang modul.";
    }
    if(quality&&quality.level==="limited"){
      if(pages>0&&pages<=2)return "⚠️ Hanya "+pages+" halaman terbaca. Materi tetap bisa dipakai; Quiz mungkin lebih pendek.";
      const detail=quality.reason==="reference_heavy"
        ?"Materi yang terbaca banyak berupa daftar pustaka/referensi."
        :quality.reason==="repetitive_text"
          ?"Materi yang terbaca banyak berisi teks berulang."
          :"Materi yang terbaca terlihat sedikit.";
      return "⚠️ "+detail+" Quiz mungkin memiliki lebih sedikit soal.";
    }
    return "";
  }

  // Batch 37: indeks item textContent yang mengandung query (case-insensitive).
  // Fungsi murni — dipakai pencarian modul (text layer) dan dites di Node.
  // Item tanpa `str` string (whitespace-only dsb.) dilewati, tidak pernah crash.
  function findTextMatchesInItems(items,query){
    const list=Array.isArray(items)?items:[];
    const q=String(query||"").trim().toLowerCase();
    if(!q)return [];
    const hits=[];
    for(let i=0;i<list.length;i++){
      const str=list[i]&&typeof list[i].str==="string"?list[i].str:"";
      if(str&&str.toLowerCase().includes(q))hits.push(i);
    }
    return hits;
  }

  // Batch 38b: urutan (0-based) match aktif di ANTARA match halaman tertentu.
  // Dipakai jalur fallback highlight: span ke-N yang cocok di halaman itu = N.
  // Mengembalikan -1 bila match aktif tidak ada di halaman tsb (atau indeks di
  // luar rentang) sehingga tidak ada span yang salah ditandai aktif.
  function activeOrdinalForPage(matches,index,pageNo){
    const list=Array.isArray(matches)?matches:[];
    const active=list[index];
    if(!active||active.page!==pageNo)return -1;
    let ordinal=0;
    for(let i=0;i<index;i++){
      const match=list[i];
      if(match&&match.page===pageNo)ordinal++;
    }
    return ordinal;
  }

  global.BMP_MY_BMP_UI=Object.freeze({filterMaterialsByCode,escapeHtmlFragment,highlightSnippet,UNDO_WINDOW_SECONDS,undoMessage,pickDefaultModule,quizSourceNotice,findTextMatchesInItems,activeOrdinalForPage});

  const STORE=global.BMP_MY_BMP_STORE;
  if(!STORE||typeof document==="undefined")return;

  let materials=[];
  let filterQuery="";
  let selectedCode="";
  let selectedModule=0;
  let activeEmbedKey="";
  let activeEmbedUrl="";
  // Renderer PDF lokal (Batch 33): PDF.js via canvas, tidak bergantung PDF
  // viewer bawaan browser (masalah Edge Canary Android: viewer dimatikan dan
  // pengaturannya sulit dicari).
  let embedPdf=null;
  let embedRenderTask=null;
  let embedTextTask=null;
  let embedUi=null;
  let embedWrapNode=null;
  let embedPageNo=1;
  let embedTotalPages=0;
  let embedScale=1;
  let embedFitWidth=true;
  let embedResizeTimer=0;
  let embedLastFitWidth=0;
  // Audit ronde 2 (R2-EXT-B-004): observer lama harus dilepas di releaseEmbed,
  // kalau tidak setiap buka modul menambah observer baru yang menahan wrapper
  // (dan closure-nya) hidup selama halaman ini hidup.
  let embedResizeObserver=null;
  // Batch 37: pencarian modul (text layer + highlight).
  let embedSearchQuery="";
  let embedSearchMatches=[]; // entri {page,item} berurut dokumen
  let embedSearchIndex=0;
  let embedSearchJob=0;
  let embedSearchTimer=0;
  let embedPageTextCache=null; // Map pageNo -> items (per dokumen aktif)
  // Batch 38b: div teks per item dari renderTextLayer (task._textDivs). Ini
  // pemetaan 1:1 dengan items textContent, sedangkan querySelectorAll("span")
  // TIDAK 1:1 — pdf.js tidak memasang span untuk item ber-str kosong dan bisa
  // menambah span .markedContent. Dulu ketidakcocokan itu memicu fallback yang
  // selalu menyorot match PERTAMA halaman, sehingga panah tidak kelihatan
  // berpindah (laporan Owner 2026-10-24).
  let embedTextDivs=[];

  function el(tag,attrs,children){
    const node=document.createElement(tag);
    for(const [k,v] of Object.entries(attrs||{})){
      if(k==="class")node.className=String(v);
      else if(k==="text")node.textContent=String(v);
      else if(k.startsWith("on")&&typeof v==="function")node.addEventListener(k.slice(2),v);
      else node.setAttribute(k,String(v));
    }
    for(const child of (Array.isArray(children)?children:children?[children]:[])){
      if(child==null)continue;
      node.appendChild(typeof child==="string"?document.createTextNode(child):child);
    }
    return node;
  }

  function formatBytes(bytes){
    const total=Number(bytes)||0;
    if(total<1024)return total+" B";
    if(total<1024*1024)return (total/1024).toFixed(0)+" KB";
    return (total/(1024*1024)).toFixed(1)+" MB";
  }

  function moduleKey(code,moduleNo){
    return code+":M"+moduleNo;
  }

  function notice(container,message,kind){
    const box=el("div",{class:"notice"+(kind?" "+kind:"")},message);
    container.appendChild(box);
    return box;
  }

  // UNDO simultan: satu entri per kode, masing-masing punya baris sendiri di
  // UNDO bar — hapus kode lain tidak lagi meng-commit paksa UNDO yang berjalan.
  const pendingDeletions=new Map(); // code -> {timer,interval,row,label,keys,secondsLeft}

  function clearPendingDelete(code){
    const pending=pendingDeletions.get(code);
    if(!pending)return;
    pendingDeletions.delete(code);
    if(pending.timer)clearTimeout(pending.timer);
    if(pending.interval)clearInterval(pending.interval);
    if(pending.row&&pending.row.parentNode)pending.row.remove();
    if(pendingDeletions.size===0){
      const bar=document.getElementById("undoBar");
      if(bar)bar.hidden=true;
    }
  }

  // Commit penghapusan fisik — HANYA key yang di-snapshot saat tombol Hapus
  // ditekan, sehingga data baru untuk kode yang sama tidak ikut lenyap.
  async function commitPendingDelete(code){
    const pending=pendingDeletions.get(code);
    if(!pending)return;
    clearPendingDelete(code);
    try{
      await STORE.deleteKeys(pending.keys);
    }catch(error){
      // Penghapusan fisik gagal — muat ulang apa adanya; data tetap di perangkat.
      try{materials=await STORE.listMaterials();}catch{/* biarkan daftar lama */}
      renderDashboard();
      renderDetail();
      if(materials.some(m=>m.code===code)){
        const dashboard=document.getElementById("dashboard");
        if(dashboard)notice(dashboard,"Gagal menghapus: "+(error?.message||error),"error");
      }
    }
  }

  async function removeMaterial(code){
    // Keputusan Owner 2026-10-11: jalur UNDO menggantikan dialog confirm.
    // Data belum disentuh; kalau tab ditutup sebelum jendela habis, data selamat.
    // Kode yang sama tidak bisa dihapus dua kali: ia sudah hilang dari daftar
    // selama jendela UNDO berjalan, jadi abaikan panggilan ulang.
    if(pendingDeletions.has(code))return;
    const material=materials.find(m=>m.code===code)||null;
    if(!material){renderDashboard();return;}
    const keys=material.modules.map(moduleNo=>moduleKey(code,moduleNo));
    materials=materials.filter(m=>m.code!==code);
    if(selectedCode===code){
      showDashboard();
    }else{
      renderDashboard();
    }

    const bar=document.getElementById("undoBar");
    if(!bar)return;
    bar.hidden=false;
    const row=el("div",{class:"undoRow"});
    const label=el("span",{class:"undoLabel"},undoMessage(code,UNDO_WINDOW_SECONDS));
    row.appendChild(label);
    row.appendChild(el("button",{class:"undoButton",text:"Batalkan",onclick:()=>{
      clearPendingDelete(code);
      reloadAfterUndo();
    }}));
    bar.appendChild(row);
    const pending={
      keys,
      row,
      label,
      secondsLeft:UNDO_WINDOW_SECONDS,
      timer:setTimeout(()=>{commitPendingDelete(code);},UNDO_WINDOW_SECONDS*1000)
    };
    pending.interval=setInterval(()=>{
      if(!pendingDeletions.has(code))return;
      pending.secondsLeft-=1;
      if(pending.secondsLeft>0)pending.label.textContent=undoMessage(code,pending.secondsLeft);
    },1000);
    pendingDeletions.set(code,pending);
  }

  async function reloadAfterUndo(){
    try{
      materials=await STORE.listMaterials();
    }catch(error){
      // Sumber gagal dibaca; daftar lama tetap ditampilkan apa adanya.
    }
    renderDashboard();
    renderDetail();
  }

  function releaseEmbed(){
    if(activeEmbedUrl){
      URL.revokeObjectURL(activeEmbedUrl);
      activeEmbedUrl="";
    }
    if(embedResizeObserver){
      try{embedResizeObserver.disconnect();}catch{ /* disconnect aman; abaikan */ }
      embedResizeObserver=null;
    }
    activeEmbedKey="";
    if(embedResizeTimer){clearTimeout(embedResizeTimer);embedResizeTimer=0;}
    if(embedRenderTask){
      try{embedRenderTask.cancel();}catch{ /* cancel bisa menolak; abaikan */ }
      embedRenderTask=null;
    }
    if(embedTextTask){
      try{embedTextTask.cancel();}catch{ /* cancel bisa menolak; abaikan */ }
      embedTextTask=null;
    }
    if(embedPdf){
      try{embedPdf.destroy();}catch{ /* destroy asinkron; abaikan */ }
      embedPdf=null;
    }
    embedUi=null;
    embedWrapNode=null;
    embedPageNo=1;
    embedTotalPages=0;
    embedScale=1;
    embedFitWidth=true;
    embedLastFitWidth=0;
    // Batch 37: pencarian ikut dilepas — dokumen baru mulai dari nol.
    embedSearchQuery="";
    embedSearchMatches=[];
    embedSearchIndex=0;
    embedSearchJob++;
    if(embedSearchTimer){clearTimeout(embedSearchTimer);embedSearchTimer=0;}
    embedPageTextCache=null;
    embedTextDivs=[]; // Batch 38b: daftar div teks halaman aktif ikut dilepas
  }

  function renderDashboard(){
    const grid=document.getElementById("dashboardGrid");
    const empty=document.getElementById("dashboardEmpty");
    grid.textContent="";
    const filtered=BMP_MY_BMP_UI.filterMaterialsByCode(materials,filterQuery);
    if(!filtered.length){
      empty.hidden=false;
      empty.textContent=materials.length
        ?"Tidak ada materi dengan kode seperti itu."
        :"Belum ada hasil. Proses BMP lewat side panel untuk melihatnya di sini.";
      return;
    }
    empty.hidden=true;
    for(const item of filtered){
      const card=el("button",{
        class:"materialCard",
        title:"Buka detail "+item.code,
        onclick:()=>selectMaterial(item.code)
      },[
        el("span",{class:"materialCardTitle"},item.code),
        item.title?el("span",{class:"materialCardName"},item.title):null,
        el("span",{class:"materialCardMeta"},item.modules.length+" modul · "+formatBytes(item.bytes)),
        el("span",{class:"materialCardLast"},item.detectedLastModule?"Terakhir diproses: Modul "+item.detectedLastModule:"")
      ].filter(Boolean));
      grid.appendChild(card);
    }
  }

  function showDashboard(){
    selectedCode="";
    selectedModule=0;
    releaseEmbed();
    stopQuizStatusPolling();
    document.getElementById("detail").hidden=true;
    document.getElementById("detail").textContent="";
    document.getElementById("dashboard").hidden=false;
    renderDashboard();
  }

  function currentMaterial(){
    return materials.find(m=>m.code===selectedCode)||null;
  }

  async function selectMaterial(code,forceModule=0){
    releaseEmbed();
    selectedCode=code;
    const material=currentMaterial();
    selectedModule=pickDefaultModule(material,forceModule);
    document.getElementById("dashboard").hidden=true;
    document.getElementById("detail").hidden=false;
    renderDetail();
  }

  // Item 9 (keputusan Owner 2026-10-11) + Batch 14 (keputusan Owner
  // 2026-10-12): Generate Quiz per materi, dengan status yang selalu
  // mencerminkan sumber kebenaran terbaru (lifecycle → antrian → kualitas
  // sumber → bank). Status TIDAK BOLEH membeku di pesan aksi sesaat —
  // kegagalan generate di background (mis. modul anomali teks minim) harus
  // sampai ke baris status, tidak hilang hanya di lifecycle storage.
  let quizStatusTimer=0;
  let quizInfoKey="";
  let quizSourceCache=null;
  let quizBankCache=null;

  function stopQuizStatusPolling(){
    if(quizStatusTimer)clearInterval(quizStatusTimer);
    quizStatusTimer=0;
  }

  async function sendBg(message){
    try{return await chrome.runtime.sendMessage(message);}catch{return null;}
  }

  async function refreshQuizStatus(full){
    if(!selectedCode||!selectedModule)return;
    const statusEl=document.getElementById("quizStatus");
    if(!statusEl||!statusEl.isConnected)return;
    const key=selectedCode+":M"+selectedModule;
    if(key!==quizInfoKey){quizInfoKey=key;quizSourceCache=null;quizBankCache=null;}
    try{
      // 1) Lifecycle = sumber kebenaran untuk proses berjalan/gagal/selesai.
      const lc=await sendBg({type:"GET_QUIZ_LIFECYCLE",code:selectedCode,module:selectedModule});
      if(!statusEl.isConnected)return;
      const lifecycle=lc&&lc.ok?lc.lifecycle:null;
      const quizButton=document.getElementById("quizButton");
      if(lifecycle){
        let message=String(lifecycle.message||"");
        if(
          String(lifecycle.phase||"")==="generating_bank"&&
          Number(lifecycle.updatedAt||0)>0&&
          Date.now()-Number(lifecycle.updatedAt)>=120000
        ){
          message="Bank soal M"+selectedModule+" masih disiapkan. Proses membutuhkan waktu lebih lama dari biasanya dan dapat berlangsung hingga sekitar 10 menit.";
        }
        statusEl.className="quizStatus"+
          (lifecycle.phase==="error"?" error":"")+
          (lifecycle.phase==="started"?" success":"");
        statusEl.textContent=message;
        if(quizButton)quizButton.textContent=
          lifecycle.phase==="generating_bank"?"Menyiapkan Quiz...":
          lifecycle.phase==="checking_bank"||lifecycle.phase==="starting_round"?"Memproses Quiz...":
          (lifecycle.active||lifecycle.phase==="active")?"Buka Quiz di Telegram":"Generate Quiz";
        // Hasil generate mengubah ketersediaan bank — cache kedaluwarsa.
        if(lifecycle.phase==="error"||lifecycle.phase==="started")quizBankCache=null;
        return;
      }
      if(quizButton&&quizButton.textContent!=="Generate Quiz")quizButton.textContent="Generate Quiz";

      // 2) Posisi modul di antrian generate.
      const q=await sendBg({type:"GET_QUIZ_GENERATE_QUEUE"});
      if(!statusEl.isConnected)return;
      const queue=Array.isArray(q&&q.queue)?q.queue:[];
      const mine=queue.findIndex(item=>
        String(item&&item.code||"")===selectedCode&&Number(item&&item.module||0)===selectedModule);
      if(mine!==-1){
        statusEl.className="quizStatus";
        statusEl.textContent="M"+selectedModule+" menunggu di antrian generate #"+(mine+1)+" dari "+queue.length+
          (q&&q.activeGeneration&&q.activeGeneration.active
            ?" — sedang membuat bank M"+q.activeGeneration.module+".":".");
        return;
      }

      // 3) Ketersediaan bank soal dulu: bank READY berarti Quiz bisa dimainkan
      // walau materi sumber lokal sudah tidak ada lagi. [R2-EXT-B-006]
      if(!quizBankCache)quizBankCache=await sendBg({type:"GET_QUIZ_BANK_STATUS",code:selectedCode,module:selectedModule});
      if(!statusEl.isConnected)return;
      statusEl.className="quizStatus";
      if(quizBankCache&&quizBankCache.ok&&quizBankCache.ready===true){
        statusEl.textContent="✓ Bank soal M"+selectedModule+" sudah tersedia. Quiz bisa langsung dimainkan.";
        return;
      }

      // 4) Kualitas sumber materi: hanya relevan saat bank harus dibuat dulu.
      if(!quizSourceCache)quizSourceCache=await sendBg({type:"GET_QUIZ_SOURCE_STATUS",code:selectedCode,module:selectedModule});
      if(!statusEl.isConnected)return;
      const notice=BMP_MY_BMP_UI.quizSourceNotice(quizSourceCache,selectedModule);
      const level=quizSourceCache&&quizSourceCache.ok?quizSourceCache.quality&&quizSourceCache.quality.level:null;
      if(notice&&(level==="invalid"||quizSourceCache.sourceAvailable!==true)){
        statusEl.className="quizStatus error";
        statusEl.textContent=notice;
        return;
      }

      // 5) Bank belum siap: jelaskan alasannya.
      if(quizBankCache&&quizBankCache.ok){
        if(notice){
          statusEl.textContent=notice;
        }else if(quizBankCache.generationAvailable===false){
          statusEl.textContent="Bank soal M"+selectedModule+" belum tersedia dan pembuatan bank baru sedang dinonaktifkan.";
        }else{
          statusEl.textContent="Bank soal M"+selectedModule+" belum tersedia. Tekan Generate Quiz untuk membuatnya.";
        }
        return;
      }
      if(notice){statusEl.textContent=notice;return;}
      statusEl.textContent="";
    }catch{/* tanpa status bukan kegagalan */}
  }

  async function generateQuizForSelected(code){
    const statusEl=document.getElementById("quizStatus");
    if(!selectedModule)return;
    if(statusEl){statusEl.className="quizStatus";statusEl.textContent="Menyiapkan Quiz M"+selectedModule+"…";}
    try{
      // [R2-EXT-B-006] Bank yang sudah READY tidak butuh materi sumber: klik
      // tombol harus membuka ronde di Telegram (background: READY -> open),
      // bukan diblokir pre-check kualitas sumber. Pre-check hanya relevan saat
      // bank harus dibuat dulu.
      if(!quizBankCache)quizBankCache=await sendBg({type:"GET_QUIZ_BANK_STATUS",code,module:selectedModule});
      const bankReady=!!(quizBankCache&&quizBankCache.ok&&quizBankCache.ready===true);
      let limitedNotice="";
      if(!bankReady){
        // Pre-check kualitas sumber: modul tanpa materi (invalid/belum ada) tidak
        // boleh masuk antrian — beri pesan jelas seperti sidepanel, bukan UI membeku.
        const src=await sendBg({type:"GET_QUIZ_SOURCE_STATUS",code,module:selectedModule});
        quizSourceCache=src;
        const blocked=!src||src.ok!==true||src.sourceAvailable!==true||
          (src.quality&&src.quality.level==="invalid");
        if(blocked){
          if(statusEl){
            statusEl.className="quizStatus error";
            statusEl.textContent=BMP_MY_BMP_UI.quizSourceNotice(src,selectedModule)||
              "M"+selectedModule+" belum siap untuk Quiz. Unduh ulang sekali untuk menyiapkan materi.";
          }
          return;
        }
        limitedNotice=BMP_MY_BMP_UI.quizSourceNotice(src,selectedModule);
      }
      const res=await chrome.runtime.sendMessage({type:"ENQUEUE_QUIZ_GENERATE",code,module:selectedModule});
      if(!res||res.ok!==true){
        if(statusEl){statusEl.className="quizStatus error";statusEl.textContent=res?.error||"Quiz tidak dapat disiapkan.";}
        return;
      }
      if(res.queued){
        if(statusEl){
          statusEl.className="quizStatus";
          statusEl.textContent=(limitedNotice?limitedNotice+" ":"")+
            (res.alreadyQueued
              ?"M"+selectedModule+" sudah menunggu di antrian generate #"+res.position+"."
              :"M"+selectedModule+" masuk antrian generate #"+res.position+". Bank soal dibuat otomatis begitu giliran tiba.");
        }
        refreshQuizStatus(false);
        return;
      }
      if(statusEl){
        statusEl.className="quizStatus success";
        statusEl.textContent=res.bankCreated
          ?"✓ Soal baru dibuat dan ronde dibuka di Telegram."
          :"✓ Bank soal sudah tersedia; ronde dibuka di Telegram.";
      }
    }catch(error){
      if(statusEl){statusEl.className="quizStatus error";statusEl.textContent="Gagal menyiapkan Quiz: "+(error?.message||error);}
    }
  }

  function renderDetail(){
    const detail=document.getElementById("detail");
    detail.textContent="";
    const material=currentMaterial();
    if(!material){
      showDashboard();
      return;
    }

    detail.appendChild(el("button",{class:"textButton backLink",text:"← Kembali ke semua materi",onclick:showDashboard}));
    detail.appendChild(el("h2",{class:"detailTitle"},material.code+(material.title?" · "+material.title:"")));
    detail.appendChild(el("div",{class:"detailMeta"},
      material.modules.length+" modul tersimpan · "+formatBytes(material.bytes)
      +(material.detectedLastModule?" · terakhir diproses: Modul "+material.detectedLastModule:"")));

    // Permintaan Owner 2026-10-12: list modul pindah ke sidebar kiri
    // (menggantikan grid chip horizontal); kolom kanan berisi aksi & info.
    const layout=el("div",{class:"detailLayout"});
    const sidebar=el("nav",{class:"moduleSidebar","aria-label":"Pilih modul"});
    for(const moduleNo of material.modules){
      sidebar.appendChild(el("button",{
        class:"moduleChoice"+(moduleNo===selectedModule?" selected":""),
        "data-module":String(moduleNo),
        title:"Pilih Modul "+moduleNo,
        onclick:()=>selectModule(moduleNo)
      },[
        el("span",{class:"moduleChoiceNo",text:"Modul "+moduleNo})
      ]));
    }
    const main=el("div",{class:"moduleMain"});

    const actions=el("div",{class:"actions"},[
      el("button",{class:"primary",text:"Buka Reader",onclick:()=>openModule(selectedModule)}),
      el("button",{text:"Ekspor PDF",onclick:()=>exportModule(selectedModule)}),
      el("button",{id:"quizButton",text:"Generate Quiz",onclick:()=>generateQuizForSelected(material.code)}),
      // Permintaan Owner 2026-10-12: label tombol hapus menyebut kode materi.
      el("button",{text:"Hapus "+material.code,onclick:()=>removeMaterial(material.code)})
    ]);
    main.appendChild(actions);
    // Baris status quiz (Item 9 + Batch 14): status hidup — polling ringan
    // setiap 5 detik memastikan kegagalan/progress di background selalu
    // sampai ke sini dan tidak ada UI yang membeku di pesan lama.
    main.appendChild(el("div",{id:"quizStatus",class:"quizStatus"},""));
    stopQuizStatusPolling();
    refreshQuizStatus(false);
    quizStatusTimer=setInterval(()=>refreshQuizStatus(false),5000);

    const embedHost=el("div",{id:"embedHost"});
    main.appendChild(embedHost);
    layout.appendChild(sidebar);
    layout.appendChild(main);
    detail.appendChild(layout);
    if(selectedModule)renderEmbed(material.code,selectedModule,embedHost);
  }

  // Renderer PDF lokal (Batch 33): canvas PDF.js + toolbar halaman/zoom.
  // Kontrak: (a) tidak ada blob URL PDF ke viewer browser; (b) pindah modul /
  // kembali ke dashboard membatalkan loading task & meng-dispose dokumen;
  // (c) kegagalan baca/render tampil sebagai notice error, pustaka tetap jalan.
  const EMBED_ZOOM_STEP=1.25;
  const EMBED_ZOOM_MIN=0.5;
  const EMBED_ZOOM_MAX=3;

  function embedRenderToken(){
    return activeEmbedKey;
  }

  async function embedDrawPage(){
    const pdf=embedPdf;
    const ui=embedUi;
    if(!pdf||!ui)return;
    const token=embedRenderToken();
    if(embedRenderTask){
      try{embedRenderTask.cancel();}catch{ /* render lama dibatalkan */ }
      embedRenderTask=null;
    }
    if(embedTextTask){
      try{embedTextTask.cancel();}catch{ /* text layer lama dibatalkan */ }
      embedTextTask=null;
    }
    let page=null;
    try{
      page=await pdf.getPage(embedPageNo);
      if(embedRenderToken()!==token)return;
      const outputScale=Math.min(window.devicePixelRatio||1,3);
      const viewport=page.getViewport({scale:embedScale});
      ui.canvas.width=Math.floor(viewport.width*outputScale);
      ui.canvas.height=Math.floor(viewport.height*outputScale);
      ui.canvas.style.width=Math.floor(viewport.width)+"px";
      ui.canvas.style.height=Math.floor(viewport.height)+"px";
      // Batch 37: wrapper .readerPage memberi kerangka posisi textLayer —
      // ukurannya mengikuti canvas sehingga layer teks menutupi halaman pas.
      ui.page.style.width=Math.floor(viewport.width)+"px";
      ui.page.style.height=Math.floor(viewport.height)+"px";
      const ctx=ui.canvas.getContext("2d");
      embedRenderTask=page.render({
        canvasContext:ctx,
        viewport,
        transform:outputScale!==1?[outputScale,0,0,outputScale,0,0]:null
      });
      await embedRenderTask.promise;
      embedRenderTask=null;
      if(embedRenderToken()!==token)return;
      ui.pageNotice.textContent="";
      ui.pageNotice.hidden=true;
      await embedDrawTextLayer(page,viewport);
      if(embedRenderToken()!==token)return;
      embedMarkHits();
      embedScrollActiveHit(false);
    }catch(error){
      if(embedRenderToken()!==token)return;
      if(String(error?.name||"")==="RenderingCancelledException")return;
      ui.pageNotice.textContent="Gagal menampilkan halaman: "+(error?.message||error);
      ui.pageNotice.hidden=false;
    }
    embedSyncToolbar();
  }

  // Batch 37: text layer PDF.js di atas canvas — teks jadi bisa diseleksi/
  // disalin dan menjadi landasan highlight pencarian. pdf.js 3.11.174
  // (renderTextLayer + --scale-factor di container; diverifikasi dari vendor).
  // Defensif: bila API tidak ada, layer dilewati — reader tetap jalan.
  async function embedDrawTextLayer(page,viewport){
    const ui=embedUi;
    const token=embedRenderToken();
    if(!ui)return;
    ui.textLayer.textContent="";
    ui.textLayer.style.setProperty("--scale-factor",String(viewport.scale));
    if(typeof global.pdfjsLib.renderTextLayer!=="function")return;
    let content=null;
    try{
      content=await page.getTextContent();
    }catch{ return; /* halaman tanpa teks: canvas tetap tampil */ }
    if(embedRenderToken()!==token)return;
    if(embedPageTextCache)embedPageTextCache.set(embedPageNo,content.items||[]);
    let task=null;
    try{
      task=global.pdfjsLib.renderTextLayer({
        textContentSource:content,
        container:ui.textLayer,
        viewport
      });
      embedTextTask=task;
      await task.promise;
      if(embedTextTask===task)embedTextTask=null;
      if(embedRenderToken()!==token)return;
      // Batch 38b: ambil daftar div teks (1:1 dengan items). Getter publik
      // `textDivs` ada di sumber pdf.js; build minified lokal hanya menyimpan
      // `_textDivs`, jadi coba keduanya. Versi vendor dipin SHA-256 di
      // build-release, jadi bentuk internalnya stabil.
      const divs=Array.isArray(task?.textDivs)?task.textDivs
        :(Array.isArray(task?._textDivs)?task._textDivs:null);
      embedTextDivs=divs?divs.filter(node=>node&&node.nodeType===1):[];
    }catch(error){
      // Hanya bersihkan bila task ini yang aktif — task lama yang dibatalkan
      // tidak boleh menghapus layer hasil render halaman baru (race pindah
      // halaman saat layer masih dirender).
      if(embedTextTask===task){
        embedTextTask=null;
        if(embedRenderToken()===token){
          ui.textLayer.textContent=""; // layer parsial dibuang, canvas tetap tampil
          embedTextDivs=[];
        }
      }
    }
  }

  // Batch 37 (+ fix 38b): highlight hasil pencarian di text layer halaman aktif.
  // Sumber pemetaan utama = embedTextDivs (daftar div teks per item dari
  // renderTextLayer, 1:1 dengan items textContent) sehingga indeks item =
  // indeks div. Bila daftar itu tidak tersedia, baru jatuh ke pemetaan isi
  // span, dan di sana match aktif dipilih berdasarkan URUTAN match di halaman
  // ini — bukan selalu match pertama (bug yang dilaporkan Owner 2026-10-24).
  function embedMarkHits(){
    const ui=embedUi;
    if(!ui)return;
    const domSpans=Array.from(ui.textLayer.querySelectorAll("span"));
    for(const span of domSpans)span.classList.remove("readerHit","readerHitActive");
    for(const div of embedTextDivs)if(div&&div.classList)div.classList.remove("readerHit","readerHitActive");
    if(!embedSearchQuery||!embedSearchMatches.length)return;
    const byItem=new Map();
    embedSearchMatches.forEach((match,i)=>{
      if(match.page===embedPageNo)byItem.set(match.item,i);
    });
    if(!byItem.size)return;
    const items=(embedPageTextCache&&embedPageTextCache.get(embedPageNo))||null;
    const ordered=embedTextDivs.length&&(!items||embedTextDivs.length===items.length)?embedTextDivs:null;
    if(ordered){
      for(const [itemIndex,matchIndex] of byItem){
        const div=ordered[itemIndex];
        if(!div||!div.classList)continue;
        div.classList.add("readerHit");
        if(matchIndex===embedSearchIndex)div.classList.add("readerHitActive");
      }
      return;
    }
    // Fallback: cocokkan isi span satu-satu. Match aktif = span ke-N yang
    // cocok, dengan N = urutan match aktif di antara match halaman ini.
    const q=embedSearchQuery.toLowerCase();
    const activeOrdinal=activeOrdinalForPage(embedSearchMatches,embedSearchIndex,embedPageNo);
    let seen=0;
    for(const span of domSpans){
      if(!String(span.textContent||"").toLowerCase().includes(q))continue;
      span.classList.add("readerHit");
      if(seen===activeOrdinal)span.classList.add("readerHitActive");
      seen++;
    }
  }

  function embedScrollActiveHit(smooth){
    const ui=embedUi;
    if(!ui||!embedSearchMatches.length)return;
    const active=ui.textLayer.querySelector(".readerHitActive");
    if(active){
      try{active.scrollIntoView({block:"center",behavior:smooth?"smooth":"auto"});}catch{ /* abaikan */ }
    }
  }

  // Batch 37: mesin pencarian modul — telusuri textContent semua halaman
  // secara serial (hemat memori, token-guarded), kumpulkan match {page,item},
  // lalu tandai di text layer. Murni lokal; tidak ada network.
  function embedSyncSearchToolbar(){
    const ui=embedUi;
    if(!ui)return;
    const total=embedSearchMatches.length;
    if(!embedSearchQuery){
      ui.searchCount.textContent="";
      ui.searchPrev.disabled=true;
      ui.searchNext.disabled=true;
      return;
    }
    ui.searchCount.textContent=total?(embedSearchIndex+1)+" dari "+total:"0 dari 0";
    ui.searchPrev.disabled=total===0;
    ui.searchNext.disabled=total===0;
  }

  async function embedFetchPageItems(pageNo){
    if(embedPageTextCache&&embedPageTextCache.has(pageNo))return embedPageTextCache.get(pageNo);
    const page=await embedPdf.getPage(pageNo);
    const content=await page.getTextContent();
    const items=content.items||[];
    if(embedPageTextCache)embedPageTextCache.set(pageNo,items);
    return items;
  }

  async function embedRunSearch(query){
    const q=String(query||"").trim();
    const job=++embedSearchJob;
    const token=activeEmbedKey;
    embedSearchQuery=q;
    embedSearchMatches=[];
    embedSearchIndex=0;
    if(!q||!embedPdf){
      embedMarkHits(); // hapus sisa highlight tanpa menunggu redraw
      embedSyncSearchToolbar();
      return;
    }
    const matches=[];
    for(let pageNo=1;pageNo<=embedTotalPages;pageNo++){
      if(embedSearchJob!==job||activeEmbedKey!==token)return;
      let items=[];
      try{
        items=await embedFetchPageItems(pageNo);
      }catch{ items=[]; /* halaman gagal dibaca dilewati, pencarian lanjut */ }
      if(embedSearchJob!==job||activeEmbedKey!==token)return;
      for(const itemIndex of findTextMatchesInItems(items,q)){
        matches.push({page:pageNo,item:itemIndex});
      }
      // Progressif: publish referensi match sejauh ini (embedMarkHits membaca
      // state global), supaya highlight halaman aktif tampil tanpa menunggu
      // seluruh dokumen selesai ditelusuri.
      embedSearchMatches=matches;
      if(pageNo===embedPageNo)embedMarkHits();
    }
    if(embedSearchJob!==job||activeEmbedKey!==token)return;
    embedSearchMatches=matches;
    embedSearchIndex=0;
    embedSyncSearchToolbar();
    if(matches.length){
      if(matches[0].page!==embedPageNo){
        embedSetPage(matches[0].page);
      }else{
        embedMarkHits();
        embedScrollActiveHit(true);
      }
    }
  }

  function embedStepSearch(delta){
    if(!embedSearchMatches.length)return;
    const total=embedSearchMatches.length;
    embedSearchIndex=((embedSearchIndex+delta)%total+total)%total; // wrap-around
    const match=embedSearchMatches[embedSearchIndex];
    embedSyncSearchToolbar();
    if(match.page!==embedPageNo){
      embedSetPage(match.page); // draw ulang menandai + scroll via embedDrawPage
    }else{
      embedMarkHits();
      embedScrollActiveHit(true);
    }
  }

  function embedSyncToolbar(){
    const ui=embedUi;
    if(!ui)return;
    ui.pageInput.value=String(embedPageNo);
    ui.pageTotal.textContent="dari "+embedTotalPages;
    ui.prev.disabled=embedPageNo<=1;
    ui.next.disabled=embedPageNo>=embedTotalPages;
    ui.zoomOut.disabled=embedScale<=EMBED_ZOOM_MIN;
    ui.zoomIn.disabled=embedScale>=EMBED_ZOOM_MAX;
    ui.fitWidth.classList.toggle("selected",embedFitWidth);
  }

  function embedSetPage(n){
    if(!embedPdf)return;
    const target=Math.max(1,Math.min(embedTotalPages,Math.floor(Number(n)||embedPageNo)));
    if(target===embedPageNo)return;
    embedPageNo=target;
    // Batch 38: halaman baru selalu mulai dari tepi kiri-atas. Tanpa reset
    // scrollLeft, halaman berikutnya mewarisi posisi geser lama dan terlihat
    // "tercrop" di kiri saat konten lebih lebar dari viewport.
    embedUi.viewport.scrollTop=0;
    embedUi.viewport.scrollLeft=0;
    embedSyncToolbar();
    void embedDrawPage();
  }

  function embedApplyZoom(scale,fitWidth){
    if(!embedPdf)return;
    // Batch 36b: clamp 0.5-3 hanya untuk zoom manual. Fit-width harus pas
    // mengikuti container — boleh di bawah 0.5 (popup Android sempit; tanpa
    // ini canvas melebihi container bahkan di zoom paling minimal).
    const fit=Boolean(fitWidth);
    embedScale=fit
      ?Math.min(EMBED_ZOOM_MAX,Math.max(0.05,scale))
      :Math.max(EMBED_ZOOM_MIN,Math.min(EMBED_ZOOM_MAX,scale));
    embedFitWidth=fit;
    embedSyncToolbar();
    void embedDrawPage();
  }

  // Batch 36b: lebar diukur dari CONTENT-BOX viewport (clientWidth dikurangi
  // padding), bukan clientWidth mentah: clientWidth termasuk padding 20px
  // sehingga canvas selalu ~20px lebih lebar dari area visible → scrollbar
  // horizontal permanen. Lebar viewport sendiri ditentukan parent (.embedWrap
  // blok) dan TIDAK dipengaruhi ukuran canvas (canvas hanya memengaruhi
  // scrollWidth), sehingga pengukuran ini stabil — bebas loop.
  function embedContentBoxWidth(viewportEl){
    const base=viewportEl?viewportEl.clientWidth:0;
    const cs=viewportEl?getComputedStyle(viewportEl):null;
    const pad=(parseFloat(cs&&cs.paddingLeft)||0)+(parseFloat(cs&&cs.paddingRight)||0);
    return Math.max(0,Math.floor(base-pad));
  }

  function embedComputeFitScale(pdf,containerWidth){
    const width=Number(containerWidth)||0;
    if(!width||width<50)return 1;
    // Skala dihitung dari lebar halaman pertama; PDF BMP seragam sehingga
    // halaman lain hampir selalu selebar halaman pertama. Tanpa page.cleanup():
    // proxy halaman dipakai bersama jalur render aktif.
    return pdf.getPage(1).then(page=>{
      const vp=page.getViewport({scale:1});
      return vp.width>0?Math.min(EMBED_ZOOM_MAX,width/vp.width):1;
    }).catch(()=>1);
  }

  async function renderEmbed(code,moduleNo,host){
    const key=moduleKey(code,moduleNo);
    if(activeEmbedKey===key){
      // Klik ulang modul yang sama: detail direbuild sehingga wrap lama
      // tercabut dari DOM — pasang kembali daripada render ulang.
      if(embedWrapNode&&embedUi&&embedWrapNode.parentNode!==host){
        host.textContent="";
        host.appendChild(embedWrapNode);
      }
      return;
    }
    releaseEmbed();
    host.textContent="";
    if(typeof global.pdfjsLib==="undefined"||!global.pdfjsLib){
      host.appendChild(el("div",{class:"notice error"},"Gagal membuka PDF: renderer tidak tersedia. Muat ulang halaman ini."));
      return;
    }
    const canvas=el("canvas",{class:"readerCanvas",role:"img","aria-label":"Halaman PDF "+key});
    const textLayer=el("div",{class:"textLayer"});
    const page=el("div",{class:"readerPage"},[canvas,textLayer]);
    const pageNotice=el("div",{class:"notice error pageNotice",hidden:true});
    const viewport=el("div",{class:"readerViewport"},[page,pageNotice]);
    const pageInput=el("input",{class:"readerPageInput",type:"number",min:"1",value:"1","aria-label":"Halaman saat ini"});
    const pageTotal=el("span",{class:"readerPageTotal",text:"dari …"});
    const prev=el("button",{type:"button",class:"readerNav",text:"‹","aria-label":"Halaman sebelumnya",title:"Halaman sebelumnya"});
    const next=el("button",{type:"button",class:"readerNav",text:"›","aria-label":"Halaman berikutnya",title:"Halaman berikutnya"});
    const zoomOut=el("button",{type:"button",class:"readerNav",text:"−","aria-label":"Perkecil",title:"Perkecil"});
    const zoomIn=el("button",{type:"button",class:"readerNav",text:"+","aria-label":"Perbesar",title:"Perbesar"});
    const fitWidth=el("button",{type:"button",class:"readerNav readerFit",text:"Muat lebar","aria-label":"Muat lebar halaman",title:"Muat lebar halaman"});
    const toolbar=el("div",{class:"readerToolbar",role:"toolbar","aria-label":"Kontrol PDF"},[
      prev,pageInput,pageTotal,next,
      el("span",{class:"readerSpacer"}),
      zoomOut,zoomIn,fitWidth
    ]);
    // Batch 37: pencarian modul — input + navigasi match + label hitung.
    const searchInput=el("input",{class:"readerSearchInput",type:"text",placeholder:"Cari di modul…","aria-label":"Cari di modul"});
    const searchPrev=el("button",{type:"button",class:"readerNav",text:"‹","aria-label":"Match sebelumnya",title:"Match sebelumnya",disabled:true});
    const searchNext=el("button",{type:"button",class:"readerNav",text:"›","aria-label":"Match berikutnya",title:"Match berikutnya",disabled:true});
    const searchCount=el("span",{class:"readerSearchCount",text:""});
    const searchBar=el("div",{class:"readerSearchBar",role:"search","aria-label":"Pencarian modul"},[
      searchInput,searchPrev,searchNext,searchCount
    ]);
    const wrap=el("div",{class:"embedWrap readerWrap"},[toolbar,searchBar,viewport]);
    host.appendChild(wrap);
    embedUi={canvas,page,textLayer,pageNotice,viewport,pageInput,pageTotal,prev,next,zoomOut,zoomIn,fitWidth,searchInput,searchPrev,searchNext,searchCount};
    embedWrapNode=wrap;
    activeEmbedKey=key;
    embedPageTextCache=new Map();
    embedTextDivs=[];

    try{
      const bytes=await STORE.readPdf(key);
      if(embedRenderToken()!==key)return;
      global.pdfjsLib.GlobalWorkerOptions.workerSrc=chrome.runtime.getURL("vendor/pdf.worker.min.js");
      const loadingTask=global.pdfjsLib.getDocument({data:bytes,isEvalSupported:false});
      const pdf=await loadingTask.promise;
      if(embedRenderToken()!==key){
        try{pdf.destroy();}catch{ /* dokumen dibuang diam-diam */ }
        return;
      }
      embedPdf=pdf;
      embedTotalPages=pdf.numPages||0;
      embedPageNo=1;
      embedFitWidth=true;
      const fitWidthPx=embedContentBoxWidth(viewport);
      embedLastFitWidth=fitWidthPx;
      embedScale=await embedComputeFitScale(pdf,fitWidthPx);
      if(embedRenderToken()!==key)return;
      embedSyncToolbar();
      await embedDrawPage();
      if(embedRenderToken()!==key)return;
      prev.addEventListener("click",()=>embedSetPage(embedPageNo-1));
      next.addEventListener("click",()=>embedSetPage(embedPageNo+1));
      zoomOut.addEventListener("click",()=>embedApplyZoom(embedScale/EMBED_ZOOM_STEP,false));
      zoomIn.addEventListener("click",()=>embedApplyZoom(embedScale*EMBED_ZOOM_STEP,false));
      fitWidth.addEventListener("click",()=>{
        const widthPx=embedContentBoxWidth(viewport);
        embedComputeFitScale(embedPdf,widthPx).then(scale=>{
          if(embedRenderToken()===key){embedLastFitWidth=widthPx;embedApplyZoom(scale,true);}
        });
      });
      pageInput.addEventListener("change",()=>embedSetPage(pageInput.value));
      pageInput.addEventListener("keydown",event=>{
        if(event.key==="Enter")embedSetPage(pageInput.value);
      });
      // Batch 37: pencarian modul — debounce saat mengetik, Enter langsung.
      searchInput.addEventListener("input",()=>{
        clearTimeout(embedSearchTimer);
        embedSearchTimer=setTimeout(()=>{embedSearchTimer=0;void embedRunSearch(searchInput.value);},200);
      });
      searchInput.addEventListener("keydown",event=>{
        if(event.key==="Enter"){
          clearTimeout(embedSearchTimer);
          embedSearchTimer=0;
          void embedRunSearch(searchInput.value);
        }
      });
      searchPrev.addEventListener("click",()=>embedStepSearch(-1));
      searchNext.addEventListener("click",()=>embedStepSearch(1));
      if(typeof ResizeObserver!=="undefined"){
        // Batch 36b: amati WRAPPER stabil, bukan viewport (elemen scroll yang
        // ukurannya berubah akibat render sendiri → siklus recompute).
        // Guard: refit hanya bila lebar content-box berubah >=2px.
        const observer=new ResizeObserver(()=>{
          if(!embedFitWidth||!embedPdf)return;
          clearTimeout(embedResizeTimer);
          embedResizeTimer=setTimeout(()=>{
            if(embedRenderToken()!==key||!embedFitWidth)return;
            const widthPx=embedContentBoxWidth(viewport);
            if(Math.abs(widthPx-embedLastFitWidth)<2)return;
            embedComputeFitScale(embedPdf,widthPx).then(scale=>{
              if(embedRenderToken()===key){embedLastFitWidth=widthPx;embedApplyZoom(scale,true);}
            });
          },150);
        });
        observer.observe(wrap);
        embedResizeObserver=observer;
      }
    }catch(error){
      if(embedRenderToken()!==key)return;
      host.textContent="";
      releaseEmbed();
      host.appendChild(el("div",{class:"notice error"},"Gagal membuka PDF: "+(error?.message||error)));
    }
  }

  function selectModule(moduleNo){
    selectedModule=moduleNo;
    renderDetail();
  }

  async function openModule(moduleNo){
    if(!moduleNo||!selectedCode)return;
    const embedHost=document.getElementById("embedHost");
    try{
      const res=await chrome.runtime.sendMessage({type:"OPEN_READER",code:selectedCode,module:moduleNo});
      if(!res||res.ok!==true)throw new Error(res?.error||"Reader tidak bisa dibuka.");
    }catch(error){
      if(embedHost)notice(embedHost,"Gagal membuka reader: "+(error?.message||error),"error");
    }
  }

  // Audit ronde 2 (R2-EXT-B-003): blob export PDF dulu tak pernah di-revoke
  // sehingga menumpuk sepanjang umur halaman. Pola sama dengan popup.js
  // (cleanupLocalBackupTempAfterDownload): revoke saat download selesai/gagal,
  // dengan fallback waktu supaya blob besar/lambat tak dicabut kepagian.
  function releaseExportedBlobAfterDownload(downloadId,url){
    let cleaned=false;
    let fallbackTimer=0;
    const cleanup=()=>{
      if(cleaned)return;
      cleaned=true;
      if(fallbackTimer)clearTimeout(fallbackTimer);
      fallbackTimer=0;
      try{chrome.downloads.onChanged.removeListener(listener);}catch{ /* listener bisa sudah hilang; abaikan */ }
      try{URL.revokeObjectURL(url);}catch{ /* revoke ganda/URL mati; abaikan */ }
    };
    const listener=delta=>{
      if(Number(delta?.id)!==Number(downloadId))return;
      const state=String(delta?.state?.current||"");
      if(state==="complete"||state==="interrupted")cleanup();
    };
    chrome.downloads.onChanged.addListener(listener);
    // fallbackTimer: bila sinyal selesai dari browser hilang (unduhan sangat
    // lambat), blob tetap dibersihkan tanpa mencabut URL besar kepagian.
    fallbackTimer=setTimeout(cleanup,5*60*1000);
    // Guard balapan: unduhan bisa selesai sebelum listener terpasang.
    Promise.resolve(chrome.downloads.search({id:Number(downloadId)})).then(items=>{
      const state=String(items?.[0]?.state||"");
      if(state==="complete"||state==="interrupted")cleanup();
    }).catch(()=>{});
    return cleanup;
  }

  async function exportModule(moduleNo){
    if(!moduleNo)return;
    const key=moduleKey(selectedCode,moduleNo);
    const host=document.getElementById("embedHost");
    try{
      const bytes=await STORE.readPdf(key);
      const url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
      const downloadId=await chrome.downloads.download({
        url,
        filename:"BMP Terbuka/"+selectedCode+"/"+selectedCode+"_M"+moduleNo+"_Searchable.pdf",
        saveAs:true
      });
      releaseExportedBlobAfterDownload(downloadId,url);
      if(host)notice(host,"Ekspor dimulai. Simpan file di dialog download.","success");
    }catch(error){
      if(host)notice(host,"Gagal ekspor: "+(error?.message||error),"error");
    }
  }

  // Judul BMP diambil dari katalog resmi UT lewat background (GET_MATERIAL_TITLE;
  // background yang fetch karena CSP connect-src halaman ekstensi terkunci).
  // Sekali per kode: hasil (termasuk "tidak ada judul") di-cache background di
  // bmpCacheMeta. Urutan serial supaya sopan ke katalog; gagal = kode saja.
  let titlesEnsured=false;
  async function ensureTitles(){
    if(titlesEnsured)return;
    titlesEnsured=true;
    let changed=false;
    for(const item of materials){
      if(item.title)continue;
      const res=await sendBg({type:"GET_MATERIAL_TITLE",code:item.code});
      const title=String(res&&res.ok===true?res.title:"");
      if(title){
        item.title=title;
        changed=true;
      }
    }
    if(changed){renderDashboard();renderDetail();}
  }

  async function boot(){
    try{
      materials=await STORE.listMaterials();
      document.getElementById("materialFilter").addEventListener("input",event=>{
        filterQuery=event.target.value;
        renderDashboard();
      });
      renderDashboard();
      // Judul = pelengkap: kegagalan ambil katalog tidak boleh mengganggu daftar.
      ensureTitles().then(()=>{}).catch(()=>{});
    }catch(error){
      const empty=document.getElementById("dashboardEmpty");
      empty.hidden=false;
      empty.textContent="";
      empty.appendChild(el("div",{class:"notice error"},"Gagal membaca penyimpanan lokal: "+(error?.message||error)));
      document.getElementById("dashboardGrid").textContent="";
    }
  }

  window.addEventListener("pagehide",releaseEmbed);
  boot();
})(typeof self!=="undefined"?self:globalThis);
