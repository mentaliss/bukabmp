let worker = null;
let workerPromise = null;
let activeJobRunId = "";
let progressRunId = "";
let progressModule = 0;
let progressPage = 0;
let currentModuleKey = null;
let currentPdfRunId = "";
let currentPdf = null;
let currentQuizPageText = new Map();
const blobUrls = new Set();
const QUIZ_LOCAL = self.BMP_QUIZ_LOCAL;

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
        runId: progressRunId,
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
    const req = indexedDB.open("bmp-terbuka-pdf-cache", 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("pdfs")) db.createObjectStore("pdfs");
      if (!db.objectStoreNames.contains("quiz_sources")) db.createObjectStore("quiz_sources");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function storedByteView(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

function storedBytesEqual(expected, actual) {
  const a = storedByteView(expected);
  const b = storedByteView(actual);
  if (!a || !b || a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function verifyModuleArtifacts(db, key, bytes, quizSource) {
  const [storedPdf, storedQuiz] = await Promise.all([
    new Promise((resolve, reject) => {
      const tx = db.transaction("pdfs", "readonly");
      const req = tx.objectStore("pdfs").get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    }),
    new Promise((resolve, reject) => {
      const tx = db.transaction("quiz_sources", "readonly");
      const req = tx.objectStore("quiz_sources").get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    })
  ]);

  if (!storedBytesEqual(bytes, storedPdf)) {
    throw new Error("Verifikasi penyimpanan PDF lokal gagal.");
  }
  if (quizSource) {
    if (JSON.stringify(storedQuiz) !== JSON.stringify(quizSource)) {
      throw new Error("Verifikasi source Quiz lokal gagal.");
    }
  } else if (storedQuiz !== undefined) {
    throw new Error("Source Quiz lama masih tersimpan setelah modul diperbarui.");
  }
}

async function dbPutModuleArtifacts(key, bytes, quizSource) {
  const db = await dbOpen();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["pdfs", "quiz_sources"], "readwrite");
      tx.objectStore("pdfs").put(bytes, key);
      if (quizSource) tx.objectStore("quiz_sources").put(quizSource, key);
      else tx.objectStore("quiz_sources").delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Penyimpanan modul dibatalkan."));
    });
    await verifyModuleArtifacts(db, key, bytes, quizSource);
  } finally {
    db.close();
  }
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

async function dbGetQuizSource(key) {
  const db = await dbOpen();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction("quiz_sources", "readonly");
    const req = tx.objectStore("quiz_sources").get(key);
    req.onsuccess = () => { const v = req.result; db.close(); resolve(v || null); };
    req.onerror = () => { const e = req.error; db.close(); reject(e); };
  });
}

async function quizSourceInfo(code, moduleNo, {includeText = false} = {}) {
  const normalized = String(code || "").trim().toUpperCase();
  const mod = Number(moduleNo);
  if (!/^[A-Z0-9_-]{3,32}$/.test(normalized) ||
      !Number.isInteger(mod) || mod < 1 || mod > 99) {
    throw new Error("Identitas modul quiz tidak valid.");
  }
  const key = `${normalized}:M${mod}`;
  const value = await dbGetQuizSource(key);
  if (!value || value.schemaVersion !== 1) {
    return {available: false, contentHash: "", charCount: 0};
  }
  const sanitizedText = String(value.sanitizedText || "");
  const contentHash = String(value.contentHash || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(contentHash)) {
    return {available: false, contentHash: "", charCount: 0};
  }
  const actualHash = await QUIZ_LOCAL.sha256Hex(sanitizedText);
  if (actualHash !== contentHash) {
    throw new Error("Fingerprint source quiz lokal tidak cocok.");
  }
  return {
    available: true,
    contentHash,
    charCount: sanitizedText.length,
    pageCount: Number(value.pageCount || value.quality?.pageCount || 0) || null,
    quality: value.quality && typeof value.quality === "object" ? value.quality : null,
    ...(includeText ? {sanitizedText} : {})
  };
}

function storedBytes(value) {
  if (!value) return 0;
  if (typeof value.byteLength === "number") return value.byteLength;
  if (typeof value.size === "number") return value.size;
  if (typeof value === "string") return new TextEncoder().encode(value).byteLength;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return 0;
  }
}

async function dbStorageInfo(code = "") {
  const normalized = String(code || "").trim().toUpperCase();
  const db = await dbOpen();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(["pdfs", "quiz_sources"], "readonly");
    let totalBytes = 0;
    let pdfCount = 0;
    let codeBytes = 0;
    const modules = [];
    const bytesByCode = {};

    const scan = (storeName, countPdf = false) => {
      const req = tx.objectStore(storeName).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return;
        const key = String(cur.key || "");
        const bytes = storedBytes(cur.value);
        totalBytes += bytes;
        const match = key.match(/^([A-Z0-9_-]{3,32}):M(\d+)$/);
        if (match) {
          const recordCode = match[1];
          bytesByCode[recordCode] = Number(bytesByCode[recordCode] || 0) + bytes;
          if (normalized && recordCode === normalized) {
            codeBytes += bytes;
            if (countPdf) {
              const moduleNo = Number.parseInt(match[2], 10);
              if (Number.isInteger(moduleNo) && moduleNo >= 1 && moduleNo <= 99) {
                modules.push(moduleNo);
              }
            }
          }
        }
        if (countPdf) pdfCount++;
        cur.continue();
      };
    };

    scan("pdfs", true);
    scan("quiz_sources", false);

    tx.oncomplete = () => {
      db.close();
      resolve({
        totalBytes,
        pdfCount,
        bytesByCode,
        codeBytes,
        modules:Array.from(new Set(modules)).sort((a,b)=>a-b)
      });
    };
    tx.onerror = () => {
      const e = tx.error;
      db.close();
      reject(e);
    };
  });
}

async function dbCacheInfo(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return {modules: [], bytes: 0, totalBytes: 0};
  const modules = await dbListModules(normalized);
  let bytes = 0;
  for (const moduleNo of modules) {
    bytes += storedBytes(await dbGet(`${normalized}:M${moduleNo}`));
  }
  return {modules, bytes, totalBytes: bytes};
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
    const tx = db.transaction(["pdfs", "quiz_sources"], "readwrite");
    for (const storeName of ["pdfs", "quiz_sources"]) {
      const store = tx.objectStore(storeName);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return;
        if (String(cur.key).startsWith(`${code}:`)) cur.delete();
        cur.continue();
      };
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { const e = tx.error; db.close(); reject(e); };
  });
}

async function dbClearAll() {
  const db = await dbOpen();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(["pdfs", "quiz_sources"], "readwrite");
    tx.objectStore("pdfs").clear();
    tx.objectStore("quiz_sources").clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { const e = tx.error; db.close(); reject(e); };
  });
}

function ownsActivePdf(runId, key = currentModuleKey) {
  return Boolean(
    runId &&
    runId === activeJobRunId &&
    runId === currentPdfRunId &&
    currentPdf &&
    currentModuleKey === key
  );
}

function clearPdfOwnedBy(runId) {
  if (!runId || currentPdfRunId !== runId) return;
  currentModuleKey = null;
  currentPdfRunId = "";
  currentPdf = null;
  currentQuizPageText = new Map();
}

async function ensureModulePdf(code, moduleNo, runId) {
  const key = `${code}:M${moduleNo}`;
  if (ownsActivePdf(runId, key)) return currentPdf;
  if (!runId || runId !== activeJobRunId) {
    throw new Error("OCR request berasal dari proses lama.");
  }

  const pdf = await PDFLib.PDFDocument.create();
  if (runId !== activeJobRunId) {
    throw new Error("OCR request dibatalkan sebelum state PDF dibuat.");
  }
  pdf.setTitle(`${code} M${moduleNo} Searchable OCR`);
  pdf.setCreator("BMP Terbuka");
  currentModuleKey = key;
  currentPdfRunId = runId;
  currentPdf = pdf;
  currentQuizPageText = new Map();
  return pdf;
}

async function addOcrPage(code, moduleNo, pageNo, dataUrl, runId) {
  if (!runId || runId !== activeJobRunId) {
    throw new Error("OCR request berasal dari proses lama.");
  }
  const key = `${code}:M${moduleNo}`;
  const pdf = await ensureModulePdf(code, moduleNo, runId);
  if (!ownsActivePdf(runId, key) || currentPdf !== pdf) {
    throw new Error("State OCR berubah sebelum halaman diproses.");
  }

  progressRunId = runId;
  progressModule = moduleNo;
  progressPage = pageNo;
  const w = await ensureWorker();
  if (!ownsActivePdf(runId, key) || currentPdf !== pdf) {
    throw new Error("OCR request dibatalkan sebelum recognition dimulai.");
  }

  const res = await w.recognize(
    dataUrl,
    {pdfTitle: `${code} M${moduleNo} Page ${pageNo}`},
    {pdf: true}
  );
  if (!ownsActivePdf(runId, key) || currentPdf !== pdf) {
    throw new Error("OCR request dibatalkan karena proses baru sudah dimulai.");
  }
  if (!res?.data?.pdf) {
    throw new Error(`OCR tidak menghasilkan PDF untuk Modul ${moduleNo} halaman ${pageNo}.`);
  }

  const pagePdf = await PDFLib.PDFDocument.load(new Uint8Array(res.data.pdf));
  if (!ownsActivePdf(runId, key) || currentPdf !== pdf) {
    throw new Error("OCR request dibatalkan saat PDF halaman disiapkan.");
  }
  const copied = await pdf.copyPages(pagePdf, pagePdf.getPageIndices());
  if (!ownsActivePdf(runId, key) || currentPdf !== pdf) {
    throw new Error("OCR request dibatalkan sebelum halaman digabungkan.");
  }
  copied.forEach(p => pdf.addPage(p));

  // Raw OCR text stays inside this local offscreen context. Only sanitized
  // page text is retained for the optional Quiz V0 source cache.
  const sanitizedPage = QUIZ_LOCAL.sanitizeQuizSourceText(
    String(res?.data?.text || "")
  );
  currentQuizPageText.set(Number(pageNo), sanitizedPage);
  return sanitizedPage;
}

async function finishModule(code, moduleNo, pages, runId) {
  const key = `${code}:M${moduleNo}`;
  if (!ownsActivePdf(runId, key)) {
    throw new Error("Finalisasi modul berasal dari proses lama.");
  }
  const pdf = currentPdf;
  if (pdf.getPageCount() !== Number(pages)) {
    throw new Error("Jumlah halaman OCR tidak cocok.");
  }

  const bytes = await pdf.save();
  if (!ownsActivePdf(runId, key) || currentPdf !== pdf) {
    throw new Error("Finalisasi modul dibatalkan karena proses sudah berubah.");
  }

  const sanitizedText = [...currentQuizPageText.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, text]) => String(text || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, QUIZ_LOCAL.MAX_QUIZ_SOURCE_CHARS);
  const quizPageTexts = [...currentQuizPageText.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, text]) => String(text || "").trim());
  const quality = QUIZ_LOCAL.analyzeQuizSourcePages(quizPageTexts, Number(pages));
  const quizSource = sanitizedText
    ? {
        schemaVersion: 1,
        sanitizedText,
        contentHash: await QUIZ_LOCAL.sha256Hex(sanitizedText),
        charCount: sanitizedText.length,
        pageCount: Number(pages),
        quality,
        createdAt: Date.now()
      }
    : null;

  // PDF + sanitized quiz source are committed locally in one IndexedDB
  // transaction. No raw OCR text or page image is persisted for Quiz V0.
  await dbPutModuleArtifacts(key, bytes, quizSource);
  if (!ownsActivePdf(runId, key) || currentPdf !== pdf) {
    throw new Error("Finalisasi modul selesai setelah proses dibatalkan.");
  }

  const blob = new Blob([bytes], {type: "application/pdf"});
  const url = URL.createObjectURL(blob);
  blobUrls.add(url);

  clearPdfOwnedBy(runId);
  return url;
}

async function cachedPdfBlobUrl(code, moduleNo) {
  const bytes = await dbGet(`${code}:M${moduleNo}`);
  if (!bytes) throw new Error(`PDF Modul ${moduleNo} belum tersedia di penyimpanan lokal.`);
  const blob = new Blob([bytes], {type: "application/pdf"});
  const url = URL.createObjectURL(blob);
  blobUrls.add(url);
  return url;
}

async function buildRange(code, firstModule, lastModule) {
  if (!Number.isInteger(firstModule) || !Number.isInteger(lastModule) ||
      firstModule < 1 || lastModule < firstModule || lastModule > 99) {
    throw new Error("Rentang PDF gabungan tidak valid.");
  }

  const out = await PDFLib.PDFDocument.create();
  out.setTitle(
    firstModule === 1
      ? `${code} Searchable OCR`
      : `${code} M${firstModule}-M${lastModule} Searchable OCR`
  );
  out.setCreator("BMP Terbuka");

  for (let m = firstModule; m <= lastModule; m++) {
    const bytes = await dbGet(`${code}:M${m}`);
    if (!bytes) throw new Error(`PDF Modul ${m} belum tersedia di penyimpanan lokal.`);
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

async function buildFull(code, lastModule) {
  return await buildRange(code, 1, lastModule);
}

function reviewerSampleDataUrl() {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 900;
  const ctx = canvas.getContext("2d", {alpha: false});
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111111";
  ctx.textBaseline = "top";
  ctx.font = "700 60px Arial, sans-serif";
  ctx.fillText("BMP Terbuka — Store Review Sample", 90, 100);
  ctx.font = "46px Arial, sans-serif";
  const lines = [
    "OCR berjalan sepenuhnya di perangkat pengguna.",
    "Halaman sampel ini dibundel di dalam extension.",
    "Tidak ada dokumen, password, cookie, atau sesi sumber yang dikirim.",
    "Hasil pengujian adalah PDF yang dapat dicari."
  ];
  lines.forEach((line, index) => ctx.fillText(line, 90, 240 + index * 105));
  ctx.font = "32px Arial, sans-serif";
  ctx.fillText("Review fixture • bukan materi BMP asli", 90, 720);
  return canvas.toDataURL("image/png");
}

async function runReviewerSample() {
  // Use an internal cache namespace that can never collide with a user BMP code
  // (public BMP codes reject "@").
  const code = "@BMP-REVIEW-FIXTURE";
  const moduleNo = 1;
  const runId = "review:" + crypto.randomUUID();
  activeJobRunId = runId;
  currentModuleKey = null;
  currentPdfRunId = "";
  currentPdf = null;
  try {
    const text = await addOcrPage(code, moduleNo, 1, reviewerSampleDataUrl(), runId);
    const blobUrl = await finishModule(code, moduleNo, 1, runId);
    await dbClearCode(code);
    return {blobUrl, text};
  } catch (e) {
    clearPdfOwnedBy(runId);
    await dbClearCode(code).catch(() => {});
    throw e;
  } finally {
    clearPdfOwnedBy(runId);
    if (activeJobRunId === runId) activeJobRunId = "";
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target !== "offscreen") return;

  (async () => {
    if (msg.type === "OCR_ENGINE_PROBE") {
      assertLibraries();
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OCR_CANCEL_JOB") {
      const runId = String(msg.runId || "");
      if (runId && activeJobRunId === runId) {
        activeJobRunId = "";
        progressRunId = "";
        clearPdfOwnedBy(runId);
      }
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OCR_REVIEW_SAMPLE") {
      assertLibraries();
      const out = await runReviewerSample();
      sendResponse({ok: true, ...out});
      return;
    }
    if (msg.type === "OCR_PREPARE_JOB") {
      assertLibraries();
      const runId = String(msg.runId || "");
      if (!runId) throw new Error("runId OCR tidak tersedia.");
      const code = String(msg.code || "").toUpperCase();
      activeJobRunId = runId;
      currentModuleKey = null;
      currentPdfRunId = "";
      currentPdf = null;
      currentQuizPageText = new Map();
      sendResponse({
        ok: true,
        cachedModules: await dbListModules(code)
      });
      return;
    }
    if (msg.type === "OCR_CACHE_INFO") {
      const info = await dbCacheInfo(String(msg.code || "").toUpperCase());
      sendResponse({ok: true, ...info});
      return;
    }
    if (msg.type === "OCR_STORAGE_INFO") {
      const info = await dbStorageInfo();
      sendResponse({ok: true, ...info});
      return;
    }
    if (msg.type === "OCR_CACHE_SNAPSHOT") {
      const info = await dbStorageInfo(String(msg.code || "").toUpperCase());
      sendResponse({ok: true, ...info});
      return;
    }
    if (msg.type === "OCR_QUIZ_SOURCE_INFO") {
      const info = await quizSourceInfo(
        String(msg.code || "").toUpperCase(),
        Number(msg.module),
        {includeText: false}
      );
      sendResponse({ok: true, ...info});
      return;
    }
    if (msg.type === "OCR_GET_QUIZ_SOURCE") {
      const info = await quizSourceInfo(
        String(msg.code || "").toUpperCase(),
        Number(msg.module),
        {includeText: true}
      );
      sendResponse({ok: true, ...info});
      return;
    }
    if (msg.type === "OCR_RESET_JOB") {
      assertLibraries();
      await dbClearCode(String(msg.code || "").toUpperCase());
      const oldRunId = activeJobRunId;
      activeJobRunId = "";
      progressRunId = "";
      clearPdfOwnedBy(oldRunId);
      currentModuleKey = null;
      currentPdfRunId = "";
      currentPdf = null;
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OCR_CLEAR_CODE") {
      assertLibraries();
      const code = String(msg.code || "").toUpperCase();
      await dbClearCode(code);
      if (currentModuleKey && currentModuleKey.startsWith(code + ":M")) {
        const oldRunId = activeJobRunId;
        activeJobRunId = "";
        progressRunId = "";
        clearPdfOwnedBy(oldRunId);
        currentModuleKey = null;
        currentPdfRunId = "";
        currentPdf = null;
      }
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OCR_CLEAR_ALL") {
      assertLibraries();
      await dbClearAll();
      const oldRunId = activeJobRunId;
      activeJobRunId = "";
      progressRunId = "";
      clearPdfOwnedBy(oldRunId);
      currentModuleKey = null;
      currentPdfRunId = "";
      currentPdf = null;
      currentQuizPageText = new Map();
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OCR_ADD_PAGE") {
      await addOcrPage(
        msg.code,
        Number(msg.module),
        Number(msg.page),
        msg.dataUrl,
        String(msg.runId || "")
      );
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OCR_FINISH_MODULE") {
      sendResponse({
        ok: true,
        blobUrl: await finishModule(
          msg.code,
          Number(msg.module),
          Number(msg.pages),
          String(msg.runId || "")
        )
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
    if (msg.type === "OCR_BUILD_RANGE") {
      sendResponse({
        ok: true,
        blobUrl: await buildRange(
          msg.code,
          Number(msg.firstModule),
          Number(msg.lastModule)
        )
      });
      return;
    }
    if (msg.type === "OCR_EXPORT_CACHED_MODULE") {
      sendResponse({
        ok: true,
        blobUrl: await cachedPdfBlobUrl(msg.code, Number(msg.module))
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
