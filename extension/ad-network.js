(function(root){
"use strict";
const REQUEST_TIMEOUT_MS=1200;
let cardRequestUsed=false;
function provider(){const sdk=root.BMP_ADSONBREAD_SDK;return sdk&&typeof sdk.renderCard==="function"?sdk:null;}
async function renderCard(container,{timeoutMs=REQUEST_TIMEOUT_MS}={}){
 if(!container)return {rendered:false,reason:"missing_container"};
 const sdk=provider();if(!sdk)return {rendered:false,reason:"sdk_unavailable"};
 if(cardRequestUsed)return {rendered:false,reason:"surface_already_requested"};
 cardRequestUsed=true;let timer;
 try{
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve({rendered:false,reason:"timeout"}),Math.max(250,Math.min(2000,Number(timeoutMs)||REQUEST_TIMEOUT_MS)));});
  const result=await Promise.race([Promise.resolve(sdk.renderCard({container,placement:"card"})),timeout]);
  return result?.rendered===true?{rendered:true}:{rendered:false,reason:String(result?.reason||"no_fill")};
 }catch(_){return {rendered:false,reason:"error"};}finally{clearTimeout(timer);}
}
root.BMP_AD_NETWORK=Object.freeze({REQUEST_TIMEOUT_MS,renderCard});
})(typeof self!=="undefined"?self:globalThis);
