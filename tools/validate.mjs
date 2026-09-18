#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const js=[];
function walk(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()){
      if(["vendor","dist",".cache"].includes(e.name)) continue;
      walk(p);
    } else if(e.name.endsWith(".js")||e.name.endsWith(".mjs")) js.push(p);
  }
}
walk(ROOT);
for(const p of js){
  execFileSync(process.execPath,["--check",p],{stdio:"inherit"});
}
JSON.parse(fs.readFileSync(path.join(ROOT,"extension","manifest.json"),"utf8"));
console.log(`OK: ${js.length} JavaScript files + manifest.json`);
