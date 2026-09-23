import fs from "node:fs";import path from "node:path";
const required=["id","en"];
for(const lang of required){const p=path.join("dist-site",lang,"index.html");if(!fs.existsSync(p))throw new Error("missing "+p);}
const routes=["download","features","how-it-works","faq","sponsor","privacy","terms","security","responsible-use","community","ethics","funding","advertiser-terms","trademark","compatibility","code-of-conduct","architecture","release-notes","third-party-licenses","license"];
for(const lang of required)for(const route of routes){const p=path.join("dist-site",lang,route,"index.html");if(!fs.existsSync(p))throw new Error("missing "+p);}
if(!fs.existsSync(path.join("dist-site","id","investor","index.html")))throw new Error("missing id investor");
if(!fs.existsSync(path.join("dist-site","en","investors","index.html")))throw new Error("missing en investors");
console.log("site validation PASS");