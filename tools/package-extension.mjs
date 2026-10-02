#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const EXT_SRC=path.join(ROOT,"extension");
const DIST=path.join(ROOT,"dist");
const channelArg=process.argv.find(x=>x.startsWith("--channel="));
const channel=String(channelArg?channelArg.slice("--channel=".length):"github").toLowerCase();
const allowedChannels=new Set(["github","cws","edge","android"]);
const storeChannels=new Set(["cws","edge"]);
if(!allowedChannels.has(channel))throw new Error(`Unknown distribution channel: ${channel}`);

const manifest=JSON.parse(fs.readFileSync(path.join(EXT_SRC,"manifest.json"),"utf8"));
const version=String(manifest.version||"");
if(!/^\d+(?:\.\d+){1,3}$/.test(version))throw new Error("Invalid extension version.");
const outBase=storeChannels.has(channel)?path.join(DIST,channel):DIST;
const packageDir=path.join(outBase,`BMP-Terbuka-v${version}`);
const zipPath=path.join(outBase,`BMP-Terbuka-v${version}-${channel}.zip`);
const receiptPath=path.join(outBase,`BMP-Terbuka-v${version}-${channel}.integrity.json`);

function sha256Buffer(buf){return crypto.createHash("sha256").update(buf).digest("hex")}
function sha256File(file){return sha256Buffer(fs.readFileSync(file))}
function listFiles(dir,rel="",out=[]){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,ent.name);
    const next=path.join(rel,ent.name).replaceAll("\\","/");
    if(ent.isDirectory())listFiles(abs,next,out);
    else if(ent.isFile())out.push(next);
  }
  return out.sort();
}

const crcTable=(()=>{
  const table=new Uint32Array(256);
  for(let n=0;n<256;n++){
    let c=n;
    for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
    table[n]=c>>>0;
  }
  return table;
})();

function crc32(buf){
  let c=0xffffffff;
  for(const byte of buf)c=crcTable[(c^byte)&0xff]^(c>>>8);
  return (c^0xffffffff)>>>0;
}

const ZIP_METHOD_DEFLATE=8;
const ZIP_DEFLATE_LEVEL=zlib.constants.Z_DEFAULT_COMPRESSION;

function localHeader(nameBytes,crc,compressedSize,size,method=ZIP_METHOD_DEFLATE){
  const b=Buffer.alloc(30);
  b.writeUInt32LE(0x04034b50,0);
  b.writeUInt16LE(20,4);
  b.writeUInt16LE(0x0800,6);
  b.writeUInt16LE(method,8);
  b.writeUInt16LE(0,10);
  b.writeUInt16LE(0x0021,12);
  b.writeUInt32LE(crc,14);
  b.writeUInt32LE(compressedSize,18);
  b.writeUInt32LE(size,22);
  b.writeUInt16LE(nameBytes.length,26);
  b.writeUInt16LE(0,28);
  return b;
}

function centralHeader(nameBytes,crc,compressedSize,size,offset,method=ZIP_METHOD_DEFLATE){
  const b=Buffer.alloc(46);
  b.writeUInt32LE(0x02014b50,0);
  b.writeUInt16LE(0x0314,4);
  b.writeUInt16LE(20,6);
  b.writeUInt16LE(0x0800,8);
  b.writeUInt16LE(method,10);
  b.writeUInt16LE(0,12);
  b.writeUInt16LE(0x0021,14);
  b.writeUInt32LE(crc,16);
  b.writeUInt32LE(compressedSize,20);
  b.writeUInt32LE(size,24);
  b.writeUInt16LE(nameBytes.length,28);
  b.writeUInt16LE(0,30);
  b.writeUInt16LE(0,32);
  b.writeUInt16LE(0,34);
  b.writeUInt16LE(0,36);
  b.writeUInt32LE(0,38);
  b.writeUInt32LE(offset,42);
  return b;
}

function buildDeflatedZip(sourceDir,target){
  const files=listFiles(sourceDir);
  const chunks=[];
  const central=[];
  let offset=0;
  for(const rel of files){
    const nameBytes=Buffer.from(rel,"utf8");
    const data=fs.readFileSync(path.join(sourceDir,rel));
    if(data.length>0xffffffff)throw new Error(`ZIP file too large: ${rel}`);
    const compressed=zlib.deflateRawSync(data,{level:ZIP_DEFLATE_LEVEL});
    if(compressed.length>0xffffffff)throw new Error(`ZIP compressed file too large: ${rel}`);
    const crc=crc32(data);
    const header=localHeader(nameBytes,crc,compressed.length,data.length);
    chunks.push(header,nameBytes,compressed);
    central.push(Buffer.concat([
      centralHeader(nameBytes,crc,compressed.length,data.length,offset),
      nameBytes
    ]));
    offset+=header.length+nameBytes.length+compressed.length;
  }
  const centralOffset=offset;
  const centralBuf=Buffer.concat(central);
  const eocd=Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50,0);
  eocd.writeUInt16LE(0,4);
  eocd.writeUInt16LE(0,6);
  eocd.writeUInt16LE(files.length,8);
  eocd.writeUInt16LE(files.length,10);
  eocd.writeUInt32LE(centralBuf.length,12);
  eocd.writeUInt32LE(centralOffset,16);
  eocd.writeUInt16LE(0,20);
  fs.writeFileSync(target,Buffer.concat([...chunks,centralBuf,eocd]));
  return files;
}

function extractAndVerifyDeflatedZip(zipFile,destination){
  const buf=fs.readFileSync(zipFile);
  let offset=0;
  const files=[];
  while(offset+4<=buf.length){
    const sig=buf.readUInt32LE(offset);
    if(sig===0x02014b50||sig===0x06054b50)break;
    if(sig!==0x04034b50)throw new Error(`Invalid ZIP local header at ${offset}`);
    const flags=buf.readUInt16LE(offset+6);
    const method=buf.readUInt16LE(offset+8);
    const expectedCrc=buf.readUInt32LE(offset+14);
    const compressedSize=buf.readUInt32LE(offset+18);
    const size=buf.readUInt32LE(offset+22);
    const nameLen=buf.readUInt16LE(offset+26);
    const extraLen=buf.readUInt16LE(offset+28);
    if(flags&0x0008)throw new Error("ZIP data descriptors are not supported by canonical package.");
    if(method!==ZIP_METHOD_DEFLATE)throw new Error("Canonical ZIP entries must use DEFLATE.");
    const nameStart=offset+30;
    const dataStart=nameStart+nameLen+extraLen;
    const dataEnd=dataStart+compressedSize;
    if(dataEnd>buf.length)throw new Error("Truncated ZIP entry.");
    const rel=buf.subarray(nameStart,nameStart+nameLen).toString("utf8").replaceAll("\\","/");
    if(!rel||rel.startsWith("/")||rel.includes("../")||rel.includes("..\\"))throw new Error(`Unsafe ZIP path: ${rel}`);
    const compressed=buf.subarray(dataStart,dataEnd);
    const data=zlib.inflateRawSync(compressed);
    if(data.length!==size)throw new Error(`ZIP uncompressed size mismatch: ${rel}`);
    if(crc32(data)!==expectedCrc)throw new Error(`ZIP CRC mismatch: ${rel}`);
    const out=path.join(destination,...rel.split("/"));
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,data);
    files.push(rel);
    offset=dataEnd;
  }
  return files.sort();
}

function assertSameTree(sourceDir,unzippedDir){
  const sourceFiles=listFiles(sourceDir);
  const extractedFiles=listFiles(unzippedDir);
  if(JSON.stringify(sourceFiles)!==JSON.stringify(extractedFiles)){
    throw new Error("ZIP extraction file list does not match validated package directory.");
  }
  for(const rel of sourceFiles){
    const a=sha256File(path.join(sourceDir,rel));
    const b=sha256File(path.join(unzippedDir,rel));
    if(a!==b)throw new Error(`ZIP extraction hash mismatch: ${rel}`);
  }
  return sourceFiles;
}

function git(args){
  return execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();
}

const sourceCommit=git(["rev-parse","HEAD"]);
const commitEpoch=git(["show","-s","--format=%ct","HEAD"]);

const env={...process.env,SOURCE_DATE_EPOCH:commitEpoch};
execFileSync(process.execPath,[
  path.join(ROOT,"tools","build-release.mjs"),
  "--strict",
  `--channel=${channel}`
],{cwd:ROOT,env,stdio:"inherit"});

execFileSync(process.execPath,[
  path.join(ROOT,"tools","validate-cws.mjs"),
  `--channel=${channel}`,
  `--dir=${packageDir}`
],{cwd:ROOT,env,stdio:"inherit"});

fs.rmSync(zipPath,{force:true});
const archivedFiles=buildDeflatedZip(packageDir,zipPath);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"bmp-package-verify-"));
let verifiedFiles=[];
try{
  fs.mkdirSync(temp,{recursive:true});
  verifiedFiles=extractAndVerifyDeflatedZip(zipPath,temp);
  assertSameTree(packageDir,temp);
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}

const packageFiles=listFiles(packageDir).map(rel=>{
  const file=path.join(packageDir,rel);
  return {path:rel,bytes:fs.statSync(file).size,sha256:sha256File(file)};
});
const receipt={
  schema_version:1,
  source_commit:sourceCommit,
  source_commit_epoch:Number(commitEpoch),
  distribution_channel:channel,
  manifest_version:version,
  manifest_version_name:String(manifest.version_name||""),
  package_directory:path.relative(ROOT,packageDir).replaceAll("\\","/"),
  zip_file:path.basename(zipPath),
  zip_bytes:fs.statSync(zipPath).size,
  zip_sha256:sha256File(zipPath),
  zip_compression:"deflate",
  zip_compression_method:ZIP_METHOD_DEFLATE,
  archive_entries:archivedFiles.length,
  unzip_verified:JSON.stringify(archivedFiles)===JSON.stringify(verifiedFiles),
  files:packageFiles
};
fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+"\n");

console.log(JSON.stringify({
  ok:true,
  channel,
  package_dir:packageDir,
  zip:zipPath,
  integrity:receiptPath,
  sha256:receipt.zip_sha256,
  source_commit:sourceCommit,
  zip_compression:"deflate",
  files:packageFiles.length
},null,2));
