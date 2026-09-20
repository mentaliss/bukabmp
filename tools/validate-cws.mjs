#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const sourceManifest=JSON.parse(fs.readFileSync(path.join(ROOT,"extension","manifest.json"),"utf8"));
const packageDir=process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT,"dist","cws",`BMP-Terbuka-v${sourceManifest.version}`);

function fail(message){ throw new Error(message); }
function mustFile(rel){
  const p=path.join(packageDir,rel);
  if(!fs.existsSync(p)||!fs.statSync(p).isFile()) fail(`Missing CWS file: ${rel}`);
  return p;
}

if(!fs.existsSync(packageDir)) fail(`CWS build not found: ${packageDir}`);
const manifest=JSON.parse(fs.readFileSync(mustFile("manifest.json"),"utf8"));
if(manifest.manifest_version!==3) fail("CWS manifest must use Manifest V3.");
if(manifest.update_url) fail("CWS manifest must not set update_url.");

const permissions=new Set(manifest.permissions||[]);
for(const required of ["storage","downloads","offscreen","clipboardWrite"]){
  if(!permissions.has(required)) fail(`Missing required permission: ${required}`);
}
if(permissions.has("tabs")) fail('CWS package must not request the broad "tabs" permission.');

const expectedHosts=[
  "https://pustaka.ut.ac.id/*",
  "https://community.bukabmp.workers.dev/*"
];
const actualHosts=[...(manifest.host_permissions||[])].sort();
if(JSON.stringify(actualHosts)!==JSON.stringify([...expectedHosts].sort())){
  fail(`Unexpected CWS host permissions: ${actualHosts.join(", ")}`);
}

if(fs.existsSync(path.join(packageDir,"config.template.js"))){
  fail("config.template.js must not be shipped.");
}
const config=fs.readFileSync(mustFile("config.js"),"utf8");
if(!/DISTRIBUTION_CHANNEL:\s*"cws"/.test(config)){
  fail('CWS config must set DISTRIBUTION_CHANNEL to "cws".');
}
if(config.includes("__BMP_")) fail("Unresolved build placeholder found in config.js.");

for(const rel of [
  "background.js","content.js","popup.js","offscreen.js",
  "vendor/tesseract.min.js","vendor/worker.min.js","vendor/pdf-lib.min.js",
  "vendor/core/tesseract-core.wasm.js",
  "vendor/core/tesseract-core-simd.wasm.js",
  "vendor/core/tesseract-core-lstm.wasm.js",
  "vendor/core/tesseract-core-simd-lstm.wasm.js",
  "vendor/lang/ind.traineddata.gz",
  "VENDOR_MANIFEST.json"
]) mustFile(rel);

for(const rel of ["background.js","content.js","popup.js","offscreen.js"]){
  const text=fs.readFileSync(mustFile(rel),"utf8");
  if(/\beval\s*\(/.test(text)) fail(`eval() found in ${rel}`);
  if(/\bnew\s+Function\s*\(/.test(text)) fail(`new Function() found in ${rel}`);
  if(/importScripts\s*\(\s*["']https?:\/\//i.test(text)){
    fail(`Remote importScripts() found in ${rel}`);
  }
  if(/new\s+Worker\s*\(\s*["']https?:\/\//i.test(text)){
    fail(`Remote Worker URL found in ${rel}`);
  }
}

for(const rel of ["popup.html","offscreen.html","about.html"]){
  const text=fs.readFileSync(mustFile(rel),"utf8");
  if(/<script[^>]+src\s*=\s*["']https?:\/\//i.test(text)){
    fail(`Remote script tag found in ${rel}`);
  }
}

const vendorManifest=JSON.parse(fs.readFileSync(mustFile("VENDOR_MANIFEST.json"),"utf8"));
if(vendorManifest.distribution_channel!=="cws") fail("VENDOR_MANIFEST channel mismatch.");
if(!/^[0-9a-f]{40}$/.test(String(vendorManifest.tessdata_commit||""))){
  fail("Tessdata provenance must be pinned to an immutable commit.");
}

console.log(`OK: CWS package ${packageDir}`);
