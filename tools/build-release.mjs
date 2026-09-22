#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import crypto from "node:crypto";
import zlib from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXT_SRC = path.join(ROOT, "extension");
const DIST = path.join(ROOT, "dist");
const CACHE = path.join(ROOT, ".cache", "vendor");
const strict = process.argv.includes("--strict");
const channelArg = process.argv.find(x => x.startsWith("--channel="));
const channel = String(
  channelArg ? channelArg.slice("--channel=".length) : (process.env.BMP_DISTRIBUTION_CHANNEL || "github")
).toLowerCase();
const allowedChannels = new Set(["github", "cws", "edge", "android"]);
const storeChannels = new Set(["cws", "edge"]);
if (!allowedChannels.has(channel)) throw new Error(`Unknown distribution channel: ${channel}`);

const TESSDATA_FAST_COMMIT = "87416418657359cb625c412a48b6e1d6d41c29bd";
const TESSDATA_FAST_SHA256 = "69786901da87ab8766c1ea7fbb10b28f2110c14da3f6c8f2735df131fba95d88";

function mkdir(p){ fs.mkdirSync(p,{recursive:true}); }
function rm(p){ fs.rmSync(p,{recursive:true,force:true}); }
function copyDir(src,dst){
  mkdir(dst);
  for(const ent of fs.readdirSync(src,{withFileTypes:true})){
    const a=path.join(src,ent.name), b=path.join(dst,ent.name);
    if(ent.isDirectory()) copyDir(a,b);
    else fs.copyFileSync(a,b);
  }
}
function sha256File(file){
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
async function fetchBytes(url){
  const r=await fetch(url,{redirect:"follow"});
  if(!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
async function ensure(url,target,minBytes=1000,expectedSha256=""){
  mkdir(path.dirname(target));
  if(fs.existsSync(target) && fs.statSync(target).size>=minBytes){
    if(!expectedSha256 || sha256File(target)===expectedSha256) return;
    fs.rmSync(target,{force:true});
  }
  const buf=await fetchBytes(url);
  if(buf.length<minBytes) throw new Error(`File terlalu kecil: ${url} (${buf.length})`);
  if(expectedSha256){
    const actual=crypto.createHash("sha256").update(buf).digest("hex");
    if(actual!==expectedSha256){
      throw new Error(`SHA-256 mismatch: ${url}\nexpected=${expectedSha256}\nactual=${actual}`);
    }
  }
  fs.writeFileSync(target,buf);
}

const manifest=JSON.parse(fs.readFileSync(path.join(EXT_SRC,"manifest.json"),"utf8"));
const version=manifest.version;
const outBase=storeChannels.has(channel) ? path.join(DIST,channel) : DIST;
const out=path.join(outBase,`BMP-Terbuka-v${version}`);

rm(out);
mkdir(out);
copyDir(EXT_SRC,out);

// Development-only network mock stays in source/tests and must never ship.
fs.rmSync(path.join(out,"vendor","adsonbread-test-sdk.js"),{force:true});

// CWS gets a minimum-permission manifest without changing the shared source manifest.
// The GitHub/manual and Android packages keep their existing permission profile.
if(storeChannels.has(channel)){
  const manifestPath=path.join(out,"manifest.json");
  const cwsManifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
  cwsManifest.permissions=(cwsManifest.permissions||[]).filter(p=>p!=="tabs");
  fs.writeFileSync(manifestPath,JSON.stringify(cwsManifest,null,2)+"\n");
}

// config.js is generated from template.
let config=fs.readFileSync(path.join(EXT_SRC,"config.template.js"),"utf8");
const vals={
  "__BMP_API_BASE_URL__": process.env.BMP_API_BASE_URL || "__BMP_API_BASE_URL__",
  "__BMP_DISTRIBUTION_CHANNEL__": channel,
  "__BMP_TELEGRAM_CHANNEL_URL__": process.env.BMP_TELEGRAM_CHANNEL_URL || "__BMP_TELEGRAM_CHANNEL_URL__",
  "__BMP_TELEGRAM_GROUP_URL__": process.env.BMP_TELEGRAM_GROUP_URL || "__BMP_TELEGRAM_GROUP_URL__"
};
const releasePlaceholders=Object.keys(vals);
for(const [k,v] of Object.entries(vals)) config=config.split(k).join(v);
if(strict && releasePlaceholders.some(x=>config.includes(x))){
  throw new Error(
    "Release config belum lengkap. Set BMP_API_BASE_URL, " +
    "BMP_TELEGRAM_CHANNEL_URL, BMP_TELEGRAM_GROUP_URL."
  );
}
fs.writeFileSync(path.join(out,"config.js"),config);
fs.rmSync(path.join(out,"config.template.js"),{force:true});

// Runtime vendor: fetched only at build time. End-user release is self-contained.
const assets=[
  ["https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js","tesseract.min.js",30000,"10fff78484067759c43028a02a72d76d0b90eb17302bb23b58a9ec5410bc928b"],
  ["https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js","worker.min.js",50000,"38645599043239c0eb6db08a6504a92dcdc292200535f3e9339cd77c4443b842"],
  ["https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js","pdf-lib.min.js",100000,"0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f"],
  ["https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core.wasm.js","core/tesseract-core.wasm.js",1000000,"e66872f6a76f5ad414d73d21512245df0de3060ad4871a97c47efceaab27b955"],
  ["https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core-simd.wasm.js","core/tesseract-core-simd.wasm.js",1000000,"3b0678c47a8dea6abb931b214171c08b742a5b9a9fcbbb1a028a08d5de6e9d4c"],
  ["https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core-lstm.wasm.js","core/tesseract-core-lstm.wasm.js",1000000,"775a35df6f2ae100e02609443e6bd5cafcd07983dd6175454ca4a432a7730687"],
  ["https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core-simd-lstm.wasm.js","core/tesseract-core-simd-lstm.wasm.js",1000000,"9d7c43fb206dc9f48475228b46bf35f888fa9e6259da2e67d5a75c77049f2dc7"],
  ["https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/LICENSE.md","licenses/LICENSE-tesseract-js.md",5000,"b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1"],
  ["https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/LICENSE","licenses/LICENSE-tesseract-core.txt",5000,"c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08"],
  ["https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/LICENSE.md","licenses/LICENSE-pdf-lib.md",500,"f2c9fc00fdb66eb99ac156ba52d734af66d8d309f65753ae809ad34ee2883bcb"]
];

for(const [url,rel,min,expectedSha256] of assets){
  const cached=path.join(CACHE,rel);
  await ensure(url,cached,min,expectedSha256);
  const dest=path.join(out,"vendor",rel);
  mkdir(path.dirname(dest));
  fs.copyFileSync(cached,dest);
}

function replaceExact(file,from,to,label){
  const text=fs.readFileSync(file,"utf8");
  const count=text.split(from).length-1;
  if(count!==1) throw new Error("Unexpected "+label+" occurrence count in "+file+": "+count);
  fs.writeFileSync(file,text.replace(from,to));
}

function hardenTesseractForMv3(outDir){
  const tesseract=path.join(outDir,"vendor","tesseract.min.js");
  const worker=path.join(outDir,"vendor","worker.min.js");

  // Tesseract browser distributions ship generic CDN fallbacks and legacy
  // Function-constructor fallbacks. BMP always supplies local worker/core/lang
  // paths, so remove those dead RHC paths from the compiled Store package.
  replaceExact(tesseract,'"https://cdn.jsdelivr.net/npm/tesseract.js@v".concat(c,"/dist/worker.min.js")','"/vendor/worker.min.js"',"Tesseract worker CDN fallback");
  replaceExact(tesseract,'Function("r","regeneratorRuntime = r")(o)','void 0',"Tesseract Function constructor fallback");
  replaceExact(worker,'b=s||"https://cdn.jsdelivr.net/npm/@tesseract.js-data/".concat(i,m?"/4.0.0_best_int":"/4.0.0")','b=s||"/vendor/lang"',"Tesseract language CDN fallback");
  replaceExact(worker,'f=o||"https://cdn.jsdelivr.net/npm/tesseract.js-core@v".concat(s.substring(1))','f=o||"/vendor/core"',"Tesseract core CDN fallback");
  replaceExact(worker,'Function("r","regeneratorRuntime = r")(i)','void 0',"Tesseract worker Function constructor fallback");
  replaceExact(worker,'new Function("return this")()','void 0',"Tesseract worker global Function constructor fallback");
}

hardenTesseractForMv3(out);

// Indonesian fast traineddata is pinned to an immutable upstream commit.
const trainedRaw=path.join(CACHE,"lang",`ind-${TESSDATA_FAST_COMMIT}.traineddata`);
await ensure(
  `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${TESSDATA_FAST_COMMIT}/ind.traineddata`,
  trainedRaw,
  1000000,
  TESSDATA_FAST_SHA256
);
const edgeUncompressedTessdata = channel === "edge";
const langDest=path.join(
  out,
  "vendor",
  "lang",
  edgeUncompressedTessdata ? "ind.traineddata" : "ind.traineddata.gz"
);
mkdir(path.dirname(langDest));
fs.writeFileSync(
  langDest,
  edgeUncompressedTessdata
    ? fs.readFileSync(trainedRaw)
    : zlib.gzipSync(fs.readFileSync(trainedRaw),{level:9})
);

if(edgeUncompressedTessdata){
  const offscreenPath=path.join(out,"offscreen.js");
  const offscreen=fs.readFileSync(offscreenPath,"utf8");
  if(!offscreen.includes("gzip: true")){
    throw new Error("Expected Tesseract gzip:true setting missing from offscreen.js");
  }
  fs.writeFileSync(offscreenPath,offscreen.replace("gzip: true","gzip: false"));
}

// Provenance manifest for bundled third-party files.
const vendorFiles=[];
function walk(dir,rel=""){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,ent.name);
    const r=path.join(rel,ent.name).replaceAll("\\","/");
    if(ent.isDirectory()) walk(abs,r);
    else if(!r.endsWith("README.md")) vendorFiles.push({
      path:r,
      bytes:fs.statSync(abs).size,
      sha256:sha256File(abs)
    });
  }
}
walk(path.join(out,"vendor"));
fs.writeFileSync(
  path.join(out,"VENDOR_MANIFEST.json"),
  JSON.stringify({
    generated_at:new Date().toISOString(),
    distribution_channel:channel,
    tesseract_js:"6.0.1",
    tesseract_js_core:"6.0.0",
    pdf_lib:"1.17.1",
    tessdata_repository:"tesseract-ocr/tessdata_fast",
    tessdata_commit:TESSDATA_FAST_COMMIT,
    tessdata_language:"ind",
    tessdata_compression:edgeUncompressedTessdata ? "none" : "gzip",
    files:vendorFiles
  },null,2)+"\n"
);

// Release hygiene.
for(const forbidden of ["SETUP_OCR_ENGINE.bat","SETUP_OCR_ENGINE.ps1"]){
  if(fs.existsSync(path.join(out,forbidden))) throw new Error(`Forbidden end-user file: ${forbidden}`);
}
const textFiles=[];
function scanText(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) scanText(p);
    else if(/\.(js|json|html|md|txt)$/.test(ent.name)) textFiles.push(p);
  }
}
scanText(out);
if(strict){
  for(const p of textFiles){
    const t=fs.readFileSync(p,"utf8");
    const leftover=releasePlaceholders.find(x=>t.includes(x));
    if(leftover) throw new Error(`Placeholder tersisa (${leftover}): ${p}`);
  }
}

console.log(out);
