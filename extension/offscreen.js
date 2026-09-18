let worker = null;
let workerPromise = null;
let progressModule = 0;
let progressPage = 0;
let currentModuleKey = null;
let currentPdf = null;
const blobUrls = new Set();

function assertLibraries() {
  if (typeof Tesseract === "undefined") {
    throw new Error("Mesin OCR lokal tidak ditemukan pada paket extension.");
  }
  if (typeof PDFLib === "undefined") {
    throw new Error("Mesin PDF lokal tidak ditemukan pada paket extension.");
  }
}

async function ensureWorker() {
  assertLibraries();
  if (worker) return worker;
  if (workerPromise) return await workerPromise;

  workerPromise = Tesseract.createWorker("ind", 1, {
    workerPath: chrome.runtime.getURL("vendor/worker.min.js"),
    corePath: chrome.runtime.getURL("vendor/core"),
    langPath: chrome.runtime.getURL("vendor/lang"),
    workerBlobURL: false,
    gzip: true,
    logger: m => {
      chrome.runtime.sendMessage({
        type: "OCR_PROGRESS",
        module: progressModule,
        page: progressPage,
        status: m.status || "",
        progress: typeof m.progress === "number" ? m.progress : null
      }).catch(() => {});
    }
  }).then(w => {
    worker = w;
    workerPromise = null;
    return w;
  }).catch(e => {
    workerPromise = null;
    throw e;
  });

  return await workerPromise;
}

function dbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("bmp-terbuka-pdf-cache", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("pdfs")) db.createObjectStore("pdfs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(key, bytes) {
  const db = await dbOpen();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction("pdfs", "readwrite");
    tx.objectStore("pdfs").put(bytes, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { const e = tx.error; db.close(); reject(e); };
  });
}

async function dbGet(key) {
  const db = await dbOpen();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction("pdfs", "readonly");
    const req = tx.objectStore("pdfs").get(key);
    req.onsuccess = () => { const v = req.result; db.close(); resolve(v); };
    req.onerror = () => { const e = req.error; db.close(); reject(e); };
  });
}

async function dbListModules(code) {
  const prefix = `${code}:M`;
  const modules = [];
  const db = await dbOpen();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction("pdfs", "readonly");
    const store = tx.objectStore("pdfs");
    const req = store.openKeyCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return;
      const key = String(cur.key || "");
      if (key.startsWith(prefix)) {
        const moduleNo = Number.parseInt(key.slice(prefix.length), 10);
        if (Number.isInteger(moduleNo) && moduleNo >= 1 && moduleNo <= 99) {
          modules.push(moduleNo);
        }
      }
      cur.continue();
    };
    tx.oncomplete = () => {
      db.close();
      resolve(Array.from(new Set(modules)).sort((a, b) => a - b));
    };
    tx.onerror = () => {
      const e = tx.error;
      db.close();
      reject(e);
    };
  });
}

async function dbClearCode(code) {
  const db = await dbOpen();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction("pdfs", "readwrite");
    const store = tx.objectStore("pdfs");
    const req = store.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return;
      if (String(cur.key).startsWith(`${code}:`)) cur.delete();
      cur.continue();
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { const e = tx.error; db.close(); reject(e); };
  });
}

async function ensureModulePdf(code, moduleNo) {
  const key = `${code}:M${moduleNo}`;
  if (currentModuleKey === key && currentPdf) return;
  currentModuleKey = key;
  currentPdf = await PDFLib.PDFDocument.create();
  currentPdf.setTitle(`${code} M${moduleNo} Searchable OCR`);
  currentPdf.setCreator("BMP Terbuka");
}

async function addOcrPage(code, moduleNo, pageNo, dataUrl) {
  await ensureModulePdf(code, moduleNo);
  progressModule = moduleNo;
  progressPage = pageNo;
  const w = await ensureWorker();

  const res = await w.recognize(
    dataUrl,
    {pdfTitle: `${code} M${moduleNo} Page ${pageNo}`},
    {pdf: true}
  );
  if (!res?.data?.pdf) {
    throw new Error(`OCR tidak menghasilkan PDF untuk Modul ${moduleNo} halaman ${pageNo}.`);
  }

  const pagePdf = await PDFLib.PDFDocument.load(new Uint8Array(res.data.pdf));
  const copied = await currentPdf.copyPages(pagePdf, pagePdf.getPageIndices());
  copied.forEach(p => currentPdf.addPage(p));
}

async function finishModule(code, moduleNo, pages) {
  const key = `${code}:M${moduleNo}`;
  if (currentModuleKey !== key || !currentPdf) {
    throw new Error(`State PDF Modul ${moduleNo} tidak tersedia.`);
  }
  if (currentPdf.getPageCount() !== Number(pages)) {
    throw new Error("Jumlah halaman OCR tidak cocok.");
  }

  const bytes = await currentPdf.save();
  await dbPut(key, bytes);

  const blob = new Blob([bytes], {type: "application/pdf"});
  const url = URL.createObjectURL(blob);
  blobUrls.add(url);

  currentPdf = null;
  currentModuleKey = null;
  return url;
}

async function buildFull(code, lastModule) {
  const out = await PDFLib.PDFDocument.create();
  out.setTitle(`${code} Searchable OCR`);
  out.setCreator("BMP Terbuka");

  for (let m = 1; m <= lastModule; m++) {
    const bytes = await dbGet(`${code}:M${m}`);
    if (!bytes) throw new Error(`PDF Modul ${m} belum tersedia di cache.`);
    const src = await PDFLib.PDFDocument.load(bytes);
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach(p => out.addPage(p));
  }

  const bytes = await out.save();
  const blob = new Blob([bytes], {type: "application/pdf"});
  const url = URL.createObjectURL(blob);
  blobUrls.add(url);
  return url;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target !== "offscreen") return;

  (async () => {
    if (msg.type === "OCR_ENGINE_PROBE") {
      assertLibraries();
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OCR_PREPARE_JOB") {
      assertLibraries();
      const code = String(msg.code || "").toUpperCase();
      currentModuleKey = null;
      currentPdf = null;
      sendResponse({
        ok: true,
        cachedModules: await dbListModules(code)
      });
      return;
    }
    if (msg.type === "OCR_RESET_JOB") {
      assertLibraries();
      await dbClearCode(String(msg.code || "").toUpperCase());
      currentModuleKey = null;
      currentPdf = null;
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OCR_ADD_PAGE") {
      await addOcrPage(msg.code, Number(msg.module), Number(msg.page), msg.dataUrl);
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OCR_FINISH_MODULE") {
      sendResponse({
        ok: true,
        blobUrl: await finishModule(msg.code, Number(msg.module), Number(msg.pages))
      });
      return;
    }
    if (msg.type === "OCR_BUILD_FULL") {
      sendResponse({
        ok: true,
        blobUrl: await buildFull(msg.code, Number(msg.lastModule))
      });
      return;
    }
    if (msg.type === "REVOKE_BLOB_URL") {
      if (blobUrls.has(msg.blobUrl)) {
        URL.revokeObjectURL(msg.blobUrl);
        blobUrls.delete(msg.blobUrl);
      }
      sendResponse({ok: true});
      return;
    }
    sendResponse({ok: false, error: "Pesan OCR tidak dikenal."});
  })().catch(e => {
    sendResponse({ok: false, error: e?.stack || String(e)});
  });
  return true;
});
