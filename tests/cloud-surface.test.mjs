import assert from "node:assert/strict";
await import("../extension/cloud-surface.js");

const CLOUD=globalThis.BMP_CLOUD_SURFACE;
assert.ok(CLOUD,"cloud surface API loaded");

const bad=CLOUD.sanitizeState({
  schema_version:1,
  ttl_seconds:1,
  sections:[
    {id:"evil",visible:true,title:"Nope",text:"x",action:{type:"OPEN_URL",label:"Go",url:"javascript:alert(1)"}},
    {id:"html",visible:true,title:"<script>x</script>",text:"plain",action:{type:"RUN_CODE",label:"Run"}}
  ]
});
assert.equal(bad.ttlSeconds,60);
assert.equal(bad.sections.length,2);
assert.equal(bad.sections[0].action,null);
assert.equal(bad.sections[1].action,null);

const good=CLOUD.sanitizeState({
  schema_version:1,
  ttl_seconds:90,
  generated_at:"2026-09-20T00:00:00Z",
  sections:[
    {
      id:"maintenance",
      visible:true,
      kind:"warning",
      title:"Maintenance",
      text:"Coba lagi nanti.",
      action:{type:"OPEN_URL",label:"Status",url:"https://example.com/status"}
    },
    {
      id:"hidden",
      visible:false,
      title:"hidden",
      text:"hidden"
    }
  ],
  status_badge:{visible:true,kind:"success",text:"Layanan normal"},
  supporter:{active:true,until:"2026-12-01T00:00:00Z",label:"BMP Supporter"},
  features:{supporter_card:true,community_banner:true}
});
assert.equal(good.sections.length,1);
assert.equal(good.sections[0].action.type,"OPEN_URL");
assert.deepEqual(good.statusBadge,{
  visible:true,
  kind:"success",
  text:"Layanan normal"
});
assert.equal(good.supporter.active,true);
assert.equal(good.features.supporterCard,true);

const sponsor=CLOUD.sanitizeState({
  schema_version:1,
  sections:[{
    id:"campaign-1",
    visible:true,
    kind:"sponsor",
    title:"Partner belajar",
    text:"Penawaran sponsor yang ditampilkan sebagai teks aman.",
    action:{type:"OPEN_URL",label:"Lihat",url:"https://example.com/offer"}
  },{
    id:"bad-sponsor-action",
    visible:true,
    kind:"sponsor",
    title:"Bad",
    action:{type:"OPEN_GROUP",label:"Open"}
  }]
});
assert.equal(sponsor.sections[0].kind,"sponsor");
assert.equal(sponsor.sections[0].action.type,"OPEN_URL");
assert.equal(sponsor.sections[1].action,null);

const ads=CLOUD.sanitizeState({
  schema_version:1,
  ads:{
    enabled:true,
    active:true,
    campaign_id:"campaign-sep-2026",
    revision:3,
    sponsor_label:"Sponsor",
    advertiser:"Contoh Partner",
    headline:"Belajar lebih nyaman",
    body:"Materi sponsor realtime.",
    disclaimer:"Konten berbayar.",
    cta:{label:"Lihat",url:"https://example.com/offer"},
    house:{
      sponsor_label:"Sponsor",
      headline:"Space iklan tersedia",
      body:"Hubungi untuk pemasangan.",
      cta:{label:"Pasang iklan? Hubungi",url:"https://t.me/bukabmp?direct"}
    },
    placements:{card:true,interstitial:true},
    interstitial:{
      enabled:true,
      trigger:"job_started",
      delay_min_ms:2000,
      delay_max_ms:5000
    }
  }
});
assert.equal(ads.ads.active,true);
assert.equal(ads.ads.campaignId,"campaign-sep-2026");
assert.equal(ads.ads.revision,3);
assert.equal(ads.ads.placements.card,true);
assert.equal(ads.ads.placements.interstitial,true);
assert.equal(ads.ads.interstitial.enabled,true);
assert.equal(ads.ads.interstitial.trigger,"job_started");
assert.equal(ads.ads.interstitial.delayMinMs,2000);
assert.equal(ads.ads.interstitial.delayMaxMs,5000);
assert.equal(ads.ads.cta.url,"https://example.com/offer");
assert.equal(ads.ads.house.headline,"Space iklan tersedia");
assert.equal(ads.ads.house.cta.url,"https://t.me/bukabmp?direct");

const unsafeAds=CLOUD.sanitizeState({
  schema_version:1,
  ads:{
    enabled:true,
    active:true,
    campaign_id:"campaign-unsafe",
    headline:"Test",
    cta:{label:"Run",url:"javascript:alert(1)"},
    placements:{card:true,interstitial:true},
    interstitial:{enabled:true,delay_min_ms:1,delay_max_ms:999999}
  }
});
assert.equal(unsafeAds.ads.cta,null);
assert.equal(unsafeAds.ads.interstitial.delayMinMs,500);
assert.equal(unsafeAds.ads.interstitial.delayMaxMs,30000);

const malformedBadge=CLOUD.sanitizeState({
  schema_version:1,
  status_badge:{visible:true,kind:"evil",text:"  Status aman  "}
});
assert.deepEqual(malformedBadge.statusBadge,{
  visible:true,
  kind:"info",
  text:"Status aman"
});

const wrongSchema=CLOUD.sanitizeState({schema_version:99,sections:[{visible:true,title:"x"}]});
assert.deepEqual(wrongSchema.sections,[]);
assert.equal(wrongSchema.statusBadge.visible,false);
assert.equal(wrongSchema.ads.active,false);
assert.equal(wrongSchema.ads.house.headline,"Space iklan tersedia");

console.log("OK: cloud surface sanitizer, ads contract, and action allowlist");
