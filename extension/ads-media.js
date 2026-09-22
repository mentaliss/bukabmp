(function(root){
"use strict";
const IMAGE_MIME=new Set(["image/jpeg","image/png","image/webp"]);
const VIDEO_MIME=new Set(["video/mp4","video/webm"]);
function safeId(value){const id=String(value||"").trim();return /^[0-9a-f]{64}$/i.test(id)?id:"";}
function safeBase(value){try{const url=new URL(String(value||""));return url.protocol==="https:"?url.toString().replace(/\/$/,""):"";}catch(_){return "";}}
function mediaUrl(apiBase,asset){const base=safeBase(apiBase),id=safeId(asset?.id);return base&&id?`${base}/v1/media/${encodeURIComponent(id)}`:"";}
function clear(container){if(!container)return;for(const node of [...container.querySelectorAll("video")]){try{node.pause();node.removeAttribute("src");node.load();}catch(_){}}container.textContent="";}
function render(container,{apiBase,asset,posterAsset=null,mode,onError=()=>{}}={}){
 clear(container);if(!container||!asset)return null;const src=mediaUrl(apiBase,asset);if(!src)return null;const wanted=String(mode||"").toLowerCase();
 if((wanted==="banner"||wanted==="image")&&IMAGE_MIME.has(String(asset.mime||"").toLowerCase())){const img=document.createElement("img");img.className="sponsorMediaAsset";img.alt="Materi sponsor";img.decoding="async";img.loading="eager";img.src=src;img.addEventListener("error",()=>{clear(container);onError("image_load_failed");},{once:true});container.append(img);return img;}
 if(wanted==="video"&&VIDEO_MIME.has(String(asset.mime||"").toLowerCase())){const video=document.createElement("video");video.className="sponsorMediaAsset";video.autoplay=true;video.muted=true;video.defaultMuted=true;video.playsInline=true;video.loop=false;video.controls=false;video.preload="metadata";const poster=mediaUrl(apiBase,posterAsset);if(poster)video.poster=poster;video.src=src;video.addEventListener("error",()=>{clear(container);onError("video_load_failed");},{once:true});container.append(video);const play=video.play();if(play&&typeof play.catch==="function")play.catch(()=>{});return video;}
 return null;
}
root.BMP_ADS_MEDIA=Object.freeze({IMAGE_MIME,VIDEO_MIME,safeId,mediaUrl,clear,render});
})(typeof self!=="undefined"?self:globalThis);
