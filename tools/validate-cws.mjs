#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import crypto from "node:crypto";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const sourceManifest=JSON.parse(fs.readFileSync(path.join(ROOT,"extension","manifest.json"),"utf8"));
const channelArg=process.argv.find(x=>x.startsWith("--channel="));
const channel=String(channelArg?channelArg.slice("--channel=".length):"cws").toLowerCase();
const allowedChannels=new Set(["github","cws","edge","android"]);
const storeChannels=new Set(["cws","edge"]);
if(!allowedChannels.has(channel))throw new Error(`Unknown validation channel: ${channel}`);

const defaultBase=storeChannels.has(channel)?path.join(ROOT,"dist",channel):path.join(ROOT,"dist");
const packageDir=process.argv.find(x=>x.startsWith("--dir="))
  ? path.resolve(process.argv.find(x=>x.startsWith("--dir=")).slice("--dir=".length))
  : path.join(defaultBase,`BMP-Terbuka-v${sourceManifest.version}`);

function fail(message){throw new Error(message)}
function sha256(file){return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}
function mustFile(rel){
  const p=path.join(packageDir,rel);
  if(!fs.existsSync(p)||!fs.statSync(p).isFile())fail(`Missing package file: ${rel}`);
  return p;
}

if(!fs.existsSync(packageDir))fail(`Package build not found: ${packageDir}`);
const manifest=JSON.parse(fs.readFileSync(mustFile("manifest.json"),"utf8"));
if(manifest.manifest_version!==3)fail("Manifest must use Manifest V3.");
if(manifest.update_url)fail("Store/manual package must not set update_url.");
if(manifest.default_locale!=="id")fail('Manifest default_locale must be "id".');
if(manifest.name!=="__MSG_extensionName__"||manifest.description!=="__MSG_extensionDescription__"){
  fail("Manifest name/description must use i18n message keys.");
}
const localeMessages=JSON.parse(fs.readFileSync(mustFile("_locales/id/messages.json"),"utf8"));
if(localeMessages?.extensionName?.message!=="BMP Terbuka")fail("Indonesian extension name mismatch.");
if(!String(localeMessages?.extensionDescription?.message||"").trim())fail("Indonesian extension description missing.");

const permissions=new Set(manifest.permissions||[]);
for(const required of ["storage","downloads","offscreen","clipboardWrite"]){
  if(!permissions.has(required))fail(`Missing required permission: ${required}`);
}
if(storeChannels.has(channel)&&permissions.has("tabs")){
  fail(`${channel} package must not request broad "tabs" permission.`);
}
if(!storeChannels.has(channel)&&!permissions.has("tabs")){
  fail(`${channel} compatibility package unexpectedly lost "tabs" permission.`);
}

const expectedHosts=[
  "https://pustaka.ut.ac.id/*",
  "https://community.bukabmp.workers.dev/*"
];
const actualHosts=[...(manifest.host_permissions||[])].sort();
if(JSON.stringify(actualHosts)!==JSON.stringify([...expectedHosts].sort())){
  fail(`Unexpected host permissions: ${actualHosts.join(", ")}`);
}

if(fs.existsSync(path.join(packageDir,"config.template.js")))fail("config.template.js must not ship.");
if(fs.existsSync(path.join(packageDir,"vendor","adsonbread-test-sdk.js")))fail("Development AdsOnBread mock must not ship.");
const config=fs.readFileSync(mustFile("config.js"),"utf8");
const channelPattern=new RegExp(`DISTRIBUTION_CHANNEL:\\s*["']${channel}["']`);
if(!channelPattern.test(config))fail(`Config must set DISTRIBUTION_CHANNEL to "${channel}".`);
if(config.includes("__BMP_"))fail("Unresolved build placeholder found in config.js.");

const tessdataRel=channel==="edge"
  ? "vendor/lang/ind.traineddata"
  : "vendor/lang/ind.traineddata.gz";

for(const rel of [
  "background.js","cloud-surface.js","telemetry.js","ads-media.js","ad-network.js","content.js","popup.js","offscreen.js",
  "vendor/tesseract.min.js","vendor/worker.min.js","vendor/pdf-lib.min.js",
  "vendor/core/tesseract-core.wasm.js",
  "vendor/core/tesseract-core-simd.wasm.js",
  "vendor/core/tesseract-core-lstm.wasm.js",
  "vendor/core/tesseract-core-simd-lstm.wasm.js",
  tessdataRel,
  "VENDOR_MANIFEST.json"
])mustFile(rel);

if(channel==="edge"){
  for(const rel of ["vendor/lang/ind.traineddata.gz"]){
    if(fs.existsSync(path.join(packageDir,rel)))fail(`Edge package must not contain compressed asset: ${rel}`);
  }
  const archiveExt=/\.(?:zip|gz|tgz|tar|rar|7z|bz2|xz|crx)$/i;
  const nestedArchives=[];
  function scanArchives(dir,rel=""){
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const abs=path.join(dir,ent.name);
      const r=path.join(rel,ent.name).replaceAll("\\","/");
      if(ent.isDirectory())scanArchives(abs,r);
      else if(archiveExt.test(ent.name))nestedArchives.push(r);
    }
  }
  scanArchives(packageDir);
  if(nestedArchives.length)fail(`Edge package contains nested/compressed archive files: ${nestedArchives.join(", ")}`);

  const edgeOffscreen=fs.readFileSync(mustFile("offscreen.js"),"utf8");
  if(!edgeOffscreen.includes("gzip: false"))fail("Edge Tesseract loader must use gzip:false.");
}

for(const rel of ["background.js","cloud-surface.js","telemetry.js","ads-media.js","ad-network.js","content.js","popup.js","offscreen.js"]){
  const code=fs.readFileSync(mustFile(rel),"utf8");
  if(/\beval\s*\(/.test(code))fail(`eval() found in ${rel}`);
  if(/\bnew\s+Function\s*\(/.test(code))fail(`new Function() found in ${rel}`);
  if(/importScripts\s*\(\s*["']https?:\/\//i.test(code))fail(`Remote importScripts() found in ${rel}`);
  if(/new\s+Worker\s*\(\s*["']https?:\/\//i.test(code))fail(`Remote Worker URL found in ${rel}`);
}

// Compiled third-party files are reviewed too; keep the shipped vendor bundle local-only.
for(const rel of ["vendor/tesseract.min.js","vendor/worker.min.js"]){
  const code=fs.readFileSync(mustFile(rel),"utf8");
  if(/cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com/i.test(code)) fail(`Remote CDN reference found in compiled vendor file: ${rel}`);
  if(/\bnew\s+Function\s*\(|\bFunction\s*\(\s*[\"']/.test(code)) fail(`Dynamic code constructor found in compiled vendor file: ${rel}`);
}
for(const rel of ["popup.html","offscreen.html","about.html"]){
  const html=fs.readFileSync(mustFile(rel),"utf8");
  if(/<script[^>]+src\s*=\s*["']https?:\/\//i.test(html))fail(`Remote script tag found in ${rel}`);
}

const vendorManifest=JSON.parse(fs.readFileSync(mustFile("VENDOR_MANIFEST.json"),"utf8"));
if(vendorManifest.distribution_channel!==channel)fail("VENDOR_MANIFEST channel mismatch.");
if(!/^[0-9a-f]{40}$/.test(String(vendorManifest.tessdata_commit||"")))fail("Tessdata must be commit-pinned.");
if(channel==="edge"&&vendorManifest.tessdata_compression!=="none")fail("Edge tessdata compression must be none.");
for(const entry of vendorManifest.files||[]){
  const file=mustFile(path.posix.join("vendor",entry.path));
  if(Number(entry.bytes)!==fs.statSync(file).size)fail(`Vendor size mismatch: ${entry.path}`);
  if(String(entry.sha256)!==sha256(file))fail(`Vendor digest mismatch: ${entry.path}`);
}

console.log(`OK: ${channel} package ${packageDir}`);
