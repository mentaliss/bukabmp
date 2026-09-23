import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "dist-site");
const siteDir = path.join(root, "site");

const BASE_PATH = (process.env.BMP_SITE_BASE_PATH || "/bukabmp").trim().replace(/\/$/, "");
const SITE_URL = (process.env.BMP_SITE_URL || "https://mentaliss.github.io/bukabmp").trim().replace(/\/$/, "");
const EDGE_URL = (process.env.BMP_EDGE_ADDONS_URL || "https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm").trim();
const BUSINESS_URL = (process.env.BMP_BUSINESS_CONTACT_URL || "https://t.me/bukabmp").trim();
const GITHUB_ZIP_URL = (process.env.BMP_GITHUB_ZIP_URL || "https://github.com/mentaliss/bukabmp/releases/download/v1.1.0/BMP-Terbuka-v1.1.0.zip").trim();

const idRoutes = {
  "": "content/id/home.md",
  "download": "content/id/download.md",
  "features": "content/id/features.md",
  "how-it-works": "content/id/how-it-works.md",
  "docs": "content/id/getting-started.md",
  "docs/install": "content/id/install.md",
  "docs/activation": "content/id/activation.md",
  "docs/usage": "content/id/usage.md",
  "docs/files": "content/id/files.md",
  "docs/troubleshooting": "content/id/troubleshooting.md",
  "docs/bot": "content/id/bot.md",
  "docs/supporter": "content/id/supporter.md",
  "status": "content/id/status.md",
  "faq": "docs/FAQ.md",
  "sponsor": "SPONSORSHIP.md",
  "investor": "content/id/investor.md",
  "privacy": "PRIVACY.md",
  "terms": "TERMS.md",
  "security": "SECURITY.md",
  "responsible-use": "RESPONSIBLE_USE.md",
  "community": "docs/COMMUNITY.md",
  "ethics": "ETHICS_INDEPENDENCE.md",
  "funding": "FUNDING_TRANSPARENCY.md",
  "advertiser-terms": "ADVERTISER_TERMS.md",
  "trademark": "TRADEMARK.md",
  "compatibility": "docs/COMPATIBILITY.md",
  "code-of-conduct": "CODE_OF_CONDUCT.md",
  "architecture": "docs/ARCHITECTURE.md",
  "release-notes": "CHANGELOG.md",
  "third-party-licenses": "THIRD_PARTY_LICENSES.md",
  "license": "content/id/license.md"
};

const enRoutes = {
  "": "content/en/home.md",
  "download": "content/en/download.md",
  "features": "content/en/features.md",
  "how-it-works": "content/en/how-it-works.md",
  "faq": "content/en/faq.md",
  "sponsor": "content/en/sponsor.md",
  "investors": "content/en/investors.md",
  "privacy": "content/en/privacy.md",
  "terms": "content/en/terms.md",
  "security": "content/en/security.md",
  "responsible-use": "content/en/responsible-use.md",
  "community": "content/en/community.md",
  "ethics": "content/en/ethics.md",
  "funding": "content/en/funding.md",
  "advertiser-terms": "content/en/advertiser-terms.md",
  "trademark": "content/en/trademark.md",
  "compatibility": "content/en/compatibility.md",
  "code-of-conduct": "content/en/code-of-conduct.md",
  "architecture": "content/en/architecture.md",
  "release-notes": "content/en/release-notes.md",
  "third-party-licenses": "content/en/third-party-licenses.md",
  "license": "content/en/license.md"
};

const repoDocRoutes = new Map([
  ["PRIVACY.md", "privacy"],
  ["SECURITY.md", "security"],
  ["RESPONSIBLE_USE.md", "responsible-use"],
  ["TERMS.md", "terms"],
  ["SPONSORSHIP.md", "sponsor"],
  ["ADVERTISER_TERMS.md", "advertiser-terms"],
  ["ETHICS_INDEPENDENCE.md", "ethics"],
  ["FUNDING_TRANSPARENCY.md", "funding"],
  ["TRADEMARK.md", "trademark"],
  ["THIRD_PARTY_LICENSES.md", "third-party-licenses"],
  ["CHANGELOG.md", "release-notes"],
  ["docs/FAQ.md", "faq"],
  ["docs/COMPATIBILITY.md", "compatibility"],
  ["docs/COMMUNITY.md", "community"],
  ["docs/ARCHITECTURE.md", "architecture"],
  ["docs/INSTALL.md", "docs/install"],
  ["docs/RELEASE.md", "release-notes"]
]);

function esc(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function sitePath(relative = "") {
  const suffix = relative ? "/" + String(relative).replace(/^\/+|\/+$/g, "") + "/" : "/";
  return (BASE_PATH || "") + suffix;
}

function normalizeRepoPath(url) {
  return String(url).replace(/^\.\.\//, "").replace(/^\.\//, "").replace(/^\//, "");
}

function resolveLink(url, lang, slug = "") {
  const raw = String(url);
  if (/^https?:\/\//i.test(raw) || /^mailto:/i.test(raw)) return raw;
  if (raw.startsWith("#")) return raw;

  const normalized = normalizeRepoPath(raw);
  if (normalized === "CONTRIBUTING.md") return "https://github.com/mentaliss/bukabmp/blob/main/CONTRIBUTING.md";
  if (normalized === "LICENSE") return sitePath(lang + "/license");

  const route = repoDocRoutes.get(normalized);
  if (route) return sitePath(lang + "/" + route);

  const routes = lang === "id" ? idRoutes : enRoutes;
  if (Object.prototype.hasOwnProperty.call(routes, normalized)) {
    return sitePath(lang + "/" + normalized);
  }

  if (
    lang === "id" &&
    slug.startsWith("docs") &&
    !normalized.includes("/") &&
    Object.prototype.hasOwnProperty.call(routes, "docs/" + normalized)
  ) {
    return sitePath(lang + "/docs/" + normalized);
  }

  return sitePath(lang);
}

function inline(value, lang, slug = "") {
  let x = esc(value);
  x = x.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  x = x.replace(/\`(.+?)\`/g, "<code>$1</code>");
  x = x.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    return '<a href="' + esc(resolveLink(url, lang, slug)) + '">' + label + "</a>";
  });
  return x;
}

function headingText(value) {
  return String(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\`(.+?)\`/g, "$1")
    .trim();
}

function headingSlug(value, seen) {
  const base = headingText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "bagian";
  const count = (seen.get(base) || 0) + 1;
  seen.set(base, count);
  return count === 1 ? base : base + "-" + count;
}

function docsTableOfContents(md, lang, slug) {
  const seen = new Map();
  const items = [];

  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const heading = raw.trimEnd().match(/^(#{1,3})\s+(.+)$/);
    if (!heading) continue;
    const level = heading[1].length;
    const id = headingSlug(heading[2], seen);
    if (level === 2 || level === 3) {
      items.push({
        level,
        id,
        label: inline(headingText(heading[2]), lang, slug)
      });
    }
  }

  if (!items.length) return "";

  return '<aside class="docs-toc" aria-label="Daftar isi">' +
    '<div class="docs-toc-title">Daftar isi</div>' +
    '<div class="docs-toc-links">' +
    items.map(item =>
      '<a class="docs-toc-link level-' + item.level + '" href="#' + esc(item.id) + '">' +
      item.label + "</a>"
    ).join("") +
    "</div></aside>";
}

function markdown(md, lang, slug = "") {
  const lines = md.replace(/\r/g, "").split("\n");
  let html = "";
  let list = null;
  const headingIds = new Map();

  const closeList = () => {
    if (list) {
      html += "</" + list + ">";
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const id = headingSlug(heading[2], headingIds);
      html += "<h" + level + ' id="' + esc(id) + '">' + inline(heading[2], lang, slug) + "</h" + level + ">";
      continue;
    }

    if (/^>\s?/.test(line)) {
      closeList();
      html += "<blockquote>" + inline(line.replace(/^>\s?/, ""), lang, slug) + "</blockquote>";
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      if (list !== "ul") {
        closeList();
        list = "ul";
        html += "<ul>";
      }
      html += "<li>" + inline(unordered[1], lang, slug) + "</li>";
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      if (list !== "ol") {
        closeList();
        list = "ol";
        html += "<ol>";
      }
      html += "<li>" + inline(ordered[1], lang, slug) + "</li>";
      continue;
    }

    closeList();
    if (/^https?:\/\/\S+$/.test(line.trim())) {
      const url = line.trim();
      html += '<p><a href="' + esc(url) + '">' + esc(url) + "</a></p>";
    } else {
      html += "<p>" + inline(line, lang, slug) + "</p>";
    }
  }

  closeList();
  return html;
}

function titleFrom(md) {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1] : "BMP Terbuka";
}

function nav(lang) {
  const home = sitePath(lang);
  const investor = lang === "id" ? sitePath("id/investor") : sitePath("en/investors");
  const helpLinks = lang === "id"
    ? '<a href="' + sitePath("id/docs") + '">Panduan</a>' +
      '<a href="' + sitePath("id/status") + '">Status</a>' +
      '<a href="' + sitePath("id/faq") + '">FAQ</a>'
    : "";
  return '<nav><a class="brand" href="' + home + '">BMP TERBUKA</a><div class="navlinks">' +
    '<a href="' + home + '">' + (lang === "id" ? "Beranda" : "Home") + "</a>" +
    '<a href="' + sitePath(lang + "/download") + '">Download</a>' +
    helpLinks +
    '<a href="' + sitePath(lang + "/features") + '">' + (lang === "id" ? "Fitur" : "Features") + "</a>" +
    '<a href="' + sitePath(lang + "/sponsor") + '">Sponsor</a>' +
    '<a href="' + investor + '">' + (lang === "id" ? "Investor / Partnership" : "Investors / Partnership") + "</a>" +
    '<span class="lang"><a href="' + sitePath("id") + '">ID</a> | <a href="' + sitePath("en") + '">EN</a></span></div></nav>';
}

function footer(lang) {
  const investor = lang === "id" ? sitePath("id/investor") : sitePath("en/investors");
  const groups = [
    ["PRODUCT", [["Download", "download"], [lang === "id" ? "Fitur" : "Features", "features"], [lang === "id" ? "Cara Kerja" : "How it Works", "how-it-works"], ["FAQ", "faq"], ["Compatibility", "compatibility"]]],
    ["TRUST & SAFETY", [["Privacy", "privacy"], ["Terms", "terms"], ["Responsible Use", "responsible-use"], ["Security", "security"], ["Community", "community"], ["Code of Conduct", "code-of-conduct"]]],
    ["BUSINESS", [["Sponsor / Advertising", "sponsor"], ["Advertiser Terms", "advertiser-terms"], ["Investor / Partnership", investor], ["Funding & Transparency", "funding"], ["Ethics & Independence", "ethics"]]],
    ["LEGAL", [["Open-source License", "license"], ["Trademark", "trademark"], ["Third-party Licenses", "third-party-licenses"]]],
    ["DEVELOPERS", [["GitHub", "https://github.com/mentaliss/bukabmp"], ["Architecture", "architecture"], ["Release Notes", "release-notes"], ["Contributing", "https://github.com/mentaliss/bukabmp/blob/main/CONTRIBUTING.md"]]]
  ];

  if (lang === "id") {
    groups.splice(1, 0, ["PANDUAN", [
      ["Mulai", "docs"],
      ["Instalasi & Update", "docs/install"],
      ["Aktivasi", "docs/activation"],
      ["Cara Menggunakan", "docs/usage"],
      ["PDF, Resume & Penyimpanan", "docs/files"],
      ["Mengatasi Masalah", "docs/troubleshooting"],
      ["Bot & Komunitas", "docs/bot"],
      ["Supporter Pass", "docs/supporter"],
      ["Status & Versi", "status"]
    ]]);
  }

  let html = "<footer>";
  for (const [name, items] of groups) {
    html += "<section><h3>" + name + "</h3>";
    for (const [label, target] of items) {
      let href;
      if (/^https?:\/\//.test(target) || target.startsWith("/")) href = target;
      else href = sitePath(lang + "/" + target);
      html += '<a href="' + href + '">' + label + "</a>";
    }
    html += "</section>";
  }
  return html + "</footer>";
}

function inject(content) {
  const edge = EDGE_URL
    ? '<a class="button" href="' + esc(EDGE_URL) + '">Microsoft Edge Add-ons</a>'
    : '<span class="button disabled">Microsoft Edge Add-ons — link pending verification</span>';

  const business = BUSINESS_URL
    ? '<a class="button" href="' + esc(BUSINESS_URL) + '">Contact</a>'
    : '<span class="button disabled">Contact — pending owner verification</span>';

  const docs = '<a class="button secondary" href="' + sitePath("id/docs") + '">Mulai Menggunakan</a>';

  const zip = GITHUB_ZIP_URL
    ? '<a class="button" href="' + esc(GITHUB_ZIP_URL) + '">GitHub ZIP — current stable v1.1.0</a>'
    : '<span class="button disabled">GitHub ZIP — unavailable</span>';

  return content
    .replaceAll("[[EDGE_CTA]]", edge)
    .replaceAll("[[DOCS_CTA]]", docs)
    .replaceAll("[[BUSINESS_CTA]]", business)
    .replaceAll("[[GITHUB_ZIP_CTA]]", zip);
}

function page(lang, slug, md) {
  const title = titleFrom(md);
  const body = inject(markdown(md, lang, slug));
  const isDocs = lang === "id" && (slug === "docs" || slug.startsWith("docs/"));
  const toc = isDocs ? docsTableOfContents(md, lang, slug) : "";
  const mainBody = isDocs
    ? '<div class="docs-layout">' + toc + '<article class="docs-article">' + body + "</article></div>"
    : body;
  const mainClass = isDocs ? ' class="docs-main"' : "";
  const canonicalPath = slug ? "/" + lang + "/" + slug + "/" : "/" + lang + "/";
  const canonical = SITE_URL + canonicalPath;

  return '<!doctype html><html lang="' + lang + '"><head>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" + esc(title) + " — BMP Terbuka</title>" +
    '<meta name="description" content="BMP Terbuka — local-first searchable PDF workflow.">' +
    '<link rel="canonical" href="' + esc(canonical) + '">' +
    '<link rel="stylesheet" href="' + sitePath("assets/styles.css").replace(/\/$/, "") + '">' +
    "</head><body>" + nav(lang) + "<main" + mainClass + ">" + mainBody + "</main>" + footer(lang) + "</body></html>";
}

fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(path.join(out, "assets"), {recursive: true});
fs.copyFileSync(path.join(siteDir, "styles.css"), path.join(out, "assets", "styles.css"));

for (const [lang, routes] of Object.entries({id: idRoutes, en: enRoutes})) {
  for (const [slug, source] of Object.entries(routes)) {
    const src = path.join(root, source);
    if (!fs.existsSync(src)) throw new Error("Missing website source: " + source);
    const md = fs.readFileSync(src, "utf8");
    const dir = path.join(out, lang, slug);
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, "index.html"), page(lang, slug, md));
  }
}

fs.writeFileSync(
  path.join(out, "index.html"),
  '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=' + sitePath("id") + '"><title>BMP Terbuka</title><a href="' + sitePath("id") + '">Bahasa Indonesia</a> · <a href="' + sitePath("en") + '">English</a>'
);

fs.writeFileSync(
  path.join(out, "_headers"),
  "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Frame-Options: DENY\n"
);

console.log("Built", Object.keys(idRoutes).length + Object.keys(enRoutes).length, "routes to dist-site with base", BASE_PATH || "/");
