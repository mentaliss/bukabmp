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
  path.join("dist-site", "en", "investors", "index.html")
]) {
  if (!fs.existsSync(file)) throw new Error("missing " + file);
}

const idHome = fs.readFileSync(path.join("dist-site", "id", "index.html"), "utf8");
const idDownload = fs.readFileSync(path.join("dist-site", "id", "download", "index.html"), "utf8");

for (const required of [
  "/bukabmp/assets/styles.css",
  "https://mentaliss.github.io/bukabmp/id/",
  "https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm",
  "https://t.me/bukabmp"
]) {
  if (!idHome.includes(required)) throw new Error("homepage missing expected value: " + required);
}

if (!idDownload.includes("BMP-Terbuka-v1.0.5.zip")) {
  throw new Error("download page missing verified stable v1.0.5 asset");
}

if (idDownload.includes("v1.1.0.zip")) {
  throw new Error("download page must not claim a released v1.1.0 ZIP");
}

console.log("site validation PASS");
