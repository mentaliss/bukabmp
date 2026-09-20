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
const config=fs.readFileSync(mustFile("config.js"),"utf8");
const channelPattern=new RegExp(`DISTRIBUTION_CHANNEL:\\s*["']${channel}["']`);
if(!channelPattern.test(config))fail(`Config must set DISTRIBUTION_CHANNEL to "${channel}".`);
if(config.includes("__BMP_"))fail("Unresolved build placeholder found in config.js.");

for(const rel of [
  "background.js","cloud-surface.js","content.js","popup.js","offscreen.js",
  "vendor/tesseract.min.js","vendor/worker.min.js","vendor/pdf-lib.min.js",
  "vendor/core/tesseract-core.wasm.js",
  "vendor/core/tesseract-core-simd.wasm.js",
  "vendor/core/tesseract-core-lstm.wasm.js",
  "vendor/core/tesseract-core-simd-lstm.wasm.js",
  "vendor/lang/ind.traineddata.gz",
  "VENDOR_MANIFEST.json"
])mustFile(rel);

for(const rel of ["background.js","cloud-surface.js","content.js","popup.js","offscreen.js"]){
  const code=fs.readFileSync(mustFile(rel),"utf8");
  if(/\beval\s*\(/.test(code))fail(`eval() found in ${rel}`);
  if(/\bnew\s+Function\s*\(/.test(code))fail(`new Function() found in ${rel}`);
  if(/importScripts\s*\(\s*["']https?:\/\//i.test(code))fail(`Remote importScripts() found in ${rel}`);
  if(/new\s+Worker\s*\(\s*["']https?:\/\//i.test(code))fail(`Remote Worker URL found in ${rel}`);
}

for(const rel of ["popup.html","offscreen.html","about.html"]){
  const html=fs.readFileSync(mustFile(rel),"utf8");
  if(/<script[^>]+src\s*=\s*["']https?:\/\//i.test(html))fail(`Remote script tag found in ${rel}`);
}

const vendorManifest=JSON.parse(fs.readFileSync(mustFile("VENDOR_MANIFEST.json"),"utf8"));
if(vendorManifest.distribution_channel!==channel)fail("VENDOR_MANIFEST channel mismatch.");
if(!/^[0-9a-f]{40}$/.test(String(vendorManifest.tessdata_commit||"")))fail("Tessdata must be commit-pinned.");
for(const entry of vendorManifest.files||[]){
  const file=mustFile(path.posix.join("vendor",entry.path));
  if(Number(entry.bytes)!==fs.statSync(file).size)fail(`Vendor size mismatch: ${entry.path}`);
  if(String(entry.sha256)!==sha256(file))fail(`Vendor digest mismatch: ${entry.path}`);
}

console.log(`OK: ${channel} package ${packageDir}`);
