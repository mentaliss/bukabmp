import fs from "node:fs";
import path from "node:path";

const requiredLanguages = ["id", "en"];
const commonRoutes = [
  "download","features","how-it-works","faq","sponsor","privacy","terms",
  "security","responsible-use","community","ethics","funding","advertiser-terms",
  "trademark","compatibility","code-of-conduct","architecture","release-notes",
  "third-party-licenses","license"
];

for (const lang of requiredLanguages) {
  const home = path.join("dist-site", lang, "index.html");
  if (!fs.existsSync(home)) throw new Error("missing " + home);

  for (const route of commonRoutes) {
    const file = path.join("dist-site", lang, route, "index.html");
    if (!fs.existsSync(file)) throw new Error("missing " + file);
  }
}

for (const file of [
  path.join("dist-site", "id", "investor", "index.html"),
  path.join("dist-site", "en", "investors", "index.html"),
  path.join("dist-site", "id", "docs", "index.html"),
  path.join("dist-site", "id", "docs", "install", "index.html"),
  path.join("dist-site", "id", "docs", "activation", "index.html"),
  path.join("dist-site", "id", "docs", "usage", "index.html"),
  path.join("dist-site", "id", "docs", "files", "index.html"),
  path.join("dist-site", "id", "docs", "troubleshooting", "index.html"),
  path.join("dist-site", "id", "docs", "bot", "index.html"),
  path.join("dist-site", "id", "docs", "supporter", "index.html"),
  path.join("dist-site", "id", "status", "index.html")
]) {
  if (!fs.existsSync(file)) throw new Error("missing " + file);
}

const idHome = fs.readFileSync(path.join("dist-site", "id", "index.html"), "utf8");
const idDownload = fs.readFileSync(path.join("dist-site", "id", "download", "index.html"), "utf8");
const idStatus = fs.readFileSync(path.join("dist-site", "id", "status", "index.html"), "utf8");
const idInstall = fs.readFileSync(path.join("dist-site", "id", "docs", "install", "index.html"), "utf8");

for (const required of [
  "/bukabmp/assets/styles.css",
  "https://mentaliss.github.io/bukabmp/id/",
  "https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm",
  "https://t.me/bukabmp"
]) {
  if (!idHome.includes(required)) throw new Error("homepage missing expected value: " + required);
}

if (!idDownload.includes("BMP-Terbuka-v1.1.0.zip")) {
  throw new Error("download page missing stable v1.1.0 asset");
}

if (/Unreleased/i.test(idDownload)) {
  throw new Error("download page must not describe v1.1.0 as unreleased");
}

for (const required of [
  "BMP Terbuka v1.1.0",
  "Belum tersedia sebagai jalur instalasi aktif",
  "/bukabmp/id/docs/install/"
]) {
  if (!idStatus.includes(required)) throw new Error("status page missing expected value: " + required);
}

for (const required of [
  "chrome://extensions",
  "Load unpacked",
  "Microsoft Edge Stable",
  "/bukabmp/id/docs/activation/"
]) {
  if (!idInstall.includes(required)) throw new Error("install guide missing expected value: " + required);
}

console.log("site validation PASS");
