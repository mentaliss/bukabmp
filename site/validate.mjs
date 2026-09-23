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
  path.join("dist-site", "id", "status", "index.html"),
  path.join("dist-site", "en", "docs", "index.html"),
  path.join("dist-site", "en", "docs", "install", "index.html"),
  path.join("dist-site", "en", "docs", "activation", "index.html"),
  path.join("dist-site", "en", "docs", "usage", "index.html"),
  path.join("dist-site", "en", "docs", "files", "index.html"),
  path.join("dist-site", "en", "docs", "troubleshooting", "index.html"),
  path.join("dist-site", "en", "docs", "bot", "index.html"),
  path.join("dist-site", "en", "docs", "supporter", "index.html"),
  path.join("dist-site", "en", "status", "index.html")
]) {
  if (!fs.existsSync(file)) throw new Error("missing " + file);
}

const idHome = fs.readFileSync(path.join("dist-site", "id", "index.html"), "utf8");
const idDownload = fs.readFileSync(path.join("dist-site", "id", "download", "index.html"), "utf8");
const idDocs = fs.readFileSync(path.join("dist-site", "id", "docs", "index.html"), "utf8");
const idStatus = fs.readFileSync(path.join("dist-site", "id", "status", "index.html"), "utf8");
const idInstall = fs.readFileSync(path.join("dist-site", "id", "docs", "install", "index.html"), "utf8");
const enHome = fs.readFileSync(path.join("dist-site", "en", "index.html"), "utf8");
const enDownload = fs.readFileSync(path.join("dist-site", "en", "download", "index.html"), "utf8");
const enDocs = fs.readFileSync(path.join("dist-site", "en", "docs", "index.html"), "utf8");
const enStatus = fs.readFileSync(path.join("dist-site", "en", "status", "index.html"), "utf8");
const enInstall = fs.readFileSync(path.join("dist-site", "en", "docs", "install", "index.html"), "utf8");
const enPrivacy = fs.readFileSync(path.join("dist-site", "en", "privacy", "index.html"), "utf8");
const aiCorpusPath = path.join("dist-site", "id", "ai-support.json");
if (!fs.existsSync(aiCorpusPath)) throw new Error("missing " + aiCorpusPath);
const aiCorpus = JSON.parse(fs.readFileSync(aiCorpusPath, "utf8"));
if (!/^[0-9a-f]{64}$/i.test(String(aiCorpus.content_sha256 || ""))) {
  throw new Error("AI support corpus missing valid content_sha256");
}
if (!String(aiCorpus.source_revision || "").trim()) {
  throw new Error("AI support corpus missing source_revision");
}

for (const required of [
  "/bukabmp/assets/styles.css",
  "https://mentaliss.github.io/bukabmp/id/",
  "https://t.me/bukabmp",
  "Mulai Menggunakan",
  ">Download<",
  ">Contact<",
  'class="home-cta-row"',
  "/bukabmp/id/docs/",
  "/bukabmp/id/download/"
]) {
  if (!idHome.includes(required)) throw new Error("homepage missing expected value: " + required);
}

if (idHome.includes(">Microsoft Edge Add-ons<")) {
  throw new Error("homepage must link to Download page instead of exposing Edge Add-ons CTA");
}

for (const required of [
  "Get Started",
  ">Download<",
  ">Contact<",
  'class="home-cta-row"',
  "/bukabmp/en/docs/",
  "/bukabmp/en/download/",
  "/bukabmp/en/status/"
]) {
  if (!enHome.includes(required)) throw new Error("English homepage missing expected value: " + required);
}

if (enHome.includes(">Microsoft Edge Add-ons<")) {
  throw new Error("English homepage must link to Download page instead of exposing Edge Add-ons CTA");
}

if (!idDownload.includes("BMP-Terbuka-v1.1.0.zip")) {
  throw new Error("download page missing stable v1.1.0 asset");
}

if (/Unreleased/i.test(idDownload)) {
  throw new Error("download page must not describe v1.1.0 as unreleased");
}

if (!enDownload.includes("BMP-Terbuka-v1.1.0.zip")) {
  throw new Error("English download page missing stable v1.1.0 asset");
}

if (/Unreleased/i.test(enDownload) || /Unreleased/i.test(enPrivacy)) {
  throw new Error("English public pages must not describe v1.1.0 as unreleased");
}

for (const required of [
  'class="docs-layout"',
  'class="docs-toc"',
  'class="docs-toc-title">Daftar isi',
  'href="#sebelum-mulai"',
  'id="sebelum-mulai"'
]) {
  if (!idDocs.includes(required)) throw new Error("docs page missing expected TOC value: " + required);
}

for (const required of [
  'class="docs-layout"',
  'class="docs-toc"',
  'class="docs-toc-title">On this page',
  'href="#before-you-start"',
  'id="before-you-start"'
]) {
  if (!enDocs.includes(required)) throw new Error("English docs page missing expected TOC value: " + required);
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

for (const required of [
  "BMP Terbuka v1.1.0",
  "Not available as an active installation path yet",
  "/bukabmp/en/docs/install/"
]) {
  if (!enStatus.includes(required)) throw new Error("English status page missing expected value: " + required);
}

for (const required of [
  "chrome://extensions",
  "Load unpacked",
  "Microsoft Edge Stable",
  "/bukabmp/en/docs/activation/"
]) {
  if (!enInstall.includes(required)) throw new Error("English install guide missing expected value: " + required);
}

if (aiCorpus.schema_version !== 1 || aiCorpus.language !== "id") {
  throw new Error("invalid AI support corpus schema/language");
}
if (!Array.isArray(aiCorpus.pages) || aiCorpus.pages.length < 20) {
  throw new Error("AI support corpus is unexpectedly small");
}
const corpusText = JSON.stringify(aiCorpus);
for (const required of [
  "docs/install",
  "docs/troubleshooting",
  "docs/supporter",
  "status",
  "privacy",
  "Chrome Web Store",
  "Microsoft Edge Stable",
  "v1.1.0",
  "https://mentaliss.github.io/bukabmp/id/docs/install/"
]) {
  if (!corpusText.includes(required)) {
    throw new Error("AI support corpus missing expected value: " + required);
  }
}
const sections = aiCorpus.pages.flatMap(page => Array.isArray(page.sections) ? page.sections : []);
if (sections.length < 60) {
  throw new Error("AI support corpus has too few sections");
}
if (!sections.every(section => section.url && section.text && section.search_text)) {
  throw new Error("AI support corpus contains incomplete sections");
}

console.log("site validation PASS");
