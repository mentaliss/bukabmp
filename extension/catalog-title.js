(function(root){
  "use strict";

  // Judul materi dari katalog resmi UT (WordPress REST publik).
  // Murni & deterministik supaya bisa dites di node (tests/material-title.test.mjs).
  // Dipakai background.js (GET_MATERIAL_TITLE); hasil di-cache di bmpCacheMeta
  // sehingga katalog hanya ditanya sekali per kode.

  function decodeHtmlEntities(value){
    return String(value||"")
      .replace(/&#(\d+);/g,(_,d)=>{
        const n=Number(d);
        return Number.isFinite(n)&&n>0&&n<=0x10FFFF?String.fromCodePoint(n):"";
      })
      .replace(/&#x([0-9a-f]+);/gi,(_,d)=>{
        const n=parseInt(d,16);
        return Number.isFinite(n)&&n>0&&n<=0x10FFFF?String.fromCodePoint(n):"";
      })
      .replace(/&quot;/g,'"')
      .replace(/&#0?39;|&apos;/g,"'")
      .replace(/&nbsp;/g," ")
      .replace(/&lt;/g,"<")
      .replace(/&gt;/g,">")
      .replace(/&amp;/g,"&");
  }

  // Format katalog: "KODE – Judul Materi (Edisi N)" (separator – — - atau :).
  // Hanya judul yang DIWAJIBKAN diawali kode persis; satu kode bisa punya
  // beberapa edisi — pilih edisi tertinggi, fallback hasil pertama.
  function pickCatalogTitle(code,posts){
    const wanted=String(code||"").trim().toUpperCase();
    if(!/^[A-Z0-9_-]{3,32}$/.test(wanted))return "";
    if(!Array.isArray(posts))return "";
    const matches=[];
    for(const post of posts){
      const raw=decodeHtmlEntities(post&&post.title&&post.title.rendered).trim();
      if(!raw)continue;
      const m=raw.match(new RegExp("^"+wanted+"\\s*[\\u2013\\u2014\\-:]\\s*(.+)$","i"));
      if(!m)continue;
      const title=m[1].trim();
      if(!title)continue;
      const edisi=/edisi\s+(\d+)/i.exec(title);
      matches.push({title,edition:edisi?Number(edisi[1]):0});
    }
    if(!matches.length)return "";
    matches.sort((a,b)=>b.edition-a.edition);
    return matches[0].title.slice(0,300);
  }

  root.BMP_CATALOG_TITLE=Object.freeze({decodeHtmlEntities,pickCatalogTitle});
})(typeof self!=="undefined"?self:globalThis);
