(function(root){
  "use strict";

  const MAX_QUIZ_SOURCE_CHARS = 48000;

  const identityPatterns = [
    /\b(?:nim|npm|nomor\s+induk(?:\s+mahasiswa)?|nama(?:\s+mahasiswa)?|username|user\s*id|student\s*id)\b/i,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /\b\d{9,18}\b/,
    /https?:\/\//i,
    /pustaka\.ut\.ac\.id\/reader/i,
    /\b(?:diunduh|downloaded)\s+(?:oleh|by)\b/i,
    /\bwatermark\b/i
  ];

  function cleanLine(value){
    return String(value||"")
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function sanitizeQuizSourceText(raw){
    const source=String(raw||"").normalize("NFKC");
    const kept=[];
    for(const part of source.split(/\r?\n/)){
      const line=cleanLine(part);
      if(line.length<2)continue;
      if(identityPatterns.some(pattern=>pattern.test(line)))continue;
      kept.push(line);
    }
    return kept.join("\n")
      .replace(/\n{3,}/g,"\n\n")
      .trim()
      .slice(0,MAX_QUIZ_SOURCE_CHARS);
  }

  function analyzeQuizSourcePages(pageTexts,totalPages){
    const pages=Math.max(0,Number(totalPages)||0);
    const texts=(Array.isArray(pageTexts)?pageTexts:[])
      .map(value=>sanitizeQuizSourceText(value))
      .filter(Boolean);
    const nonEmptyPages=texts.filter(text=>text.length>=80).length;
    const totalChars=texts.reduce((sum,text)=>sum+text.length,0);
    const avgChars=pages?Math.round(totalChars/pages):0;
    const referencePages=texts.filter(text=>
      /(?:^|\n)\s*(?:daftar\s+pustaka|referensi|references|bibliography)\b/i.test(text) ||
      ((text.match(/\b(?:edisi|volume|vol\.|penerbit|publisher|isbn|doi)\b/gi)||[]).length>=3)
    ).length;

    const lines=texts
      .flatMap(text=>text.split(/\n+/))
      .map(cleanLine)
      .filter(line=>line.length>=20);
    const signatures=lines.map(line=>line.toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim());
    const uniqueLines=new Set(signatures).size;
    const uniqueRatio=signatures.length?uniqueLines/signatures.length:0;
    const nonEmptyRatio=pages?nonEmptyPages/pages:0;
    const referenceRatio=nonEmptyPages?referencePages/nonEmptyPages:0;

    let level="ready";
    let reason="ok";
    if(totalChars<800||nonEmptyPages===0){
      level="invalid";
      reason="too_little_text";
    }else if(
      pages<=2 ||
      nonEmptyRatio<0.35 ||
      avgChars<220 ||
      referenceRatio>0.5 ||
      (signatures.length>=12&&uniqueRatio<0.35)
    ){
      level="limited";
      reason=pages<=2
        ?"unusual_page_count"
        :referenceRatio>0.5
          ?"reference_heavy"
          :uniqueRatio<0.35
            ?"repetitive_text"
            :"sparse_content";
    }

    return {
      level,
      reason,
      pageCount:pages,
      nonEmptyPages,
      totalChars,
      avgChars,
      referencePages,
      uniqueRatio:Number(uniqueRatio.toFixed(3))
    };
  }

  async function sha256Hex(text){
    const bytes=new TextEncoder().encode(String(text||""));
    const digest=await crypto.subtle.digest("SHA-256",bytes);
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  }

  async function fingerprintSanitizedText(text){
    const sanitized=sanitizeQuizSourceText(text);
    return {
      sanitizedText:sanitized,
      contentHash:await sha256Hex(sanitized),
      charCount:sanitized.length
    };
  }

  root.BMP_QUIZ_LOCAL=Object.freeze({
    MAX_QUIZ_SOURCE_CHARS,
    sanitizeQuizSourceText,
    analyzeQuizSourcePages,
    sha256Hex,
    fingerprintSanitizedText
  });
})(typeof self!=="undefined"?self:globalThis);
