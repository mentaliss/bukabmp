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
  const AD_PROVIDERS = new Set(["direct","affiliate","house","network"]);

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
      ads:{
        enabled:false,
        active:false,
        campaignId:"",
        revision:0,
        creativeVersion:1,
        provider:"direct",
        sponsorLabel:"Sponsor",
        advertiser:"",
        headline:"",
        body:"",
        disclaimer:"",
        imageUrl:"",
        cta:null,
        card:{
          enabled:false,
          mode:"text",
          headline:"",
          body:"",
          disclaimer:"",
          asset:null,
          mediaUrl:"",
          cta:null
        },
        network:{adsonbread:false},
        house:{
          sponsorLabel:"Sponsor",
          headline:"Space iklan tersedia",
          body:"",
          disclaimer:"",
          cta:{label:"Pasang iklan? Hubungi",url:"https://t.me/bukabmp?direct"}
        },
        startsAt:null,
        endsAt:null,
        placements:{card:false,interstitial:false},
        interstitial:{
          enabled:false,
          trigger:"job_started",
          mode:"text",
          headline:"",
          body:"",
          disclaimer:"",
          asset:null,
          posterAsset:null,
          mediaUrl:"",
          cta:null,
          delayMinMs:2000,
          delayMaxMs:5000
        },
        legacy:{cardWeight:50,stickyDays:1},
        legacyProjection:null
      },
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

  function boundedInt(value,fallback,min,max){
    const parsed=Number(value);
    if(!Number.isFinite(parsed))return fallback;
    return Math.max(min,Math.min(max,Math.floor(parsed)));
  }

  function sanitizeAdCta(raw){
    if(!raw||typeof raw!=="object")return null;
    const label=text(raw.label,48);
    const url=httpsUrl(raw.url);
    return label&&url?{label,url}:null;
  }

  function sanitizeMediaAsset(raw,kind){
    if(!raw||typeof raw!=="object")return null;
    const id=text(raw.id,128);
    if(!/^[0-9a-f]{64}$/i.test(id))return null;
    const mime=text(raw.mime,64).toLowerCase();
    const allowed=kind==="video"
      ?new Set(["video/mp4","video/webm"])
      :new Set(["image/jpeg","image/png","image/webp"]);
    if(!allowed.has(mime))return null;
    const maxBytes=kind==="video"?10*1024*1024:3*1024*1024;
    return {
      id,
      mime,
      bytes:boundedInt(raw.bytes,0,0,maxBytes),
      width:boundedInt(raw.width,0,0,8192),
      height:boundedInt(raw.height,0,0,8192),
      durationMs:kind==="video"?boundedInt(raw.duration_ms,0,0,15000):0
    };
  }

  function own(raw,key){
    return raw&&Object.prototype.hasOwnProperty.call(raw,key);
  }

  function sanitizeAds(raw){
    const fallback=defaultState().ads;
    if(!raw||typeof raw!=="object")return fallback;

    const campaignIdRaw=text(raw.campaign_id,64);
    const campaignId=/^[a-z0-9][a-z0-9_.:-]{0,63}$/i.test(campaignIdRaw)
      ?campaignIdRaw
      :"";
    const startsAt=isoDate(raw.starts_at);
    const endsAt=isoDate(raw.ends_at);
    const now=Date.now();
    const inWindow=
      (!startsAt||now>=Date.parse(startsAt))&&
      (!endsAt||now<Date.parse(endsAt));

    const placementsRaw=raw.placements&&typeof raw.placements==="object"
      ?raw.placements
      :{};
    const cardRaw=raw.card&&typeof raw.card==="object"?raw.card:{};
    const interstitialRaw=raw.interstitial&&typeof raw.interstitial==="object"
      ?raw.interstitial
      :{};

    const legacyHeadline=text(raw.headline,120);
    const legacyBody=text(raw.body,700);
    const legacyDisclaimer=text(raw.disclaimer,220);
    const legacyImageUrl=httpsUrl(raw.image_url);
    const legacyCta=sanitizeAdCta(raw.cta);

    const cardConfigured=typeof cardRaw.enabled==="boolean"
      ?cardRaw.enabled
      :placementsRaw.card===true;
    const interstitialConfigured=typeof interstitialRaw.enabled==="boolean"
      ?interstitialRaw.enabled
      :placementsRaw.interstitial===true;

    const cardMode=text(cardRaw.mode,16).toLowerCase()==="banner"?"banner":"text";
    const cardAsset=cardMode==="banner"?sanitizeMediaAsset(cardRaw.asset,"image"):null;
    const interstitialModeRaw=text(interstitialRaw.mode,16).toLowerCase();
    const interstitialMode=["image","video"].includes(interstitialModeRaw)?interstitialModeRaw:"text";
    const interstitialAsset=interstitialMode==="video"
      ?sanitizeMediaAsset(interstitialRaw.asset,"video")
      :(interstitialMode==="image"?sanitizeMediaAsset(interstitialRaw.asset,"image"):null);
    const posterAsset=interstitialMode==="video"
      ?sanitizeMediaAsset(interstitialRaw.poster_asset,"image")
      :null;

    const cardHeadline=own(cardRaw,"headline")?text(cardRaw.headline,120):legacyHeadline;
    const cardBody=own(cardRaw,"body")?text(cardRaw.body,700):legacyBody;
    const interstitialHeadline=own(interstitialRaw,"headline")?text(interstitialRaw.headline,120):legacyHeadline;
    const interstitialBody=own(interstitialRaw,"body")?text(interstitialRaw.body,700):legacyBody;
    const hasCreative=Boolean(
      (cardConfigured&&(cardHeadline||cardBody||cardAsset))||
      (interstitialConfigured&&(interstitialHeadline||interstitialBody||interstitialAsset))
    );
    const enabled=raw.enabled===true;
    const active=Boolean(raw.active===true&&enabled&&campaignId&&hasCreative&&inWindow);
    const placements={
      card:active&&cardConfigured,
      interstitial:active&&interstitialConfigured
    };
    const delayMinMs=boundedInt(interstitialRaw.delay_min_ms,2000,2000,5000);
    const delayMaxMs=boundedInt(interstitialRaw.delay_max_ms,5000,delayMinMs,5000);

    const houseRaw=raw.house&&typeof raw.house==="object"?raw.house:{};
    const defaultHouse=fallback.house;
    const house={
      sponsorLabel:text(houseRaw.sponsor_label,32)||defaultHouse.sponsorLabel,
      headline:text(houseRaw.headline,120)||defaultHouse.headline,
      body:text(houseRaw.body,420),
      disclaimer:text(houseRaw.disclaimer,220),
      cta:sanitizeAdCta(houseRaw.cta)||defaultHouse.cta
    };

    const providerRaw=text(raw.provider,24).toLowerCase();
    const provider=AD_PROVIDERS.has(providerRaw)&&providerRaw!=="house"?providerRaw:"direct";
    const networkRaw=raw.network&&typeof raw.network==="object"?raw.network:{};
    const legacyRaw=raw.legacy&&typeof raw.legacy==="object"?raw.legacy:{};
    const projectionRaw=raw.legacy_projection&&typeof raw.legacy_projection==="object"
      ?raw.legacy_projection
      :null;

    return {
      enabled,
      active,
      campaignId,
      revision:boundedInt(raw.revision,0,0,2147483647),
      creativeVersion:boundedInt(raw.creative_version,1,1,3),
      provider,
      sponsorLabel:text(raw.sponsor_label,32)||"Sponsor",
      advertiser:text(raw.advertiser,96),
      // Shared fields remain for legacy compatibility only.
      headline:legacyHeadline,
      body:legacyBody,
      disclaimer:legacyDisclaimer,
      imageUrl:legacyImageUrl,
      cta:legacyCta,
      card:{
        enabled:placements.card,
        mode:cardMode,
        headline:cardHeadline,
        body:cardBody,
        disclaimer:own(cardRaw,"disclaimer")?text(cardRaw.disclaimer,220):legacyDisclaimer,
        asset:cardAsset,
        mediaUrl:own(cardRaw,"media_url")?httpsUrl(cardRaw.media_url):legacyImageUrl,
        cta:own(cardRaw,"cta")?sanitizeAdCta(cardRaw.cta):legacyCta
      },
      network:{adsonbread:networkRaw.adsonbread===true},
      house,
      startsAt,
      endsAt,
      placements,
      interstitial:{
        enabled:placements.interstitial,
        trigger:"job_started",
        mode:interstitialMode,
        headline:interstitialHeadline,
        body:interstitialBody,
        disclaimer:own(interstitialRaw,"disclaimer")?text(interstitialRaw.disclaimer,220):legacyDisclaimer,
        asset:interstitialAsset,
        posterAsset,
        mediaUrl:own(interstitialRaw,"media_url")?httpsUrl(interstitialRaw.media_url):legacyImageUrl,
        cta:own(interstitialRaw,"cta")?sanitizeAdCta(interstitialRaw.cta):legacyCta,
        delayMinMs,
        delayMaxMs
      },
      legacy:{
        cardWeight:boundedInt(legacyRaw.card_weight,50,0,100),
        stickyDays:boundedInt(legacyRaw.sticky_days,1,1,30)
      },
      legacyProjection:projectionRaw?{
        paidPlacement:["card","interstitial"].includes(text(projectionRaw.paid_placement,24).toLowerCase())
          ?text(projectionRaw.paid_placement,24).toLowerCase()
          :null,
        otherSurface:text(projectionRaw.other_surface,32),
        bucket:boundedInt(projectionRaw.bucket,0,0,99),
        cardWeight:boundedInt(projectionRaw.card_weight,50,0,100),
        stickyDays:boundedInt(projectionRaw.sticky_days,7,1,30)
      }:null
    };
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
      ads:sanitizeAds(raw.ads),
      features:{
        supporterCard:featuresRaw.supporter_card===true,
        communityBanner:featuresRaw.community_banner===true
      }
    };
  }

  root.BMP_CLOUD_SURFACE=Object.freeze({
    defaultState,
    sanitizeAction,
    sanitizeMediaAsset,
    sanitizeAds,
    sanitizeState
  });
})(typeof self!=="undefined"?self:globalThis);
