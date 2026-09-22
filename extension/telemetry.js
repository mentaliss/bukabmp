(function(root){
"use strict";
const STORAGE_KEY="bmpAnalyticsIdV1";
const EVENTS=new Set(["extension_open","job_started","job_completed","job_failed","ad_impression","ad_click","ad_dismiss","media_render_failed"]);
const CHANNELS=new Set(["github","android","cws","edge"]);
const PLACEMENTS=new Set(["card","interstitial"]);
function clean(value,max){return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max)}
function safeCampaign(value){const x=clean(value,64);return /^[a-z0-9][a-z0-9_.:-]{0,63}$/i.test(x)?x:"";}
let analyticsIdPromise=null;
async function ensureAnalyticsId(){
 if(analyticsIdPromise)return await analyticsIdPromise;
 analyticsIdPromise=(async()=>{
  const data=await chrome.storage.local.get(STORAGE_KEY);
  const current=clean(data?.[STORAGE_KEY],80);
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(current))return current;
  const id=crypto.randomUUID();
  await chrome.storage.local.set({[STORAGE_KEY]:id});
  return id;
 })();
 try{return await analyticsIdPromise;}finally{analyticsIdPromise=null;}
}
function dimensions(raw={}){const out={};const duration=Math.max(0,Math.min(86400000,Math.floor(Number(raw.duration_ms)||0)));if(duration)out.duration_ms=duration;const campaign=safeCampaign(raw.campaign_id);if(campaign)out.campaign_id=campaign;const placement=clean(raw.placement,24).toLowerCase();if(PLACEMENTS.has(placement))out.placement=placement;if(Number.isFinite(Number(raw.revision)))out.revision=Math.max(0,Math.min(2147483647,Math.floor(Number(raw.revision))));if(raw.paid_direct===true)out.paid_direct=true;const reason=clean(raw.reason,48);if(reason)out.reason=reason;return out;}
async function emit(config,event,rawDimensions={}){const type=clean(event,40).toLowerCase();if(!EVENTS.has(type))return {ok:false,error:"invalid_event"};const base=clean(config?.API_BASE_URL,2048).replace(/\/$/,"");if(!/^https:\/\//i.test(base)||base.includes("__BMP_"))return {ok:false,error:"config_unavailable"};const actorId=await ensureAnalyticsId();const channel=clean(config?.DISTRIBUTION_CHANNEL,24).toLowerCase();const body={actor_id:actorId,event:type,extension_version:clean(chrome.runtime.getManifest().version,32),distribution_channel:CHANNELS.has(channel)?channel:"github",dimensions:dimensions(rawDimensions)};try{const res=await fetch(base+"/v1/telemetry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),keepalive:true});return {ok:res.ok,status:res.status};}catch(_){return {ok:false,error:"network"};}}
root.BMP_TELEMETRY=Object.freeze({STORAGE_KEY,EVENTS,ensureAnalyticsId,emit});
})(typeof self!=="undefined"?self:globalThis);
