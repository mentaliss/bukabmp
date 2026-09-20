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
const allowedChannels = new Set(["github", "cws", "android"]);
if (!allowedChannels.has(channel)) throw new Error(`Unknown distribution channel: ${channel}`);

const TESSDATA_FAST_COMMIT = "87416418657359cb625c412a48b6e1d6d41c29bd";

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
async function ensure(url,target,minBytes=1000){
  mkdir(path.dirname(target));
  if(fs.existsSync(target) && fs.statSync(target).size>=minBytes) return;
  const buf=await fetchBytes(url);
  if(buf.length<minBytes) throw new Error(`File terlalu kecil: ${url} (${buf.length})`);
  fs.writeFileSync(target,buf);
}

const manifest=JSON.parse(fs.readFileSync(path.join(EXT_SRC,"manifest.json"),"utf8"));
const version=manifest.version;
const outBase=channel==="cws" ? path.join(DIST,"cws") : DIST;
const out=path.join(outBase,`BMP-Terbuka-v${version}`);

rm(out);
mkdir(out);
copyDir(EXT_SRC,out);

// CWS gets a minimum-permission manifest without changing the shared source manifest.
// The GitHub/manual and Android packages keep their existing permission profile.
if(channel==="cws"){
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
  ["https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js","tesseract.min.js",30000],
  ["https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js","worker.min.js",50000],
  ["https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js","pdf-lib.min.js",100000],
  ["https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core.wasm.js","core/tesseract-core.wasm.js",1000000],
  ["https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core-simd.wasm.js","core/tesseract-core-simd.wasm.js",1000000],
  ["https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core-lstm.wasm.js","core/tesseract-core-lstm.wasm.js",1000000],
  ["https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core-simd-lstm.wasm.js","core/tesseract-core-simd-lstm.wasm.js",1000000],
  ["https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/LICENSE.md","licenses/LICENSE-tesseract-js.md",5000],
  ["https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/LICENSE","licenses/LICENSE-tesseract-core.txt",5000],
  ["https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/LICENSE.md","licenses/LICENSE-pdf-lib.md",500]
];

for(const [url,rel,min] of assets){
  const cached=path.join(CACHE,rel);
  await ensure(url,cached,min);
  const dest=path.join(out,"vendor",rel);
  mkdir(path.dirname(dest));
  fs.copyFileSync(cached,dest);
}

// Indonesian fast traineddata is pinned to an immutable upstream commit.
const trainedRaw=path.join(CACHE,"lang",`ind-${TESSDATA_FAST_COMMIT}.traineddata`);
await ensure(
  `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${TESSDATA_FAST_COMMIT}/ind.traineddata`,
  trainedRaw,
  1000000
);
const langDest=path.join(out,"vendor","lang","ind.traineddata.gz");
mkdir(path.dirname(langDest));
fs.writeFileSync(langDest,zlib.gzipSync(fs.readFileSync(trainedRaw),{level:9}));

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
