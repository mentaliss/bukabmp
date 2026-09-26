(function(root){
"use strict";
const IMAGE_MIME=new Set(["image/jpeg","image/png","image/webp"]);
const VIDEO_MIME=new Set(["video/mp4","video/webm"]);

function safeId(value){
  const id=String(value||"").trim();
  return /^[0-9a-f]{64}$/i.test(id)?id:"";
}
function safeBase(value){
  try{
    const url=new URL(String(value||""));
    return url.protocol==="https:"?url.toString().replace(/\/$/,""):"";
  }catch(_){return "";}
}
function mediaUrl(apiBase,asset){
  const base=safeBase(apiBase),id=safeId(asset?.id);
  return base&&id?`${base}/v1/media/${encodeURIComponent(id)}`:"";
}
function revokeNodeUrl(node){
  const u=node?.dataset?.bmpObjectUrl||"";
  if(u){try{URL.revokeObjectURL(u);}catch(_){} delete node.dataset.bmpObjectUrl;}
  const p=node?.dataset?.bmpPosterUrl||"";
  if(p){try{URL.revokeObjectURL(p);}catch(_){} delete node.dataset.bmpPosterUrl;}
}
function clear(container){
  if(!container)return;
  for(const node of [...container.querySelectorAll("video,img")])revokeNodeUrl(node);
  for(const node of [...container.querySelectorAll("video")]){
    try{node.pause();node.removeAttribute("src");node.load();}catch(_){}
  }
  container.textContent="";
  container.style.aspectRatio="";
}
function applyIntrinsicFrame(container,asset){
  const width=Number(asset?.width),height=Number(asset?.height);
  if(Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0){
    container.style.aspectRatio=`${width} / ${height}`;
    return width/height;
  }
  container.style.aspectRatio="";
  return null;
}
async function loadBlob(url,expectedMime){
  const response=await fetch(url,{method:"GET",credentials:"omit",cache:"no-store"});
  if(!response.ok)throw new Error("media_http_"+response.status);
  const type=String(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  if(expectedMime&&type&&type!==String(expectedMime).toLowerCase())throw new Error("media_mime_mismatch");
  return await response.blob();
}
function reportFailure(container,onError,reason){
  clear(container);
  try{onError(reason);}catch(_){}
}
function render(container,{apiBase,asset,posterAsset=null,mode,onError=()=>{}}={}){
  clear(container);
  if(!container||!asset)return null;

  const src=mediaUrl(apiBase,asset);
  if(!src)return null;
  const wanted=String(mode||"").toLowerCase();
  const mime=String(asset.mime||"").toLowerCase();
  applyIntrinsicFrame(container,asset);

  if((wanted==="banner"||wanted==="image")&&IMAGE_MIME.has(mime)){
    const img=document.createElement("img");
    img.className="sponsorMediaAsset";
    img.alt="Materi sponsor";
    img.decoding="async";
    img.loading="eager";

    let fallbackAttempted=false;
    img.addEventListener("error",async()=>{
      if(!img.isConnected)return;
      if(fallbackAttempted){
        reportFailure(container,onError,"image_decode_failed");
        return;
      }
      fallbackAttempted=true;
      try{
        const blob=await loadBlob(src,mime);
        if(!img.isConnected)return;
        const objectUrl=URL.createObjectURL(blob);
        img.dataset.bmpObjectUrl=objectUrl;
        img.src=objectUrl;
      }catch(error){
        reportFailure(container,onError,String(error?.message||"image_load_failed"));
      }
    });

    container.append(img);
    // Prefer the immutable first-party URL. The extension CSP explicitly
    // permits only the BMP Worker origin. Blob fetching is a compatibility
    // fallback for browser-specific element loading failures.
    img.src=src;
    return img;
  }

  if(wanted==="video"&&VIDEO_MIME.has(mime)){
    const video=document.createElement("video");
    video.className="sponsorMediaAsset";
    video.autoplay=true;
    video.muted=true;
    video.defaultMuted=true;
    video.playsInline=true;
    video.loop=false;
    video.controls=false;
    video.preload="metadata";

    const poster=mediaUrl(apiBase,posterAsset);
    if(poster)video.poster=poster;

    let fallbackAttempted=false;
    video.addEventListener("error",async()=>{
      if(!video.isConnected)return;
      if(fallbackAttempted){
        reportFailure(container,onError,"video_decode_failed");
        return;
      }
      fallbackAttempted=true;
      try{
        const blob=await loadBlob(src,mime);
        if(!video.isConnected)return;
        const objectUrl=URL.createObjectURL(blob);
        video.dataset.bmpObjectUrl=objectUrl;
        video.src=objectUrl;
        const play=video.play();
        if(play&&typeof play.catch==="function")play.catch(()=>{});
      }catch(error){
        reportFailure(container,onError,String(error?.message||"video_load_failed"));
      }
    });

    container.append(video);
    video.src=src;
    const play=video.play();
    if(play&&typeof play.catch==="function")play.catch(()=>{});
    return video;
  }
  return null;
}

root.BMP_ADS_MEDIA=Object.freeze({
  IMAGE_MIME,VIDEO_MIME,safeId,mediaUrl,clear,applyIntrinsicFrame,render
});
})(typeof self!=="undefined"?self:globalThis);
