(function(root){
  "use strict";

  const ACTION_TYPES = new Set([
    "OPEN_URL",
    "OPEN_CHANNEL",
    "OPEN_GROUP",
    "OPEN_ABOUT"
  ]);
  const SECTION_KINDS = new Set([
    "info",
    "warning",
    "success",
    "community",
    "supporter",
    "sponsor"
  ]);

  function text(value,max){
    return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g," ").trim().slice(0,max);
  }

  function httpsUrl(value){
    const raw=text(value,2048);
    if(!raw)return "";
    try{
      const url=new URL(raw);
      return url.protocol==="https:" ? url.toString() : "";
    }catch(_){
      return "";
    }
  }

  function isoDate(value){
    const raw=text(value,64);
    if(!raw)return null;
    const parsed=Date.parse(raw);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  function defaultState(){
    return {
      schemaVersion:1,
      generatedAt:"",
      ttlSeconds:300,
      sections:[],
      statusBadge:{visible:false,kind:"info",text:""},
      supporter:{active:false,until:null,label:""},
      features:{supporterCard:false,communityBanner:false}
    };
  }

  function sanitizeAction(raw){
    if(!raw||typeof raw!=="object")return null;
    const type=text(raw.type,32).toUpperCase();
    if(!ACTION_TYPES.has(type))return null;
    const label=text(raw.label,48);
    if(!label)return null;
    if(type==="OPEN_URL"){
      const url=httpsUrl(raw.url);
      if(!url)return null;
      return {type,label,url};
    }
    return {type,label};
  }

  function sanitizeSection(raw,index=0){
    if(!raw||typeof raw!=="object"||raw.visible!==true)return null;
    const rawId=text(raw.id,48);
    const id=/^[a-z0-9][a-z0-9_-]{0,47}$/i.test(rawId) ? rawId : `section-${index+1}`;
    const kindRaw=text(raw.kind,24).toLowerCase();
    const kind=SECTION_KINDS.has(kindRaw)?kindRaw:"info";
    const title=text(raw.title,96);
    const body=text(raw.text,700);
    if(!title&&!body)return null;
    let action=sanitizeAction(raw.action);
    if(kind==="sponsor"&&action?.type!=="OPEN_URL")action=null;
    return {id,kind,title,text:body,action};
  }

  function sanitizeState(raw){
    const fallback=defaultState();
    if(!raw||typeof raw!=="object"||Number(raw.schema_version)!==1)return fallback;

    const ttlRaw=Number(raw.ttl_seconds);
    const ttlSeconds=Number.isFinite(ttlRaw)
      ? Math.max(60,Math.min(86400,Math.floor(ttlRaw)))
      : fallback.ttlSeconds;

    const sections=[];
    if(Array.isArray(raw.sections)){
      for(let i=0;i<raw.sections.length&&sections.length<8;i++){
        const section=sanitizeSection(raw.sections[i],i);
        if(section)sections.push(section);
      }
    }

    // Backward-compatible translation for the original blueprint fields.
    if(sections.length<8&&raw.notice?.visible===true){
      const section=sanitizeSection({
        id:text(raw.notice.id,48)||"notice",
        visible:true,
        kind:text(raw.notice.kind,24)||"info",
        title:raw.notice.title,
        text:raw.notice.text,
        action:raw.notice.action?.label ? {
          type:"OPEN_URL",
          label:raw.notice.action.label,
          url:raw.notice.action.url
        } : null
      },sections.length);
      if(section)sections.push(section);
    }
    if(sections.length<8&&raw.community?.visible===true){
      const section=sanitizeSection({
        id:"community",
        visible:true,
        kind:"community",
        title:"Komunitas",
        text:raw.community.text,
        action:raw.community.action?.label ? {
          type:"OPEN_URL",
          label:raw.community.action.label,
          url:raw.community.action.url
        } : null
      },sections.length);
      if(section)sections.push(section);
    }

    const badgeRaw=raw.status_badge&&typeof raw.status_badge==="object"?raw.status_badge:{};
    const badgeKindRaw=text(badgeRaw.kind,24).toLowerCase();
    const badgeKind=new Set(["info","success","warning","community","supporter"]).has(badgeKindRaw)
      ? badgeKindRaw
      : "info";
    const badgeText=text(badgeRaw.text,160);
    const supporterRaw=raw.supporter&&typeof raw.supporter==="object"?raw.supporter:{};
    const featuresRaw=raw.features&&typeof raw.features==="object"?raw.features:{};

    return {
      schemaVersion:1,
      generatedAt:isoDate(raw.generated_at)||"",
      ttlSeconds,
      sections,
      statusBadge:{
        visible:badgeRaw.visible===true&&Boolean(badgeText),
        kind:badgeKind,
        text:badgeText
      },
      supporter:{
        active:supporterRaw.active===true,
        until:isoDate(supporterRaw.until),
        label:text(supporterRaw.label,64)
      },
      features:{
        supporterCard:featuresRaw.supporter_card===true,
        communityBanner:featuresRaw.community_banner===true
      }
    };
  }

  root.BMP_CLOUD_SURFACE=Object.freeze({
    defaultState,
    sanitizeAction,
    sanitizeState
  });
})(typeof self!=="undefined"?self:globalThis);
