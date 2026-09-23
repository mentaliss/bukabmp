import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const out=path.join(root,"dist-site");
const siteDir=path.join(root,"site");

const EDGE_URL=(process.env.BMP_EDGE_ADDONS_URL||"").trim();
const BUSINESS_URL=(process.env.BMP_BUSINESS_CONTACT_URL||"").trim();
const GITHUB_ZIP_URL=(process.env.BMP_GITHUB_ZIP_URL||"https://github.com/mentaliss/bukabmp/releases/download/v1.0.5/BMP-Terbuka-v1.0.5.zip").trim();

const idRoutes={
  "":"content/id/home.md","download":"content/id/download.md","features":"content/id/features.md","how-it-works":"content/id/how-it-works.md",
  "faq":"docs/FAQ.md","sponsor":"SPONSORSHIP.md","investor":"content/id/investor.md","privacy":"PRIVACY.md","terms":"TERMS.md",
  "security":"SECURITY.md","responsible-use":"RESPONSIBLE_USE.md","community":"docs/COMMUNITY.md","ethics":"ETHICS_INDEPENDENCE.md",
  "funding":"FUNDING_TRANSPARENCY.md","advertiser-terms":"ADVERTISER_TERMS.md","trademark":"TRADEMARK.md",
  "compatibility":"docs/COMPATIBILITY.md","code-of-conduct":"CODE_OF_CONDUCT.md","architecture":"docs/ARCHITECTURE.md",
  "release-notes":"CHANGELOG.md","third-party-licenses":"THIRD_PARTY_LICENSES.md","license":"content/id/license.md"
};
const enRoutes={
  "":"content/en/home.md","download":"content/en/download.md","features":"content/en/features.md","how-it-works":"content/en/how-it-works.md",
  "faq":"content/en/faq.md","sponsor":"content/en/sponsor.md","investors":"content/en/investors.md","privacy":"content/en/privacy.md","terms":"content/en/terms.md",
  "security":"content/en/security.md","responsible-use":"content/en/responsible-use.md","community":"content/en/community.md","ethics":"content/en/ethics.md",
  "funding":"content/en/funding.md","advertiser-terms":"content/en/advertiser-terms.md","trademark":"content/en/trademark.md",
  "compatibility":"content/en/compatibility.md","code-of-conduct":"content/en/code-of-conduct.md","architecture":"content/en/architecture.md",
  "release-notes":"content/en/release-notes.md","third-party-licenses":"content/en/third-party-licenses.md","license":"content/en/license.md"
};

function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function inline(s){
  let x=esc(s);
  x=x.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  x=x.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|[^)]+)\)/g,(m,label,url)=>{
    const safe=url.startsWith("http")?url:url.replace(/^\.\.\//,"/");
    return "<a href=\""+esc(safe)+"\">"+label+"</a>";
  });
  return x;
}
function markdown(md){
  const lines=md.replace(/\r/g,"").split("\n");
  let html="",list=null;
  const close=()=>{if(list){html+="</"+list+">";list=null;}};
  for(const raw of lines){
    const line=raw.trimEnd();
    if(!line.trim()){close(); continue;}
    const h=line.match(/^(#{1,3})\s+(.+)$/);
    if(h){close(); const n=h[1].length; html+="<h"+n+">"+inline(h[2])+"</h"+n+">"; continue;}
    if(/^>\s?/.test(line)){close(); html+="<blockquote>"+inline(line.replace(/^>\s?/,""))+"</blockquote>"; continue;}
    const ul=line.match(/^[-*]\s+(.+)$/);
    if(ul){if(list!=="ul"){close();list="ul";html+="<ul>";} html+="<li>"+inline(ul[1])+"</li>"; continue;}
    const ol=line.match(/^\d+\.\s+(.+)$/);
    if(ol){if(list!=="ol"){close();list="ol";html+="<ol>";} html+="<li>"+inline(ol[1])+"</li>"; continue;}
    close(); html+="<p>"+inline(line)+"</p>";
  }
  close();
  return html;
}
function titleFrom(md){const m=md.match(/^#\s+(.+)$/m);return m?m[1]:"BMP Terbuka";}
function nav(lang){
  const home=lang==="id"?"/id/":"/en/";
  const investor=lang==="id"?"/id/investor/":"/en/investors/";
  return '<nav><a class="brand" href="'+home+'">BMP TERBUKA</a><div class="navlinks"><a href="'+home+'">'+(lang==="id"?"Beranda":"Home")+'</a><a href="/'+lang+'/download/">'+(lang==="id"?"Download":"Download")+'</a><a href="/'+lang+'/features/">'+(lang==="id"?"Fitur":"Features")+'</a><a href="/'+lang+'/sponsor/">'+(lang==="id"?"Sponsor":"Sponsor")+'</a><a href="'+investor+'">'+(lang==="id"?"Investor / Partnership":"Investors / Partnership")+'</a><span class="lang"><a href="/id/">ID</a> | <a href="/en/">EN</a></span></div></nav>';
}
function footer(lang){
  const investor=lang==="id"?"/id/investor/":"/en/investors/";
  const groups=[
    ["PRODUCT",[["Download","download"],[lang==="id"?"Fitur":"Features","features"],[lang==="id"?"Cara Kerja":"How it Works","how-it-works"],["FAQ","faq"],["Compatibility","compatibility"]]],
    ["TRUST & SAFETY",[["Privacy","privacy"],["Terms","terms"],["Responsible Use","responsible-use"],["Security","security"],["Community","community"],["Code of Conduct","code-of-conduct"]]],
    ["BUSINESS",[["Sponsor / Advertising","sponsor"],["Advertiser Terms","advertiser-terms"],["Investor / Partnership",investor],["Funding & Transparency","funding"],["Ethics & Independence","ethics"]]],
    ["LEGAL",[["Open-source License","license"],["Trademark","trademark"],["Third-party Licenses","third-party-licenses"]]],
    ["DEVELOPERS",[["GitHub","https://github.com/mentaliss/bukabmp"],["Architecture","architecture"],["Release Notes","release-notes"],["Contributing","https://github.com/mentaliss/bukabmp/blob/main/CONTRIBUTING.md"]]]
  ];
  let h="<footer>";
  for(const [name,items] of groups){h+="<section><h3>"+name+"</h3>";
    for(const [label,target] of items){
      const href=target.startsWith("http")||target.startsWith("/")?target:"/"+lang+"/"+target+"/";
      h+='<a href="'+href+'">'+label+"</a>";
    }
    h+="</section>";
  }
  return h+"</footer>";
}
function inject(content){
  let x=content;
  const edge=EDGE_URL?'<a class="button" href="'+esc(EDGE_URL)+'">Microsoft Edge Add-ons</a>':'<span class="button disabled">Microsoft Edge Add-ons — link pending verification</span>';
  const biz=BUSINESS_URL?'<a class="button secondary" href="'+esc(BUSINESS_URL)+'">Chat about advertising / partnership</a>':'<span class="button secondary disabled">Business contact — pending owner verification</span>';
  const zip=GITHUB_ZIP_URL?'<a class="button" href="'+esc(GITHUB_ZIP_URL)+'">GitHub ZIP — current stable</a>':'<span class="button disabled">GitHub ZIP — unavailable</span>';
  x=x.replaceAll("[[EDGE_CTA]]",edge).replaceAll("[[BUSINESS_CTA]]",biz).replaceAll("[[GITHUB_ZIP_CTA]]",zip);
  return x;
}
function page(lang,md){
  const title=titleFrom(md);
  const body=inject(markdown(md));
  return '<!doctype html><html lang="'+lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' — BMP Terbuka</title><meta name="description" content="BMP Terbuka — local-first searchable PDF workflow."><link rel="stylesheet" href="/assets/styles.css"></head><body>'+nav(lang)+'<main>'+body+'</main>'+footer(lang)+'</body></html>';
}
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(path.join(out,"assets"),{recursive:true});
fs.copyFileSync(path.join(siteDir,"styles.css"),path.join(out,"assets","styles.css"));
for(const [lang,routes] of Object.entries({id:idRoutes,en:enRoutes})){
  for(const [slug,source] of Object.entries(routes)){
    const src=path.join(root,source);
    if(!fs.existsSync(src)) throw new Error("Missing website source: "+source);
    const md=fs.readFileSync(src,"utf8");
    const dir=path.join(out,lang,slug);
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,"index.html"),page(lang,md));
  }
}
fs.writeFileSync(path.join(out,"index.html"),'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/id/"><title>BMP Terbuka</title><a href="/id/">Bahasa Indonesia</a> · <a href="/en/">English</a>');
fs.writeFileSync(path.join(out,"_headers"),"/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Frame-Options: DENY\n");
console.log("Built",Object.keys(idRoutes).length+Object.keys(enRoutes).length,"routes to dist-site");
