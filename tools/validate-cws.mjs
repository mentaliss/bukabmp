#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const EXT_SRC=path.join(ROOT,"extension");
const sourceManifest=JSON.parse(fs.readFileSync(path.join(EXT_SRC,"manifest.json"),"utf8"));
const packageBaseline=JSON.parse(fs.readFileSync(path.join(ROOT,"tools","extension-package-baseline.json"),"utf8"));
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
if(String(manifest.version||"")!==String(sourceManifest.version||""))fail("Package manifest version changed from audited source.");
if(String(manifest.version_name||"")!==String(sourceManifest.version_name||""))fail("Package manifest version_name changed from audited source.");
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

for(const rel of packageBaseline.required_files||[])mustFile(rel);
for(const rel of packageBaseline.forbidden_files||[]){
  if(fs.existsSync(path.join(packageDir,rel)))fail(`Forbidden package file: ${rel}`);
}

function collectFiles(dir,rel="",out=[]){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,ent.name);
    const next=path.join(rel,ent.name).replaceAll("\\","/");
    if(ent.isDirectory())collectFiles(abs,next,out);
    else if(ent.isFile())out.push(next);
  }
  return out;
}

// Every first-party source runtime file must survive packaging. Vendor is
// validated separately because the build intentionally replaces/fetches it.
const sourceRuntimeFiles=collectFiles(EXT_SRC).filter(rel=>
  rel!=="config.template.js" &&
  !rel.startsWith("vendor/")
);
for(const rel of sourceRuntimeFiles)mustFile(rel);

const manifestRefs=new Set();
if(manifest?.background?.service_worker)manifestRefs.add(manifest.background.service_worker);
if(manifest?.action?.default_popup)manifestRefs.add(manifest.action.default_popup);
if(manifest?.options_page)manifestRefs.add(manifest.options_page);
if(manifest?.options_ui?.page)manifestRefs.add(manifest.options_ui.page);
if(manifest?.side_panel?.default_path)manifestRefs.add(manifest.side_panel.default_path);
for(const rel of Object.values(manifest?.icons||{}))manifestRefs.add(rel);
for(const script of manifest?.content_scripts||[]){
  for(const rel of script?.js||[])manifestRefs.add(rel);
  for(const rel of script?.css||[])manifestRefs.add(rel);
}
for(const item of manifest?.web_accessible_resources||[]){
  for(const rel of item?.resources||[]){
    if(!String(rel).includes("*"))manifestRefs.add(rel);
  }
}
for(const rel of manifestRefs)mustFile(rel);
const config=fs.readFileSync(mustFile("config.js"),"utf8");
const channelPattern=new RegExp(`DISTRIBUTION_CHANNEL:\\s*["']${channel}["']`);
if(!channelPattern.test(config))fail(`Config must set DISTRIBUTION_CHANNEL to "${channel}".`);
if(config.includes("__BMP_"))fail("Unresolved build placeholder found in config.js.");

const tessdataRel=channel==="edge"
  ? "vendor/lang/ind.traineddata"
  : "vendor/lang/ind.traineddata.gz";

for(const rel of [
  "background.js","cache-consistency.js","cloud-surface.js","telemetry.js",
  "ads-media.js","ad-network.js","local-backup.js","quiz-local.js","content.js","popup.js","offscreen.js",
  "popup.html","offscreen.html","about.html",
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

for(const rel of ["background.js","cloud-surface.js","telemetry.js","ads-media.js","ad-network.js","local-backup.js","content.js","popup.js","offscreen.js"]){
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
// Defense in depth: inspect every JavaScript file that will actually ship, not
// only first-party entry points. This catches future dependency regressions.
const shippedJs=[];
function collectShippedJs(dir,rel=""){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,ent.name);
    const r=path.join(rel,ent.name).replaceAll("\\","/");
    if(ent.isDirectory())collectShippedJs(abs,r);
    else if(ent.isFile()&&ent.name.endsWith(".js"))shippedJs.push(r);
  }
}
collectShippedJs(packageDir);
for(const rel of shippedJs){
  const code=fs.readFileSync(mustFile(rel),"utf8");
  if(/\beval\s*\(/.test(code))fail(`eval() found in shipped code: ${rel}`);
  if(/\bnew\s+Function\s*\(|\bFunction\s*\(\s*[\"\']/.test(code))fail(`Dynamic code constructor found in shipped code: ${rel}`);
  if(/(?:importScripts|new\s+Worker)\s*\([^)]*https?:\/\//i.test(code))fail(`Remote executable URL found in shipped code: ${rel}`);
  if(/cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com/i.test(code))fail(`Remote CDN reference found in shipped code: ${rel}`);
}
for(const rel of ["popup.html","offscreen.html","about.html"]){
  const html=fs.readFileSync(mustFile(rel),"utf8");
  if(/<script[^>]+src\s*=\s*["']https?:\/\//i.test(html))fail(`Remote script tag found in ${rel}`);
  for(const match of html.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi)){
    const src=String(match[1]||"").trim();
    if(!src||/^(?:https?:|data:|blob:)/i.test(src))continue;
    mustFile(src.replace(/^\.\//,""));
  }
}

// Parse every shipped JavaScript file with the same Node major used by CI.
for(const rel of shippedJs){
  try{
    execFileSync(process.execPath,["--check",mustFile(rel)],{stdio:"pipe"});
  }catch(error){
    fail(`JavaScript syntax check failed: ${rel}\n${String(error?.stderr||error?.message||error)}`);
  }
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
