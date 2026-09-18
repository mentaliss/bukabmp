function el(id){return document.getElementById(id)}
async function send(type, extra={}){return await chrome.runtime.sendMessage({type,...extra})}

const ACTIVATION_LONG_WAIT_MS = 90_000;
let activationChecking = false;
let latestAccess = null;
let latestVersionPolicy = null;

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
  if(!s.running&&x==="IDLE")return["Siap","Buka halaman reader pada tab aktif, lalu tekan Mulai."];
  if(x==="STARTING")return["Menyiapkan","Menyiapkan dokumen..."];
  if(x.startsWith("OPENING_M"))return["Membuka modul",s.progress||""];
  if(x.startsWith("DOWNLOADING_M"))return["Sedang diproses",s.progress||""];
  if(x.startsWith("OCR_FINALIZING_M"))return["Menyusun PDF","Halaman selesai. Menyusun file PDF..."];
  if(x.startsWith("M")&&x.endsWith("_PDF_READY"))return["PDF siap",s.progress||""];
  if(x==="BUILDING_FULL")return["Menggabungkan PDF",s.progress||""];
  if(x==="DONE"||x==="MAX_MODULE_REACHED")return["Selesai",s.progress||"Semua modul selesai."];
  if(x==="END_CANDIDATE")return["Selesai",s.progress||"Kandidat modul terakhir terdeteksi."];
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
  const [title,text]=humanStatus(s);
  el("statusTitle").textContent=title;
  el("statusText").textContent=text;
  const completed=s.completedModules||[];
  el("completed").textContent=completed.length?`PDF selesai: ${completed.map(x=>"Modul "+x).join(", ")}`:"";
  const o=ocrProgress(s.ocrProgress||"");
  if(s.running&&o.label){
    el("ocrWrap").style.display="block";
    el("ocrLabel").textContent=o.label;
    el("ocrBar").style.width=o.percent==null?"8%":`${o.percent}%`;
  }else{
    el("ocrWrap").style.display="none";
    el("ocrBar").style.width="0%";
  }
  el("start").disabled=Boolean(s.running)||Boolean(latestVersionPolicy?.updateRequired);
  el("stop").disabled=!s.running;
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
  const tabs=await chrome.tabs.query({active:true,currentWindow:true});
  const tab=tabs[0];
  if(!tab?.id||!tab.url?.startsWith("https://pustaka.ut.ac.id/reader/")){
    el("statusTitle").textContent="Buka reader terlebih dahulu";
    el("statusText").textContent="Tab aktif harus berada pada halaman reader yang didukung.";
    return;
  }
  const startModule=Number(el("startModule").value);
  const maxModule=Number(el("maxModule").value);
  if(!Number.isInteger(startModule)||!Number.isInteger(maxModule)||startModule<1||maxModule<startModule){
    el("statusTitle").textContent="Periksa modul";
    el("statusText").textContent="Modul terakhir harus sama atau lebih besar dari modul pertama.";
    return;
  }
  const res=await send("START_JOB",{
    tabId:tab.id,
    code:el("code").value.trim().toUpperCase(),
    startModule,maxModule
  });
  if(!res?.ok){
    el("statusTitle").textContent="Gagal memulai";
    el("statusText").textContent=res?.error||"Terjadi kesalahan.";
  }
  await refreshState();
});

el("stop").addEventListener("click",async()=>{await send("STOP_JOB");await refreshState()});
el("about").addEventListener("click",()=>chrome.tabs.create({url:chrome.runtime.getURL("about.html")}));

(async()=>{
  await refreshAccess();
  await refreshVersion();
  await refreshState();
  setInterval(async()=>{await refreshAccess();await refreshState()},1000);
  setInterval(async()=>{
    const a=await send("GET_ACCESS_STATUS");
    if(a?.pending&&!a?.active)await checkPendingActivation({quiet:true});
  },2000);
})();
