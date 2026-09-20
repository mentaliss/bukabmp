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
  supporter:{active:true,until:"2026-12-01T00:00:00Z",label:"BMP Supporter"},
  features:{supporter_card:true,community_banner:true}
});
assert.equal(good.sections.length,1);
assert.equal(good.sections[0].action.type,"OPEN_URL");
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

const wrongSchema=CLOUD.sanitizeState({schema_version:99,sections:[{visible:true,title:"x"}]});
assert.deepEqual(wrongSchema.sections,[]);

console.log("OK: cloud surface sanitizer and action allowlist");
